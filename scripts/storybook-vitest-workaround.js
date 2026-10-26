import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const originalImports = '  experimental_UniversalStore,';
const patchedImports = '  internal_universalStatusStore,\n  internal_universalTestProviderStore,\n  experimental_UniversalStore,';
const originalStartup = 'this.store.untilReady().then(() => this.vitestManager.startVitest({';
const patchedStartup = 'Promise.all([this.store.untilReady(), internal_universalStatusStore.untilReady(), internal_universalTestProviderStore.untilReady()]).then(() => this.vitestManager.startVitest({';

// Temporary backport of https://github.com/storybookjs/storybook/pull/36068.
// The status/provider followers must synchronize before importing Vitest can
// block their one-second response deadline. Review/remove on dependency upgrade.
export function patchVitestStartup(source, version) {
  if (version !== '10.6.3') throw Error(`Review the Storybook widget workaround for addon-vitest ${version}; it only supports 10.6.3.`);
  if (source.includes(patchedImports) && source.includes(patchedStartup) && !source.includes(originalStartup)) return source;
  if (source.split(originalImports).length !== 2 || source.split(originalStartup).length !== 2 || source.includes(patchedStartup) || source.includes(patchedImports)) {
    throw Error('Unexpected addon-vitest startup source; refusing to apply the Storybook widget workaround.');
  }
  return source.replace(originalImports, patchedImports).replace(originalStartup, patchedStartup);
}

export function applyVitestStartupWorkaround(packageDirectory = path.dirname(require.resolve('@storybook/addon-vitest/package.json'))) {
  const { version } = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  const filename = path.join(packageDirectory, 'dist/node/vitest.js');
  const original = readFileSync(filename, 'utf8');
  const patched = patchVitestStartup(original, version);
  if (patched === original) return false;
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, patched);
  renameSync(temporary, filename);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (applyVitestStartupWorkaround()) console.log('[storybook] Applied addon-vitest 10.6.3 store synchronization workaround.');
}
