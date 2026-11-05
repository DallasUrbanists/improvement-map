import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { localDevelopmentPlugin } from '../scripts/local-development/vite-plugin.js';

const local = path => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig(({ command }) => {
  return {
    base: './',
    envDir: local('./env'),
    envPrefix: 'STORYBOOK_PUBLIC_',
    plugins: [vue(), tailwindcss(), localDevelopmentPlugin({ staticCatalog: command === 'build', surface: 'storybook' })],
    // The state toolbar imports theming lazily; prebundle it so a cold browser
    // test run cannot reload its test modules partway through the suite.
    optimizeDeps: { include: ['storybook/theming'] },
    resolve: { alias: [
      { find: '@', replacement: local('../src') },
      { find: /^(?:.*\/|\.\.\/services\/)bookmarks(?:\.js)?$/, replacement: local('../stories/support/bookmarks.js') },
      { find: /^(?:.*\/|\.\.\/services\/)storage(?:\.js)?$/, replacement: local('../stories/support/storage.js') },
    ] },
    define: {
      __STORYBOOK_COMMIT__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 8) || 'local'),
    },
  };
});
