import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonBase, gitRefExists } from './branch-policy.js';

const normalize = value => value.replaceAll('\\', '/').replace(/^\.\//, '');
export function discoverStories(root = process.cwd()) {
  const walk = directory => !existsSync(path.join(root, directory)) ? [] : readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(file) : file.endsWith('.stories.js') ? [file] : [];
  });
  return [...walk('src'), ...walk('stories')].sort();
}

/** Conservative static import closure. Unknown/dynamic imports invalidate selection. */
export function selectStories(changedPaths, root = process.cwd()) {
  const stories = discoverStories(root), reasons = [];
  const all = reason => ({ files: stories, all: true, reasons: [reason] });
  if (changedPaths === null) return all('Full, scheduled, release, or unavailable diff');
  const changed = changedPaths.map(normalize);
  if (changed.some(file => /^(?:\.storybook\/|dev\/|public\/|package(?:-lock)?\.json$|vite.*config\.js$|vitest.*config\.js$|playwright\.storybook|scripts\/(?:local-development\/|playwright-task\.js$|storybook|serve-storybook|build-pages)|tests\/storybook\/|\.github\/workflows\/|Dockerfile$|compose\.yaml$|\.dockerignore$)/.test(file) || file === 'src/style.css' || file === 'src/presentation.css' || file === 'index.html')) return all('Shared styles, assets, dependencies, or tooling changed');
  const selected = new Set();
  let uncertain = false;
  for (const story of stories) {
    const seen = new Set(), pending = [story];
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      let source;
      try { source = readFileSync(path.join(root, file), 'utf8'); } catch { uncertain = true; break; }
      // These cannot be resolved reliably by a static import walk.
      if (/import\.meta\.glob|import\s*\(\s*[^'"\s]|require\s*\(/.test(source)) uncertain = true;
      const imports = [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|@import\s*['"]([^'"]+)['"]|\bsrc=['"]([^'"]+)['"]/g)].map(match => match.slice(1).find(Boolean));
      for (const specifier of imports) {
        if (!specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('/src/')) continue;
        const base = specifier.startsWith('@/') ? `src/${specifier.slice(2)}` : specifier.startsWith('/') ? specifier.slice(1) : path.posix.join(path.posix.dirname(file), specifier);
        const resolved = [base, ...['.js', '.mjs', '.vue', '.css', '.json', '/index.js'].map(extension => base + extension)].find(candidate => existsSync(path.join(root, candidate)) && statSync(path.join(root, candidate)).isFile());
        if (resolved) pending.push(resolved); else uncertain = true;
      }
    }
    if (changed.some(file => seen.has(file))) selected.add(story);
  }
  if (uncertain) return all('Unresolved dependency; conservative full selection');
  if (changed.some(file => file.endsWith('.stories.js') && !stories.includes(file))) return all('Story removed or renamed');
  if (!selected.size && changed.some(file => !/^(?:docs\/|\.agents\/|AGENTS\.md$|README\.md$|\.gitignore$)/.test(file) && !file.endsWith('.md'))) return all('Changed source has no known story owner');
  if (selected.size) reasons.push('Selected changed stories and transitive consumers');
  return { files: [...selected].sort(), all: false, reasons };
}

export function parseDiffPaths(output) {
  const fields = output.split('\0'), files = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i++];
    if (!status) continue;
    files.push(fields[i++]);
    if (/^[RC]/.test(status)) files.push(fields[i++]);
  }
  return [...new Set(files.filter(Boolean).map(normalize))];
}
function git(args) { return execFileSync('git', args, { encoding: 'utf8' }).trimEnd(); }
function changedForEvent() {
  const name = process.env.GITHUB_EVENT_NAME;
  if (['workflow_dispatch', 'schedule', 'release'].includes(name)) return null;
  if (!name) {
    const base = comparisonBase({ explicit: process.argv[2], branch: git(['branch', '--show-current']), exists: gitRefExists });
    return [...parseDiffPaths(git(['diff', '--name-status', '--find-renames', '-z', git(['merge-base', base, 'HEAD'])])),
      ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)];
  }
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let base;
  if (name === 'pull_request') base = git(['merge-base', event.pull_request.base.sha, event.pull_request.head.sha]);
  else if (name === 'push' && event.before && !/^0+$/.test(event.before)) base = event.before;
  else return null;
  return parseDiffPaths(git(['diff', '--name-status', '--find-renames', '-z', base, 'HEAD']));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let selection;
  try { selection = selectStories(changedForEvent()); } catch (error) { selection = { ...selectStories(null), reasons: [`Diff fallback: ${error.message}`] }; }
  mkdirSync('test-results/storybook', { recursive: true });
  writeFileSync('test-results/storybook/selection.json', JSON.stringify(selection, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `has-tests=${selection.files.length > 0}\n`);
  console.log(JSON.stringify(selection, null, 2));
}
