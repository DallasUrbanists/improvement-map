import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localConfiguration, dependencyForPath } from '../scripts/local-development/config.js';
import { createMockServer } from '../scripts/local-development/mock-server.js';
import { localDevelopmentPlugin } from '../scripts/local-development/vite-plugin.js';
import { seedSuggestions } from '../dev/fixtures.js';

function temporary(t) { const root = mkdtempSync(path.join(tmpdir(), 'improvement-map-local-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }

test('local setup ignores legacy credentials and defaults every dependency to mock', t => {
  const root = temporary(t);
  writeFileSync(path.join(root, '.env'), 'VITE_API_BASE_URL=https://production.example\nVITE_GOOGLE_MAPS_API_KEY=legacy-key');
  const config = localConfiguration({ root, env: { VITE_GOOGLE_MAPS_API_KEY: 'legacy-process-key' } });
  assert.ok(Object.values(config.modes).every(value => value === 'mock'));
  assert.equal(config.mapsKey, ''); assert.equal(config.apiKey, ''); assert.equal(config.liveApiOrigin, '');
});
test('Maps alone can be live, with overrides confined to the local development file', t => {
  const root = temporary(t);
  writeFileSync(path.join(root, '.env.development.local'), 'DEV_MAPS_MODE=live\nVITE_GOOGLE_MAPS_API_KEY=local-browser-key');
  const config = localConfiguration({ root, env: {} });
  assert.equal(config.modes.maps, 'live'); assert.equal(config.mapsKey, 'local-browser-key');
  assert.ok(Object.entries(config.modes).filter(([key]) => key !== 'maps').every(([, value]) => value === 'mock'));
  const built = localConfiguration({ root, env: {}, staticCatalog: true });
  assert.equal(built.modes.maps, 'mock'); assert.equal(built.mapsKey, '');
  assert.equal(localConfiguration({ root, env: { DEV_FORCE_MOCKS: '1' } }).modes.maps, 'mock');
});
test('invalid modes and missing live inputs fail instead of falling back', t => {
  const root = temporary(t);
  assert.throws(() => localConfiguration({ root, env: { DEV_MAPS_MODE: 'automatic' } }), /mock or live/);
  assert.throws(() => localConfiguration({ root, env: { DEV_MAPS_MODE: 'live' } }), /VITE_GOOGLE_MAPS_API_KEY/);
  assert.throws(() => localConfiguration({ root, env: { DEV_API_MODE: 'live', DEV_LIVE_API_ORIGIN: 'https://api.dallasurbanists.org' } }), /staging HTTPS/);
  assert.equal(dependencyForPath('/api/public-improvements/suggestions/upload-url'), 'uploads');
  assert.equal(dependencyForPath('/api/public-improvements/presentation/ws'), 'presentation');
  assert.equal(dependencyForPath('/api/suggestions/1/streetmix'), 'streetmix');
});
test('the sandbox cannot build a deployable application and does not override Vitest caches', () => {
  const plugin = localDevelopmentPlugin();
  assert.throws(() => plugin.configResolved({ command: 'build' }), /development-only/);
  assert.doesNotThrow(() => plugin.configResolved({ command: 'serve' }));
  assert.equal(plugin.config({ cacheDir: '/isolated/test-project-cache' }).cacheDir, '/isolated/test-project-cache');
  assert.doesNotThrow(() => localDevelopmentPlugin({ surface: 'storybook', staticCatalog: true }).configResolved({ command: 'build' }));
});
test('mock HTTP preserves read/creation envelopes, errors, upload bytes and restart persistence', async t => {
  const dataDir = temporary(t);
  let server = createMockServer({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  const request = (pathname, body) => fetch(`${origin}${pathname}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (await request('/api/public-improvements/suggestions')).json()).data.length, 3);
  assert.equal((await request('/api/public-improvements/suggestions', {})).status, 422);
  const response = await request('/api/public-improvements/suggestions', { content: { details: 'A synthetic crossing request' }, location: { latitude: 32.78, longitude: -96.8 } });
  assert.equal(response.status, 201); const saved = (await response.json()).data;
  assert.equal((await (await request(`/api/suggestions/${saved.id}`)).json()).data.content.details, 'A synthetic crossing request');
  assert.equal((await (await request(`/api/suggestions/${saved.id}/recommended-actions`)).json()).data.length, 3);
  const representatives = await (await request(`/api/suggestions/${saved.id}/representatives`)).json();
  assert.equal(representatives.length, 4);
  assert.deepEqual(saved.representatives, representatives);
  const upload = (await (await request('/api/public-improvements/suggestions/upload-url', { contentType: 'image/webp' })).json()).data;
  const bytes = Buffer.from('RIFF-local-image-bytes-WEBP');
  assert.equal((await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: bytes })).status, 200);
  assert.deepEqual(Buffer.from(await (await fetch(upload.publicUrl)).arrayBuffer()), bytes);
  assert.equal((await request('/api/not-implemented')).status, 404);
  const osm = await (await request('/__overpass', {})).json();
  assert.ok(osm.elements.length > 0);
  assert.ok(osm.elements.every(item => item.type === 'way' && Number.isSafeInteger(item.id) && item.geometry.length > 0));
  await new Promise(resolve => server.close(resolve));
  server = createMockServer({ dataDir }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await request('/api/public-improvements/suggestions')).json()).data.length, 4);
  assert.deepEqual(await (await request(`/api/public-improvements/suggestions/${saved.id}/representatives?limit=500`)).json(), representatives);
  assert.deepEqual(Buffer.from(await (await fetch(`${origin}${new URL(upload.publicUrl).pathname}`)).arrayBuffer()), bytes);
  await request('/__mock/reset', {});
  assert.equal((await (await request('/api/public-improvements/suggestions')).json()).data.length, 3);
  assert.equal((await (await request('/api/suggestions/3/recommended-actions')).json()).data.length, 3);
  for (const suggestion of (await (await request('/api/suggestions')).json()).data) {
    assert.equal((await (await request(`/api/suggestions/${suggestion.id}/representatives`)).json()).length, 4);
  }
});

test('mock startup backfills and persists representatives for every suggestion while preserving existing data', async t => {
  const dataDir = temporary(t);
  const existing = seedSuggestions();
  existing[0].representatives = [{ id: 'custom-representative', name: 'Existing fixture' }];
  existing[1].representatives = [];
  existing.push({ id: 42, content: { details: 'A previously saved suggestion' } });
  writeFileSync(path.join(dataDir, 'suggestions.json'), JSON.stringify(existing));
  const server = createMockServer({ dataDir });
  t.after(async () => { if (server.listening) await new Promise(resolve => server.close(resolve)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const stored = JSON.parse(readFileSync(path.join(dataDir, 'suggestions.json'), 'utf8'));
  const ids = new Set();
  for (const suggestion of stored) {
    const response = await fetch(`${origin}/api/public-improvements/suggestions/${suggestion.id}/representatives?limit=500`);
    assert.equal(response.status, 200);
    const representatives = await response.json();
    assert.deepEqual(representatives, suggestion.representatives);
    if (suggestion.id === 1) {
      assert.deepEqual(representatives, existing[0].representatives);
      continue;
    }
    assert.equal(representatives.length, 4);
    for (const representative of representatives) {
      assert.ok(!ids.has(representative.id));
      ids.add(representative.id);
      assert.match(representative.name, /synthetic/);
      assert.ok(representative.title && representative.boundary.entityName && representative.boundary.bodyName && representative.boundary.districtName);
      assert.ok(representative.emails.every(email => email.endsWith('@representatives.example.invalid')));
      assert.ok(representative.phones.every(phone => /^\+1214555010[0-3]$/.test(phone)));
      assert.equal(new URL(representative.webpage_url).hostname, 'representatives.example.invalid');
    }
  }
  assert.equal((await fetch(`${origin}/api/suggestions/999/representatives`)).status, 404);
});

test('mock startup persists actions for every stored suggestion and preserves existing actions', async t => {
  const dataDir = temporary(t);
  const existing = seedSuggestions();
  existing[0].recommendedActions = [{ id: 'existing', summary: 'Keep this action' }];
  existing.push({ id: 42, content: { summary: 'Repair a sidewalk', details: 'Uneven pavement' }, location: { address: 'Test Street' } });
  writeFileSync(path.join(dataDir, 'suggestions.json'), JSON.stringify(existing));
  let server;
  t.after(async () => { if (server?.listening) await new Promise(resolve => server.close(resolve)); });
  let firstResults;
  for (let restart = 0; restart < 2; restart++) {
    server = createMockServer({ dataDir });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const results = [];
    for (const suggestion of existing) {
      const response = await fetch(`${origin}/api/public-improvements/suggestions/${suggestion.id}/recommended-actions`);
      assert.equal(response.status, 200);
      const { data } = await response.json();
      results.push(data);
      if (suggestion.id === 1) assert.deepEqual(data, suggestion.recommendedActions);
      else {
        assert.equal(data.length, 3);
        assert.equal(new Set(data.map(action => action.id)).size, 3);
        assert.ok(data.every(action => action.instructions.includes(suggestion.content.summary) && action.instructions.includes('Synthetic mock action') && action.reason));
      }
    }
    assert.match(results[1][0].summary, /cycling/);
    assert.match(results[2][0].summary, /shade/);
    assert.match(results[3][0].summary, /sidewalk/);
    if (restart) assert.deepEqual(results, firstResults);
    else firstResults = results;
    await new Promise(resolve => server.close(resolve));
  }
});
