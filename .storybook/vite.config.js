import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

const local = path => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig(({ mode }) => {
  // Keep the standalone builder isolated from app credentials, while allowing
  // the browser Maps key that Google Maps requires to be bundled publicly.
  const mapsEnv = loadEnv(mode, local('../'), 'VITE_GOOGLE_MAPS_API_KEY');

  return {
    base: './',
    envDir: local('./env'),
    envPrefix: 'STORYBOOK_PUBLIC_',
    plugins: [vue(), tailwindcss()],
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
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(mapsEnv.VITE_GOOGLE_MAPS_API_KEY || ''),
    },
  };
});
