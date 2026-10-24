import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.storybook.config.js', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, STORYBOOK_PAGES: '1' } });
process.exit(result.status ?? 1);
