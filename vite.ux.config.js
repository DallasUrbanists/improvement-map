import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config.js';

// Audit artifacts and concurrent documentation edits must not trigger a live
// reload in the middle of a journey. Production configuration is unchanged.
export default defineConfig(env => mergeConfig(config(env), {
  server: { hmr: false, watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/tests/**', '**/docs/**'] } },
}));
