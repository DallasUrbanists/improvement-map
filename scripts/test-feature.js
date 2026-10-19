import { spawnSync } from 'node:child_process';
const [feature, ...args] = process.argv.slice(2);
const features = {
  browse: 'browse, search',
  submit: 'submission edits',
  recovery: 'empty, denied',
  guardrails: 'audit detects|draft oracle|firewall blocks|bundled icons',
};
if (!features[feature]) {
  console.error('Usage: npm run test:feature -- <browse|submit|recovery|guardrails> [Playwright options]');
  process.exit(1);
}
const project = args.some(x => x.startsWith('--project')) ? [] : ['--project=android-light'];
const result = spawnSync(process.execPath, ['scripts/test-ux.js', '--grep', features[feature], ...project, ...args], {
  stdio: 'inherit', env: { ...process.env, UX_SCAN: '0' },
});
process.exit(result.status ?? 1);
