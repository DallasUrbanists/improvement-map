import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/local-development',
  fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  outputDir: 'test-results/local-development/browser',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/local-development', open: 'never' }]],
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:5183', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node scripts/local-development/mock-server.js', url: 'http://127.0.0.1:4011/__mock/health', env: { MOCK_PORT: '4011', MOCK_DATA_DIR: 'test-results/local-development/mock' }, reuseExistingServer: false },
    { command: 'npm run dev:local -- --host 127.0.0.1 --port 5183 --strictPort', url: 'http://127.0.0.1:5183/__dev', env: { DEV_FORCE_MOCKS: '1', DEV_VITE_CACHE: 'node_modules/.cache/local-smoke', DEV_MOCK_ORIGIN: 'http://127.0.0.1:4011' }, reuseExistingServer: false },
    { command: 'npm run storybook -- --host 127.0.0.1 --port 6016 --ci --disable-telemetry', url: 'http://127.0.0.1:6016/index.json', env: { DEV_FORCE_MOCKS: '1', DEV_VITE_CACHE: 'node_modules/.cache/local-smoke', DEV_MOCK_ORIGIN: 'http://127.0.0.1:4011' }, reuseExistingServer: false, timeout: 180000 },
  ],
});
