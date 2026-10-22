import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';

const [type, slug, issueNumberArg, ...extraArgs] = process.argv.slice(2);
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

function runCaptured(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
}

function usage() {
  console.error('Usage: npm run start:<type> -- <lowercase-kebab-slug> [issue-number]');
  console.error('Omit issue-number to enter one interactively or create a new issue.');
  console.error(`Types: ${[...branchTypes].join(', ')}`);
}

function assertBranchDoesNotExist(branchName) {
  for (const ref of [`refs/heads/${branchName}`, `refs/remotes/origin/${branchName}`]) {
    const existing = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], { stdio: 'ignore' });
    if (existing.status === 0) throw new Error(`Branch already exists: ${branchName}`);
    if (existing.status !== 1) throw new Error('Could not inspect Git branches. Run this command from inside a Git repository.');
  }
}

async function ask(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(question)).trim();
  } finally {
    prompt.close();
  }
}

async function createIssue(issueType) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Creating an issue requires an interactive terminal.');
  }
  const title = await ask('New issue title: ');
  if (!title) throw new Error('Issue title cannot be empty.');
  const body = await ask('Issue description (optional): ');
  const args = ['issue', 'create', '--title', title, '--body', body];
  if (issueType) args.push('--type', issueType);
  const result = runCaptured('gh', args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) throw new Error('GitHub issue creation failed.');
  const match = result.stdout.match(/\/issues\/(\d+)/);
  if (!match) throw new Error('Issue was created, but its number could not be read from GitHub CLI output.');
  return match[1];
}

async function main() {
  if (!branchTypes.has(type) || !slug || extraArgs.length
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      || (issueNumberArg && !/^\d+$/.test(issueNumberArg))) {
    usage();
    process.exit(1);
  }

  const ghCheck = run('gh', ['auth', 'status']);
  if (ghCheck.error?.code === 'ENOENT') {
    throw new Error('GitHub CLI (gh) is not installed or is not on PATH. Install it before creating a branch.');
  }

  if (ghCheck.status !== 0) {
    const login = run('gh', ['auth', 'login']);
    if (login.status !== 0) process.exit(login.status ?? 1);
    const verify = run('gh', ['auth', 'status']);
    if (verify.status !== 0) throw new Error('GitHub CLI authentication could not be verified.');
  }

  let issueNumber = issueNumberArg;
  if (!issueNumber) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('Run from an interactive terminal to enter an issue number.');
    }
    issueNumber = await ask('GitHub issue number (press Enter to create one): ');
    if (!issueNumber) {
      const issueType = type === 'feature' ? 'Feature' : type === 'refactor' ? 'Task' : undefined;
      issueNumber = await createIssue(issueType);
    }
    if (!/^\d+$/.test(issueNumber)) throw new Error('Issue number must contain digits only.');
  }

  const issueCheck = run('gh', ['issue', 'view', issueNumber, '--json', 'number']);
  if (issueCheck.status !== 0) throw new Error(`Could not access issue #${issueNumber}.`);

  if (type === 'feature') {
    const labelResult = run('gh', ['issue', 'edit', issueNumber, '--add-label', 'enhancement']);
    if (labelResult.status !== 0) throw new Error(`Could not add the enhancement label to issue #${issueNumber}.`);
  }

  if (type === 'refactor') {
    const labelResult = run('gh', ['issue', 'edit', issueNumber, '--add-label', 'refactor']);
    if (labelResult.status !== 0) throw new Error(`Could not add the refactor label to issue #${issueNumber}.`);
  }

  const branch = `${type}/${issueNumber}-${slug}`;
  assertBranchDoesNotExist(branch);
  const result = run('gh', ['issue', 'develop', issueNumber, '--base', 'main', '--name', branch, '--checkout']);
  process.exit(result.status ?? 1);
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
