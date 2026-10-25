import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

export function release(args, { run = spawnSync, npmCli = process.env.npm_execpath } = {}) {
  const [increment, ...extraArgs] = args;
  if (!['major', 'minor', 'patch'].includes(increment) || extraArgs.length) {
    console.error('Usage: npm run release -- <major|minor|patch>');
    return 2;
  }

  const steps = [
    // Enforce the branch even when npm lifecycle scripts have been disabled.
    [process.execPath, [fileURLToPath(new URL('./assert-main.js', import.meta.url))]],
    npmCli
      ? [process.execPath, [npmCli, 'version', increment]]
      : ['npm', ['version', increment], { shell: process.platform === 'win32' }],
    ['git', ['push', 'origin', 'main', '--tags']],
  ];
  for (const [command, commandArgs, options] of steps) {
    const result = run(command, commandArgs, { stdio: 'inherit', ...options });
    if (result.error) console.error(result.error.message);
    if (result.error || result.status !== 0) return result.status || 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = release(process.argv.slice(2));
}
