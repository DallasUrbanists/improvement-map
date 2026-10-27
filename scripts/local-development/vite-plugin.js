import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localConfiguration, dependencyForPath } from './config.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const browser = name => path.join(root, 'dev/browser', name);

export function localDevelopmentPlugin({ staticCatalog = false, surface = 'app' } = {}) {
  const config = localConfiguration({ root, staticCatalog });
  return {
    name: 'local-development',
    configResolved(resolved) {
      if (surface === 'app' && resolved.command === 'build') {
        throw Error('The local sandbox is development-only. Use npm run build for deployment artifacts; mock adapters must not enter a staging or production app build.');
      }
    },
    config(viteConfig) {
      const aliases = [
        { find: /^(?:.*[/\\])?apiBaseUrl(?:\.js)?$/, replacement: browser('apiBaseUrl.js') },
      ];
      aliases.push({
        find: /^(?:.*[/\\])?firebase(?:\.js)?$/,
        replacement: browser(config.modes.auth === 'mock' && config.modes.appcheck === 'mock' ? 'firebase.js' : 'firebaseMixed.js'),
      });
      if (config.modes.maps === 'mock') aliases.push(
        { find: '@googlemaps/js-api-loader', replacement: browser('mapsLoader.js') },
        { find: '@googlemaps/markerclusterer', replacement: browser('clusterer.js') },
      );
      const cloudProxy = service => ({
        target: config.modes[service] === 'live' ? config.liveApiOrigin : config.mockOrigin, changeOrigin: true, ws: true, xfwd: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, request) => {
            const live = config.modes[dependencyForPath(new URL(request.url, 'http://local').pathname)] === 'live';
            // The local facade never manufactures credentials for live requests.
            if (!live) {
              for (const header of ['authorization', 'x-api-key', 'x-firebase-appcheck', 'cookie']) proxyReq.removeHeader(header);
            } else if (config.apiKey) proxyReq.setHeader('X-API-Key', config.apiKey);
          });
        },
      });
      const overpass = config.modes.overpass === 'live'
        ? { target: 'https://overpass.openstreetmap.fr', changeOrigin: true, rewrite: () => '/api/interpreter' }
        // Vite deep-merges this with the app's existing live proxy options.
        // Explicitly replace their rewrite so the mock receives its own route.
        : { target: config.mockOrigin, changeOrigin: true, rewrite: pathname => pathname };
      const googleSources = config.modes.maps === 'live' || config.modes.appcheck === 'live' || config.modes.auth === 'live'
        ? ' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.firebaseapp.com https://*.recaptcha.net' : '';
      const storageSources = config.modes.uploads === 'live' ? ' https://storage.googleapis.com https://*.storage.googleapis.com' : '';
      return {
        envDir: path.join(root, 'dev/empty-env'),
        cacheDir: viteConfig.cacheDir || `${process.env.DEV_VITE_CACHE || 'node_modules/.cache/local-development'}/${surface}`,
        resolve: { alias: aliases },
        define: {
          'import.meta.env.VITE_API_KEY': JSON.stringify(''),
          'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(config.mapsKey || 'local-mock'),
          'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(config.firebaseKey || ''),
          'import.meta.env.VITE_RECAPTCHA_SITE_KEY': JSON.stringify(config.recaptchaKey || ''),
          'import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN': JSON.stringify(config.appCheckDebugToken || ''),
          // Presentation is independently opt-in; this initial local sandbox does not enable it.
          'import.meta.env.VITE_PRESENTATION_ENABLED': JSON.stringify('false'),
          'import.meta.env.VITE_PRESENTATION_WEBSOCKET_ENABLED': JSON.stringify('false'),
          __LOCAL_DEPENDENCY_MODES__: JSON.stringify(config.modes),
          'import.meta.env.VITE_LOCAL_DEVELOPMENT': 'true',
          'import.meta.env.VITE_LOCAL_STORYBOOK_URL': JSON.stringify(config.storybookOrigin),
        },
        server: {
          proxy: {
            '^/api/(?:public-improvements/)?presentation(?:/|$)': cloudProxy('presentation'),
            '^/api/(?:public-improvements/)?suggestions/upload-url$': cloudProxy('uploads'),
            '^/api/(?:public-improvements/)?suggestions/[^/]+/streetmix(?:/|$)': cloudProxy('streetmix'),
            '/api/assist/': cloudProxy('assist'), '/api': cloudProxy('api'),
            '/__mock': { target: config.mockOrigin }, '/__uploads': { target: config.mockOrigin },
            '/__overpass-kumi': overpass, '/__overpass': overpass,
          },
          headers: { 'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'${googleSources}; style-src 'self' 'unsafe-inline'${googleSources}; connect-src 'self' ws://localhost:* ws://127.0.0.1:*${googleSources}${storageSources}; img-src 'self' data: blob:${googleSources}${storageSources}${config.modes.media === 'live' ? ' https:' : ''}; font-src 'self' data:; frame-src 'self'${googleSources}${config.modes.streetmix === 'live' ? ' https://streetmix.net' : ''}; worker-src 'self' blob:;` },
          watch: { ignored: ['**/test-results/**', '**/playwright-report/**', '**/storybook-static/**', '**/dist/**'] },
        },
      };
    },
    resolveId(id) {
      if (['virtual:local-browser', 'virtual:local-firebase-live'].includes(id)) return `\0${id}`;
    },
    load(id) {
      if (id === '\0virtual:local-browser') return `import ${JSON.stringify(browser('environment.js'))};`;
      if (id === '\0virtual:local-firebase-live') return 'export { useAuth } from "/src/services/firebase.js?local-live";';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        // Vitest owns its tester HTML and inline-module indexes. Only augment
        // the app document and Storybook preview, never Vitest's internal pages.
        const filename = context.filename && path.normalize(context.filename);
        if (filename !== path.join(root, 'index.html') && context.path?.split('?')[0] !== '/iframe.html') return html;
        return {
          html: html.replace(/<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/g, ''),
          tags: [{ tag: 'script', attrs: { type: 'module' }, children: 'import "virtual:local-browser";', injectTo: 'head-prepend' }],
        };
      },
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method === 'POST' && /^\/api\/(?:public-improvements\/)?suggestions$/.test(request.url?.split('?')[0])
          && config.modes.api === 'live' && config.modes.uploads !== 'live') {
          response.writeHead(409, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ message: 'Live submissions require DEV_UPLOADS_MODE=live. Local upload URLs cannot be saved to the live backend; live reads are still available.' }));
          return;
        }
        next();
      });
      server.middlewares.use('/__dev', (_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ modes: config.modes, liveApiOrigin: config.liveApiOrigin, surface,
          runtime: { kind: process.env.DEV_CONTAINER === '1' ? 'docker' : 'native', pid: process.pid,
            instanceId: process.env.DEV_NATIVE_INSTANCE_ID || null } }));
      });
      server.httpServer?.once('listening', () => console.log('[local services]', Object.entries(config.modes).map(([name, mode]) => `${name}=${mode}`).join(' ')));
    },
  };
}
