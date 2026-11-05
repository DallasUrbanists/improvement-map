import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

export const dependencyNames = ['maps', 'overpass', 'api', 'uploads', 'assist', 'streetmix', 'presentation', 'auth', 'appcheck', 'geolocation', 'speech', 'media'];

// Deliberately read only this opt-in file, never the existing .env/.env.local.
export function localConfiguration({ root = process.cwd(), env = process.env, staticCatalog = false } = {}) {
  const file = path.join(root, '.env.development.local');
  const values = { ...(existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {}), ...env };
  const modes = Object.fromEntries(dependencyNames.map(name => {
    const value = staticCatalog || env.DEV_FORCE_MOCKS === '1' ? 'mock' : values[`DEV_${name.toUpperCase()}_MODE`] || 'mock';
    if (!['mock', 'live'].includes(value)) throw Error(`DEV_${name.toUpperCase()}_MODE must be mock or live.`);
    return [name, value];
  }));
  const mapsKey = modes.maps === 'live' ? values.VITE_GOOGLE_MAPS_API_KEY || '' : '';
  if (modes.maps === 'live' && !mapsKey.trim()) throw Error('Live Maps requires VITE_GOOGLE_MAPS_API_KEY authorized for localhost:5173 and localhost:6006.');
  const cloudLive = ['api', 'uploads', 'assist', 'streetmix', 'presentation'].some(name => modes[name] === 'live');
  let liveApiOrigin = '';
  if (cloudLive) {
    let url;
    try { url = new URL(values.DEV_LIVE_API_ORIGIN || 'invalid'); }
    catch { throw Error('Live Cloud API services require an explicit approved DEV_LIVE_API_ORIGIN.'); }
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password
      || /(?:^|\.)dallasurbanists\.org$/i.test(url.hostname) || /^urbanists-cloud-api-server(?:-|\.)/.test(url.hostname)) {
      throw Error('DEV_LIVE_API_ORIGIN must be an explicit staging HTTPS origin, without credentials, paths, queries or production aliases.');
    }
    liveApiOrigin = url.origin;
    if (!values.VITE_API_KEY?.trim()) throw Error('Live Cloud API services require VITE_API_KEY; App Check/CORS must also allow the development origin.');
  }
  for (const name of ['FIREBASE_API_KEY', 'RECAPTCHA_SITE_KEY']) {
    if ((name === 'FIREBASE_API_KEY' && (modes.auth === 'live' || modes.appcheck === 'live') || name === 'RECAPTCHA_SITE_KEY' && modes.appcheck === 'live')
      && !values[`VITE_${name}`]?.trim()) throw Error(`Live Firebase requires VITE_${name}.`);
  }
  return {
    modes, mapsKey, liveApiOrigin,
    mockOrigin: values.DEV_MOCK_ORIGIN || 'http://127.0.0.1:4010',
    storybookOrigin: values.DEV_STORYBOOK_PUBLIC_ORIGIN || 'http://localhost:6006',
    apiKey: cloudLive ? values.VITE_API_KEY : '',
    firebaseKey: modes.auth === 'live' || modes.appcheck === 'live' ? values.VITE_FIREBASE_API_KEY : '',
    recaptchaKey: modes.appcheck === 'live' ? values.VITE_RECAPTCHA_SITE_KEY : '',
    appCheckDebugToken: modes.appcheck === 'live' ? values.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN || '' : '',
  };
}

export function dependencyForPath(pathname) {
  if (pathname.startsWith('/__overpass')) return 'overpass';
  if (pathname.startsWith('/__mock/')) return 'mock';
  if (pathname.includes('/presentation')) return 'presentation';
  if (pathname.endsWith('/upload-url') || pathname.startsWith('/__uploads/')) return 'uploads';
  if (pathname.startsWith('/api/assist/')) return 'assist';
  if (pathname.includes('/streetmix')) return 'streetmix';
  return 'api';
}
