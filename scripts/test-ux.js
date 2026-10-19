import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const full = args.includes('--full');
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test',
  '--config=playwright.ux.config.js', ...args.filter(arg => arg !== '--full')], {
  stdio: 'inherit', env: { ...process.env, UX_FULL: full ? '1' : '0' },
});
process.exit(result.status ?? 1);
