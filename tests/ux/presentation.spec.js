import { test, expect } from './fixture.js';
import { audit } from './audit.js';
import { PresentationTestServer, presentationBrowserInit } from '../fixtures/presentationServer.js';

async function installPresentationServer(page, server) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/public-improvements/presentation')
      || ['images.test', 'streetmix.net'].includes(url.hostname)) return server.route(route);
    return route.fallback();
  });
  await page.addInitScript(presentationBrowserInit);
}

test('presentation setup shells stay separate from the regular workspace on a narrow phone', async ({ page }) => {
  const checkpoint = audit(page, test.info());
  await page.setViewportSize({ width: 320, height: 568 });

  await page.goto('/tv');
  await expect(page.getByRole('heading', { name: 'Present on TV' })).toBeVisible();
  await expect(page.locator('.map-workspace')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start presentation' })).toBeVisible();
  await checkpoint('presentation-tv-setup');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);

  await page.goto('/remote');
  await expect(page.getByRole('heading', { name: 'Connect to a presentation' })).toBeVisible();
  await expect(page.getByLabel('Presenter code')).toBeVisible();
  await expect(page.locator('.map-workspace')).toHaveCount(0);
  await checkpoint('presentation-remote-pairing');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);

  await page.goto('/audience');
  await expect(page.getByRole('heading', { name: 'Join the audience' })).toBeVisible();
  await expect(page.getByLabel('Audience viewing code')).toBeVisible();
  await expect(page.locator('.map-workspace')).toHaveCount(0);
  await checkpoint('presentation-audience-join');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('audience view fits narrow and landscape layouts with clear top-corner controls', async ({ page }) => {
  const server = new PresentationTestServer();
  const checkpoint = audit(page, test.info());
  await installPresentationServer(page, server);
  await page.setViewportSize({ width: 844, height: 390 });

  await page.goto('/tv');
  await page.getByRole('button', { name: 'Start presentation' }).click();
  const presenterCode = await page.locator('.tv-presenter-code').innerText();
  await page.goto('/remote');
  await page.getByLabel('Presenter code').fill(presenterCode);
  await page.getByRole('button', { name: 'Connect remote' }).click();
  await page.getByRole('button', { name: 'Open remote menu' }).click();
  await page.getByRole('menuitem', { name: 'Find ideas' }).click();
  await page.getByRole('button', { name: 'Present this idea: Protected bike lane on Main Street' }).click();
  const audienceCode = await page.evaluate(async () => (await import('/src/services/presentationSession.js')).presentationSession.credential.audienceCode);

  await page.goto('/audience');
  await page.getByLabel('Audience viewing code').fill(audienceCode);
  await page.getByRole('button', { name: 'Join presentation' }).click();
  await expect(page.locator('[data-presentation-map="audience"]')).toHaveCount(1);
  await checkpoint('presentation-audience-landscape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(845);
  const tabs = await page.locator('.audience-viewer-controls').boundingBox();
  const status = await page.locator('.audience-status-control').boundingBox();
  expect(tabs.x + tabs.width).toBeLessThanOrEqual(status.x + 2);

  await page.setViewportSize({ width: 320, height: 568 });
  await checkpoint('presentation-audience-narrow');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  const controls = await page.locator('.audience-map-controls').boundingBox();
  const statusAfterResize = await page.locator('.audience-status-control').boundingBox();
  expect(controls.y).toBeGreaterThan(tabs.y + tabs.height);
  expect(controls.x + controls.width).toBeLessThan(statusAfterResize.x + 44);
});
