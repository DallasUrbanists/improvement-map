import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('Pages catalog survives refresh with and without the app service worker', async ({ page }) => {
  await page.goto('?path=/story/buttons-square-icon-button--floating');
  await expect(page.frameLocator('#storybook-preview-iframe').locator('.square-icon-button')).toBeVisible();
  await page.reload();
  await expect(page.frameLocator('#storybook-preview-iframe').locator('.square-icon-button')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto('iframe.html?id=buttons-square-icon-button--floating&viewMode=story');
  await expect(page.locator('.square-icon-button')).toBeVisible();
  await page.reload();
  await expect(page.locator('.square-icon-button')).toBeVisible();
  const precached = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.includes('precache'));
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat();
  });
  expect(precached.length).toBeGreaterThan(0);
  expect(precached.some(url => url.includes('/storybook/'))).toBe(false);
  const missing = await page.goto('not-a-real-storybook-file');
  expect(missing.status(), 'App navigation fallback must not replace missing catalog pages').toBe(404);
});

test('Pages app entry and CNAME remain alongside the catalog', async ({ request }) => {
  const app = await request.get('/'); expect(app.ok()).toBe(true);
  expect(await app.text()).toContain('Improvement Map');
  expect(readFileSync('dist/CNAME', 'utf8').trim()).toBe('map.dallasurbanists.org');
  const manifest = await request.get('manifests/components.json'); expect(manifest.ok()).toBe(true);
});
