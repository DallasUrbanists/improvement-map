import test from 'node:test';
import assert from 'node:assert/strict';
import { patchVitestStartup } from '../scripts/storybook-vitest-workaround.js';

const startup = 'this.store.untilReady().then(() => this.vitestManager.startVitest({';
const source = `import {\n  experimental_UniversalStore,\n} from "storybook/internal/core-server";\n${startup}\n  coverage: this.store.getState().config.coverage\n}));`;

test('the backport waits for every IPC follower without changing test settings', () => {
  const result = patchVitestStartup(source, '10.6.3');
  assert.match(result, /Promise\.all\(\[this\.store\.untilReady\(\), internal_universalStatusStore\.untilReady\(\), internal_universalTestProviderStore\.untilReady\(\)\]\)/);
  assert.ok(result.includes('coverage: this.store.getState().config.coverage'));
  assert.equal(patchVitestStartup(result, '10.6.3'), result);
});

test('dependency upgrades and unexpected or duplicated source require review', () => {
  assert.throws(() => patchVitestStartup(source, '10.6.4'), /only supports 10.6.3/);
  assert.throws(() => patchVitestStartup(source.replace(startup, 'changedStartup()'), '10.6.3'), /Unexpected/);
  assert.throws(() => patchVitestStartup(source + startup, '10.6.3'), /Unexpected/);
  const partiallyPatched = patchVitestStartup(source, '10.6.3').replace(
    'Promise.all([this.store.untilReady(), internal_universalStatusStore.untilReady(), internal_universalTestProviderStore.untilReady()]).then(() => this.vitestManager.startVitest({', startup,
  );
  assert.throws(() => patchVitestStartup(partiallyPatched, '10.6.3'), /Unexpected/);
});
