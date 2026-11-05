import path from 'node:path';
import { createHash } from 'node:crypto';

export function developmentSettings(env = process.env, args = [], root = process.cwd()) {
  const portArg = args.findIndex(arg => arg === '--port' || arg === '-p');
  const inlinePort = args.find(arg => arg.startsWith('--port='))?.slice(7);
  const port = (value, name) => {
    if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 65535) throw Error(`${name} must be a port between 1 and 65535.`);
    return Number(value);
  };
  if (args.includes('-d') || args.includes('--detach')) throw Error('Native Storybook runs in the foreground. Use dev:docker -- -d for a detached Docker stack.');
  const appPort = port(env.DEV_APP_PORT || 5173, 'DEV_APP_PORT');
  const storybookPort = port(inlinePort || (portArg >= 0 ? args[portArg + 1] : env.DEV_STORYBOOK_PORT) || 6006, 'DEV_STORYBOOK_PORT');
  if (appPort === storybookPort) throw Error('App and Storybook must use different ports.');
  const id = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
  return {
    root: path.resolve(root), appPort, storybookPort,
    appOrigin: `http://127.0.0.1:${appPort}`,
    storybookOrigin: `http://127.0.0.1:${storybookPort}`,
    statePath: path.join(root, 'node_modules/.cache/local-development', `native-storybook-${id}.json`),
  };
}

export function nativeEnvironment(settings, env = process.env, instanceId) {
  return {
    ...env, STORYBOOK_EDITING: 'true', STORYBOOK_PUBLIC_EDITING: 'true',
    DEV_RUNTIME: 'native', DEV_CONTAINER: '0', DEV_NATIVE_INSTANCE_ID: instanceId,
    DEV_MOCK_ORIGIN: env.DEV_MOCK_ORIGIN || settings.appOrigin,
    DEV_STORYBOOK_PUBLIC_ORIGIN: settings.storybookOrigin,
    DEV_STORYBOOK_PORT: String(settings.storybookPort),
    CHOKIDAR_USEPOLLING: 'false', STORYBOOK_DISABLE_TELEMETRY: '1',
  };
}

export function ownsNativeServer(state, payload, root) {
  const runtime = payload?.runtime;
  return Boolean(state && state.root === path.resolve(root) && state.instanceId
    && runtime?.kind === 'native' && payload.surface === 'storybook'
    && state.instanceId === runtime.instanceId && state.pid === runtime.pid);
}
