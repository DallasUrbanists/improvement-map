import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [task, ...forwardedArgs] = process.argv.slice(2);
const env = {
  ...process.env,
  // Keep browser downloads with this checkout instead of a sandbox-specific user cache.
  PLAYWRIGHT_BROWSERS_PATH: '0',
};

let executable;
let args;

if (task === 'install') {
  executable = path.join(projectRoot, 'node_modules', 'playwright', 'cli.js');
  args = ['install', ...(forwardedArgs.length ? forwardedArgs : ['chromium'])];
} else if (task === 'storybook') {
  executable = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
  args = ['run', '--config', 'vitest.storybook.config.js', ...forwardedArgs];
} else if (task === 'storybook-watch') {
  executable = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
  args = ['--config', 'vitest.storybook.config.js', ...forwardedArgs];
} else {
  console.error('Usage: node scripts/playwright-task.js <install|storybook|storybook-watch> [args...]');
  process.exit(2);
}

const result = spawnSync(process.execPath, [executable, ...args], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
