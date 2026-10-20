import { defineConfig, devices } from '@playwright/test';

const unitOnly = process.argv.includes('--project=unit');

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/ux/**',
  fullyParallel: true,
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  outputDir: 'test-results/regression',
  use: {
    baseURL: 'http://localhost:5173',
    // Existing journeys exercise the app after onboarding; announcement specs override this.
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'improvement_map_announcements_v1', value: JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.3.0' }) }] }] },
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: unitOnly && !process.argv.some(arg => arg.startsWith('--project=') && arg !== '--project=unit') ? undefined : {
    command: 'npm run dev',
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
