import { fileURLToPath } from 'node:url';

export default {
  stories: ['../stories/**/*.mdx', '../src/**/*.stories.js'],
  framework: {
    name: '@storybook/vue3-vite',
    options: { docgen: 'vue-component-meta', builder: { viteConfigPath: '.storybook/vite.config.js' } },
  },
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest', '@storybook/addon-mcp', 'storybook-addon-pseudo-states'],
  features: { componentsManifest: true, experimentalDocgenServer: true },
  // Copy only intentional public assets, never the app's CNAME or service worker.
  staticDirs: [
    { from: '../public/images', to: '/images' },
    { from: fileURLToPath(new URL('../stories/assets', import.meta.url)), to: '/fixtures' },
  ],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    // Storybook replaces server options from vite.config.js. Apply the watcher
    // exclusions here, after that replacement, to avoid Windows EBUSY crashes
    // when builds and test reports are rewritten beside the running server.
    return mergeConfig(config, { server: { watch: {
      ignored: [/[/\\](?:storybook-static|dist|dist-ssr|test-results|playwright-report|blob-report)(?:[/\\]|$)/],
    } } });
  },
};
