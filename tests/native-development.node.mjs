import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { developmentSettings, nativeEnvironment, ownsNativeServer } from '../scripts/local-development/native.js';
import { skipAutoplay } from '../.storybook/editing-mode.js';

test('native Storybook routes mocked services through the published app port', () => {
  const settings = developmentSettings({ DEV_APP_PORT: '5191', DEV_STORYBOOK_PORT: '6011' });
  const env = nativeEnvironment(settings, { DEV_API_MODE: 'live', DEV_CONTAINER: '1' }, 'instance-a');
  assert.equal(env.DEV_MOCK_ORIGIN, 'http://127.0.0.1:5191');
  assert.equal(env.DEV_API_MODE, 'live');
  assert.equal(env.DEV_CONTAINER, '0');
  assert.equal(env.STORYBOOK_PUBLIC_EDITING, 'true');
  assert.equal(env.CHOKIDAR_USEPOLLING, 'false');
  assert.equal(env.DEV_NATIVE_INSTANCE_ID, 'instance-a');
  assert.equal(nativeEnvironment(settings, { DEV_MOCK_ORIGIN: 'http://127.0.0.1:4099' }, 'a').DEV_MOCK_ORIGIN, 'http://127.0.0.1:4099');
});

test('ports fail early and worktrees never share ownership records', () => {
  assert.throws(() => developmentSettings({ DEV_APP_PORT: '6006' }), /different ports/);
  for (const value of ['0', '-1', '65536', 'abc']) assert.throws(() => developmentSettings({ DEV_STORYBOOK_PORT: value }), /between/);
  assert.throws(() => developmentSettings({}, ['-d']), /foreground/);
  assert.equal(developmentSettings({}, ['--port', '6012']).storybookPort, 6012);
  assert.notEqual(developmentSettings({}, [], '/one').statePath, developmentSettings({}, [], '/two').statePath);
});

test('shutdown requires the matching checkout, process and instance identity', () => {
  const root = path.resolve('fixture');
  const state = { root, pid: 123, instanceId: 'owned-instance' };
  const payload = { surface: 'storybook', runtime: { kind: 'native', pid: 123, instanceId: 'owned-instance' } };
  assert.equal(ownsNativeServer(state, payload, root), true);
  assert.equal(ownsNativeServer(state, payload, path.resolve('another-checkout')), false);
  for (const runtime of [
    { ...payload.runtime, pid: 124 }, { ...payload.runtime, instanceId: 'another-instance' },
    { ...payload.runtime, kind: 'docker' },
  ]) assert.equal(ownsNativeServer(state, { ...payload, runtime }, root), false);
  assert.equal(ownsNativeServer(state, null, root), false);
  assert.equal(ownsNativeServer(state, { ...payload, surface: 'app' }, root), false);
});

test('editing never suppresses portable tests or production playback', () => {
  const base = { development: true, pathname: '/iframe.html', search: '', defaultEditing: 'true' };
  assert.equal(skipAutoplay(base), true);
  assert.equal(skipAutoplay({ ...base, search: '?editing=false' }), false);
  assert.equal(skipAutoplay({ ...base, defaultEditing: 'false', search: '?editing=true' }), true);
  assert.equal(skipAutoplay({ ...base, pathname: '/__vitest_test__/?session=1' }), false);
  assert.equal(skipAutoplay({ ...base, development: false }), false);
  assert.equal(skipAutoplay({ ...base, pathname: '/storybook/iframe.html' }), true);
});
