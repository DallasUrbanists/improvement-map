import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const maxAge = 7 * 24 * 60 * 60 * 1000;
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

export function identity(root, { base, suite, profile, projects }) {
  const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, 'utf8'));
  const version = lock.packages['node_modules/@playwright/test'].version;
  return {
    schema: 1, head: git(root, 'rev-parse', 'HEAD'), base,
    suite, profile, projects,
    node: '24.12.0', runner: 'ubuntu-latest',
    image: `mcr.microsoft.com/playwright:v${version}-noble`,
    policy: 'advisory-head-tests-v1',
  };
}

export function eligible({ event, suite, kind, enforce }) {
  return event === 'pull_request' && enforce !== 'true'
    && (suite === 'storybook' || kind === 'ux' || kind === 'regression');
}

export function passingJob(job, name, steps) {
  return job.name === name && job.status === 'completed' && job.conclusion === 'success'
    && steps.every(name => job.steps?.some(step => step.name === name && step.conclusion === 'success'));
}

export function completePlaywrightReport(report) {
  return report.stats?.expected > 0 && report.stats.unexpected === 0
    && report.stats.skipped === 0 && report.stats.flaky === 0 && !report.errors?.length;
}

export function completeVitestReport(report) {
  return report.success === true && report.numPassedTests > 0
    && report.numFailedTests === 0 && report.numFailedTestSuites === 0
    && report.numPendingTests === 0 && !report.numTodoTests;
}

export function approval(comment, { fingerprint, head, suite, profile, approvers, now = Date.now() }) {
  if (comment.user?.type !== 'User' || !approvers.includes(comment.user.login.toLowerCase())) return null;
  const age = now - Date.parse(comment.updated_at);
  if (!Number.isFinite(age) || age < 0 || age > maxAge) return null;
  // A standalone command, not a quoted snippet or text copied into a PR body.
  const match = comment.body?.trim().match(/^\/accept-local-tests ([a-f0-9]{40}) ([a-z-]+) ([a-z-]+) ([a-f0-9]{64}) (https:\/\/\S+)$/);
  if (!match || match[1] !== head || match[2] !== suite || match[3] !== profile || match[4] !== fingerprint) return null;
  return { type: 'local-approved', url: comment.html_url, report: match[5], approver: comment.user.login };
}
