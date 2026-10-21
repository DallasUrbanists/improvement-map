import { defineConfig, devices } from '@playwright/test';

const unitOnly = process.argv.includes('--project=unit');
const reporter = [['list']];
if (process.env.PLAYWRIGHT_BLOB_DIR) reporter.push(['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_DIR }]);

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/ux/**',
  fullyParallel: true,
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/regression',
  reporter,
  use: {
    baseURL: 'http://localhost:5173',
    // Existing journeys exercise the app after onboarding; announcement specs override this.
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'improvement_map_announcements_v1', value: JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.3.0' }) }] }] },
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: unitOnly && !process.argv.some(arg => arg.startsWith('--project=') && arg !== '--project=unit') ? undefined : {
    // Disable HMR so test artifacts and concurrent edits cannot reload a journey.
    command: 'npm run dev -- --config vite.ux.config.js',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
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
