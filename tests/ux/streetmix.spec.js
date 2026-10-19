import { test, expect } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';

const design = { streetmix: { id: 'saved', stale: false }, result: { streetmixUrl: 'https://streetmix.net/-/123', warnings: ['Widths are estimated.'], estimatedDetails: ['Lane widths'], sources: [{ name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' }], selectedStreet: { carriagewayOnly: true } }, activeRequest: null };
const coordinate = { latitude: 32.78, longitude: -96.8 };
const candidates = [1, 2].map(n => ({ osmWayId: n, name: 'Main Street', highway: 'primary', distanceMeters: n * 5, bearingDegrees: 90, layer: n - 1, bridge: n === 2, oppositeOsmWayId: n === 1 ? 2 : undefined, snappedCoordinate: coordinate, geometry: [[coordinate, { latitude: 32.781, longitude: -96.8 + n / 1000 }]] }));
const choice = { requestId: 'r1', status: 'awaiting_selection', coordinate, candidates, selectionExpiresAt: '2026-10-19T12:15:00Z', error: 'STREET_SELECTION_REQUIRED' };

async function setup(page, initial = { streetmix: null, result: null, activeRequest: null }, respond) {
  const calls = [];
  let saved = structuredClone(initial);
  await page.route('https://streetmix.net/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Street design preview</p>' }));
  await page.route('https://api.test/api/suggestions/**', async route => {
    const req = route.request();
    const call = { method: req.method(), path: new URL(req.url()).pathname, headers: req.headers(), body: req.postData() };
    calls.push(call);
    const custom = await respond?.(call, { save: value => { saved = structuredClone(value); } });
    if (custom?.abort) return route.abort();
    await route.fulfill({ status: custom?.status || 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Expose-Headers': 'ETag, Retry-After', ETag: '"v1"', ...custom?.headers }, body: JSON.stringify(custom?.body ?? saved) });
  });
  return calls;
}
async function open(page) {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
  await expect(page.locator('.streetmix-panel').getByText('Loading Streetmix…')).toHaveCount(0);
}
const generate = page => page.getByRole('button', { name: 'Generate Streetmix design', exact: true });
const posts = calls => calls.filter(c => c.method === 'POST');

test('saved design, stale warning, attribution and safe embed', async ({ page }) => {
  await setup(page, { ...design, streetmix: { stale: true } });
  await open(page);
  await expect(page.getByRole('link', { name: 'Open in Streetmix' })).toHaveAttribute('href', design.result.streetmixUrl);
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', /allow-scripts allow-same-origin/);
  await expect(page.getByText('Created for this suggestion’s previous location.')).toBeVisible();
  await expect(page.getByText('This drawing covers one carriageway only.')).toBeAttached();
  await page.getByText('Design details', { exact: true }).click();
  await expect(page.locator('.streetmix-evidence').getByText(/OpenStreetMap/)).toBeAttached();
  await expect(page.locator('.streetmix-evidence').getByText('Lane widths', { exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Regenerate design', exact: true })).toHaveCount(0);
});

test('anonymous generation prevents duplicates and reconciles permanent saved result', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const calls = await setup(page, undefined, async (call, state) => {
    if (call.method === 'POST') { await hold; state.save(design); return { body: { requestId: 'r1', status: 'completed', result: { streetmixUrl: 'https://streetmix.net/-/999' } } }; }
  });
  await open(page);
  await generate(page).click();
  await expect.poll(() => posts(calls).length).toBe(1);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeDisabled();
  release();
  await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
  expect(posts(calls)[0].body).toBe('{}');
  expect(posts(calls)[0].headers['idempotency-key']).toBeTruthy();
  expect(posts(calls)[0].headers.authorization).toBeUndefined();
  expect(calls.every(c => ['GET', 'POST'].includes(c.method))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('streetmix-operation-v1:1'))).toBeNull();
});

test('202 and save_pending survive reload; resume repeats original operation', async ({ page }) => {
  let count = 0;
  const calls = await setup(page, undefined, (call, state) => {
    if (call.method === 'POST') {
      if (++count === 1) { state.save({ streetmix: null, result: null, activeRequest: { requestId: 'r1', status: 'save_pending' } }); return { status: 202, body: { requestId: 'r1', status: 'save_pending' }, headers: { 'Retry-After': '1' } }; }
      state.save(design); return { body: { requestId: 'r1', status: 'completed' } };
    }
    if (call.path.endsWith('/requests/r1')) return { body: { requestId: 'r1', status: 'save_pending' } };
  });
  await open(page); await generate(page).click();
  await expect(page.getByText('Resume to finish saving.')).toBeVisible();
  await page.reload();
  await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  expect(posts(calls)).toHaveLength(1);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
  expect(posts(calls)[1]).toMatchObject({ body: posts(calls)[0].body, path: posts(calls)[0].path });
  expect(posts(calls)[1].headers['idempotency-key']).toBe(posts(calls)[0].headers['idempotency-key']);
});

test('lost response and uncertain publication never create a fresh operation', async ({ page }) => {
  let count = 0;
  const calls = await setup(page, undefined, (call, state) => {
    if (call.method === 'POST') {
      if (++count === 1) return { abort: true };
      const activeRequest = { requestId: 'r1', status: 'publication_uncertain' };
      state.save({ streetmix: null, result: null, activeRequest });
      return { body: activeRequest };
    }
    if (call.path.endsWith('/requests/r1')) return { body: { requestId: 'r1', status: 'publication_uncertain' } };
  });
  await open(page); await generate(page).click();
  await expect(page.getByText('Connection interrupted.', { exact: false })).toBeVisible();
  await page.reload(); await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByText('The design may already be published.')).toBeVisible();
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(generate(page)).toHaveCount(0);
  expect(posts(calls)).toHaveLength(2);
  expect(new Set(posts(calls).map(c => c.headers['idempotency-key'])).size).toBe(1);
});

async function mapSupport(page) {
  await page.addInitScript(() => {
    const maps = window.google.maps;
    window.__streetRoads = []; window.__streetMarkers = [];
    maps.LatLngBounds = class { extend() {} };
    maps.Map.prototype.fitBounds = function () {};
    maps.Polyline = class extends maps.Marker { constructor(options) { super(options); window.__streetRoads.push(this); } };
    const Marker = maps.Marker;
    maps.Marker = class extends Marker { constructor(options) { super(options); window.__streetMarkers.push(this); } };
  });
}

test('ambiguous roads synchronize map and selector; confirmation is a separate saved phase', async ({ page }) => {
  await mapSupport(page);
  const calls = await setup(page, undefined, (call, state) => {
    if (call.method === 'POST' && call.path.endsWith('/selection')) { state.save(design); return { body: { requestId: 'r1', status: 'completed' } }; }
    if (call.method === 'POST') return { status: 409, body: choice };
  });
  await open(page); await generate(page).click();
  await expect(page.getByLabel('Street', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Confirm selected street' })).toBeDisabled();
  await page.getByLabel('Street', { exact: true }).selectOption('1');
  await expect.poll(() => page.evaluate(() => window.__streetRoads.filter(o => o.map !== null).map(o => o.options.strokeColor))).toEqual(['#c2410c', '#7e22ce']);
  expect(posts(calls)).toHaveLength(1);
  await page.evaluate(() => window.__streetMarkers.filter(o => o.map !== null && o.options.label === '2').at(-1).fire('click'));
  await expect(page.getByLabel('Street', { exact: true })).toHaveValue('2');
  await expect(page.locator('.streetmix-panel p').filter({ hasText: /OSM 2 · 90° bearing · Bridge · Layer 1/ })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm selected street' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
  expect(posts(calls)[1].body).toBe('{"osmWayId":2}');
  expect(posts(calls)[1].headers['idempotency-key']).not.toBe(posts(calls)[0].headers['idempotency-key']);
});

test('discovered selection works without a stored key and with a failed map', async ({ page }) => {
  const calls = await setup(page, { streetmix: null, result: null, activeRequest: choice }, (call, state) => {
    if (call.method === 'POST') { state.save(design); return { body: { requestId: 'r1', status: 'completed' } }; }
  });
  await open(page);
  await expect(page.getByText('Map unavailable. Choose a street below.')).toBeVisible();
  await page.getByLabel('Street', { exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Confirm selected street' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
  expect(posts(calls)).toHaveLength(1);
});

test('expired selection reloads and requires an explicit restart', async ({ page }) => {
  const calls = await setup(page, { streetmix: null, result: null, activeRequest: { ...choice, selectionExpiresAt: '2026-10-19T11:59:00Z' } });
  await open(page);
  await expect(page.getByText('Street selection expired.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm selected street' })).toHaveCount(0);
  expect(posts(calls)).toHaveLength(0);
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect.poll(() => posts(calls).length).toBe(1);
});

test('selection expiry retains restart when the server no longer lists the request', async ({ page }) => {
  let expired = false;
  const calls = await setup(page, undefined, call => {
    if (call.method === 'POST') return { status: 409, body: choice };
    if (expired) return { body: { streetmix: null, result: null, activeRequest: null } };
  });
  await open(page); await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') }); await generate(page).click();
  await expect(page.getByLabel('Street', { exact: true })).toBeVisible();
  expired = true;
  const reads = calls.filter(c => c.method === 'GET').length;
  await page.clock.fastForward(901000);
  await expect(page.getByText('Street selection expired.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start again' })).toBeEnabled();
  await expect.poll(() => calls.filter(c => c.method === 'GET').length).toBeGreaterThan(reads);
  expect(posts(calls)).toHaveLength(1);
});

test('anonymous verification failure keeps recovery and never asks for sign-in', async ({ page }) => {
  const calls = await setup(page, undefined, call => call.method === 'POST' ? { status: 401, body: { message: 'Authentication required' } } : undefined);
  await open(page); await generate(page).click();
  await expect(page.getByText('Application verification failed. Please try again.')).toBeVisible();
  await expect(page.getByText('Authentication required')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled();
  expect(posts(calls)).toHaveLength(1);
});

test('uncertain publication in a provider failure still preserves the operation', async ({ page }) => {
  const calls = await setup(page, undefined, call => call.method === 'POST' ? { status: 503, body: { status: 'publication_uncertain', requestId: 'r1' } } : undefined);
  await open(page); await generate(page).click();
  await expect(page.getByText('The design may already be published.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start again' })).toHaveCount(0);
  await expect(generate(page)).toHaveCount(0);
  expect(posts(calls)).toHaveLength(1);
});

test('production header helper acquires fresh Firebase and App Check tokens', async ({ page }) => {
  await page.route(/\/src\/services\/firebase(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: `
    import {ref} from '/node_modules/.vite/deps/vue.js';
    const user=ref(null),isStaff=ref(false),authVersion=ref(0); let ids=0,checks=0;
    export function useAuth(){return {user,isStaff,authVersion,getToken:async()=> 'test-id-'+ ++ids,getAppCheckToken:async()=> 'test-check-'+ ++checks};}
  ` }));
  await setup(page); await open(page);
  await page.route('**/src/services/api.js?header-check', route => route.continue());
  const headers = await page.evaluate(async () => {
    const { apiHeaders } = await import('/src/services/api.js?header-check');
    const first = await apiHeaders(), second = await apiHeaders();
    return [first, second].map(h => [h.Authorization, h['X-Firebase-AppCheck']]);
  });
  expect(headers).toEqual([['Bearer test-id-1', 'test-check-1'], ['Bearer test-id-2', 'test-check-2']]);
});

async function identity(page, staff = false) {
  await page.addInitScript(() => { window.__ux.author = { name: 'Author', uid: 'owner' }; });
  await page.route(/\/src\/services\/firebase(?:\.js)?(?:\?|$)/, route => route.fulfill({ contentType: 'application/javascript', body: `
    import {ref} from '/node_modules/.vite/deps/vue.js';
    const user=ref({uid:${JSON.stringify(staff ? 'staff-user' : 'owner')}}),isStaff=ref(${staff});
    export function useAuth(){return {user,isStaff};}
  ` }));
}

for (const staff of [false, true]) {
  test(`${staff ? 'staff' : 'author'} regeneration keeps old design and retries original ETag`, async ({ page }) => {
    await identity(page, staff);
    let count = 0;
    const calls = await setup(page, design, (call, state) => {
      if (call.method === 'POST') {
        if (++count === 1) return { abort: true };
        state.save({ ...design, result: { streetmixUrl: 'https://streetmix.net/-/456' } });
        return { body: { requestId: 'r2', status: 'completed' } };
      }
    });
    await open(page);
    await page.getByRole('button', { name: 'Regenerate design', exact: true }).click();
    await expect(page.getByText('Connection interrupted.', { exact: false })).toBeVisible();
    await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
    expect(posts(calls)[0].headers['if-match']).toBe('"v1"');
    expect(calls[calls.findIndex(c => c.method === 'POST') - 1].method).toBe('GET');
    await page.reload(); await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
    await expect(page.locator('iframe')).toHaveAttribute('src', design.result.streetmixUrl);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.locator('iframe')).toHaveAttribute('src', 'https://streetmix.net/-/456');
    expect(posts(calls)[1].headers['idempotency-key']).toBe(posts(calls)[0].headers['idempotency-key']);
    expect(posts(calls)[1].headers['if-match']).toBe('"v1"');
  });
}

test('regeneration selection recovery keeps its phase key and original ETag across reload', async ({ page }) => {
  await identity(page);
  let confirmations = 0;
  const calls = await setup(page, design, (call, state) => {
    if (call.method !== 'POST') return;
    if (call.path.endsWith('/regenerate')) { state.save({ ...design, activeRequest: choice }); return { status: 409, body: choice }; }
    if (++confirmations === 1) return { abort: true };
    state.save({ ...design, result: { streetmixUrl: 'https://streetmix.net/-/456' } }); return { body: { status: 'completed', requestId: 'r1' } };
  });
  await open(page); await page.getByRole('button', { name: 'Regenerate design', exact: true }).click();
  await page.getByLabel('Street', { exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Confirm selected street' }).click();
  await expect(page.getByText('Connection interrupted.', { exact: false })).toBeVisible();
  await page.reload(); await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
  await expect(page.getByLabel('Street', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Street', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://streetmix.net/-/456');
  expect(posts(calls)).toHaveLength(3);
  expect(posts(calls)[2].headers['idempotency-key']).toBe(posts(calls)[1].headers['idempotency-key']);
  expect(posts(calls)[2].headers['if-match']).toBe('"v1"');
  expect(posts(calls)[2].body).toBe(posts(calls)[1].body);
});

test('ETag conflict reloads the replacement without publishing again', async ({ page }) => {
  await identity(page);
  const calls = await setup(page, design, (call, state) => {
    if (call.method === 'POST') { state.save({ ...design, result: { streetmixUrl: 'https://streetmix.net/-/789' } }); return { status: 412, body: {} }; }
  });
  await open(page); await page.getByRole('button', { name: 'Regenerate design', exact: true }).click();
  await expect(page.getByText('The design changed. Review the latest design.')).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://streetmix.net/-/789');
  expect(posts(calls)).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('streetmix-operation-v1:1'))).toBeNull();
});

test('discovered regeneration selection is restricted to author or staff', async ({ page }) => {
  const calls = await setup(page, { ...design, activeRequest: choice });
  await open(page);
  await expect(page.getByText('Only the author or staff can confirm a replacement.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm selected street' })).toHaveCount(0);
  expect(posts(calls)).toHaveLength(0);
});

test('road selection remains accessible with enlarged text', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await setup(page, { streetmix: null, result: null, activeRequest: choice });
  await open(page);
  await page.locator('html').evaluate(el => { el.style.fontSize = '20px'; });
  const select = page.getByLabel('Street', { exact: true });
  await select.selectOption('2');
  await select.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Confirm selected street' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).include('.streetmix-accordion').analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('street-selection.png') });
});

test('polling honors Retry-After and stops on collapse', async ({ page }) => {
  const calls = await setup(page, undefined, call => {
    if (call.method === 'POST' || call.path.endsWith('/requests/r1')) return { status: 202, body: { status: 'generating', requestId: 'r1' }, headers: { 'Retry-After': '10' } };
  });
  await open(page); await generate(page).click();
  await expect(page.getByText('Creating design… About a minute.')).toBeVisible();
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  await page.clock.fastForward(9000);
  expect(calls.filter(c => c.path.endsWith('/requests/r1'))).toHaveLength(0);
  await page.clock.fastForward(1100);
  await expect.poll(() => calls.filter(c => c.path.endsWith('/requests/r1')).length).toBe(1);
  await page.locator('.streetmix-accordion > summary').click();
  await page.clock.fastForward(120000);
  expect(calls.filter(c => c.path.endsWith('/requests/r1'))).toHaveLength(1);
  expect(posts(calls)).toHaveLength(1);
});

test('a delayed response cannot overwrite another suggestion', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  let first = true;
  await setup(page, undefined, async call => {
    if (call.path.includes('/suggestions/1/') && first) { first = false; await hold; return { body: design }; }
  });
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page).not.toHaveURL(/suggestion\/1$/);
  release();
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.locator('summary').filter({ hasText: /^Streetmix$/ }).click();
  await expect(generate(page)).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('unsafe iframe URLs are rejected, including credentials and suffixes', async ({ page }) => {
  await setup(page, { ...design, result: { streetmixUrl: 'https://streetmix.net.evil.test/-/123' } });
  await open(page);
  await expect(page.getByText('The saved design link is invalid.')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  const valid = await page.evaluate(async () => {
    const { safeStreetmixUrl } = await import('/src/services/streetmix.js');
    return ['https://streetmix.net/-/123', 'http://streetmix.net/-/123', 'https://user@streetmix.net/-/123', 'https://streetmix.net/-/123?a=b', 'https://streetmix.net/-/123#x', 'javascript:alert(1)', 'https://streetmix.net/-/123/', 'https://streetmix.net/-/123?', 'https://streetmix.net/-/123#'].map(safeStreetmixUrl);
  });
  expect(valid).toEqual(['https://streetmix.net/-/123', '', '', '', '', '', '', '', '']);
});

for (const size of [{ width: 360, height: 880 }, { width: 320, height: 568 }, { width: 880, height: 360 }]) {
  test(`Streetmix fits ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await setup(page, design);
    await open(page);
    await expect(page.locator('.submission-detail-tray')).toHaveClass(/streetmix-expanded/);
    await expect(page.getByRole('link', { name: 'Open in Streetmix' })).toBeVisible();
    const layout = await page.evaluate(() => {
      const tray = document.querySelector('.submission-detail-tray').getBoundingClientRect();
      const iframe = document.querySelector('iframe').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, top: tray.top, bottom: tray.bottom, height: iframe.height, width: iframe.width, trayWidth: tray.width };
    });
    expect(layout.overflow).toBe(false); expect(layout.top).toBeGreaterThanOrEqual(0); expect(layout.bottom).toBeLessThanOrEqual(size.height);
    expect(layout.height).toBe(620); expect(layout.width).toBeLessThan(layout.trayWidth);
    expect(await page.locator('.submission-detail-tray .map-tray-close').evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    expect(await page.getByRole('link', { name: 'Open in Streetmix' }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath('streetmix.png') });
    await page.locator('.streetmix-accordion > summary').click();
    await expect(page.locator('.submission-detail-tray')).not.toHaveClass(/streetmix-expanded/);
  });
}
