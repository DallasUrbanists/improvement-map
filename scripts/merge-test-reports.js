import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || 'test-results/downloaded');
const output = path.resolve(process.argv[3] || 'playwright-report/combined');
const reportRoot = path.resolve(process.argv[4] || 'test-results/combined');
const summaries = [];
const blobs = [];
const files = [];
const suiteTimings = [];
const reused = [];

async function walk(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else {
      files.push(file);
      if (entry.name === 'ux-summary.json') summaries.push(JSON.parse(await readFile(file, 'utf8')));
      else if (entry.name === 'timing.json') suiteTimings.push(JSON.parse(await readFile(file, 'utf8')));
      else if (entry.name === 'reuse.json') reused.push(JSON.parse(await readFile(file, 'utf8')));
      else if (entry.name.endsWith('.zip') && file.toLowerCase().includes('blob')) blobs.push(file);
    }
  }
}

await walk(root);
const tests = [];
for (const summary of summaries) tests.push(summary);
const planned = process.env.PLANNED_MATRIX ? JSON.parse(process.env.PLANNED_MATRIX) : null;
const missingArtifacts = [];
for (const row of planned?.rows || []) {
  const returned = files.filter(file => file.includes(row.artifact));
  const accepted = reused.some(item => item.head === planned.headSha && item.suite === row.suite
    && item.profile === row.profile && ['trusted-ci', 'local-approved'].includes(item.type));
  const evidencePresent = accepted || (row.kind === 'ux'
    ? returned.some(file => path.basename(file) === 'ux-summary.json')
    : returned.some(file => file.toLowerCase().includes('blob-report') && file.endsWith('.zip')));
  if (!evidencePresent) missingArtifacts.push(`No usable report artifact received for ${row.suite}/${row.profile}.`);
}
if (planned?.runUnit && !files.some(file => file.toLowerCase().includes('advisory-unit'))) missingArtifacts.push('No artifact received for the unit suite.');
let jobTimings = [];
try {
  const data = JSON.parse(await readFile(path.join(path.dirname(reportRoot), 'jobs.json'), 'utf8'));
  jobTimings = (data.jobs || []).filter(job => /^(ux-|regression-|unit)/.test(job.name)).map(job => ({
    name: job.name,
    status: job.conclusion,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    durationSeconds: job.started_at && job.completed_at ? Math.round((Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000) : null,
    steps: (job.steps || []).filter(step => /Install dependencies|Run selected suite|Run unit suite|Upload .* evidence/.test(step.name)).map(step => ({ name: step.name, conclusion: step.conclusion, outcome: step.outcome, startedAt: step.started_at, completedAt: step.completed_at, durationSeconds: step.started_at && step.completed_at ? Math.round((Date.parse(step.completed_at) - Date.parse(step.started_at)) / 1000) : null })),
  }));
} catch { /* timings remain unavailable when the Actions API result could not be saved */ }
const report = {
  status: missingArtifacts.length ? 'incomplete' : !planned?.rows?.length && !planned?.runUnit ? 'no-tests-selected' : tests.some(item => item.status !== 'passed') || suiteTimings.some(item => item.testExit !== 0) ? 'failed-or-advisory-failure' : reused.length ? 'passed-with-reuse' : 'passed',
  planned,
  summaries: tests,
  reused,
  suiteTimings,
  missingArtifacts,
  jobTimings,
};
await mkdir(reportRoot, { recursive: true });
await writeFile(path.join(reportRoot, 'combined-ux-summary.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(reportRoot, 'combined-ux-summary.md'), `# Combined Playwright report\n\nStatus: ${report.status}. UX suite summaries received: ${summaries.length}. Blob reports received: ${blobs.length}.\n\n` + summaries.map(item => `- ${item.suite}: ${item.status}; ${item.coverage.reduce((sum, entry) => sum + entry.audited.length, 0)} audited checkpoints.`).join('\n') + `\n\n${missingArtifacts.join('\n') || 'All planned jobs returned artifacts.'}\n\n` + jobTimings.map(job => `- ${job.name}: ${job.durationSeconds ?? 'unknown'} seconds, ${job.status}.`).join('\n') + '\n');
if (reused.length) {
  const reuseText = '\n## Reused results (not executed in this run)\n\n' + reused.map(item => `- ${item.suite}/${item.profile}: ${item.type}; ${item.url}`).join('\n') + '\n';
  const file = path.join(reportRoot, 'combined-ux-summary.md');
  await writeFile(file, await readFile(file, 'utf8') + reuseText);
}

if (blobs.length) {
  const blobDirectory = path.join(reportRoot, 'blobs');
  await mkdir(blobDirectory, { recursive: true });
  const { copyFile } = await import('node:fs/promises');
  for (const [index, blob] of blobs.entries()) await copyFile(blob, path.join(blobDirectory, `${index + 1}.zip`));
  const cli = path.resolve('node_modules/@playwright/test/cli.js');
  const result = spawnSync(process.execPath, [cli, 'merge-reports', '--config', path.resolve('playwright.merge.config.js'), '--reporter=html', blobDirectory], { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_HTML_OUTPUT_DIR: output, PLAYWRIGHT_HTML_OPEN: 'never' } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

if (missingArtifacts.length) process.exitCode = 1;
