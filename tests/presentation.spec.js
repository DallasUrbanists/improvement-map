import { test, expect } from '@playwright/test';
import { PresentationTestServer, presentationBrowserInit } from './fixtures/presentationServer.js';

async function presentationPage(browser, server, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.route('**/*', route => server.route(route));
  await context.addInitScript(presentationBrowserInit);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

test('TV, presenter, and two audience contexts stay synchronized without sharing viewer state', async ({ browser }) => {
  const server = new PresentationTestServer();
  const tv = await presentationPage(browser, server, { width: 1920, height: 1080 });
  const presenter = await presentationPage(browser, server, { width: 390, height: 844 });
  const audienceA = await presentationPage(browser, server, { width: 844, height: 390 });
  const audienceB = await presentationPage(browser, server, { width: 844, height: 390 });
  const contexts = [tv, presenter, audienceA, audienceB];
  try {
    await tv.page.goto('http://localhost:5173/tv');
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await expect(tv.page.locator('.tv-presenter-code')).toHaveText('ABCD 2345');
    await expect(tv.page.getByRole('img', { name: 'QR code for presenter pairing link' })).toBeVisible();
    await expect(tv.page.locator('.map-workspace')).toHaveCount(0);
    const enrollment = server.enrollmentRequests.find(item => item.method === 'POST' && !item.body.code);
    expect(enrollment.body.participantToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(enrollment.headers.authorization).toBeUndefined();
    const transport = await tv.page.evaluate(() => window.__presentationTransport);
    expect(transport.length).toBeGreaterThan(0);
    expect(transport.every(item => item.cache === 'no-store' && item.credentials === 'omit' && !item.hasFirebaseAuth)).toBe(true);
    expect(transport.some(item => item.hasBearer)).toBe(true);
    expect(await tv.page.evaluate(() => Object.keys(localStorage).filter(key => /presentation-active|presentation-pending|participantToken/i.test(key)))).toEqual([]);

    await audienceA.page.goto('http://localhost:5173/audience#view=WXYZ6789');
    await audienceB.page.goto('http://localhost:5173/audience#view=WXYZ6789');
    await expect(audienceA.page.getByText('Waiting for the presenter')).toBeVisible();
    await expect.poll(() => [...server.sessions.values()][0].participants.size).toBe(3);

    await presenter.page.goto('http://localhost:5173/remote#pair=ABCD2345');
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    await expect(presenter.page.getByText('TV connected')).toBeVisible();
    await expect.poll(() => [...server.sessions.values()][0].participants.size).toBe(4);

    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    await expect(presenter.page.getByText('Protected bike lane on Main Street')).toBeVisible();
    await presenter.page.getByRole('button', { name: 'Present this idea: Protected bike lane on Main Street' }).click();
    await expect(tv.page.getByText('Protected bike lane on Main Street').first()).toBeVisible();
    await expect(tv.page.locator('[data-presentation-map="receiver"]')).toHaveCount(1);
    await expect.poll(() => [...server.sessions.values()][0].state.selectedIdeaId).toBe('202');

    await presenter.page.getByRole('button', { name: 'Photo', exact: true }).click();
    await expect(tv.page.locator('.tv-photo')).toBeVisible();
    await expect(tv.page.locator('.tv-photo img')).toBeVisible();
    await audienceA.page.getByRole('button', { name: 'Photos' }).click();
    await audienceB.page.getByRole('button', { name: 'Description' }).click();
    await expect(audienceA.page.getByText('Following presenter', { exact: true })).toBeVisible();
    await expect(audienceB.page.getByRole('button', { name: 'Return to presenter' })).toBeVisible();
    await audienceA.page.getByRole('button', { name: 'Next photo' }).click();
    await expect(audienceA.page.locator('.presentation-streetmix iframe')).toBeVisible();
    await expect(audienceA.page.getByRole('button', { name: 'Zoom photo in' })).toHaveCount(0);
    await expect(audienceB.page.locator('.audience-description-card')).toContainText('Connect the protected lane');
    await audienceB.page.getByRole('button', { name: 'Next description page' }).click();
    await expect(audienceB.page.locator('.paginator-count')).toHaveText('2 / 2');

    await presenter.page.getByRole('button', { name: 'Description', exact: true }).click();
    await expect(tv.page.locator('.tv-description')).toContainText('Protected bike lane on Main Street');
    await expect(audienceA.page.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-pressed', 'true');
    await expect(audienceB.page.getByRole('button', { name: 'Description', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(audienceA.page.getByRole('button', { name: 'Return to presenter' })).toHaveCount(1);
    await expect(audienceA.page.getByText('Following presenter', { exact: true })).toHaveCount(0);
    await expect(audienceB.page.getByRole('button', { name: 'Return to presenter' })).toHaveCount(1);

    await audienceA.page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(audienceA.page.locator('[data-presentation-map="audience"]')).toHaveCount(1);
    const mapControls = await audienceA.page.locator('.audience-map-controls').boundingBox();
    const topRight = await audienceA.page.locator('.audience-status-control').boundingBox();
    expect(mapControls.x + mapControls.width).toBeLessThan(topRight.x);
    const stateBeforeAudienceWrite = structuredClone([...server.sessions.values()][0].state);
    await audienceA.page.getByRole('button', { name: 'Pan map up' }).click();
    expect([...server.sessions.values()][0].state).toEqual(stateBeforeAudienceWrite);

    const denied = await audienceA.page.evaluate(async baseRevision => {
      const [{ getActivePresentationCredential, writePresentationState }] = await Promise.all([
        import('/src/services/presentationApi.js'),
      ]);
      const credential = getActivePresentationCredential();
      if (credential?.role !== 'audience') return { diagnostic: { role: credential?.role || null, stored: sessionStorage.getItem('presentation-active-v1') } };
      try {
        await writePresentationState(credential, { baseRevision, state: {} }, crypto.randomUUID());
        return null;
      } catch (error) { return { status: error.status, code: error.code, message: error.message }; }
    }, stateBeforeAudienceWrite.revision);
    expect(denied, JSON.stringify(denied)).toMatchObject({ status: 403, code: 'ROLE_FORBIDDEN' });
    expect([...server.sessions.values()][0].state).toEqual(stateBeforeAudienceWrite);
    expect(contexts.flatMap(item => item.errors)).toEqual([]);
  } finally {
    await Promise.all(contexts.map(item => item.context.close()));
  }
});

test('manual code entry and a lost state response retry the original idempotent write', async ({ browser }) => {
  const server = new PresentationTestServer();
  const tv = await presentationPage(browser, server);
  const presenter = await presentationPage(browser, server, { width: 390, height: 844 });
  try {
    await tv.page.goto('http://localhost:5173/tv');
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await expect(tv.page.locator('.tv-presenter-code')).toHaveText('ABCD 2345');
    await presenter.page.goto('http://localhost:5173/remote');
    await presenter.page.getByLabel('Presenter code').fill(' abcd-2345 ');
    await presenter.page.getByRole('button', { name: 'Connect remote' }).click();
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();

    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    await presenter.page.getByRole('button', { name: 'Present this idea: Safer crossing at Elm Street' }).click();
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();

    server.dropNextStateResponse = true;
    const attemptsBefore = server.stateAttempts;
    const mutationsBefore = server.stateMutations;
    const revisionBefore = [...server.sessions.values()][0].revision;
    await presenter.page.getByRole('button', { name: 'Description', exact: true }).click();
    await expect(tv.page.locator('.tv-description')).toBeVisible();
    await expect.poll(() => server.stateAttempts).toBe(attemptsBefore + 2);
    expect(server.stateMutations).toBe(mutationsBefore + 1);
    expect([...server.sessions.values()][0].revision).toBe(revisionBefore + 1);
  } finally {
    await Promise.all([tv.context.close(), presenter.context.close()]);
  }
});

test('controller subpages preserve the running session and expose local audience access', async ({ browser }) => {
  const server = new PresentationTestServer();
  const tv = await presentationPage(browser, server);
  const presenter = await presentationPage(browser, server, { width: 390, height: 844 });
  try {
    await tv.page.goto('http://localhost:5173/tv');
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await presenter.page.goto('http://localhost:5173/remote#pair=ABCD2345');
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    const revision = [...server.sessions.values()][0].revision;
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Style Settings' }).click();
    await presenter.page.getByLabel('Rail lines').check();
    await presenter.page.getByLabel('Presentation theme').selectOption('light');
    await presenter.page.goBack();
    await expect(presenter.page.getByRole('button', { name: 'Map', exact: true })).toBeVisible();
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Audience' }).click();
    await expect(presenter.page.getByRole('heading', { name: 'Audience', exact: true })).toBeVisible();
    await expect(presenter.page.getByText('ABCD 2345')).toHaveCount(0);
    await expect(presenter.page.getByText('WXYZ 6789')).toBeVisible();
    await presenter.page.getByLabel('Show audience QR on TV').check();
    await presenter.page.getByLabel('Show viewing code on TV').check();
    await expect.poll(() => [...server.sessions.values()][0].state.audienceDisplay).toEqual({ showQr: true, showCode: true });
    expect([...server.sessions.values()][0].revision).toBeGreaterThan(revision);
    await expect(tv.page.getByRole('img', { name: 'QR code for audience viewing link' })).toBeVisible();
    await expect(tv.page.getByText('WXYZ 6789')).toBeVisible();
  } finally {
    await Promise.all([tv.context.close(), presenter.context.close()]);
  }
});

test('a reload resumes an uncertain state write from its saved idempotency record', async ({ browser }) => {
  const server = new PresentationTestServer();
  const tv = await presentationPage(browser, server);
  const presenter = await presentationPage(browser, server, { width: 390, height: 844 });
  try {
    await tv.page.goto('http://localhost:5173/tv');
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await presenter.page.goto('http://localhost:5173/remote#pair=ABCD2345');
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    await presenter.page.getByRole('button', { name: 'Present this idea: Safer crossing at Elm Street' }).click();
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();

    const attemptsBefore = server.stateAttempts;
    const mutationsBefore = server.stateMutations;
    server.dropStateResponses = 2;
    await presenter.page.getByRole('button', { name: 'Description', exact: true }).click();
    await expect.poll(() => server.stateAttempts).toBe(attemptsBefore + 2);
    const savedMutation = await presenter.page.evaluate(() => JSON.parse(sessionStorage.getItem('presentation-active-v1')).pendingMutation);
    expect(savedMutation.key).toMatch(/^[0-9a-f-]{36}$/i);

    await presenter.page.reload();
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    await expect(tv.page.locator('.tv-description')).toContainText('Safer crossing at Elm Street');
    await expect.poll(() => server.stateAttempts).toBe(attemptsBefore + 3);
    expect(server.stateMutations).toBe(mutationsBefore + 1);
    expect(server.stateKeys.slice(attemptsBefore)).toEqual([savedMutation.key, savedMutation.key, savedMutation.key]);
    await expect.poll(async () => presenter.page.evaluate(() => JSON.parse(sessionStorage.getItem('presentation-active-v1')).pendingMutation)).toBeNull();
  } finally {
    await Promise.all([tv.context.close(), presenter.context.close()]);
  }
});

test('rate-limited controller writes honor Retry-After before retrying', async ({ browser }) => {
  const server = new PresentationTestServer();
  const tv = await presentationPage(browser, server);
  const presenter = await presentationPage(browser, server, { width: 390, height: 844 });
  try {
    await tv.page.goto('http://localhost:5173/tv');
    await tv.page.getByRole('button', { name: 'Start presentation' }).click();
    await presenter.page.goto('http://localhost:5173/remote#pair=ABCD2345');
    await expect(presenter.page.getByRole('button', { name: 'Open remote menu' })).toBeVisible();
    await presenter.page.getByRole('button', { name: 'Open remote menu' }).click();
    await presenter.page.getByRole('menuitem', { name: 'Find ideas' }).click();
    await presenter.page.getByRole('button', { name: 'Present this idea: Safer crossing at Elm Street' }).click();
    await expect(tv.page.getByText('Safer crossing at Elm Street').first()).toBeVisible();

    const attemptsBefore = server.stateAttempts;
    const mutationsBefore = server.stateMutations;
    server.rateLimitNextStateResponses = 1;
    await presenter.page.getByRole('button', { name: 'Description', exact: true }).click();
    await expect.poll(() => server.stateAttempts).toBe(attemptsBefore + 1);
    await presenter.page.waitForTimeout(500);
    expect(server.stateAttempts).toBe(attemptsBefore + 1);
    await expect(tv.page.locator('.tv-description')).toBeVisible();
    await expect.poll(() => server.stateAttempts).toBe(attemptsBefore + 2);
    expect(server.stateMutations).toBe(mutationsBefore + 1);
    expect(server.stateKeys.slice(attemptsBefore, attemptsBefore + 2)[0]).toBe(server.stateKeys[attemptsBefore + 1]);
  } finally {
    await Promise.all([tv.context.close(), presenter.context.close()]);
  }
});
