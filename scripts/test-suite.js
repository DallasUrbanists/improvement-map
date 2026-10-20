import { spawnSync } from 'node:child_process';
import { filesForSuite, suiteById, routineProfiles, fullProfiles } from './playwright-suites.js';

const [id, ...inputArgs] = process.argv.slice(2);
if (!id || !suiteById[id]) {
  console.error(`Usage: npm run test:suite -- <${Object.keys(suiteById).join('|')}> [Playwright options]`);
  process.exit(2);
}

const suite = suiteById[id];
const full = inputArgs.includes('--full') || inputArgs.some(arg => /--project=(narrow|landscape|desktop)-/.test(arg));
const args = inputArgs.filter(arg => arg !== '--full');
const requestedProjects = args.filter(arg => arg.startsWith('--project=')).map(arg => arg.slice('--project='.length));
const playwrightOptions = args.filter(arg => !arg.startsWith('--project='));
let projects;

if (suite.kind === 'ux') {
  const available = Object.values(full ? fullProfiles : routineProfiles).flat();
  if (requestedProjects.some(project => !available.includes(project))) {
    console.error(`Unsupported project for ${id}. Choose: ${available.join(', ')}`);
    process.exit(2);
  }
  projects = requestedProjects.length ? requestedProjects : Object.values(full ? fullProfiles : routineProfiles).flat();
  process.env.UX_FULL = full ? '1' : '0';
  process.env.UX_SUITE = id;
  process.env.UX_EXPECTED_STATES = JSON.stringify(suite.states);
} else if (suite.kind === 'unit') {
  if (requestedProjects.some(project => project !== 'unit')) {
    console.error('The unit suite only supports --project=unit.');
    process.exit(2);
  }
  projects = ['unit'];
} else {
  const allowed = ['chromium', 'Mobile Chrome'];
  if (requestedProjects.some(project => !allowed.includes(project))) {
    console.error(`Unsupported regression project. Choose: ${allowed.join(', ')}`);
    process.exit(2);
  }
  projects = requestedProjects.length ? requestedProjects : allowed;
}

const config = suite.kind === 'ux' ? 'playwright.ux.config.js' : 'playwright.config.js';
const cli = ['node_modules/@playwright/test/cli.js', 'test', `--config=${config}`];
if (suite.kind === 'unit') cli.push('--project=unit', '--grep', '@unit');
else {
  for (const project of projects) cli.push(`--project=${project}`);
  if (suite.kind === 'regression') cli.push('--grep-invert', '@critical');
}
if (suite.kind === 'ux' && process.env.CI) cli.push('--workers=4');
if (process.env.CI) {
  process.env.PLAYWRIGHT_OUTPUT_DIR ||= `test-results/${id}`;
  process.env.UX_REPORT_DIR ||= `test-results/${id}`;
  process.env.PLAYWRIGHT_BLOB_DIR ||= `blob-report/${id}`;
}
for (const file of filesForSuite(id)) cli.push(file);
cli.push(...playwrightOptions);

const result = spawnSync(process.execPath, cli, { stdio: 'inherit', env: process.env });
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.status ?? 1;
}
