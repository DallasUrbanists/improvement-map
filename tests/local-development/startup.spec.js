import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['http://127.0.0.1:5183', 'http://127.0.0.1:6016'].includes(url.origin)) return route.continue();
    throw Error(`Unexpected external dependency: ${url.origin}${url.pathname}`);
  });
});

test('real frontend API clients upload valid WebP bytes and save a local suggestion', async ({ page }) => {
  await page.goto('/suggestion/1');
  await expect(page.locator('[data-local-map="ready"]')).toHaveCount(1);
  const result = await page.evaluate(async () => {
    const api = await import('/src/services/api.js');
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
    canvas.getContext('2d').fillRect(0, 0, 32, 24);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp'));
    const { uploadUrl, publicUrl } = await api.requestPhotoUploadUrl({ contentType: 'image/webp', filename: 'local-test.webp' });
    await api.uploadPhotoBinary(uploadUrl, blob, 'image/webp');
    const created = await api.createSuggestion({
      author: { name: 'Local Browser Test', email: 'browser@example.invalid' },
      content: { summary: 'A local browser submission', details: 'Synthetic offline service verification.', photos: [{ url: publicUrl }] },
      location: { latitude: 32.7812, longitude: -96.799, address: 'Elm Street, Dallas, TX' },
    });
    const downloaded = await (await fetch(publicUrl)).blob();
    const bitmap = await createImageBitmap(downloaded);
    const dimensions = [bitmap.width, bitmap.height]; bitmap.close();
    return { id: created.id, type: downloaded.type, size: downloaded.size, dimensions };
  });
  expect(result.type).toBe('image/webp'); expect(result.size).toBeGreaterThan(15); expect(result.dimensions).toEqual([32, 24]);
  await page.goto(`/suggestion/${result.id}`);
  await expect(page.getByText('A local browser submission', { exact: false }).first()).toBeVisible();
});

test('app and Storybook start with every service mocked and no cloud configuration', async ({ page, request }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const modes = await (await request.get('/__dev')).json();
  expect(Object.values(modes.modes).every(mode => mode === 'mock')).toBe(true);
  // Exercise the merged Vite proxy with actual Overpass QL, not just direct
  // JSON requests to the mock service. A live rewrite must not survive here.
  for (const endpoint of ['/__overpass', '/__overpass-kumi']) {
    const response = await request.post(endpoint, { data: '[out:json];way(around:100,32.7812,-96.799);out geom;' });
    expect(response.status()).toBe(200);
    const osm = await response.json();
    expect(osm.generator).toBe('local-recorded-fixture');
    expect(osm.elements.length).toBeGreaterThan(0);
  }
  await page.goto('/?view=list');
  const welcome = page.getByRole('dialog', { name: 'Welcome & guide' });
  await expect(welcome).toBeVisible();
  await welcome.getByRole('button', { name: 'Go to app' }).click();
  await expect(page.locator('[data-local-map="ready"]')).toHaveCount(1);
  await expect(page.getByText('Add a safer crossing near City Hall', { exact: false }).first()).toBeVisible();
  await page.goto('/suggestion/1');
  await expect(page.getByText('Add a safer crossing near City Hall', { exact: false }).first()).toBeVisible();
  await page.reload(); await expect(page.locator('[data-local-map="ready"]')).toHaveCount(1);
  await page.goto('http://127.0.0.1:6016/iframe.html?id=embeddables-google-map--dark-roads&viewMode=story');
  await expect(page.locator('[data-local-map="ready"]')).toBeVisible();
  await expect(page.locator('.gm-style > svg polyline').first()).toBeAttached();
  await expect(page.getByText('Google Maps is not configured for this build.')).toHaveCount(0);
  const initial = await page.evaluate(() => window.google.maps ? document.querySelector('[data-local-map] svg').getAttribute('viewBox') : null);
  expect(initial).toBeTruthy();
  await page.locator('button[aria-label="Zoom in"]').click();
  await page.screenshot({ path: 'test-results/local-development/storybook-map.png' });
  expect(errors).toEqual([]);
});
