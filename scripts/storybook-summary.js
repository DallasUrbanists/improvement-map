import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const read = file => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const selection = read('test-results/storybook/selection.json');
const interactions = read('test-results/storybook/interactions.json');
const browser = read('test-results/storybook/browser.json');
const pages = read('test-results/storybook/pages.json');
const widget = read('test-results/storybook/widget.json');
function pending(suites = []) { return suites.reduce((count, suite) => count + pending(suite.suites) + (suite.specs || []).reduce((n, spec) => n + spec.tests.filter(test => test.annotations?.some(annotation => annotation.type === 'visual-review-pending')).length, 0), 0); }
const lines = [
  '## Storybook advisory results',
  'These checks do not gate deployment. Failures and missing coverage still require review.',
  `Selected story files: ${selection?.files.length ?? 'selection unavailable'}. ${selection?.reasons.join('; ') || ''}`,
  ...['BUILD', 'TOOLING', 'INTERACTIONS', 'VISUAL', 'PAGES', 'WIDGET'].map(name => `${name.toLowerCase()}: ${process.env[`STORYBOOK_${name}`] || 'not run'}`),
  interactions ? `Interactions: ${interactions.numPassedTests} passed, ${interactions.numFailedTests} failed across ${interactions.numFailedTestSuites} failed test files/suites. Review raw results for assertion failures and any collection or import errors.` : 'Interaction coverage: unavailable or not selected.',
  browser ? `Browser checks: ${browser.stats.expected} passed, ${browser.stats.unexpected} failed. Visual comparisons pending reviewed baselines: ${pending(browser.suites)}.` : 'Built-browser/visual coverage: unavailable or not selected.',
  pages ? `Pages isolation checks: ${pages.stats.expected} passed, ${pages.stats.unexpected} failed.` : 'Pages/service worker coverage: unavailable or not selected.',
  widget ? `Dev widget checks: ${widget.stats.expected} passed, ${widget.stats.unexpected} failed.` : 'Dev widget coverage: unavailable or not selected.',
  'Review artifacts contain the static catalog, selection, raw results, and screenshot candidates. Do not treat candidates as approved baselines.',
];
const text = lines.join('\n\n') + '\n';
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
