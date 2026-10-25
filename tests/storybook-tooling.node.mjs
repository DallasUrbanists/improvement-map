import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { selectStories, parseDiffPaths } from '../scripts/storybook-selection.js';
async function fixture(t) {
  await mkdir('test-results/storybook/selector', { recursive: true });
  const root = await mkdtemp(path.resolve('test-results/storybook/selector/repo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    'src/components/Button.vue': '<template><button /></template>',
    'src/components/Panel.vue': '<script setup>import Button from "./Button.vue";</script>',
    'src/components/Button.stories.js': 'import Button from "./Button.vue";',
    'src/components/Panel.stories.js': 'import Panel from "./Panel.vue";',
    'src/components/Other.stories.js': 'export default {};',
  };
  for (const [file, content] of Object.entries(files)) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), content); }
  return root;
}
test('component changes select stories of all transitive consumers', async t => {
  const root = await fixture(t);
  assert.deepEqual(selectStories(['src/components/Button.vue'], root).files, ['src/components/Button.stories.js', 'src/components/Panel.stories.js']);
});
test('story-only and documentation-only changes avoid unrelated tests', async t => {
  const root = await fixture(t);
  assert.deepEqual(selectStories(['src/components/Other.stories.js'], root).files, ['src/components/Other.stories.js']);
  assert.deepEqual(selectStories(['README.md', 'docs/storybook.md'], root).files, []);
});
test('styles, fonts, lockfile and configuration invalidate every story', async t => {
  const root = await fixture(t);
  for (const file of ['src/style.css', 'public/fonts/roboto.woff2', 'package-lock.json', '.storybook/preview.js', 'dev/browser/mapsLoader.js', 'scripts/local-development/vite-plugin.js', 'Dockerfile', 'compose.yaml', '.dockerignore']) {
    // A shared adapter plus a component edit must still select the entire catalog.
    assert.equal(selectStories([file, 'src/components/Other.stories.js'], root).files.length, 3, file);
  }
});
test('unknown source, deleted stories, unresolved imports and dynamic imports fall back safely', async t => {
  const root = await fixture(t);
  assert.equal(selectStories(['src/New.vue'], root).all, true);
  assert.equal(selectStories(['src/components/Old.stories.js'], root).all, true);
  await writeFile(path.join(root, 'src/components/Panel.vue'), 'import Missing from "./Missing.vue";');
  assert.equal(selectStories(['src/components/Button.vue'], root).all, true);
  await writeFile(path.join(root, 'src/components/Panel.vue'), 'const load = name => import(name);');
  assert.equal(selectStories(['src/components/Button.vue'], root).all, true);
});
test('NUL diff parsing preserves both paths of renames and deleted paths', () => {
  assert.deepEqual(parseDiffPaths('R100\0src/Old.vue\0src/New.vue\0D\0src/Deleted.vue\0'), ['src/Old.vue', 'src/New.vue', 'src/Deleted.vue']);
});
