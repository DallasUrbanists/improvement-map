import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { approval, eligible, hash, identity, maxAge, passingJob, completePlaywrightReport, completeVitestReport } from '../scripts/ci-evidence.js';

const head = 'a'.repeat(40), base = 'b'.repeat(40), fingerprint = 'c'.repeat(64);
const now = Date.parse('2026-10-24T12:00:00Z');
const key = { head, fingerprint, suite: 'ux-browse', profile: 'android', approvers: ['maintainer'], now };
const comment = {
  user: { login: 'maintainer', type: 'User' }, updated_at: new Date(now - 1000).toISOString(),
  body: `/accept-local-tests ${head} ux-browse android ${fingerprint} https://example.com/report`,
  html_url: 'https://github.com/owner/repo/issues/1#issuecomment-1',
};

test('only non-enforced PR advisory suites are eligible', () => {
  const row = { event: 'pull_request', suite: 'ux-browse', kind: 'ux' };
  assert.equal(eligible(row), true);
  assert.equal(eligible({ ...row, kind: 'regression' }), true);
  assert.equal(eligible({ event: 'pull_request', suite: 'storybook' }), true);
  for (const event of ['push', 'schedule', 'workflow_dispatch', 'release']) assert.equal(eligible({ ...row, event }), false);
  assert.equal(eligible({ ...row, enforce: 'true' }), false);
  for (const kind of ['unit', 'presentation', 'critical', undefined]) assert.equal(eligible({ ...row, kind }), false);
});

test('fingerprints change with revision, base, device, image, or policy', () => {
  const input = { head, base, projects: ['android-light', 'android-dark'], image: 'image:v1', policy: 'v1' };
  for (const [key, value] of Object.entries({ head: base, base: head, projects: ['iphone-light'], image: 'image:v2', policy: 'v2' })) {
    assert.notEqual(hash(input), hash({ ...input, [key]: value }));
  }
});

test('successful advisory jobs with failed or skipped test steps cannot be reused', () => {
  const name = 'ux-browse / android', step = `Run selected suite (${fingerprint})`;
  const job = { name, status: 'completed', conclusion: 'success', steps: [{ name: step, conclusion: 'success' }] };
  assert.equal(passingJob(job, name, [step]), true);
  for (const conclusion of ['failure', 'cancelled', 'skipped', undefined]) {
    assert.equal(passingJob({ ...job, steps: [{ name: step, conclusion }] }, name, [step]), false);
  }
  assert.equal(passingJob(job, name, [`Run selected suite (${'d'.repeat(64)})`]), false);
  assert.equal(passingJob(job, 'ux-submit / android', [step]), false);
  assert.equal(passingJob(job, name, [step, 'Missing catalog check']), false);
});

test('local approvals require an allowlisted human and matching fresh evidence', () => {
  assert.equal(approval(comment, key).type, 'local-approved');
  for (const change of [
    { user: { login: 'contributor', type: 'User' } },
    { user: { login: 'maintainer', type: 'Bot' } },
    { updated_at: new Date(now - maxAge - 1).toISOString() },
    { updated_at: 'invalid' }, { updated_at: new Date(now + 1).toISOString() },
    { body: `> ${comment.body}` }, { body: `${comment.body}\nExtra text` },
    { body: comment.body.replace(head, base) },
    { body: comment.body.replace('android', 'iphone') },
    { body: comment.body.replace(fingerprint, 'd'.repeat(64)) },
    { body: comment.body.replace('https://example.com/report', 'revoked') },
  ]) assert.equal(approval({ ...comment, ...change }, key), null);
});

