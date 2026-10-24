import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { stagingOrigin } from '../src/services/stagingOrigin.js';

export const stagingSite = 'https://map-staging-143738155808.web.app';

export function verifyArtifactInfo(info, commit, origin) {
  assert.match(commit || '', /^[a-f0-9]{40}$/, 'Artifact requires the tested frontend commit');
  assert.deepEqual(info, { environment: 'staging', buildCommit: commit, apiBaseUrl: stagingOrigin(origin) });
}

export function verifyBackendIdentity(health) {
  assert.equal(health.status, 'ok', 'Backend must report healthy');
  assert.equal(health.environment, 'staging', 'Backend must identify staging');
  assert.equal(health.service, 'urbanists-cloud-api-server');
  assert.deepEqual(health.databases, ['public-improvements-staging'], 'Backend must identify only the staging store');
  assert.match(health.buildCommit || '', /^[a-f0-9]{40}$/, 'Backend must identify its commit');
  assert.match(health.revision || '', /^urbanists-cloud-api-staging-[a-z0-9-]+$/, 'Backend must identify its staging Cloud Run revision');
  return { backendCommit: health.buildCommit, backendRevision: health.revision };
}

export function verifyHeaders(headers, immutable = false) {
  assert.equal(headers.get('x-robots-tag'), 'noindex, nofollow');
  const cache = headers.get('cache-control') || '';
  if (immutable) {
    assert.match(cache, /max-age=31536000/);
    assert.match(cache, /immutable/);
    assert.doesNotMatch(cache, /must-revalidate|max-age=0(?:\D|$)/);
  } else {
    assert.match(cache, /max-age=0(?:\D|$)/);
    assert.match(cache, /must-revalidate/);
    assert.doesNotMatch(cache, /immutable/);
  }
}

export function frontendTextAssets(names) {
  const required = ['index.html', 'sw.js', 'manifest.webmanifest', 'robots.txt'];
  for (const name of required) assert.ok(names.includes(name), `Missing required frontend asset: ${name}`);
  // virtual:pwa-register embeds registration in the app bundle. Other supported
  // Vite PWA builds emit registerSW.js; verify it only when actually generated.
  return [...required, ...names.filter(name => name === 'registerSW.js' || /^workbox-[\w-]+\.js$/.test(name))];
}

async function get(url) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `Unexpected response for ${new URL(url).pathname}`);
  return response;
}

async function main() {
  const origin = stagingOrigin(process.env.STAGING_API_ORIGIN);
  if (process.argv[2] === 'artifact') {
    verifyArtifactInfo(JSON.parse(readFileSync('dist/build-info.json', 'utf8')), process.env.BUILD_COMMIT, origin);
    console.log('Artifact identifies the tested staging commit and approved API origin.');
    return;
  }
  if (process.argv[2] === 'backend') {
    const identity = verifyBackendIdentity(await (await get(`${origin}/api/health`)).json());
    if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(identity)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    console.log(JSON.stringify(identity));
    return;
  }
  assert.equal(process.argv[2], 'frontend', 'Choose backend or frontend verification');
  const expected = JSON.parse(readFileSync('dist/build-info.json', 'utf8'));
  verifyArtifactInfo(expected, process.env.BUILD_COMMIT, origin);
  const nonce = `?verify=${expected.buildCommit}-${Date.now()}`;
  const metadata = await get(`${stagingSite}/build-info.json${nonce}`);
  verifyHeaders(metadata.headers);
  assert.deepEqual(await metadata.json(), expected);
  const index = readFileSync('dist/index.html', 'utf8');
  for (const route of ['/', '/submit', '/suggestion/staging-route-probe']) {
    const response = await get(`${stagingSite}${route}${nonce}`);
    verifyHeaders(response.headers);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.equal(await response.text(), index, `Direct route ${route} must serve this build's index`);
  }
  for (const file of frontendTextAssets(readdirSync('dist'))) {
    const response = await get(`${stagingSite}/${file}${nonce}`);
    verifyHeaders(response.headers);
    assert.equal(await response.text(), readFileSync(`dist/${file}`, 'utf8'), `Unexpected asset: ${file}`);
  }
  const asset = readdirSync('dist/assets').find(name => /-[\w-]{8}\.js$/.test(name));
  assert.ok(asset, 'Expected a fingerprinted Vite asset');
  verifyHeaders((await get(`${stagingSite}/assets/${asset}`)).headers, true);
  const backend = verifyBackendIdentity(await (await get(`${origin}/api/health`)).json());
  assert.equal(backend.backendCommit, process.env.BACKEND_COMMIT, 'Backend changed during publication; revalidate the pair');
  assert.equal(backend.backendRevision, process.env.BACKEND_REVISION, 'Backend revision changed during publication');
  console.log('Frontend metadata, direct routes, headers, assets and backend pair verified (HTTP only).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
