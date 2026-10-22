import { test, expect } from '@playwright/test';
import { PresentationTestServer, presentationBrowserInit } from './fixtures/presentationServer.js';

const mode = process.env.PRESENTATION_SOCKET_TEST_MODE === 'off' ? 'off' : 'on';
const soakEnabled = process.env.PRESENTATION_SOCKET_SOAK === '1' && mode === 'on';
const appBase = baseURL => new URL('/', baseURL).origin;
const appPath = (baseURL, path) => new URL(path, baseURL).toString();

async function presentationPage(browser, server, baseURL, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', route => server.route(route));
  await context.routeWebSocket('wss://api.presentation.test/api/public-improvements/presentation/ws', route => server.routeWebSocket(route));
  await context.addInitScript(presentationBrowserInit);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function waitForLive(page) {
  await page.waitForFunction(async () => {
    const { presentationSession } = await import('/src/services/presentationSession.js');
    return presentationSession.transportState === 'live' && Boolean(presentationSession.credential?.sessionId);
  });
}

async function sessionId(page) {
  const state = await page.evaluate(async () => {
    const { presentationSession } = await import('/src/services/presentationSession.js');
    return {
      sessionId: presentationSession.credential?.sessionId || null,
      role: presentationSession.role,
      status: presentationSession.status,
      transportState: presentationSession.transportState,
      errorCode: presentationSession.errorCode,
    };
  });
  if (!state.sessionId) throw new Error(`Presentation session credential is missing: ${JSON.stringify(state)}`);
  return state.sessionId;
}

test('socket ready owns TV, remote, and independent audience sessions without polling @socket-on', async ({ browser, baseURL }) => {
  test.skip(mode !== 'on');
  const server = new PresentationTestServer({ appOrigin: appBase(baseURL), apiOrigin: 'https://api.presentation.test' });
  const tv = await presentationPage(browser, server, baseURL, { width: 1920, height: 1080 });
  const presenter = await presentationPage(browser, server, baseURL, { width: 390, height: 844 });
  const audienceA = await presentationPage(browser, server, baseURL, { width: 844, height: 390 });
  const audienceB = await presentationPage(browser, server, baseURL, { width: 844, height: 390 });
  const pages = [tv, presenter, audienceA, audienceB];
  try {
    await tv.page.goto(appPath(baseURL, '/tv'));
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await expect(tv.page.locator('.tv-presenter-code')).toHaveText('01234');
    await waitForLive(tv.page);
    const receiverSessionId = await sessionId(tv.page);

    await audienceA.page.goto(appPath(baseURL, '/audience#view=01234'));
    await audienceB.page.goto(appPath(baseURL, '/audience#view=01234'));
    await waitForLive(audienceA.page);
    await waitForLive(audienceB.page);

    await presenter.page.goto(appPath(baseURL, '/remote#pair=01234'));
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    await waitForLive(presenter.page);
    expect(await sessionId(presenter.page)).toBe(receiverSessionId);

    const syncBaseline = server.syncRequests;
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    const commandAppliedAt = Date.now();
    await presenter.page.getByRole('button', { name: 'Present: Safer crossing at Elm Street' }).click();
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();
    await expect(audienceA.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();
    await expect(audienceA.page.locator('.audience-viewer')).toHaveAttribute('data-following', 'true');
    const commandToVisibleMs = Date.now() - commandAppliedAt;

    await audienceB.page.getByRole('button', { name: 'Photos', exact: true }).click();
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Controller' }).click();
    await presenter.page.getByRole('button', { name: 'Description', exact: true }).click();
    await expect(tv.page.locator('.tv-description')).toContainText('Safer crossing at Elm Street');
    await expect(audienceA.page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(audienceA.page.getByRole('button', { name: 'Return to presenter' })).toBeVisible();
    await expect(audienceB.page.getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(audienceB.page.getByRole('button', { name: 'Return to presenter' })).toBeVisible();

    const stateWritesBeforeClear = server.stateMutations;
    await presenter.page.evaluate(async () => (await import('/src/services/presentationSession.js')).clearPresentedIdea());
    await expect.poll(() => server.stateMutations).toBe(stateWritesBeforeClear + 1);
    await expect.poll(() => tv.page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.content)).toBeNull();

    expect(server.heartbeat(receiverSessionId, 'fixture-heartbeat-1')).toBe(4);
    await expect.poll(() => server.socketPresence.filter(entry => entry.heartbeatId === 'fixture-heartbeat-1').length).toBe(4);
    const presentationKeys = await tv.page.evaluate(() => Object.keys(localStorage).filter(key => /presentation-active|presentation-pending|participantToken/i.test(key)));
    expect(presentationKeys).toEqual([]);
    expect(server.socketAttempts).toBe(4);
    expect(server.socketAuthFrames).toHaveLength(4);
    for (const entry of server.socketAuthFrames) {
      const auth = entry.frame;
      expect(new URL(entry.url).search).toBe('');
      expect(new URL(entry.url).hash).toBe('');
      expect(entry.url).toBe('wss://api.presentation.test/api/public-improvements/presentation/ws');
      expect(Object.keys(auth).sort()).toEqual(['participantId', 'participantToken', 'protocolVersion', 'sessionId', 'socketProtocolVersion', 'type'].sort());
      expect(auth.type).toBe('authenticate');
      expect(auth.socketProtocolVersion).toBe(1);
      expect(auth.protocolVersion).toBe(1);
    }
    await tv.page.waitForTimeout(2200);
    expect(server.syncRequests).toBe(syncBaseline);
    expect(commandToVisibleMs).toBeLessThan(2000);
    console.info(`[presentation-socket] command-to-visible: ${commandToVisibleMs}ms`);
    expect(pages.flatMap(item => item.errors)).toEqual([]);
  } finally {
    await Promise.all(pages.map(item => item.context.close()));
  }
});

test('socket close resumes HTTP fallback and reconnects the same participants @socket-on', async ({ browser, baseURL }) => {
  test.skip(mode !== 'on');
  const server = new PresentationTestServer({ appOrigin: appBase(baseURL), apiOrigin: 'https://api.presentation.test' });
  const tv = await presentationPage(browser, server, baseURL);
  const presenter = await presentationPage(browser, server, baseURL, { width: 390, height: 844 });
  const pages = [tv, presenter];
  try {
    await tv.page.goto(appPath(baseURL, '/tv'));
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await waitForLive(tv.page);
    const originalSession = await sessionId(tv.page);
    await presenter.page.goto(appPath(baseURL, '/remote#pair=01234'));
    await waitForLive(presenter.page);
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    await presenter.page.getByRole('button', { name: 'Present: Safer crossing at Elm Street' }).click();
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();
    const enrollmentsBeforeDrop = server.enrollmentRequests.length;
    const syncsBeforeDrop = server.syncRequests;

    expect(server.dropSockets(originalSession)).toBe(2);
    await expect.poll(() => server.syncRequests, { timeout: 5000 }).toBeGreaterThan(syncsBeforeDrop);
    await expect.poll(async () => Promise.all(pages.map(item => item.page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.transportState))), { timeout: 5000 }).toEqual(['fallback', 'fallback']);
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();
    await expect.poll(() => server.socketAttempts, { timeout: 10_000 }).toBeGreaterThan(2);
    await expect.poll(async () => Promise.all(pages.map(item => item.page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.transportState))), { timeout: 10_000 }).toEqual(['live', 'live']);
    expect(await sessionId(tv.page)).toBe(originalSession);
    expect(await sessionId(presenter.page)).toBe(originalSession);
    expect(server.enrollmentRequests.length).toBe(enrollmentsBeforeDrop);
    expect(server.socketAttempts).toBeGreaterThan(2);
  } finally {
    await Promise.all(pages.map(item => item.context.close()));
  }
});

test('socket feature flag off keeps polling and makes no socket attempts @socket-off', async ({ browser, baseURL }) => {
  test.skip(mode !== 'off');
  const server = new PresentationTestServer({ appOrigin: appBase(baseURL), apiOrigin: 'https://api.presentation.test' });
  const tv = await presentationPage(browser, server, baseURL);
  try {
    await tv.page.goto(appPath(baseURL, '/tv'));
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await expect(tv.page.locator('.tv-presenter-code')).toHaveText('01234');
    await expect.poll(() => server.syncRequests).toBeGreaterThan(0);
    await tv.page.waitForTimeout(1300);
    expect(server.socketAttempts).toBe(0);
    expect(server.syncRequests).toBeGreaterThan(1);
    expect(await tv.page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.transportState)).toBe('fallback');
  } finally {
    await tv.context.close();
  }
});

