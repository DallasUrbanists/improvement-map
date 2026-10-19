import config from './playwright.ux.config.js';

// Separate port keeps focused Streetmix checks isolated from other local audits.
export default {
  ...config,
  testMatch: ['**/streetmix.spec.js', '**/detail-tray.spec.js', '**/recommended-actions.spec.js'],
  outputDir: 'test-results/streetmix',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/streetmix', open: 'never' }]],
  use: { ...config.use, baseURL: 'http://127.0.0.1:5175' },
  webServer: {
    ...config.webServer,
    command: 'npm run dev -- --config vite.ux.config.js --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
  },
};
