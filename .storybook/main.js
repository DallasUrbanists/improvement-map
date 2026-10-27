import { fileURLToPath } from 'node:url';

const editingWithoutTestWidget = process.env.STORYBOOK_EDITING === 'true';

export default {
  stories: ['../stories/**/*.mdx', '../src/**/*.stories.js'],
  framework: {
    name: '@storybook/vue3-vite',
    options: { docgen: 'vue-component-meta', builder: { viteConfigPath: '.storybook/vite.config.js' } },
  },
  addons: [
    '@storybook/addon-docs', '@storybook/addon-a11y',
    ...(editingWithoutTestWidget ? [] : ['@storybook/addon-vitest']),
    '@storybook/addon-mcp', 'storybook-addon-pseudo-states',
  ],
  features: { componentsManifest: true, experimentalDocgenServer: true },
  // Copy only intentional public assets, never the app's CNAME or service worker.
  staticDirs: [
    { from: '../public/images', to: '/images' },
    { from: fileURLToPath(new URL('../stories/assets', import.meta.url)), to: '/fixtures' },
  ],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    // Storybook replaces server options from vite.config.js. Apply warmup and
    // watcher settings afterward; output exclusions avoid Windows EBUSY crashes
    // when builds and test reports are rewritten beside the running server.
    return mergeConfig(config, { server: {
      // Compile the shared framework stylesheet while the dev server starts,
      // rather than making the first preview request pay for Tailwind generation.
      warmup: { clientFiles: ['./src/tailwind.css'] },
      watch: {
        ignored: [/[/\\](?:storybook-static|dist|dist-ssr|test-results|playwright-report|blob-report)(?:[/\\]|$)/],
      },
    } });
  },
};
