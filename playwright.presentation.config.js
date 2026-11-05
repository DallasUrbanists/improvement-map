import { defineConfig, devices } from '@playwright/test';

const mode = process.env.PRESENTATION_SOCKET_TEST_MODE === 'off' ? 'off' : 'on';
const soak = process.env.PRESENTATION_SOCKET_SOAK === '1' && mode === 'on';
const appUrl = 'http://127.0.0.1:5175';
const reporter = [['list']];
if (process.env.PLAYWRIGHT_BLOB_DIR) reporter.push(['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_DIR }]);
const viteEnv = {
  ...process.env,
  VITE_PRESENTATION_ENABLED: 'true',
  VITE_PRESENTATION_WEBSOCKET_ENABLED: mode === 'on' ? 'true' : 'false',
  VITE_API_BASE_URL: 'https://api.presentation.test',
};

export default defineConfig({
  testDir: './tests',
  testMatch: '**/presentationConnection.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: soak ? 11 * 60_000 : 45_000,
  grep: soak ? /@socket-soak/ : mode === 'on' ? /@socket-on/ : /@socket-off/,
  reporter,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/presentation-connection',
  use: {
    baseURL: appUrl,
    storageState: { cookies: [], origins: [{ origin: appUrl, localStorage: [{ name: 'improvement_map_announcements_v1', value: JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.3.0' }) }] }] },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run dev:provider -- --config vite.ux.config.js --host 127.0.0.1 --port 5175 --strictPort',
    url: appUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    env: viteEnv,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'WebKit', use: { ...devices['Desktop Safari'] } },
  ],
});
