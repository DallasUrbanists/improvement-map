import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { comparisonBase as resolveComparisonBase, gitRefExists } from './branch-policy.js';
import { browserSuiteIds, fullProfiles, playwrightImage, suiteById, suites, uxSuiteIds } from './playwright-suites.js';

const localMode = process.argv[2] === '--local';
const outputPath = localMode ? null : process.env.GITHUB_OUTPUT;
const eventPath = localMode ? null : process.env.GITHUB_EVENT_PATH;
const eventName = localMode ? 'local' : process.env.GITHUB_EVENT_NAME;
const event = eventPath ? JSON.parse(readFileSync(eventPath, 'utf8')) : {};
const headSha = localMode ? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() : eventName === 'pull_request' ? event.pull_request?.head?.sha || '' : eventName === 'release'
  ? execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim()
  : process.env.GITHUB_SHA || event.after || '';
const allIds = suites.map(({ id }) => id);
const notes = [];
let snapshotProfiles = new Map();
let onlySnapshotChanges = false;
let comparisonBase;
let mergeBase;
const normalize = value => value.replaceAll('\\', '/').replace(/^\.\//, '');

function pathsBetween(base, head) {
  const output = execFileSync('git', ['diff', '--name-status', '--find-renames', '-z', base, head], { encoding: 'utf8' });
  return parsePaths(output);
}

function parsePaths(output) {
  const fields = output.split('\0');
  const paths = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      paths.push(fields[i++], fields[i++]);
    } else {
      paths.push(fields[i++]);
    }
  }
  return [...new Set(paths.filter(Boolean).map(normalize))];
}

function changedPaths() {
  if (localMode) {
    const baseRef = resolveComparisonBase({
      explicit: process.argv[3],
      branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      exists: gitRefExists,
    });
    comparisonBase = baseRef;
    mergeBase = execFileSync('git', ['merge-base', baseRef, 'HEAD'], { encoding: 'utf8' }).trim();
    const tracked = parsePaths(execFileSync('git', ['diff', '--name-status', '--find-renames', '-z', mergeBase], { encoding: 'utf8' }));
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
      .split('\0').filter(Boolean).map(normalize);
    return [...new Set([...tracked, ...untracked])];
  }
  if (eventName === 'workflow_dispatch' || eventName === 'schedule' || eventName === 'release') return null;
  if (eventName === 'pull_request') {
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    if (!base || !head || /^0+$/.test(base) || /^0+$/.test(head)) throw new Error('PR base/head SHA is absent or zero.');
    return pathsBetween(execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim(), head);
  }
  if (eventName === 'push') {
    const base = event.before;
    if (!base || /^0+$/.test(base) || !headSha || /^0+$/.test(headSha)) throw new Error('Push before/head SHA is absent or zero.');
    return pathsBetween(base, headSha);
  }
  throw new Error(`Unsupported event ${eventName || '(missing)'}`);
}

function localImports(file) {
  const source = readFileSync(file, 'utf8');
  const matches = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g)];
  return matches.map(match => match[1] || match[2] || match[3]).filter(specifier => specifier.startsWith('.') || specifier.startsWith('/src/'));
}

function resolveImport(from, specifier) {
  const base = specifier.startsWith('/') ? specifier.slice(1) : path.posix.join(path.posix.dirname(from), specifier);
  const candidates = path.posix.extname(base) ? [base] : [`${base}.js`, `${base}.mjs`, `${base}.vue`, `${base}.json`, `${base}.css`, `${base}.geojson`, `${base}.svg`, `${base}.png`, path.posix.join(base, 'index.js')];
  for (const candidate of candidates) {
    try { readFileSync(candidate); return candidate; } catch { /* check next Vite-style extension */ }
  }
  return null;
}

function dependencyClosure(roots) {
  const visited = new Set();
  const unresolved = [];
  const pending = [...roots];
  while (pending.length) {
    const file = normalize(pending.pop());
    if (visited.has(file)) continue;
    visited.add(file);
    let imports;
    try { imports = localImports(file); } catch { unresolved.push(file); continue; }
    for (const specifier of imports) {
      const resolved = resolveImport(file, specifier);
      if (resolved) pending.push(resolved);
      else unresolved.push(`${file} -> ${specifier}`);
    }
  }
  return { visited, unresolved };
}