test('local receipts require complete nonempty reports without skipped, failed, or flaky tests', () => {
  const report = { stats: { expected: 10, unexpected: 0, skipped: 0, flaky: 0 }, errors: [] };
  assert.equal(completePlaywrightReport(report), true);
  for (const change of [{ expected: 0 }, { unexpected: 1 }, { skipped: 1 }, { flaky: 1 }]) {
    assert.equal(completePlaywrightReport({ ...report, stats: { ...report.stats, ...change } }), false);
  }
  assert.equal(completePlaywrightReport({ ...report, errors: ['Import failure'] }), false);
  assert.equal(completePlaywrightReport({}), false);
  const vitest = { success: true, numPassedTests: 10, numFailedTests: 0, numFailedTestSuites: 0, numPendingTests: 0 };
  assert.equal(completeVitestReport(vitest), true);
  for (const change of [{ success: false }, { numPassedTests: 0 }, { numFailedTests: 1 }, { numFailedTestSuites: 1 }, { numPendingTests: 1 }, { numTodoTests: 1 }]) {
    assert.equal(completeVitestReport({ ...vitest, ...change }), false);
  }
});

test('reuse stays behind a trusted base checkout and required workflows stay unchanged', () => {
  for (const workflow of ['usability', 'storybook']) {
    const source = readFileSync(`.github/workflows/${workflow}.yml`, 'utf8');
    assert.match(source, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/);
    assert.match(source, /persist-credentials: false/);
    assert.match(source, /run: node \.ci-policy\/scripts\/ci-reuse.js/);
    assert.match(source, /steps.reuse.outputs.reused != 'true'/);
    assert.doesNotMatch(source, /pull_request_target|issues: write|contents: write/);
  }
  for (const workflow of ['deploy', 'deploy-staging', 'local-development']) {
    assert.doesNotMatch(readFileSync(`.github/workflows/${workflow}.yml`, 'utf8'), /ci-reuse|accept-local-tests/);
  }
  const storybook = readFileSync('.github/workflows/storybook.yml', 'utf8');
  assert.ok(storybook.indexOf('run: node .ci-policy/scripts/ci-reuse.js') < storybook.indexOf('run: node scripts/storybook-selection.js'), 'Trust decisions must run before contributor scripts');
});

test('combined reports distinguish reuse from freshly executed tests', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-reuse-report-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'input', 'advisory-ux-browse-android');
  mkdirSync(input, { recursive: true });
  writeFileSync(path.join(input, 'reuse.json'), JSON.stringify({ head, suite: 'ux-browse', profile: 'android', type: 'local-approved', url: comment.html_url }));
  const output = path.join(directory, 'combined');
  const result = spawnSync(process.execPath, ['scripts/merge-test-reports.js', path.join(directory, 'input'), path.join(directory, 'html'), output], {
    encoding: 'utf8', env: { ...process.env, PLANNED_MATRIX: JSON.stringify({ headSha: head, rows: [{ suite: 'ux-browse', profile: 'android', kind: 'ux', artifact: 'ux-browse-android' }] }) },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(path.join(output, 'combined-ux-summary.json')));
  assert.equal(report.reused.length, 1);
  assert.equal(report.summaries.length, 0);
  assert.deepEqual(report.missingArtifacts, []);
  assert.match(readFileSync(path.join(output, 'combined-ux-summary.md'), 'utf8'), /not executed in this run/);
});

