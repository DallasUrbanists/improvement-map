import { spawnSync } from 'node:child_process';

const [branchType] = process.argv.slice(2);
const allowedBranchTypes = new Set(['feature', 'refactor']);
if (!allowedBranchTypes.has(branchType)) {
  console.error('Usage: node scripts/finish-branch.js <feature|refactor>');
  process.exit(2);
}

const command = `npm run finish:${branchType}`;

function run(commandName, args, options = {}) {
  return spawnSync(commandName, args, { stdio: 'inherit', ...options });
}

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli) return run(process.execPath, [npmCli, ...args]);
  return run('npm', args, { shell: process.platform === 'win32' });
}

function gitOutput(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

function runSuite(id) {
  const project = id === 'unit' ? 'unit' : id.startsWith('ux-') ? 'android-light' : 'chromium';
  console.log(`\nRunning ${id} (${project})...`);
  return runNpm(['run', 'test:suite', '--', id, `--project=${project}`]);
}

const branchResult = gitOutput(['branch', '--show-current']);
if (branchResult.status !== 0) {
  console.error('Could not determine the current Git branch. Run this from inside the repository.');
  process.exit(branchResult.status ?? 1);
}

const branch = branchResult.stdout.trim();
if (!branch.startsWith(`${branchType}/`)) {
  console.error(`Expected a ${branchType}/* branch, but the current branch is "${branch || '(detached HEAD)'}".`);
  process.exit(1);
}

console.log(`Checking ${branch}...`);
const selection = spawnSync(process.execPath, ['scripts/ci-test-matrix.js', '--local'], { encoding: 'utf8' });
if (selection.status !== 0) {
  console.error(selection.stderr || 'Could not select focused test suites.');
  process.exit(selection.status ?? 1);
}

let manifest;
try {
  manifest = JSON.parse(selection.stdout).manifest;
} catch {
  console.error('The test selector returned invalid output; refusing to skip tests.');
  process.exit(1);
}
if (selection.stderr.trim()) console.warn(selection.stderr.trim());

const selectedSuites = manifest.selectedSuites || [];
if (manifest.diffFallback) console.warn('Test selection fell back to all suites because the change list was uncertain.');
if (selectedSuites.length) {
  console.log(`Selected suites: ${selectedSuites.join(', ')}`);
  for (const id of selectedSuites) {
    const result = runSuite(id);
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
} else {
  console.log('No test suites selected for these documentation-only changes.');
}

if (runNpm(['run', 'build']).status !== 0) process.exit(1);

console.log('\nReviewing tracked changes against the comparison base:');
const diffBase = manifest.mergeBase || manifest.comparisonBase;
if (!diffBase) {
  console.error('Could not determine a comparison base for reviewing the diff.');
  process.exit(1);
}
if (run('git', ['diff', '--check', diffBase]).status !== 0) process.exit(1);
const diff = run('git', ['diff', '--stat', diffBase]);
if (diff.status !== 0) process.exit(diff.status ?? 1);
if (run('git', ['diff', diffBase]).status !== 0) process.exit(1);

console.log('\nUntracked files and working-tree status:');
const workingTree = gitOutput(['status', '--short']);
if (workingTree.status !== 0) {
  console.error(workingTree.stderr || 'Could not inspect the working tree.');
  process.exit(workingTree.status ?? 1);
}
process.stdout.write(workingTree.stdout);
if (workingTree.stdout.trim()) {
  console.log(`\nReview and commit the changes, then rerun \`${command}\` to create the draft PR.`);
  process.exit(0);
}

console.log('\nCreating a draft pull request...');
const pullRequest = run('gh', ['pr', 'create', '--draft', '--fill']);
if (pullRequest.error?.code === 'ENOENT') {
  console.error(`GitHub CLI (gh) is not installed or is not on PATH. Install it, authenticate, then rerun \`${command}\`.`);
  process.exit(1);
}
if (pullRequest.status !== 0) process.exit(pullRequest.status ?? 1);
