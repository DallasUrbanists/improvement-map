import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hash, identity, git, completePlaywrightReport, completeVitestReport } from './ci-evidence.js';
import { fullProfiles, suiteById } from './playwright-suites.js';

const [suite, profile, base, ...extra] = process.argv.slice(2);
const catalog = suite === 'storybook' && profile === 'catalog';
const definition = suiteById[suite];
const projects = definition?.kind === 'ux' ? fullProfiles[profile]
  : definition?.kind === 'regression' && profile === 'regression' ? ['chromium', 'Mobile Chrome'] : null;
if (extra.length || !/^[a-f0-9]{40}$/.test(base || '') || (!catalog && !Array.isArray(projects))) {
  console.error('Usage: node scripts/local-test-evidence.js <ux-suite> <android|iphone|narrow|landscape|desktop> <PR-base-SHA>\n       node scripts/local-test-evidence.js <regression-suite> regression <PR-base-SHA>\n       node scripts/local-test-evidence.js storybook catalog <PR-base-SHA>');
  process.exit(2);
}
if (process.platform !== 'linux' || !process.env.DEV_TEST_ISOLATED) {
  throw Error('Run in the isolated Compose test container; see docs/ci-evidence.md.');
}
const clean = () => {
  if (git('.', 'status', '--porcelain', '--untracked-files=all')) throw Error('Commit or remove working changes before generating evidence.');
};
clean();
git('.', 'cat-file', '-e', `${base}^{commit}`);
const key = identity('.', { base, suite, profile, projects: projects || [] });
const fingerprint = hash(key);
const directory = `test-results/local-evidence/${suite}-${profile}`;
mkdirSync(directory, { recursive: true });
const env = {
  ...process.env, CI: 'true', UX_STRICT: '1', UX_SCAN: '1', STORYBOOK_SELECTED: '0',
  UX_REPORT_DIR: directory, UX_HTML_DIR: `playwright-report/local-evidence/${suite}-${profile}`,
  PLAYWRIGHT_OUTPUT_DIR: `${directory}/results`, PLAYWRIGHT_BLOB_DIR: `blob-report/local-evidence/${suite}-${profile}`,
};
function run(script, args = [], additions = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', env: { ...env, ...additions } });
  if (result.error || result.status !== 0) throw Error(`No evidence issued: ${script} failed (${result.status}).`);
}
function playwright(script, args, file, ux = false) {
  const phase = file.split('/').at(-1).replace(/\.json$/, '');
  run(script, [...args, `--reporter=list,json,html,blob${ux ? ',./scripts/ux-reporter.js' : ''}`], {
    PLAYWRIGHT_JSON_OUTPUT_FILE: file, PLAYWRIGHT_HTML_OUTPUT_DIR: `${env.UX_HTML_DIR}/${phase}`,
    PLAYWRIGHT_OUTPUT_DIR: `${directory}/${phase}-artifacts`,
    PLAYWRIGHT_BLOB_DIR: `${env.PLAYWRIGHT_BLOB_DIR}/${phase}`,
  });
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (!completePlaywrightReport(report)) {
    throw Error('No evidence issued: require nonempty passing tests, with no skips, failures, or flaky results.');
  }
  return report.stats;
}
const reports = [];
if (catalog) {
  run('--test', ['tests/storybook-tooling.node.mjs']);
  run('--test', ['--test-name-pattern=storybook', 'tests/ci-suites.node.mjs']);
  const build = spawnSync('npm', ['run', 'build:pages'], { stdio: 'inherit', env });
  if (build.error || build.status !== 0) throw Error('No evidence issued: catalog build failed.');
  run('node_modules/vitest/vitest.mjs', ['run', '--config', 'vitest.storybook.config.js', '--reporter=default', '--reporter=json', `--outputFile=${directory}/interactions.json`]);
  const interactions = JSON.parse(readFileSync(`${directory}/interactions.json`, 'utf8'));
  if (!completeVitestReport(interactions)) {
    throw Error('No evidence issued: interaction tests must pass without skips.');
  }
  reports.push({ interactions: interactions.numPassedTests });
  reports.push(playwright('node_modules/@playwright/test/cli.js', ['test', '--config', 'playwright.storybook.config.js'], `${directory}/catalog.json`));
  reports.push(playwright('scripts/test-storybook-pages.js', [], `${directory}/pages.json`));
} else {
  reports.push(playwright('scripts/test-suite.js', [suite, ...projects.map(p => `--project=${p}`)], `${directory}/results.json`, definition.kind === 'ux'));
}
clean();
const receipt = {
  ...key, fingerprint, completedAt: new Date().toISOString(), reports,
  environment: { platform: process.platform, node: process.version, distribution: readFileSync('/etc/os-release', 'utf8'), browsersPath: env.PLAYWRIGHT_BROWSERS_PATH },
  approvalTemplate: `/accept-local-tests ${key.head} ${suite} ${profile} ${fingerprint} https://REPLACE-WITH-REPORT-LINK`,
};
writeFileSync(`${directory}/receipt.json`, JSON.stringify(receipt, null, 2));
console.log(`Evidence: ${directory}/receipt.json\n${receipt.approvalTemplate}\nUpload reports, then ask an approved maintainer to review and post the command.`);
