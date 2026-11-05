import { defineConfig, mergeConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import previewConfig from './.storybook/vite.config.js';

// The Storybook UI discovers this conventional filename. It owns one project
// and supplies the selected toolbar globals; CLI/CI use both theme projects in
// vitest.storybook.config.js. The addon assigns its own project name in UI mode.
export default defineConfig(({ mode }) => mergeConfig(
  previewConfig({ mode, command: 'serve', isSsrBuild: false, isPreview: false }),
  {
    cacheDir: 'node_modules/.cache/storybook-vitest-ui',
    plugins: [storybookTest({ configDir: '.storybook' })],
    test: {
      name: 'storybook-ui',
      maxWorkers: 2,
      browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
    },
  },
));
