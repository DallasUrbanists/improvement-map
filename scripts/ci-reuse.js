// Run this controller from the PR BASE checkout, never from contributor code.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { approval, eligible, hash, identity, maxAge, passingJob } from './ci-evidence.js';

const env = process.env;
const output = (key, value) => appendFileSync(env.GITHUB_OUTPUT, `${key}=${value}\n`);
output('reused', 'false');
const root = path.resolve(env.TEST_CHECKOUT || '.');
const suite = env.REUSE_SUITE;
const profile = env.REUSE_PROFILE;
const artifact = env.REUSE_ARTIFACT;
const workflow = suite === 'storybook' ? 'storybook.yml' : 'usability.yml';

async function request(endpoint) {
  const response = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${env.GITHUB_REPOSITORY}/${endpoint}`, {
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`GitHub evidence lookup returned HTTP ${response.status}`);
  return response.json();
}

async function pages(endpoint, key) {
  const result = [];
  for (let page = 1; page <= 5; page++) {
    const data = await request(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = key ? data[key] : data;
    if (!Array.isArray(items)) throw Error('Invalid evidence API response');
    result.push(...items);
    if (items.length < 100) return result;
  }
  // Incomplete searches must never silently accept an older approval.
  throw Error('Evidence lookup pagination limit reached');
}

try {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const projects = JSON.parse(env.REUSE_PROJECTS || '[]');
  if (!event.pull_request || !eligible({ event: env.GITHUB_EVENT_NAME, suite, kind: env.REUSE_KIND, enforce: env.UX_ENFORCE })) {
    console.log('Fresh execution: only non-enforced PR advisory suites can reuse evidence.');
  } else {
    const key = identity(root, { base: event.pull_request.base.sha, suite, profile, projects });
    if (key.head !== event.pull_request.head.sha) throw Error('Checkout does not match the PR head');
    const fingerprint = hash(key);
    output('fingerprint', fingerprint);
    const testStep = suite === 'storybook' ? `Verify catalog (${fingerprint})` : `Run selected suite (${fingerprint})`;
    output('test-step', testStep);
    // A PR changing its workflow or reuse policy cannot establish its own trust rules.
    for (const file of [`.github/workflows/${workflow}`, 'scripts/ci-evidence.js', 'scripts/ci-reuse.js']) {
      if (!readFileSync(path.join(root, file)).equals(readFileSync(new URL(`../${file}`, import.meta.url)))) {
        throw Error(`Fresh execution required: ${file} differs from the trusted base`);
      }
    }
    let reused;
    if (env.CI_REUSE_DISABLED !== 'true') {
      const runs = await request(`actions/workflows/${workflow}/runs?head_sha=${key.head}&event=pull_request&status=completed&per_page=20`);
      const candidates = runs.workflow_runs || [];
      if (Number(env.GITHUB_RUN_ATTEMPT) > 1) {
        const current = await request(`actions/runs/${env.GITHUB_RUN_ID}`);
        candidates.unshift({ ...current, run_attempt: Number(env.GITHUB_RUN_ATTEMPT) - 1 });
      }
      for (const run of candidates) {
        const age = Date.now() - Date.parse(run.updated_at);
        if (run.head_sha !== key.head
            || run.repository?.full_name !== env.GITHUB_REPOSITORY
            || !Number.isFinite(age) || age < 0 || age > maxAge
            || !run.pull_requests?.some(pr => pr.number === event.pull_request.number)) continue;
        const jobs = await pages(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
        const steps = suite === 'storybook'
          ? [testStep, 'Test selector and packaging contracts', 'Build public catalog', 'Component interactions and accessibility', 'Built catalog and visual candidates', 'Pages and service worker isolation', 'Dev widget startup and selected-story checks (advisory)']
          : [testStep];
        const job = jobs.find(job => {
          const age = Date.now() - Date.parse(job.completed_at);
          return age >= 0 && age <= maxAge && passingJob(job, suite === 'storybook' ? 'Component checks (advisory)' : `${suite} / ${profile}`, steps);
        });
        if (job) { reused = { type: 'trusted-ci', url: job.html_url, run: run.id, attempt: run.run_attempt }; break; }
      }
      if (!reused && env.CI_LOCAL_APPROVERS) {
        const approvers = env.CI_LOCAL_APPROVERS.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const comments = await pages(`issues/${event.pull_request.number}/comments`);
        // The latest command for this row wins, allowing an approval to be revoked.
        const relevant = comments.filter(c => approvers.includes(c.user?.login?.toLowerCase())
          && c.body?.trim().startsWith(`/accept-local-tests ${key.head} ${suite} ${profile} `));
        relevant.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
        if (relevant[0]) reused = approval(relevant[0], { fingerprint, ...key, approvers });
      }
    }
    if (reused) {
      const receipt = { ...key, fingerprint, ...reused, acceptedAt: new Date().toISOString() };
      mkdirSync(path.join(root, 'test-results', artifact), { recursive: true });
      writeFileSync(path.join(root, 'test-results', artifact, 'reuse.json'), JSON.stringify(receipt, null, 2));
      appendFileSync(env.GITHUB_STEP_SUMMARY, `### Reused ${suite} / ${profile}\n\nSource: ${reused.type}; ${reused.url}\n\nCommit: \`${key.head}\`. Fingerprint: \`${fingerprint}\`. No tests executed in this job.\n`);
      output('reused', 'true');
    } else console.log(`No accepted evidence for ${suite}/${profile}; running tests.`);
  }
} catch (error) {
  console.log(`Evidence unavailable; running tests. ${error.message}`);
}
