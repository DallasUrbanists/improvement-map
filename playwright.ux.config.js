import { defineConfig, devices } from '@playwright/test';

const full = process.env.UX_FULL === '1';
const reporter = [['list'], ['./scripts/ux-reporter.js'], ['html', { outputFolder: process.env.UX_HTML_DIR || 'playwright-report/ux', open: 'never' }]];
if (process.env.PLAYWRIGHT_BLOB_DIR) reporter.push(['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_DIR }]);
const profiles = [
  ['android', { ...devices['Pixel 5'] }],
  ['iphone', { ...devices['iPhone 13'], defaultBrowserType: 'webkit' }],
  ...(full ? [
    ['narrow', { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } }],
    ['landscape', { ...devices['iPhone 13 landscape'] }],
    ['desktop', { ...devices['Desktop Chrome'] }],
  ] : []),
];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/ux/**/*.spec.js',
  testIgnore: '**/live.spec.js',
  timeout: 90000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  workers: process.env.CI ? 4 : 2,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/ux',
  reporter,
  // Missing baselines must be reviewed, never silently accepted.
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/ux/snapshots/{platform}/{projectName}/{arg}{ext}',
  use: {
    actionTimeout: 10000,
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:5174', localStorage: [{ name: 'improvement_map_announcements_v1', value: JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.3.0' }) }] }] },
    baseURL: 'http://127.0.0.1:5174', serviceWorkers: 'block',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'America/Chicago',
  },
  webServer: {
    command: 'npm run dev:provider -- --config vite.ux.config.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174', reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_FIREBASE_API_KEY: '',
      VITE_RECAPTCHA_SITE_KEY: '',
      VITE_PRESENTATION_ENABLED: 'true',
      VITE_PRESENTATION_WEBSOCKET_ENABLED: 'false',
      VITE_API_BASE_URL: 'https://api.presentation.test',
    },
  },
  projects: profiles.flatMap(([name, use]) => ['light', 'dark'].map(colorScheme => ({
    name: `${name}-${colorScheme}`, use: { ...use, colorScheme },
  }))),
});
