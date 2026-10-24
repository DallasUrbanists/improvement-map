import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from 'vite';
import { buildInfo, validateStagingBuild } from '../scripts/staging-build.js';
import { branchBase, comparisonBase, draftPrArgs } from '../scripts/branch-policy.js';
import { resolveApiBaseUrl, stagingOrigin } from '../src/services/stagingOrigin.js';
import { validateCloudInputs } from '../scripts/staging-cloud-inputs.js';
import { frontendTextAssets, verifyArtifactInfo, verifyBackendIdentity, verifyHeaders } from '../scripts/verify-staging.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const sha = 'a'.repeat(40);
// Fixture origin only; never a cloud provisioning output or deployment default.
const origin = 'https://staging-api.example.invalid';
const env = {
  VITE_DEPLOY_ENV: 'staging', BASE_PATH: '/', BUILD_COMMIT: sha,
  STAGING_API_ORIGIN: origin, VITE_API_BASE_URL: origin,
  VITE_API_KEY: 'test-api', VITE_GOOGLE_MAPS_API_KEY: 'test-maps',
  VITE_FIREBASE_API_KEY: 'test-firebase', VITE_RECAPTCHA_SITE_KEY: 'test-recaptcha',
  VITE_PRESENTATION_ENABLED: 'false', VITE_PRESENTATION_WEBSOCKET_ENABLED: 'false',
};

function fixture(t) {
  const parent = path.join(root, 'test-results/staging');
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, 'fixture-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=Staging Tests', '-c', 'user.email=staging@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
}

