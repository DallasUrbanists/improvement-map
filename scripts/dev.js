import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { developmentSettings, nativeEnvironment, ownsNativeServer } from './local-development/native.js';
import { applyVitestStartupWorkaround } from './storybook-vitest-workaround.js';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const [action = 'start', ...args] = process.argv.slice(2);
const settings = developmentSettings(process.env, action === 'start' ? args : [], root);
const readState = () => {
  try { return JSON.parse(readFileSync(settings.statePath, 'utf8')); } catch { return null; }
};
const removeState = () => { if (existsSync(settings.statePath)) unlinkSync(settings.statePath); };
function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
async function health(origin) {
  try {
    const response = await fetch(`${origin}/__dev`, { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
function killTree(pid) {
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status && result.status !== 128) throw Error(`Could not stop native Storybook (PID ${pid}).`);
  } else {
    try { process.kill(-pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
}
async function stopNative() {
  const state = readState();
  if (!state) return;
  const payload = await health(state.origin);
  if (ownsNativeServer(state, payload, root)) {
    writeFileSync(settings.statePath, JSON.stringify({ ...state, stopping: true }));
    killTree(state.pid);
    const deadline = Date.now() + 2000;
    while (readState()?.instanceId === state.instanceId && Date.now() < deadline) await sleep(50);
    console.log('Stopped native Storybook.');
  } else {
    if (processAlive(state.pid)) throw Error('Saved Storybook process could not be verified. Stop its original terminal; no unverified process was terminated.');
  }
  removeState();
}
function docker(arguments_, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', arguments_, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', error => reject(Error(`Docker could not start: ${error.message}. Start Docker and build the development image first.`)));
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(Error(`docker ${arguments_.join(' ')} exited with ${code ?? signal}.`)));
  });
}
async function portBusy(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = busy => { socket.destroy(); resolve(busy); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(true));
  });
}
async function startNative() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 24 || (major === 24 && minor < 12)) throw Error('Use Node 24.21.0 (.nvmrc); Node 24.12.0+ is required.');
  if (!existsSync(path.join(root, 'node_modules/storybook/dist/bin/dispatcher.js'))) throw Error('Run npm ci on the host before starting native Storybook.');
  const existing = readState();
  const alreadyRunning = ownsNativeServer(existing, existing && await health(existing.origin), root);
  if (alreadyRunning && existing.origin !== settings.storybookOrigin) throw Error(`This checkout already owns Storybook at ${existing.origin}. Stop it before changing ports.`);
  if (existing && !alreadyRunning && processAlive(existing.pid)) throw Error('Saved Storybook process could not be verified. Stop its original terminal before starting another.');
  execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { cwd: root, stdio: 'ignore', timeout: 15000 });
  // Explicitly stop only this Compose project's optional Storybook container.
  await docker(['compose', 'stop', 'storybook']);
  await docker(['compose', 'up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '180', 'web', 'mock'],
    { ...process.env, DEV_STORYBOOK_PORT: String(settings.storybookPort) });
  if (alreadyRunning) {
    console.log(`Native Storybook is already running at ${settings.storybookOrigin}/`);
    return;
  }
  const deadline = Date.now() + 10000;
  while (await portBusy(settings.storybookPort)) {
    if (Date.now() >= deadline) throw Error(`Port ${settings.storybookPort} is occupied. Stop that server or set DEV_STORYBOOK_PORT; no unrelated process was terminated.`);
    await sleep(250);
  }
  applyVitestStartupWorkaround();
  const instanceId = randomUUID();
  const child = spawn(process.execPath, [
    'node_modules/storybook/dist/bin/dispatcher.js', 'dev', '-p', String(settings.storybookPort),
    '--host', '127.0.0.1', '--no-open', '--ci', '--exact-port', ...args,
  ], { cwd: root, env: nativeEnvironment(settings, process.env, instanceId), stdio: 'inherit', detached: process.platform !== 'win32', windowsHide: true });
  mkdirSync(path.dirname(settings.statePath), { recursive: true });
  writeFileSync(settings.statePath, JSON.stringify({ root, pid: child.pid, instanceId, origin: settings.storybookOrigin,
    composeProject: process.env.COMPOSE_PROJECT_NAME || null }));
  console.log(`App: ${settings.appOrigin}/ | Storybook: ${settings.storybookOrigin}/`);
  console.log('Storybook editing mode: autoplay and the test widget are off. Run npm run test:storybook for Docker tests.');
  console.log('Ctrl+C stops Storybook. App/mocks stay available; npm run dev:stop stops the full development stack.');
  let stopping = false;
  const stop = () => { if (!stopping) { stopping = true; killTree(child.pid); } };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', value => resolve(value)); });
    if (!stopping && !readState()?.stopping && code) process.exitCode = code;
  } finally {
    process.off('SIGINT', stop); process.off('SIGTERM', stop);
    if (readState()?.instanceId === instanceId) removeState();
  }
}
try {
  if (action === 'start') await startNative();
  else if (action === 'stop') {
    const savedProject = readState()?.composeProject;
    let stopError;
    try { await stopNative(); } catch (error) { stopError = error; }
    await docker(['compose', 'stop', 'storybook', 'web', 'mock'],
      savedProject ? { ...process.env, COMPOSE_PROJECT_NAME: savedProject } : process.env);
    if (stopError) throw stopError;
  } else if (action === 'docker') {
    await stopNative();
    await docker(['compose', '--profile', 'storybook', 'up', '--no-build', '--pull', 'never', ...args],
      { ...process.env, STORYBOOK_EDITING: 'false', STORYBOOK_PUBLIC_EDITING: 'false' });
  } else throw Error('Use start, stop or docker.');
} catch (error) { console.error(`Development startup: ${error.message}`); process.exitCode = 1; }
