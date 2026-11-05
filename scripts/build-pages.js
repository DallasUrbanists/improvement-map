import { spawnSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error('Run with npm run build:pages');
// App builds first. Storybook is copied afterward so Workbox never precaches it.
for (const script of ['build', 'build:storybook']) {
  const result = spawnSync(process.execPath, [npmCli, 'run', script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!existsSync('storybook-static/iframe.html')) throw Error('Storybook output is incomplete');
cpSync('storybook-static', path.resolve('dist/storybook'), { recursive: true });
console.log('Distribution artifact contains the app and /storybook/ from the same commit.');