function selectSuites(paths) {
  if (paths === null) return new Set(allIds);
  const selected = new Set();
  const fileOwners = new Map();
  for (const suite of suites) for (const file of suite.files) {
    const owners = fileOwners.get(file) || new Set(); owners.add(suite.id); fileOwners.set(file, owners);
  }
  const closures = new Map(suites.filter(suite => suite.roots.length).map(suite => [suite.id, dependencyClosure(suite.roots)]));
  const allUx = new Set(uxSuiteIds);
  const allConsumers = new Set(allIds);
  snapshotProfiles = new Map();
  onlySnapshotChanges = paths.every(file => file.startsWith('tests/ux/snapshots/') || file.startsWith('docs/') || file.startsWith('.agents/') || file.toLowerCase().endsWith('.md'));

  for (const file of paths) {
    let matched = false;
    if (file === 'package.json' || file === 'package-lock.json' || file.startsWith('playwright') || file === 'vite.config.js' || file === 'vite.ux.config.js' || file.startsWith('.github/workflows/') || file.startsWith('scripts/playwright-suites') || file.startsWith('scripts/test-suite') || file.startsWith('scripts/ci-test-matrix') || file.startsWith('scripts/merge-test-reports') || file === 'scripts/test-ux.js' || file === 'scripts/ux-reporter.js' || file === 'tests/ux/audit.js') {
      for (const id of allConsumers) selected.add(id);
      matched = true;
    }
    const owners = fileOwners.get(file);
    if (owners) { for (const id of owners) selected.add(id); matched = true; }
    if (file.startsWith('tests/ux/snapshots/')) {
      const parts = file.split('/');
      const project = parts[4];
      const profile = project?.replace(/-(light|dark)$/, '');
      const knownProjects = new Set(Object.values(fullProfiles).flat());
      const state = path.posix.basename(file, '.png');
      const ownersForState = suites.filter(suite => suite.kind === 'ux' && suite.states.includes(state)).map(suite => suite.id);
      const owners = state === 'toolbar' ? ['ux-browse'] : ownersForState;
      if (!knownProjects.has(project) || owners.length === 0) {
        for (const id of allUx) selected.add(id);
        notes.push(`Snapshot ownership or profile is unknown; all UX suites selected: ${file}`);
      } else {
        for (const id of owners) {
          selected.add(id);
          const allowed = snapshotProfiles.get(id) || new Set();
          allowed.add(profile);
          snapshotProfiles.set(id, allowed);
        }
      }
      matched = true;
    } else if (file.startsWith('tests/ux/')) {
      if (['tests/ux/fixture.js', 'tests/ux/catalog.js'].includes(file)) for (const id of allUx) selected.add(id);
      else if (!owners) for (const id of allIds) selected.add(id);
      matched = true;
    }
    if (file === 'tests/fixtures/workspaceMaps.js' || file === 'tests/railFixtures.js') {
      for (const id of allIds) selected.add(id);
      matched = true;
    }
    if (file.startsWith('tests/')) {
      for (const suite of suites.filter(suite => suite.kind === 'unit')) {
        // Mixed specs are selected through the test project grep when they contain @unit cases.
        if (file.endsWith('.spec.js') && /tag\s*:\s*['"]@unit['"]/.test(readFileSync(file, 'utf8'))) selected.add(suite.id);
      }
      if (!matched) { for (const id of allIds) selected.add(id); matched = true; }
    }
    if (file.startsWith('src/')) {
      const before = selected.size;
      for (const [id, closure] of closures) if (closure.visited.has(file)) {
        selected.add(id);
        if (closure.unresolved.length) {
          for (const suiteId of allIds) selected.add(suiteId);
          notes.push(`Unresolved dependencies in ${id} selected every suite: ${closure.unresolved.join(', ')}`);
        }
      }
      if (['src/App.vue', 'src/main.js', 'src/router/index.js', 'src/style.css', 'src/components/MapWorkspace.vue', 'src/components/MapTray.vue', 'src/services/api.js', 'src/services/storage.js', 'src/services/firebase.js'].includes(file)) {
        for (const id of allConsumers) selected.add(id);
      }
      if (selected.size === before) for (const id of allIds) selected.add(id);
      matched = true;
    }
    if (file.startsWith('public/')) { for (const id of allUx) selected.add(id); matched = true; }
    if (!matched && !file.startsWith('docs/') && !file.startsWith('.agents/') && !file.toLowerCase().endsWith('.md')) {
      for (const id of allIds) selected.add(id);
      notes.push(`Unmapped changed path selected every suite: ${file}`);
    }
  }
  return selected;
}

let changed;
let selected;
let diffFallback = false;
try {
  changed = changedPaths();
  selected = selectSuites(changed);
} catch (error) {
  if (localMode && !comparisonBase) {
    console.error(error.message);
    process.exit(1);
  }
  diffFallback = true;
  selected = new Set(allIds);
  notes.push(`Diff selection fell back to every suite: ${error.message}`);
}

const full = eventName === 'schedule' || eventName === 'workflow_dispatch' && (event.inputs?.full === true || event.inputs?.full === 'true');
if (eventName === 'schedule') selected = new Set(uxSuiteIds);
const routineNames = new Set(['android', 'iphone']);
const profileNames = full ? Object.keys(fullProfiles) : [...routineNames];
const rows = [];
for (const id of selected) {
  const suite = suiteById[id];
  if (!suite || suite.kind === 'unit') continue;
  const profiles = suite.kind === 'ux' ? (onlySnapshotChanges && snapshotProfiles.has(id) ? [...snapshotProfiles.get(id)] : profileNames)
    : suite.kind === 'presentation' ? ['socket'] : ['regression'];
  for (const profile of profiles) {
    const projects = suite.kind === 'ux' ? fullProfiles[profile]
      : suite.kind === 'presentation' ? ['chromium', 'Mobile Chrome', 'WebKit'] : ['chromium', 'Mobile Chrome'];
    rows.push({ suite: id, kind: suite.kind, profile, projects, artifact: `${id}-${profile}` });
  }
}

const manifest = { event: eventName, headSha, comparisonBase, mergeBase, changedPaths: changed, selectedSuites: [...selected].sort(), runUnit: selected.has('unit'), full, diffFallback, rows, notes };
const outputs = {
  'has-tests': String(selected.size > 0),
  'has-browser-tests': String(rows.length > 0),
  'run-unit': String(selected.has('unit')),
  matrix: JSON.stringify({ include: rows }),
  'selected-sha': headSha || process.env.GITHUB_SHA || '',
  'container-image': playwrightImage,
  manifest: JSON.stringify(manifest),
};
if (outputPath) for (const [key, value] of Object.entries(outputs)) appendFileSync(outputPath, `${key}=${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}\n`);
else process.stdout.write(`${JSON.stringify({ ...outputs, manifest: JSON.parse(outputs.manifest) }, null, 2)}\n`);
for (const note of notes) console.error(note);
