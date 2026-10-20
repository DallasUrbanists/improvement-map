import { spawnSync } from 'node:child_process';

const [type, slug, ...extraArgs] = process.argv.slice(2);
const branchTypes = new Set([
  'feature',
  'fix',
  'hotfix',
  'release',
  'refactor',
  'docs',
  'test',
  'chore',
]);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

if (!branchTypes.has(type) || !slug || extraArgs.length || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Usage: npm run start:<type> -- <lowercase-kebab-slug>`);
  console.error(`Types: ${[...branchTypes].join(', ')}`);
  process.exit(1);
}

const ghCheck = run('gh', ['auth', 'status']);
if (ghCheck.error?.code === 'ENOENT') {
  console.error('GitHub CLI (gh) is not installed or is not on PATH. Install it before creating a branch.');
  process.exit(1);
}

if (ghCheck.status !== 0) {
  const login = run('gh', ['auth', 'login']);
  if (login.status !== 0) process.exit(login.status ?? 1);

  const verify = run('gh', ['auth', 'status']);
  if (verify.status !== 0) {
    console.error('GitHub CLI authentication could not be verified.');
    process.exit(1);
  }
}

const branch = `${type}/${slug}`;
for (const ref of [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`]) {
  const existing = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], { stdio: 'ignore' });
  if (existing.status === 0) {
    console.error(`Branch already exists: ${branch}`);
    process.exit(1);
  }
  if (existing.status !== 1) {
    console.error('Could not inspect Git branches. Run this command from a Git repository.');
    process.exit(existing.status ?? 1);
  }
}

const result = run('git', ['switch', '-c', branch]);
process.exit(result.status ?? 1);
