import { defineConfig, devices } from '@playwright/test';
const pages = process.env.STORYBOOK_PAGES === '1';
export default defineConfig({
  testDir: './tests/storybook',
  testMatch: pages ? 'pages.spec.js' : ['catalog.spec.js', 'colors-doc.spec.js', 'square-icon-button.spec.js', 'big-circle-button.spec.js', 'text-button.spec.js', 'drawer.spec.js'],
  fullyParallel: true, workers: process.env.CI ? 4 : 2,
  timeout: 30000, retries: 0, forbidOnly: !!process.env.CI,
  outputDir: pages ? 'test-results/storybook/pages' : 'test-results/storybook/browser',
  reporter: [['list'], ['html', { outputFolder: pages ? 'playwright-report/storybook-pages' : 'playwright-report/storybook', open: 'never' }], ['json', { outputFile: pages ? 'test-results/storybook/pages.json' : 'test-results/storybook/browser.json' }]],
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:6007/storybook/', serviceWorkers: pages ? 'allow' : 'block', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'America/Chicago', trace: 'retain-on-failure' },
  webServer: { command: pages ? 'node scripts/serve-storybook.js --root dist --prefix /' : 'node scripts/serve-storybook.js', url: 'http://127.0.0.1:6007/storybook/', reuseExistingServer: false },
  projects: pages ? [{ name: 'pages', use: { ...devices['Desktop Chrome'] } }] : [
    ...['light', 'dark'].flatMap(colorScheme => [
      { name: `narrow-${colorScheme}`, use: { browserName: 'chromium', viewport: { width: 320, height: 720 }, colorScheme } },
      { name: `desktop-${colorScheme}`, use: { ...devices['Desktop Chrome'], colorScheme } },
    ]),
    { name: 'webkit-panels', grep: /dialog keyboard|map tray keyboard/, use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