test('opt-in ten minute idle and interaction soak keeps its socket healthy @socket-soak', async ({ browser, baseURL }) => {
  test.skip(!soakEnabled);
  test.setTimeout(11 * 60_000);
  const server = new PresentationTestServer({ appOrigin: appBase(baseURL), apiOrigin: 'https://api.presentation.test' });
  const tv = await presentationPage(browser, server, baseURL);
  const presenter = await presentationPage(browser, server, baseURL, { width: 390, height: 844 });
  const pages = [tv, presenter];
  const sampledAttempts = [];
  try {
    await tv.page.goto(appPath(baseURL, '/tv'));
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await waitForLive(tv.page);
    const id = await sessionId(tv.page);
    await presenter.page.goto(appPath(baseURL, '/remote#pair=01234'));
    await waitForLive(presenter.page);
    for (let second = 0; second < 600; second++) {
      if (second % 15 === 0) server.heartbeat(id, `soak-${second}`);
      if (second === 300) {
        await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
        await presenter.page.getByRole('menuitem', { name: 'Controller' }).click();
      }
      sampledAttempts.push(server.socketAttempts);
      expect(await tv.page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.transportState)).toBe('live');
      await tv.page.waitForTimeout(1000);
    }
    expect(Math.max(...sampledAttempts)).toBe(2);
    expect(server.enrollmentRequests).toHaveLength(2);
  } finally {
    await Promise.all(pages.map(item => item.context.close()));
  }
});
