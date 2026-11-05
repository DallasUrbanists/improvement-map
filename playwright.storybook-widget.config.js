import { defineConfig } from '@playwright/test';

const external = process.env.STORYBOOK_WIDGET_URL;
const baseURL = external || 'http://127.0.0.1:6017';
export default defineConfig({
  testDir: './tests/storybook', testMatch: 'widget.spec.js',
  workers: 1, retries: 0, timeout: 120000,
  outputDir: 'test-results/storybook/widget',
  reporter: [['list'], ['json', { outputFile: 'test-results/storybook/widget.json' }]],
  use: { browserName: 'chromium', baseURL, viewport: { width: 1500, height: 1000 }, trace: 'retain-on-failure' },
  webServer: external ? undefined : {
    command: 'npm run storybook:serve -- --port 6017 --host 127.0.0.1 --ci',
    url: `${baseURL}/index.json`, reuseExistingServer: false, timeout: 120000,
    stdout: 'pipe', stderr: 'pipe',
    env: { DEV_FORCE_MOCKS: '1', STORYBOOK_EDITING: 'false', STORYBOOK_PUBLIC_EDITING: 'false' },
  },
});