test('staging requires the approved HTTPS origin and public configuration', () => {
  assert.deepEqual(validateStagingBuild(env), { apiBaseUrl: origin });
  for (const value of ['', 'http://staging.example.invalid', 'https://api.dallasurbanists.org', 'https://www.dallasurbanists.org', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://user:password@example.invalid', `${origin}/api`, `${origin}?`, `${origin}#`, `${origin}?key=hidden`, `${origin}#fragment`, 'https://other.example.invalid']) {
    assert.throws(() => validateStagingBuild({ ...env, VITE_API_BASE_URL: value }));
  }
  assert.throws(() => validateStagingBuild({ ...env, STAGING_API_ORIGIN: '' }));
  for (const value of ['https://api.dallasurbanists.org.', 'https://localhost.', 'https://urbanists-cloud-api-server-123.us-central1.run.app']) {
    assert.throws(() => validateStagingBuild({ ...env, STAGING_API_ORIGIN: value, VITE_API_BASE_URL: value }));
  }
  for (const key of ['VITE_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_RECAPTCHA_SITE_KEY', 'VITE_PRESENTATION_ENABLED', 'VITE_PRESENTATION_WEBSOCKET_ENABLED']) {
    assert.throws(() => validateStagingBuild({ ...env, [key]: '' }), new RegExp(key));
  }
  for (const key of ['VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'FIREBASE_APPCHECK_DEBUG_TOKEN']) {
    assert.throws(() => validateStagingBuild({ ...env, [key]: 'debug' }), /debug tokens/);
  }
  assert.throws(() => validateStagingBuild({ ...env, BASE_PATH: '/map/' }), /BASE_PATH/);
  assert.throws(() => validateStagingBuild(env, '/override/'), /BASE_PATH/);
  assert.throws(() => validateStagingBuild({ ...env, DEV: true, PROD: false }), /production Vite build/);
  assert.equal(validateStagingBuild({ BASE_PATH: '/production/' }), null);
});

test('capability API resolution cannot default to production in staging', () => {
  assert.equal(resolveApiBaseUrl(env), origin);
  assert.equal(resolveApiBaseUrl(), 'https://api.dallasurbanists.org');
  assert.equal(resolveApiBaseUrl({ VITE_API_BASE_URL: '/local-api' }), '/local-api');
  assert.throws(() => resolveApiBaseUrl({ VITE_DEPLOY_ENV: 'staging' }));
  assert.throws(() => resolveApiBaseUrl({ ...env, VITE_API_BASE_URL: 'https://api.dallasurbanists.org/' }));
  assert.equal(stagingOrigin(`${origin}/`), origin);
  assert.doesNotMatch(read('src/services/apiBaseUrl.js') + read('src/services/stagingOrigin.js'), /from ['"].*firebase/);
});

test('metadata includes only tested SHA and resolved public origin', () => {
  assert.deepEqual(buildInfo({ ...env, VITE_API_BASE_URL: `${origin}/`, SERVER_SECRET: 'secret', GITHUB_TOKEN: 'token' }), {
    environment: 'staging', buildCommit: sha, apiBaseUrl: origin,
  });
  assert.throws(() => buildInfo({ ...env, BUILD_COMMIT: 'local' }), /BUILD_COMMIT/);
  assert.equal(buildInfo({}), null);
  assert.doesNotThrow(() => verifyArtifactInfo(buildInfo(env), sha, origin));
  assert.throws(() => verifyArtifactInfo(buildInfo(env), 'b'.repeat(40), origin));
  assert.throws(() => verifyArtifactInfo(buildInfo(env), sha, 'https://other.example.invalid'));
  assert.throws(() => verifyArtifactInfo({ ...buildInfo(env), apiKey: 'secret' }, sha, origin));
});

test('the actual Vite config honors mode files and process overrides, rejecting CLI base bypass', async t => {
  const directory = fixture(t);
  const actualSha = git(root, 'rev-parse', 'HEAD');
  const fixtureEnv = { ...env, BUILD_COMMIT: actualSha };
  writeFileSync(path.join(directory, '.env'), 'VITE_API_BASE_URL=https://api.dallasurbanists.org\n');
  writeFileSync(path.join(directory, '.env.production'), Object.entries(fixtureEnv).map(([key, value]) => `${key}=${value}`).join('\n'));
  writeFileSync(path.join(directory, '.env.production.local'), 'VITE_API_KEY=mode-local-test\n');
  // Isolate this test from any developer's local staging or debug environment.
  const keys = new Set([...Object.keys(env), 'VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', 'FIREBASE_APPCHECK_DEBUG_TOKEN', 'NODE_ENV', 'VITE_USER_NODE_ENV']);
  const previous = Object.fromEntries([...keys].map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  process.env.NODE_ENV = 'production';
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const options = { configFile: path.join(root, 'vite.config.js'), envDir: directory, mode: 'production', logLevel: 'silent' };
  const resolveBuild = input => resolveConfig(input, 'build', 'production', 'production');
  const config = await resolveBuild(options);
  assert.equal(config.base, '/');
  assert.equal(config.env.VITE_API_KEY, 'mode-local-test');
  assert.equal(config.env.VITE_API_BASE_URL, origin);
  await assert.rejects(resolveBuild({ ...options, base: '/bypass/' }), /BASE_PATH/);
  process.env.VITE_API_BASE_URL = 'https://api.dallasurbanists.org';
  await assert.rejects(resolveBuild(options), /production aliases/);
  process.env.VITE_API_BASE_URL = origin;
  process.env.VITE_API_KEY = '';
  await assert.rejects(resolveBuild(options), /VITE_API_KEY/);
  process.env.VITE_API_KEY = 'process-test';
  assert.equal((await resolveBuild(options)).env.VITE_API_KEY, 'process-test');
  process.env.NODE_ENV = 'development';
  await assert.rejects(resolveBuild(options), /production Vite build/);
  process.env.NODE_ENV = 'production';
  const ux = await resolveConfig({ ...options, configFile: path.join(root, 'vite.ux.config.js') }, 'serve');
  assert.equal(ux.server.hmr, false, 'UX wrapper must resolve the mode-aware base config');
});

test('branch bases and draft PR arguments retain issue conventions', () => {
  for (const type of ['feature', 'fix', 'refactor', 'docs', 'test', 'chore', 'release']) assert.equal(branchBase(type), 'staging');
  assert.equal(branchBase('hotfix'), 'main');
  assert.deepEqual(draftPrArgs, ['pr', 'create', '--draft', '--fill', '--base', 'staging']);
  for (const branch of ['main', 'staging', 'hotfix/42-bug']) assert.equal(comparisonBase({ branch, exists: ref => ref === 'origin/main' }), 'origin/main');
  assert.equal(comparisonBase({ branch: 'feature/42-idea', exists: ref => ['origin/staging', 'staging'].includes(ref) }), 'origin/staging');
  assert.equal(comparisonBase({ branch: 'feature/42-idea', exists: ref => ref === 'staging' }), 'staging');
  assert.throws(() => comparisonBase({ branch: 'feature/42-idea', exists: ref => ref.includes('main') }), /Missing staging.*bootstrap/);
  assert.throws(() => comparisonBase({ branch: '', exists: () => true }), /explicit comparison base/);
  assert.equal(comparisonBase({ explicit: 'custom', exists: ref => ref === 'custom' }), 'custom');
  assert.throws(() => comparisonBase({ explicit: 'absent', exists: () => false }), /Explicit comparison/);
  assert.match(read('scripts/create-branch.js'), /'--base', base/);
  assert.match(read('scripts/finish-branch.js'), /run\('gh', draftPrArgs\)/);
});

test('local selector uses Git fixture branches and fails without staging or detached base', t => {
  const cwd = fixture(t);
  git(cwd, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(cwd, 'readme.md'), 'base');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'base');
  git(cwd, 'checkout', '-qb', 'feature/42-fixture');
  const select = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/ci-test-matrix.js'), '--local', ...args], { cwd, encoding: 'utf8' });
  let result = select();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing staging/);
  git(cwd, 'branch', 'staging');
  result = select();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).manifest.comparisonBase, 'staging');
  git(cwd, 'update-ref', 'refs/remotes/origin/staging', 'HEAD');
  assert.equal(JSON.parse(select().stdout).manifest.comparisonBase, 'origin/staging');
  assert.equal(JSON.parse(select('main').stdout).manifest.comparisonBase, 'main');
  git(cwd, 'checkout', '--detach', '-q');
  assert.match(select().stderr, /explicit comparison base/);
  assert.equal(select('main').status, 0);
  // Version protection is exercised without invoking npm version or any push.
  const guard = spawnSync(process.execPath, [path.join(root, 'scripts/assert-main.js')], { cwd, encoding: 'utf8' });
  assert.equal(guard.status, 1);
  git(cwd, 'checkout', '-q', 'main');
  assert.equal(spawnSync(process.execPath, [path.join(root, 'scripts/assert-main.js')], { cwd }).status, 0);
});

test('frontend verification accepts bundled registration and checks generated worker files', () => {
  const names = ['index.html', 'sw.js', 'manifest.webmanifest', 'robots.txt', 'workbox-12345678.js', 'assets'];
  assert.deepEqual(frontendTextAssets(names), names.slice(0, -1));
  assert.ok(frontendTextAssets([...names, 'registerSW.js']).includes('registerSW.js'));
  assert.throws(() => frontendTextAssets(names.filter(name => name !== 'sw.js')), /sw.js/);
});

test('cloud inputs and backend identity fail closed without a receipt', () => {
  assert.throws(() => validateCloudInputs({}));
  const cloud = { STAGING_API_ORIGIN: origin, GCP_PROJECT_ID: 'urbanists-mixer-slides-helper', GCP_WORKLOAD_IDENTITY_PROVIDER: 'projects/123/locations/global/workloadIdentityPools/test/providers/test', GCP_SERVICE_ACCOUNT: 'map-staging-deployer@urbanists-mixer-slides-helper.iam.gserviceaccount.com' };
  assert.doesNotThrow(() => validateCloudInputs(cloud));
  for (const key of Object.keys(cloud)) assert.throws(() => validateCloudInputs({ ...cloud, [key]: '' }));
  const health = { status: 'ok', environment: 'staging', service: 'urbanists-cloud-api-server', databases: ['public-improvements-staging'], buildCommit: sha, revision: 'urbanists-cloud-api-staging-00001-test' };
  assert.equal(verifyBackendIdentity(health).backendCommit, sha);
  for (const change of [{ environment: 'production' }, { databases: ['public-improvements'] }, { databases: ['public-improvements-staging', 'production'] }, { buildCommit: '' }, { revision: '' }]) assert.throws(() => verifyBackendIdentity({ ...health, ...change }));
});

test('production and staging workflow guards cover dispatch and release refs', () => {
  const production = read('.github/workflows/deploy.yml');
  const staging = read('.github/workflows/deploy-staging.yml');
  const productionGuard = production.match(/    if: (.+)/)[1];
  const stagingGuard = staging.match(/    if: (.+)/)[1];
  const evaluate = (guard, event, ref) => Function(`return (${guard.replaceAll('github.event_name', JSON.stringify(event)).replaceAll('github.ref', JSON.stringify(ref))})`)();
  for (const [event, ref, prod, stage] of [
    ['push', 'refs/heads/main', true, false], ['workflow_dispatch', 'refs/heads/main', true, false],
    ['workflow_dispatch', 'refs/heads/staging', false, true], ['push', 'refs/heads/staging', false, true],
    ['workflow_dispatch', 'refs/heads/feature/test', false, false], ['release', 'refs/tags/v5.4.3', true, false],
    ['push', 'refs/tags/staging', false, false], ['pull_request_target', 'refs/heads/staging', false, false],
  ]) {
    assert.equal(evaluate(productionGuard, event, ref), prod, `${event} ${ref} production`);
    assert.equal(evaluate(stagingGuard, event, ref), stage, `${event} ${ref} staging`);
  }
  assert.equal(production.match(/    if: /g).length, 2);
  assert.equal(staging.match(/    if: github.ref/g).length, 2);
  assert.match(production, /github.event_name == 'release' && 'main' \|\| github.sha/);
  assert.match(staging, /--only hosting:staging --non-interactive/);
  assert.doesNotMatch(staging.split('  deploy:')[0], /id-token: write/);
  assert.match(staging, /ref: \$\{\{ needs.checks-and-build.outputs.commit \}\}/);
  assert.doesNotMatch(staging, /secrets\.VITE_|FIREBASE_TOKEN|pull_request_target/);
  assert.equal(JSON.parse(read('package.json')).scripts.build, 'vite build');
});

test('Firebase local server applies rewrite and overlapping cache headers correctly', async t => {
  const cwd = fixture(t);
  mkdirSync(path.join(cwd, 'dist/assets'), { recursive: true });
  mkdirSync(path.join(cwd, 'dist/icons'), { recursive: true });
  const files = {
    'index.html': '<html>staging fixture</html>', '404.html': '<html>404</html>',
    'sw.js': '// service worker', 'registerSW.js': '// registration', 'workbox-12345678.js': '// workbox',
    'manifest.webmanifest': '{}', 'build-info.json': JSON.stringify(buildInfo(env)),
    'robots.txt': 'User-agent: *', 'icons/icon.png': 'fixture',
    'assets/app-abcdefgh.js': '// hashed script', 'assets/unversioned.js': '// public fixture',
    'assets/public.png': 'unhashed image',
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(cwd, 'dist', name), body);
  const require = createRequire(import.meta.url);
  // Same server dependency used by the pinned Firebase Hosting emulator; no cloud calls.
  const firebaseRequire = createRequire(require.resolve('firebase-tools/package.json'));
  // Hosting CI runs on Linux. Superstatic's old glob-slash utility otherwise
  // turns URL globs into Windows filesystem separators, breaking its matcher.
  const globSlash = firebaseRequire('glob-slash');
  const originalNormalize = globSlash.normalize;
  if (process.platform === 'win32') globSlash.normalize = value => path.posix.normalize(path.posix.join('/', value));
  t.after(() => { globSlash.normalize = originalNormalize; });
  const superstatic = firebaseRequire('superstatic').default;
  const config = JSON.parse(read('firebase.json')).hosting;
  const targets = JSON.parse(read('.firebaserc')).targets;
  assert.deepEqual(targets['urbanists-mixer-slides-helper'].hosting.staging, ['map-staging-143738155808']);
  assert.equal(config.public, 'dist');
  assert.equal(config.target, 'staging');
  const handler = superstatic({ config, cwd, fallthrough: false });
  const server = createServer((request, response) => handler(request, response, error => {
    response.statusCode = error ? 500 : 404;
    response.end(error?.message || 'Not found');
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/', '/submit', '/suggestion/fixture', ...Object.keys(files).map(file => `/${file}`)]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, route === '/404.html' ? 404 : 200, route);
    try { verifyHeaders(response.headers, route === '/assets/app-abcdefgh.js'); }
    catch (error) { throw new Error(`${route}: ${error.message}; headers=${JSON.stringify([...response.headers])}`, { cause: error }); }
    assert.equal(await response.text(), files[route.slice(1)] || files['index.html'], route);
  }
});
