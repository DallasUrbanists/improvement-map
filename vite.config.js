import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { validateManifest } from './src/services/releaseVersions.js';
import { stagingBuildPlugin } from './scripts/staging-build.js';

function releaseManifestPlugin() {
  return {
    name: 'release-manifest',
    resolveId(id) { if (id === 'virtual:release-manifest') return '\0virtual:release-manifest'; },
    load(id) {
      if (id !== '\0virtual:release-manifest') return;
      const appVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
      const manifest = process.env.RELEASE_MANIFEST
        ? validateManifest(JSON.parse(fs.readFileSync(process.env.RELEASE_MANIFEST, 'utf8')))
        : { schemaVersion: 1, appVersion, buildCommit: 'local', releases: [] };
      if (manifest.appVersion !== appVersion) throw Error('Release manifest does not match package version');
      return `export default ${JSON.stringify(manifest)}`;
    },
  };
}

// Generate 404.html for GitHub Pages SPA routing fallback
function spa404Plugin() {
  return {
    name: 'spa-404-plugin',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const indexPath = path.join(outDir, 'index.html');
      const notFoundPath = path.join(outDir, '404.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
      }
    },
  };
}

const getBasePath = (env) => {
  if (env.BASE_PATH !== undefined) {
    if (env.BASE_PATH === '' || env.BASE_PATH === '/') return '/';
    return env.BASE_PATH.endsWith('/') ? env.BASE_PATH : `${env.BASE_PATH}/`;
  }
  return '/';
};

export default defineConfig(({ mode }) => ({
  base: getBasePath({ ...loadEnv(mode, process.cwd(), ''), ...process.env }),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const fixture = id.match(/[\\/](test-location-osm|additional-test-locations-osm|extra-test-locations-osm|arts-district-test-location|downtown-test-location)\.json$/);
          if (fixture) return `diagram-${fixture[1]}`;
        },
      },
    },
  },
  plugins: [
    releaseManifestPlugin(),
    vue(),
    tailwindcss(),
    spa404Plugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Dallas Urbanists Improvement Map',
        short_name: 'Improvement Map',
        description: 'Touch-friendly, mobile-first civic improvement suggestion tool for pedestrians, cyclists, and transit users.',
        theme_color: '#0c2340',
        background_color: '#071527',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globIgnores: ['**/build-info.json'],
        navigateFallbackDenylist: [/\/build-info\.json$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/build-info.json',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https?:\/\/[^/]+\/api\/public-improvements\/presentation(?:\/|$)/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-maps-api',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/public-improvements\/suggestions.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-suggestions-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          }
        ]
      }
    }),
    stagingBuildPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_', 'GOOGLE_', 'MAPS_'],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/__overpass-kumi': {
        target: 'https://overpass.private.coffee',
        changeOrigin: true,
        headers: { 'User-Agent': 'DallasUrbanists-ImprovementMap/4.2 (https://github.com/DallasUrbanists/improvement-map)' },
        rewrite: (url) => url.replace(/^\/__overpass-kumi/, '/api/interpreter'),
        timeout: 30000,
        proxyTimeout: 25000,
        configure: (proxy) => {
          proxy.on('error', (error, _request, response) => {
            if (response && !response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
              response.end(`Overpass fallback proxy connection failed: ${error.message}`);
            }
          });
        },
      },
      '/__overpass': {
        target: 'https://overpass.openstreetmap.fr',
        changeOrigin: true,
        headers: { 'User-Agent': 'DallasUrbanists-ImprovementMap/4.2 (https://github.com/DallasUrbanists/improvement-map)' },
        rewrite: (url) => url.replace(/^\/__overpass/, '/api/interpreter'),
        timeout: 30000,
        proxyTimeout: 25000,
        configure: (proxy) => {
          proxy.on('error', (error, _request, response) => {
            if (response && !response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
              response.end(`Overpass proxy connection failed: ${error.message}`);
            }
          });
        },
      },
    },
  }
}));
