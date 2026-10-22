import { defineConfig, devices } from '@playwright/test';

const unitOnly = process.argv.includes('--project=unit');
// Presentation fixtures require a known API origin and transport flags. A running
// developer server may use a real local API, so focused runs must own their server.
const focusedPresentation = process.argv.some(arg => /(?:^|[\\/])presentation\.spec\.js$/.test(arg));
const appBaseURL = process.env.PLAYWRIGHT_BASE_URL
  || (focusedPresentation ? 'http://127.0.0.1:5176' : 'http://localhost:5173');
// Workers reload this config without the runner's spec arguments.
if (focusedPresentation) process.env.PLAYWRIGHT_BASE_URL = appBaseURL;
const appUrl = new URL(appBaseURL);
const useFreshServer = focusedPresentation || Boolean(process.env.PLAYWRIGHT_BASE_URL);
const reporter = [['list']];
if (process.env.PLAYWRIGHT_BLOB_DIR) reporter.push(['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_DIR }]);

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/ux/**', '**/presentationConnection.spec.js'],
  fullyParallel: true,
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/regression',
  reporter,
  use: {
    baseURL: appBaseURL,
    // Existing journeys exercise the app after onboarding; announcement specs override this.
    storageState: { cookies: [], origins: [{ origin: appUrl.origin, localStorage: [{ name: 'improvement_map_announcements_v1', value: JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.3.0' }) }] }] },
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: unitOnly && !process.argv.some(arg => arg.startsWith('--project=') && arg !== '--project=unit') ? undefined : {
    // Disable HMR so test artifacts and concurrent edits cannot reload a journey.
    command: `npm run dev -- --config vite.ux.config.js --host ${appUrl.hostname} --port ${appUrl.port || '5173'}${useFreshServer ? ' --strictPort' : ''}`,
    url: appBaseURL,
    reuseExistingServer: useFreshServer ? false : !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_PRESENTATION_ENABLED: 'true',
      VITE_PRESENTATION_WEBSOCKET_ENABLED: 'false',
      VITE_API_BASE_URL: 'https://api.presentation.test',
    },
  },
  projects: [
    {
      name: 'unit',
      grep: /@unit/,
    },
    {
      name: 'chromium',
      grep: /^(?!.*@unit)/,
      grepInvert: /@unit/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      grep: /^(?!.*@unit)/,
      grepInvert: /@unit/,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
