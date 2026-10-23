import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const { files } = JSON.parse(readFileSync('test-results/storybook/selection.json', 'utf8'));
if (!files.length) { console.log('No affected Storybook tests.'); process.exit(0); }
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.storybook.config.js', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
