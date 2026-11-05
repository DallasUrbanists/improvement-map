import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const [task = 'interactions', ...args] = process.argv.slice(2);
const commands = {
  interactions: ['scripts/playwright-task.js', 'storybook'],
  watch: ['scripts/playwright-task.js', 'storybook-watch'],
  widget: ['scripts/playwright-task.js', 'storybook-widget'],
  visual: ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.storybook.config.js'],
  pages: ['scripts/test-storybook-pages.js'],
};
if (!commands[task]) throw Error('Unknown Storybook test task.');
const container = process.env.DEV_CONTAINER === '1' || process.env.DEV_TEST_ISOLATED === '1'
  || (process.platform === 'linux' && existsSync('/.dockerenv'));
// Existing Linux CI already provisions its pinned dependencies/browsers. Local
// developer commands use Docker, avoiding Windows optimizer and browser drift.
const preparedCI = process.env.CI === 'true' && process.platform === 'linux';
function run(command, input) {
  const result = spawnSync(command, input, { cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, STORYBOOK_PUBLIC_EDITING: 'false' } });
  if (result.error) {
    console.error(`${command} failed: ${result.error.message}. Local Storybook tests require Docker and the prepared development image.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!container && !preparedCI) {
  const service = task === 'watch' ? 'component-tests' : 'test';
  const tty = task === 'watch' && process.stdin.isTTY ? [] : ['-T'];
  run('docker', ['compose', 'run', '--rm', '--no-deps', '--pull', 'never', ...tty,
    service, 'node', 'scripts/storybook-tests.js', task, ...args]);
} else {
  // Isolated local test copies intentionally exclude host build output.
  if (container && !preparedCI && (task === 'visual' || task === 'pages')) {
    // npm supplies npm_execpath for the nested app/catalog build commands.
    if (task === 'pages') run('npm', ['run', 'build:pages']);
    else run(process.execPath, ['node_modules/storybook/dist/bin/dispatcher.js', 'build', '--disable-telemetry']);
  }
  run(process.execPath, [...commands[task], ...args]);
}