test('controller accepts trusted results and approvals, and runs fresh on invalid or unavailable evidence', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ci-evidence-controller-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const checkout = path.join(directory, 'checkout'), policy = path.join(directory, 'policy');
  for (const target of [checkout, policy]) {
    for (const file of ['scripts/ci-reuse.js', 'scripts/ci-evidence.js', '.github/workflows/usability.yml', 'package-lock.json']) {
      mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
      cpSync(file, path.join(target, file));
    }
    writeFileSync(path.join(target, 'package.json'), '{"type":"module"}');
  }
  function git(...args) {
    const result = spawnSync('git', ['-C', checkout, '-c', 'user.name=Evidence Tests', '-c', 'user.email=tests@example.invalid', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'fixture');
  const sha = git('rev-parse', 'HEAD');
  const currentKey = identity(checkout, { base, suite: 'ux-browse', profile: 'android', projects: ['android-light', 'android-dark'] });
  const digest = hash(currentKey);
  const previous = { id: 2, run_attempt: 1, head_sha: sha, repository: { full_name: 'owner/repo' }, pull_requests: [{ number: 1 }], updated_at: new Date().toISOString() };
  const job = { name: 'ux-browse / android', status: 'completed', conclusion: 'success', completed_at: new Date().toISOString(), html_url: 'https://github.com/owner/repo/actions/runs/2/job/3', steps: [{ name: `Run selected suite (${digest})`, conclusion: 'success' }] };
  const local = { ...comment, updated_at: new Date().toISOString(), body: `/accept-local-tests ${sha} ux-browse android ${digest} https://example.com/report` };
  const shim = path.join(directory, 'fetch.mjs');
  writeFileSync(shim, `import {readFileSync} from 'node:fs';
    const data=JSON.parse(readFileSync(process.env.FIXTURE));
    globalThis.fetch=async url => {
      if(data.fail) return {ok:false,status:403};
      const body=url.includes('/comments?') ? data.comments : url.includes('/jobs?') ? {jobs:data.jobs} : {workflow_runs:data.runs};
      return {ok:true,json:async()=>body};
    };`);
  const eventPath = path.join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 1, head: { sha }, base: { sha: base } } }));
  const cases = [
    ['trusted success', { runs: [previous], jobs: [job], comments: [] }, true],
    ['failed advisory step', { runs: [previous], jobs: [{ ...job, steps: [{ ...job.steps[0], conclusion: 'failure' }] }], comments: [] }, false],
    ['wrong fingerprint', { runs: [previous], jobs: [{ ...job, steps: [{ name: 'Run selected suite (wrong)', conclusion: 'success' }] }], comments: [] }, false],
    ['wrong head', { runs: [{ ...previous, head_sha: base }], jobs: [job], comments: [] }, false],
    ['stale job', { runs: [previous], jobs: [{ ...job, completed_at: new Date(Date.now() - maxAge - 1000).toISOString() }], comments: [] }, false],
    ['API failure', { fail: true }, false],
    ['approved local', { runs: [], jobs: [], comments: [local] }, true],
    ['unapproved local', { runs: [], jobs: [], comments: [{ ...local, user: { login: 'contributor', type: 'User' } }] }, false],
    ['revoked local', { runs: [], jobs: [], comments: [local, { ...local, updated_at: new Date(Date.now() + 1000).toISOString(), body: local.body.replace('https://example.com/report', 'revoked') }] }, false],
    ['reuse disabled', { runs: [previous], jobs: [job], comments: [local], disabled: 'true' }, false],
    ['enforced UX', { runs: [previous], jobs: [job], comments: [local], enforce: 'true' }, false],
    ['changed workflow policy', { runs: [previous], jobs: [job], comments: [local], changePolicy: true }, false],
  ];
  for (const [name, fixture, expected] of cases) await t.test(name, () => {
    const fixturePath = path.join(directory, 'fixture.json'), output = path.join(directory, 'output'), summary = path.join(directory, 'summary');
    writeFileSync(fixturePath, JSON.stringify(fixture)); writeFileSync(output, ''); writeFileSync(summary, '');
    const workflowPath = path.join(checkout, '.github/workflows/usability.yml');
    const workflow = readFileSync(workflowPath);
    if (fixture.changePolicy) writeFileSync(workflowPath, '# modified policy');
    const result = spawnSync(process.execPath, ['--import', pathToFileURL(shim).href, path.join(policy, 'scripts/ci-reuse.js')], {
      encoding: 'utf8', env: { ...process.env, FIXTURE: fixturePath, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary,
        TEST_CHECKOUT: checkout, REUSE_SUITE: 'ux-browse', REUSE_KIND: 'ux', REUSE_PROFILE: 'android',
        REUSE_PROJECTS: '["android-light","android-dark"]', REUSE_ARTIFACT: 'ux-browse-android',
        GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_RUN_ID: '1', GITHUB_RUN_ATTEMPT: '1', UX_ENFORCE: fixture.enforce || '', CI_LOCAL_APPROVERS: 'maintainer', CI_REUSE_DISABLED: fixture.disabled || '',
      },
    });
    writeFileSync(workflowPath, workflow);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8').includes('reused=true'), expected, result.stdout);
    if (expected) assert.ok(existsSync(path.join(checkout, 'test-results/ux-browse-android/reuse.json')));
  });
});
