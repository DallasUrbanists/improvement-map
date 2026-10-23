import { defineConfig, mergeConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import previewConfig from './.storybook/vite.config.js';
export default mergeConfig(previewConfig, defineConfig({
  test: {
    projects: ['light', 'dark'].map(theme => ({
      extends: true,
      // Each Vite server owns its optimizer cache; themes must not rewrite it concurrently.
      cacheDir: `node_modules/.cache/storybook-vitest-${theme}`,
      plugins: [storybookTest({ configDir: '.storybook', initialGlobals: { theme } })],
      test: {
        name: `storybook-${theme}`,
        maxWorkers: 2,
        browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
      },
    })),
    reporters: ['default', 'json'],
    outputFile: { json: 'test-results/storybook/interactions.json' },
  },
}));
