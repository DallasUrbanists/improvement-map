import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { dependencyNames } from './local-development/config.js';

const appPort = Number(process.env.DEV_APP_PORT || 5173);
const storybookPort = Number(process.env.DEV_STORYBOOK_PORT || 6006);
const mockPort = Number(process.env.MOCK_PORT || 4010);

async function probe(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return { operational: response.ok, response };
  } catch {
    return { operational: false, response: null };
  }
}

function composeServices() {
  try {
    const output = execFileSync('docker', ['compose', 'ps', '--all', '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Map(output.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const service = JSON.parse(line);
      return [service.Service, service];
    }));
  } catch {
    return null;
  }
}

function containerHealth(service) {
  const container = compose?.get(service);
  if (!container) return null;
  const operational = container.State === 'running' && (!container.Health || container.Health === 'healthy');
  return { operational, source: 'Docker Compose' };
}

const compose = composeServices();

const appUrl = `http://localhost:${appPort}`;
const storybookUrl = `http://localhost:${storybookPort}`;
const mockUrl = `http://localhost:${mockPort}`;
const [app, storybook, mock] = await Promise.all([
  probe(`${appUrl}/__dev`),
  probe(`${storybookUrl}/index.json`),
  probe(`${mockUrl}/__mock/health`),
]);
const appHealth = containerHealth('web') || { operational: app.operational, source: 'HTTP probe' };
const storybookHealth = containerHealth('storybook') || { operational: storybook.operational, source: 'HTTP probe' };
const mockHealth = containerHealth('mock') || (mock.response
  ? { operational: mock.operational, source: 'HTTP probe' }
  : { operational: null, source: 'container-only; Docker Compose unavailable' });

let runtimeModes;
if (app.operational) {
  try {
    const payload = await app.response.json();
    if (payload.modes && typeof payload.modes === 'object') runtimeModes = payload.modes;
  } catch {
    // Fall back to local configuration if the app health response is not JSON.
  }
}

const configPath = '.env.development.local';
const fileValues = existsSync(configPath) ? parseEnv(readFileSync(configPath, 'utf8')) : {};
const configuredValues = { ...fileValues, ...process.env };
const modes = Object.fromEntries(dependencyNames.map((name) => [
  name,
  runtimeModes?.[name]
    || (process.env.DEV_FORCE_MOCKS === '1' ? 'mock' : configuredValues[`DEV_${name.toUpperCase()}_MODE`] || 'mock'),
]));

const mockBackedServices = new Set(['overpass', 'api', 'uploads', 'assist', 'streetmix', 'presentation']);
const healthLabel = (isOperational) => isOperational === null ? 'unknown' : isOperational ? 'operational' : 'failing';

console.log('Development services');
console.log(`App        ${healthLabel(appHealth.operational).toUpperCase().padEnd(13)} ${appUrl}/ (${appHealth.source})`);
console.log(`Storybook  ${healthLabel(storybookHealth.operational).toUpperCase().padEnd(13)} ${storybookUrl}/ (${storybookHealth.source})`);
console.log(`Mock       ${healthLabel(mockHealth.operational).toUpperCase().padEnd(13)} ${mockHealth.source}`);
console.log('\nService modes and health');
for (const name of dependencyNames) {
  const mode = modes[name] === 'live' ? 'live' : 'mock';
  const health = mode === 'mock' && mockBackedServices.has(name) ? mockHealth : appHealth;
  const operational = health.operational;
  const source = mode === 'mock' && mockBackedServices.has(name) ? 'mock container' : 'app';
  console.log(`${name.padEnd(15)} ${mode.toUpperCase().padEnd(6)} ${healthLabel(operational)} (${source})`);
}
