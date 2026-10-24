import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
const runner = path.join(root, 'scripts/test-suite.js');
const matrixScript = path.join(root, 'scripts/ci-test-matrix.js');
const mergerScript = path.join(root, 'scripts/merge-test-reports.js');

function list(args, env = {}) {
  const result = spawnSync(process.execPath, [cli, 'test', ...args, '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function suiteList(id, args = [], env = {}) {
  const result = spawnSync(process.execPath, [runner, id, ...args, '--list', '--reporter=json'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function cases(report) {
  const values = [];
  for (const suite of report.suites) for (const spec of suite.specs) for (const entry of spec.tests) {
    values.push(`${entry.projectName}|${suite.file.replaceAll('\\', '/')}|${spec.title}`);
  }
  return values.sort();
}

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=Suite Tests', '-c', 'user.email=suite-tests@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
}

async function tempRepo(t) {
  const fixtures = path.join(root, 'test-results/suite-migration/repos');
  await mkdir(fixtures, { recursive: true });
  const directory = await mkdtemp(path.join(fixtures, 'playwright-suite-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  git(directory, ['init', '-q']);
  await mkdir(path.join(directory, 'scripts'), { recursive: true });
  await mkdir(path.join(directory, 'src/components'), { recursive: true });
  await mkdir(path.join(directory, 'tests/ux'), { recursive: true });
  await cp(path.join(root, 'scripts/ci-test-matrix.js'), path.join(directory, 'scripts/ci-test-matrix.js'));
  await writeFile(path.join(directory, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(path.join(directory, 'src/components/StreetmixPanel.vue'), '<script>export default {}</script>');
  await writeFile(path.join(directory, 'tests/ux/streetmix.spec.js'), "import { test } from '@playwright/test'; test('streetmix', () => {});\n");
  git(directory, ['add', '.']);
  git(directory, ['commit', '-qm', 'base']);
  const base = git(directory, ['rev-parse', 'HEAD']);
  return { directory, base };
}

async function selectForPush(repo, t, mutate) {
  await mutate(repo.directory);
  git(repo.directory, ['add', '-A']);
  git(repo.directory, ['commit', '-qm', 'change']);
  const head = git(repo.directory, ['rev-parse', 'HEAD']);
  const eventPath = path.join(path.dirname(repo.directory), `event-${path.basename(repo.directory)}.json`);
  await writeFile(eventPath, JSON.stringify({ before: repo.base, after: head }));
  const result = spawnSync(process.execPath, [matrixScript], {
    cwd: repo.directory,
    encoding: 'utf8',
    // This fixture consumes stdout JSON even when its parent is a GitHub job.
    env: { ...process.env, GITHUB_OUTPUT: '', GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_PATH: eventPath, GITHUB_SHA: head },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('routine UX suite selectors partition the existing device/theme matrix exactly once', () => {
  const before = list(['--config=playwright.ux.config.js']);
  const after = ['ux-browse', 'ux-submit', 'ux-saved', 'ux-navigation', 'ux-motion', 'ux-content', 'ux-actions', 'ux-streetmix', 'ux-presentation'].flatMap(id => cases(suiteList(id)));
  assert.deepEqual(after.sort(), cases(before));
  // The staging-origin link assertion adds one case on each routine profile.
  assert.equal(after.length, 328);
});

test('expanded UX selectors retain every expanded device/theme case exactly once', () => {
  const before = list(['--config=playwright.ux.config.js'], { UX_FULL: '1' });
  const after = ['ux-browse', 'ux-submit', 'ux-saved', 'ux-navigation', 'ux-motion', 'ux-content', 'ux-actions', 'ux-streetmix', 'ux-presentation'].flatMap(id => cases(suiteList(id, ['--full'])));
  assert.deepEqual(after.sort(), cases(before));
});

test('regression app, diagram, and browserless unit selectors preserve extended discovery', () => {
  const before = [
    ...cases(list(['--grep-invert', '@critical'])),
    ...cases(list(['--config=playwright.presentation.config.js'], { PRESENTATION_SOCKET_TEST_MODE: 'on' })),
  ].sort();
  const after = ['regression-app', 'regression-diagrams', 'regression-presentation', 'unit']
    .flatMap(id => cases(suiteList(id, [], id === 'regression-presentation' ? { PRESENTATION_SOCKET_TEST_MODE: 'on' } : {})));
  assert.deepEqual(after.sort(), before);
});

test('docs changes select no jobs and a Streetmix spec selects only its suite', async t => {
  const repo = await tempRepo(t);
  const docs = await selectForPush(repo, t, async directory => writeFile(path.join(directory, 'notes.md'), 'Release notes'));
  assert.equal(docs.manifest.rows.length, 0, JSON.stringify(docs.manifest));
  const streetmix = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => writeFile(path.join(directory, 'tests/ux/streetmix.spec.js'), "import { test } from '@playwright/test'; test('streetmix changed', () => {});\n"));
  assert.deepEqual(streetmix.manifest.rows.map(row => row.suite), ['ux-streetmix', 'ux-streetmix']);
});

test('bookmark, diagram, shared fixture, and toolbar snapshot gates stay scoped', async t => {
  const repo = await tempRepo(t);
  const bookmarks = await selectForPush(repo, t, async directory => writeFile(path.join(directory, 'tests/ux/bookmarks.spec.js'), 'test file'));
  assert.deepEqual(bookmarks.manifest.rows.map(row => row.suite), ['ux-saved', 'ux-saved']);
  const diagrams = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => {
    await mkdir(path.join(directory, 'tests'), { recursive: true });
    await writeFile(path.join(directory, 'tests/customDiagram.spec.js'), 'test file');
  });
  assert.deepEqual(diagrams.manifest.rows.map(row => row.suite), ['regression-diagrams']);
  const fixture = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => writeFile(path.join(directory, 'tests/ux/fixture.js'), 'export {}'));
  assert.equal(new Set(fixture.manifest.rows.map(row => row.suite)).size, 9);
  const snapshot = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => {
    const file = path.join(directory, 'tests/ux/snapshots/win32/android-light/toolbar.png');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'snapshot');
  });
  assert.deepEqual(snapshot.manifest.rows.map(row => [row.suite, row.profile]), [['ux-browse', 'android']]);
});

test('storybook-only changes do not select application suites', async t => {
  const repo = await tempRepo(t);
  const result = await selectForPush(repo, t, async directory => {
    for (const file of ['src/components/Example.stories.js', 'src/components/GoogleMap.stories.js', '.storybook/preview.js', 'vitest.config.js', 'tests/storybook/catalog.spec.js']) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), 'export {};');
    }
  });
  assert.deepEqual(result.manifest.selectedSuites, []);
  assert.equal(result.manifest.runUnit, false);
});

test('unknown source changes select all suites; common CSS selects all explicitly', async t => {
  const repo = await tempRepo(t);
  const unknown = await selectForPush(repo, t, async directory => {
    await mkdir(path.join(directory, 'src/new'), { recursive: true });
    await writeFile(path.join(directory, 'src/new/unknown.js'), 'export const value = true;');
  });
  assert.equal(unknown.manifest.runUnit, true);
  assert.equal(new Set(unknown.manifest.selectedSuites).size, 13);
  const css = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => writeFile(path.join(directory, 'src/style.css'), 'body { color: black; }'));
  assert.equal(css.manifest.selectedSuites.length, 13);
});

test('renames and deletions keep the prior and new owning test paths in the diff', async t => {
  const repo = await tempRepo(t);
  const renamed = await selectForPush(repo, t, async directory => {
    git(directory, ['mv', 'tests/ux/streetmix.spec.js', 'tests/ux/streetmix-copy.spec.js']);
  });
  assert.ok(renamed.manifest.selectedSuites.includes('ux-streetmix'));
  const removed = await selectForPush({ ...repo, base: git(repo.directory, ['rev-parse', 'HEAD']) }, t, async directory => {
    git(directory, ['rm', 'tests/ux/streetmix-copy.spec.js']);
  });
  assert.ok(removed.manifest.selectedSuites.includes('ux-streetmix'));
});

test('report merger distinguishes complete, missing, and empty planned reports', async t => {
  const fixtures = path.join(root, 'test-results/suite-migration/repos');
  await mkdir(fixtures, { recursive: true });
  const directory = await mkdtemp(path.join(fixtures, 'playwright-report-merge-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const downloaded = path.join(directory, 'downloaded');
  const artifact = path.join(downloaded, 'advisory-ux-streetmix-android-attempt1', 'test-results', 'ux-streetmix-android');
  await mkdir(artifact, { recursive: true });
  await writeFile(path.join(artifact, 'ux-summary.json'), JSON.stringify({ suite: 'ux-streetmix', status: 'passed', coverage: [{ audited: ['streetmix-home'] }] }));
  await writeFile(path.join(artifact, 'timing.json'), JSON.stringify({ suite: 'ux-streetmix', profile: 'android', testExit: 0 }));
  const reportRoot = path.join(directory, 'combined');
  const planned = { rows: [{ suite: 'ux-streetmix', kind: 'ux', profile: 'android', artifact: 'ux-streetmix-android' }], runUnit: false };
  const merge = plan => spawnSync(process.execPath, [mergerScript, downloaded, path.join(directory, 'html'), reportRoot], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PLANNED_MATRIX: JSON.stringify(plan) },
  });
  const complete = merge(planned);
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(JSON.parse(await readFile(path.join(reportRoot, 'combined-ux-summary.json'), 'utf8')).status, 'passed');
  const incomplete = merge({ rows: [{ ...planned.rows[0], artifact: 'missing-suite' }], runUnit: false });
  assert.equal(incomplete.status, 1, incomplete.stderr);
  assert.equal(JSON.parse(await readFile(path.join(reportRoot, 'combined-ux-summary.json'), 'utf8')).status, 'incomplete');
  const empty = merge({ rows: [], runUnit: false });
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(JSON.parse(await readFile(path.join(reportRoot, 'combined-ux-summary.json'), 'utf8')).status, 'no-tests-selected');
});
