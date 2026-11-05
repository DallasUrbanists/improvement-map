import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, mkdirSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const lock = createHash('sha256').update(readFileSync('/workspace/package-lock.json')).digest('hex');
const prepared = readFileSync('/opt/development/dependency-lock.sha256', 'utf8');
if (lock !== prepared) throw Error('Dependencies changed. While online, run docker compose --profile tools build, then recreate the containers.');
let cwd = '/workspace';
if (process.env.DEV_TEST_ISOLATED === '1') {
  console.log('[development] Preparing an isolated test workspace.');
  cwd = mkdtempSync('/tmp/improvement-map-tests-');
  cpSync('/workspace', cwd, { recursive: true, filter: source => !path.basename(source).startsWith('.env') && !['node_modules', 'test-results', 'playwright-report', 'dist', 'storybook-static', '.codex-attachments', '.codex-remote-attachments'].includes(path.basename(source)) });
}
const dependencies = path.join(cwd, 'node_modules');
const stamp = path.join(dependencies, '.development-lock');
const installation = `${prepared}:relative-links-v1`;
if (process.env.DEV_SKIP_DEPENDENCIES === '1') {
  console.log('[development] This service does not need a dependency copy.');
} else if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== installation) {
  console.log('[development] Preparing Linux dependencies. First setup may take several minutes; later starts reuse this copy.');
  mkdirSync(dependencies, { recursive: true });
  // Only this container-owned directory is cleared; the source bind mount is not removed.
  for (const entry of readdirSync(dependencies)) rmSync(path.join(dependencies, entry), { recursive: true, force: true });
  cpSync('/opt/development/node_modules', dependencies, { recursive: true, verbatimSymlinks: true });
  writeFileSync(stamp, installation);
  console.log('[development] Dependencies prepared.');
}
console.log('[development] Starting the service.');
const child = spawn(process.argv[2], process.argv.slice(3), { cwd, stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  if (process.env.DEV_TEST_ISOLATED === '1') {
    for (const directory of ['test-results', 'playwright-report']) {
      if (existsSync(path.join(cwd, directory))) cpSync(path.join(cwd, directory), `/results/local-development/${directory}`, { recursive: true });
    }
  }
  process.exitCode = code ?? 1;
});
