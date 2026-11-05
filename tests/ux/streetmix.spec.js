import { test, expect } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';
import { crc32, deflateSync } from 'node:zlib';

const streetId = 'c13a6af0-8888-4444-8888-0bbee0cc1122';
const thumbnail = 'https://api.test/api/suggestions/1/streetmix/thumbnail';
const design = { streetmix: { streetmixId: streetId, streetmixUrl: 'https://streetmix.net/-/123', stale: true }, result: { streetmixId: streetId, streetmixUrl: 'https://streetmix.net/-/123', warnings: ['Widths are estimated.'], selectedStreet: { carriagewayOnly: true } }, activeRequest: null };
const empty = { streetmix: null, result: null, activeRequest: null };
const coordinate = { latitude: 32.78, longitude: -96.8 };
const candidates = [1, 2].map(n => ({ osmWayId: n, name: 'Main Street', highway: 'primary', distanceMeters: n * 5, bearingDegrees: 90, layer: n - 1, bridge: n === 2, oppositeOsmWayId: n === 1 ? 2 : undefined, snappedCoordinate: coordinate, geometry: [[coordinate, { latitude: 32.781, longitude: -96.8 + n / 1000 }]] }));
const choice = { requestId: 'r1', status: 'awaiting_selection', coordinate, candidates, selectionExpiresAt: '2026-10-19T12:15:00Z', error: 'STREET_SELECTION_REQUIRED' };
// Real PNG data, with the wide aspect ratio of a street drawing.
function png() {
  const chunk = (name, data) => {
    const type = Buffer.from(name), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, checksum]);
  };
  const width = 720, height = 240, header = Buffer.alloc(13), pixels = Buffer.alloc((width * 3 + 1) * height);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    const color = y < 140 ? [190, 218, 234] : x < 110 || x > 610 ? [110, 140, 100] : [100, 105, 110];
    color.forEach((value, channel) => { pixels[offset + channel] = value; });
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const image = png();
async function setup(page, initial = empty, respond, imageStatus = 200) {
  const calls = [], imageCalls = [];
  let saved = structuredClone(initial);
  await page.route('https://api.test/api/suggestions/**', async route => {
    const req = route.request(), call = { method: req.method(), path: new URL(req.url()).pathname, headers: req.headers(), body: req.postData() };
    calls.push(call);
    if (call.path.endsWith('/thumbnail')) {
      imageCalls.push(req);
      return route.fulfill({ status: imageStatus, contentType: imageStatus === 200 ? 'image/png' : 'application/json', body: imageStatus === 200 ? image : '{}' });
    }
    const custom = await respond?.(call, { save: value => { saved = structuredClone(value); } });
    if (custom?.abort) return route.abort();
    await route.fulfill({ status: custom?.status || 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Expose-Headers': 'ETag, Retry-After', ETag: '"v1"', ...custom?.headers }, body: JSON.stringify(custom?.body ?? saved) });
  });
  return { calls, imageCalls };
}
const section = page => page.locator('.streetmix-content');
const dialog = page => page.getByRole('dialog', { name: 'Streetmix', exact: true });
const posts = calls => calls.filter(c => c.method === 'POST');
async function visit(page) {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Streetmix', exact: true }).click();
  await expect(section(page)).toBeVisible();
  await expect(section(page).getByRole('button', { name: /Create design|Choose street/ })).toBeEnabled();
}
async function openCreation(page) {
  await section(page).getByRole('button', { name: /Create design|Choose street/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText('Loading Streetmix…')).toHaveCount(0);
}
async function mapSupport(page) {
  await page.addInitScript(() => {
    const maps = window.google.maps;
    window.__streetRoads = []; window.__streetMarkers = [];
    maps.LatLngBounds = class { extend() {} };
    maps.Map.prototype.fitBounds = function () {};
    maps.Polyline = class extends maps.Marker { constructor(options) { super(options); window.__streetRoads.push(this); } };
    const Marker = maps.Marker;
    maps.Marker = class extends Marker { constructor(options) { super(options); if (options.label) window.__streetMarkers.push(this); } };
  });
}

test('saved design preview and Streetmix link are visible without an accordion', async ({ page }) => {
  const { imageCalls } = await setup(page, design);
  await visit(page);
  await expect(section(page).locator('img')).toHaveAttribute('src', /^blob:/);
  const link = section(page).getByRole('link', { name: 'Open in Streetmix' });
  await expect(link).toHaveAttribute('href', design.result.streetmixUrl);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect.poll(() => section(page).locator('img').evaluate(img => img.naturalWidth)).toBe(720);
  await expect(page.locator('iframe, .detail-sheet[open]')).toHaveCount(0);
  await expect(section(page).getByText(/Widths are estimated|carriageway|previous location|Regenerate/)).toHaveCount(0);
  expect(imageCalls).toHaveLength(1);
  expect(imageCalls[0].url()).toBe(thumbnail);
});

test('missing thumbnail leaves the external link usable', async ({ page }) => {
  await setup(page, design, undefined, 404);
  await visit(page);
  await expect(section(page).getByText('Preview unavailable.')).toBeVisible();
  await expect(section(page).getByRole('link', { name: 'Open in Streetmix' })).toBeVisible();
});

test('empty Streetmix content is visible and its primary pill opens creation without publishing', async ({ page }) => {
  const { calls } = await setup(page);
  await visit(page);
  await expect(section(page)).toHaveClass(/streetmix-locked/);
  await expect(section(page).getByText('Create a street cross-section for this location.')).toBeVisible();
  await expect(section(page).locator('summary')).toHaveCount(0);
  await openCreation(page);
  await expect(dialog(page).getByRole('button', { name: 'Create design', exact: true })).toBeVisible();
  expect(posts(calls)).toHaveLength(0);
});

test('creation completes inline without a generated-design popup or duplicate POST', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { calls } = await setup(page, empty, async (call, state) => {
    if (call.method === 'POST') { await hold; state.save(design); return { body: { requestId: 'r1', status: 'completed' } }; }
  });
  await visit(page); await openCreation(page);
  await dialog(page).getByRole('button', { name: 'Create design', exact: true }).click();
  await expect.poll(() => posts(calls).length).toBe(1);
  await expect(dialog(page).getByRole('button', { name: 'Resume', exact: true })).toBeDisabled();
  release();
  await expect(dialog(page)).not.toBeVisible();
  await expect(section(page).locator('img')).toHaveAttribute('src', /^blob:/);
  expect(posts(calls)).toHaveLength(1); expect(posts(calls)[0].body).toBe('{}');
  expect(calls.every(c => ['GET', 'POST'].includes(c.method))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('streetmix-operation-v1:1'))).toBeNull();
});

test('street choice has a flush footer and only the selected marker', async ({ page }) => {
  await mapSupport(page);
  const { calls } = await setup(page, { ...empty, activeRequest: choice }, (call, state) => {
    if (call.method === 'POST') { state.save(design); return { body: { status: 'completed', requestId: 'r1' } }; }
  });
  await visit(page); await expect(section(page).getByRole('button', { name: 'Choose street' })).toBeVisible();
  await openCreation(page);
  const use = dialog(page).getByRole('button', { name: 'Use this street' });
  await expect(use).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__streetMarkers.filter(m => m.map !== null).length)).toBe(3);
  await page.locator('.street-choice input[value="1"]').check();
  await expect.poll(() => page.evaluate(() => window.__streetMarkers.filter(m => m.map !== null).map(m => m.options.label))).toEqual(['1']);
  await expect.poll(() => page.evaluate(() => window.__streetRoads.filter(r => r.map !== null).map(r => r.options.strokeColor))).toEqual(['#c2410c', '#7e22ce']);
  await page.evaluate(() => window.__streetRoads.filter(r => r.map !== null).at(-1).fire('click'));
  await expect(page.locator('.street-choice input[value="2"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__streetMarkers.filter(m => m.map !== null).map(m => m.options.label))).toEqual(['2']);
  await expect(use.locator('..')).toHaveClass('detail-sheet-footer');
  const before = await use.boundingBox();
  await dialog(page).locator('.detail-sheet-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const after = await use.boundingBox(), frame = await dialog(page).boundingBox();
  expect(Math.abs(before.y - after.y)).toBeLessThan(1); expect(Math.abs(after.width - frame.width)).toBeLessThanOrEqual(2);
  expect(posts(calls)).toHaveLength(0);
  await use.click();
  await expect(section(page).locator('img')).toHaveAttribute('src', /^blob:/);
  expect(posts(calls)[0].body).toBe('{"osmWayId":2}');
});

test('confirmation recovery restores the radio and reuses its phase key', async ({ page }) => {
  let confirms = 0;
  const { calls } = await setup(page, { ...empty, activeRequest: choice }, (call, state) => {
    if (call.method === 'POST') {
      if (++confirms === 1) return { abort: true };
      state.save(design); return { body: { status: 'completed', requestId: 'r1' } };
    }
  });
  await visit(page); await openCreation(page);
  await page.locator('.street-choice input[value="2"]').check();
  await dialog(page).getByRole('button', { name: 'Use this street' }).click();
  await expect(dialog(page).getByText(/Connection interrupted/)).toBeVisible();
  await page.reload(); await openCreation(page);
  await expect(page.locator('.street-choice input[value="2"]')).toBeChecked();
  await expect(page.locator('.street-choice input[value="2"]')).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(section(page).locator('img')).toHaveAttribute('src', /^blob:/);
  expect(posts(calls)[1].headers['idempotency-key']).toBe(posts(calls)[0].headers['idempotency-key']);
  expect(posts(calls)[1].body).toBe(posts(calls)[0].body);
});

test('202 recovery and uncertain publication never start a fresh operation', async ({ page }) => {
  let count = 0;
  const { calls } = await setup(page, empty, (call, state) => {
    if (call.method === 'POST') {
      const activeRequest = { status: ++count === 1 ? 'save_pending' : 'publication_uncertain', requestId: 'r1' };
      state.save({ ...empty, activeRequest }); return { status: 202, body: activeRequest };
    }
    if (call.path.endsWith('/requests/r1')) return { body: { status: 'publication_uncertain', requestId: 'r1' } };
  });
  await visit(page); await openCreation(page);
  await dialog(page).getByRole('button', { name: 'Create design', exact: true }).click();
  await expect(dialog(page).getByText('Resume to finish saving.')).toBeVisible();
  await page.reload(); await openCreation(page);
  await dialog(page).getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(dialog(page).getByText('The design may already be published.')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Check status', exact: true }).click();
  expect(posts(calls)).toHaveLength(2); expect(new Set(posts(calls).map(c => c.headers['idempotency-key'])).size).toBe(1);
  await expect(dialog(page).getByRole('button', { name: 'Create design', exact: true })).toHaveCount(0);
});

test('expired choice needs restart and map failure leaves radios usable', async ({ page }) => {
  const { calls } = await setup(page, { ...empty, activeRequest: { ...choice, selectionExpiresAt: '2026-10-19T11:59:00Z' } }, call => call.method === 'POST' ? { status: 409, body: choice } : undefined);
  await visit(page); await openCreation(page);
  await expect(dialog(page).getByText('Street selection expired.')).toBeVisible();
  expect(posts(calls)).toHaveLength(0);
  await dialog(page).getByRole('button', { name: 'Start again' }).click();
  await expect(dialog(page).getByText('Map unavailable. Choose a street below.')).toBeVisible();
  await page.locator('.street-choice input[value="1"]').check();
  await expect(dialog(page).getByRole('button', { name: 'Use this street' })).toBeEnabled();
});

test('street choice popup is accessible with enlarged text', async ({ page }) => {
  await setup(page, { ...empty, activeRequest: choice });
  await visit(page); await openCreation(page);
  await page.locator('html').evaluate(el => { el.style.fontSize = '20px'; });
  await page.locator('.street-choice input[value="2"]').check();
  const results = await new AxeBuilder({ page }).include('.detail-sheet[open]').analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const size of [{ width: 360, height: 880 }, { width: 320, height: 568 }, { width: 880, height: 360 }]) {
  test(`PNG and street footer fit ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size); await mapSupport(page);
    await setup(page, { ...empty, activeRequest: { ...choice, candidates: Array.from({ length: 12 }, (_, i) => ({ ...candidates[i % 2], osmWayId: i + 1 })) } }, (call, state) => {
      if (call.method === 'POST') { state.save(design); return { body: { status: 'completed', requestId: 'r1' } }; }
    });
    await visit(page); await openCreation(page); await page.locator('.street-choice input[value="1"]').check();
    const use = dialog(page).getByRole('button', { name: 'Use this street' });
    await expect(use).toBeInViewport(); expect((await use.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await dialog(page).locator('.detail-sheet-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(use).toBeInViewport();
    await page.screenshot({ path: info.outputPath('street-choice-footer.png') });
    await use.click(); await expect(section(page).locator('img')).toBeVisible();
    await expect.poll(() => section(page).locator('img').evaluate(img => img.naturalWidth)).toBe(720);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const pic = await section(page).locator('img').boundingBox(), tray = await page.locator('.submission-detail-tray').boundingBox();
    expect(pic.width).toBeLessThan(tray.width);
    await expect(page.locator('.detail-sheet[open], iframe')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('inline-png.png') });
    const results = await new AxeBuilder({ page }).include('.streetmix-content').analyze();
    expect(results.violations).toEqual([]);
  });
}
