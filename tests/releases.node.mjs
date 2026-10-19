import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectReleases } from '../scripts/releaseManifest.js';
import { compareVersions, validateManifest } from '../src/services/releaseVersions.js';
import { createAnnouncementStore, ANNOUNCEMENT_KEY } from '../src/services/announcements.js';
const release = (tag, id = 1) => ({ id, tag_name: tag, name: tag, published_at: '2026-10-19T12:00:00Z', body: 'Notes', html_url: `https://github.com/DallasUrbanists/improvement-map/releases/tag/${tag}` });
test('semantic ordering, eligibility, and pagination', async () => {
  const batches = [[...Array.from({ length: 97 }, () => ({ ...release('v1.0.0'), draft: true })), release('v5.2.0', 2), release('v5.10.0', 3), release('v5.11.0', 4)], [release('v4.0.0', 5), { ...release('v5.9.0'), prerelease: true }, release('preview')]];
  const manifest = await collectReleases({ request: async page => batches[page - 1], isAncestor: async tag => tag !== 'v4.0.0', appVersion: '5.10.0', buildCommit: 'abc' });
  assert.deepEqual(manifest.releases.map(r => r.version), ['5.10.0', '5.2.0']);
  assert.equal(compareVersions('5.10.0', '5.9.0'), 1);
});
test('empty feed is valid, API failures and malformed data fail closed', async () => {
  const args = { isAncestor: async () => true, appVersion: '5.3.0', buildCommit: 'abc' };
  assert.equal((await collectReleases({ ...args, request: async () => [] })).releases.length, 0);
  await assert.rejects(collectReleases({ ...args, request: async () => { throw Error('HTTP 403'); } }), /403/);
  await assert.rejects(collectReleases({ ...args, request: async () => ({ message: 'error' }) }), /invalid/);
  await assert.rejects(collectReleases({ ...args, request: async () => [{ ...release('v5.3.0'), html_url: 'javascript:alert(1)' }] }), /Invalid/);
  assert.throws(() => validateManifest({}), /Invalid/);
});
const storage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }; };
test('baseline, opt out, session memory, and rollback watermark', () => {
  const local = storage(), session = storage(), state = createAnnouncementStore(local, session);
  state.initialize('5.3.0');
  state.skip(true); state.acknowledge('5.2.0'); state.markWelcomeSeen();
  assert.equal(state.read().acknowledged, '5.3.0');
  const restored = createAnnouncementStore(local, session);
  assert.equal(restored.read().skipWelcome, true);
  assert.equal(restored.welcomeSeen(), true);
  state.acknowledge('5.4.0');
  assert.equal(restored.read().acknowledged, '5.4.0');
  local.removeItem(ANNOUNCEMENT_KEY); restored.resetSession();
  assert.equal(restored.read().initialized, false);
  assert.equal(restored.welcomeSeen(), false);
});
test('blocked and corrupt storage retain usable in-memory state', () => {
  for (const local of [{ getItem() { throw Error(); }, setItem() { throw Error(); } }, { getItem() { return '{broken'; }, setItem() { throw Error(); } }, { getItem() { return null; }, setItem() { throw Error(); } }]) {
    const state = createAnnouncementStore(local, storage());
    state.initialize('5.3.0'); state.skip(true); state.acknowledge('5.4.0');
    assert.equal(state.read().acknowledged, '5.4.0');
    assert.equal(state.read().skipWelcome, true);
    assert.match(state.notice.value, /cannot be remembered/);
  }
});
