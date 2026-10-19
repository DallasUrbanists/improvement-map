import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ux', testMatch: 'live.spec.js',
  timeout: 60000, workers: 1, retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/ux-live', open: 'never' }]],
  outputDir: 'test-results/ux-live',
  use: { ...devices['Pixel 5'], serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
