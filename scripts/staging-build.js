import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';
import { stagingOrigin } from '../src/services/stagingOrigin.js';

export function validateStagingBuild(env, base = env.BASE_PATH) {
  if (env.VITE_DEPLOY_ENV !== 'staging') return null;
  if (env.DEV === true || env.PROD === false || env.NODE_ENV === 'development') {
    throw new Error('Staging requires a production Vite build; App Check debug mode is forbidden.');
  }
  if (env.BASE_PATH !== '/' || base !== '/') throw new Error('Staging requires BASE_PATH=/ and the root Vite base.');
  const apiBaseUrl = stagingOrigin(env.VITE_API_BASE_URL);
  if (apiBaseUrl !== stagingOrigin(env.STAGING_API_ORIGIN)) throw new Error('Staging API origin does not match approved STAGING_API_ORIGIN.');
  for (const key of ['VITE_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_RECAPTCHA_SITE_KEY']) {
    if (!env[key]?.trim()) throw new Error(`Missing staging build input: ${key}`);
  }
  for (const key of ['VITE_PRESENTATION_ENABLED', 'VITE_PRESENTATION_WEBSOCKET_ENABLED']) {
    if (!['true', 'false'].includes(env[key])) throw new Error(`Staging requires explicit true/false: ${key}`);
  }
  if (env.VITE_PRESENTATION_WEBSOCKET_ENABLED === 'true' && env.VITE_PRESENTATION_ENABLED !== 'true') {
    throw new Error('Presentation sockets require the presentation feature.');
  }
  for (const [key, value] of Object.entries(env)) {
    if (/APPCHECK_DEBUG_TOKEN/i.test(key) && value?.trim()) throw new Error('App Check debug tokens are forbidden in staging builds.');
  }
  return { apiBaseUrl };
}

export function buildInfo(env, base) {
  const staging = validateStagingBuild(env, base);
  if (!staging) return null;
  if (!/^[a-f0-9]{40}$/.test(env.BUILD_COMMIT || '')) throw new Error('Staging requires the full tested BUILD_COMMIT SHA.');
  return { environment: 'staging', buildCommit: env.BUILD_COMMIT, apiBaseUrl: staging.apiBaseUrl };
}

// Resolve from Vite's actual mode/envDir/env plus process overrides, including
// non-browser approval inputs. This hook also sees CLI --base overrides.
export function stagingBuildPlugin() {
  let info;
  let outDir;
  return {
    name: 'staging-build',
    apply: 'build',
    configResolved(config) {
      const env = { ...loadEnv(config.mode, config.envDir, ''), ...process.env, ...config.env };
      info = buildInfo(env, config.base);
      if (info && info.buildCommit !== execFileSync('git', ['rev-parse', 'HEAD'], { cwd: config.root, encoding: 'utf8' }).trim()) {
        throw new Error('BUILD_COMMIT must identify the source being built.');
      }
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // Workbox's sequential closeBundle runs first; metadata never enters precache.
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        if (info) writeFileSync(path.join(outDir, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
      },
    },
  };
}
