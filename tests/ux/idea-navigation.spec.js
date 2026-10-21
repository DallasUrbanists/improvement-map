import { test, expect, draftKey } from './fixture.js';

const tray = page => page.getByRole('region', { name: 'Browse ideas', exact: true });
const detail = page => page.getByRole('region', { name: 'Idea details', exact: true });
async function ready(page) { await expect(detail(page)).toHaveAttribute('aria-busy', 'false'); }
async function bookmarks(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Saved ideas', exact: true }).click();
}
async function mapState(page) {
  return page.evaluate(async () => {
    const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
    const map = sharedBrowseMap.value.map;
    return { center: map.getCenter().toJSON(), zoom: map.getZoom(), type: map.getMapTypeId(), gestures: map.get('gestureHandling') };
  });
}

test('desktop side tray keeps the map usable; mobile restores modal map behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?view=list');
  await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  await expect(page.locator('.workspace-backdrop')).toHaveCount(0);
  await expect.poll(async () => (await mapState(page)).gestures).toBe('greedy');
  await mapState(page);
  await bookmarks(page);
  await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  await expect.poll(async () => (await mapState(page)).gestures).toBe('none');
  await page.getByRole('button', { name: 'Close Saved ideas', exact: true }).click();
  await expect(tray(page)).toBeVisible();
});

test('search reveals the map, keeps list position, and tray exits are explicit', async ({ page }) => {
  await page.goto('/?view=list');
  await tray(page).locator('.map-tray-content').evaluate(el => { el.scrollTop = 200; });
  await page.getByRole('textbox', { name: 'Search address or neighborhood' }).fill('Main');
  await page.getByRole('button', { name: 'Searched address, Dallas, TX' }).click();
  await expect(page).toHaveURL(/view=map/);
  expect((await mapState(page)).center).toEqual({ lat: 32.81, lng: -96.76 });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect.poll(() => tray(page).locator('.map-tray-content').evaluate(el => el.scrollTop)).toBe(200);
  await bookmarks(page);
  await page.getByRole('button', { name: 'Close Saved ideas', exact: true }).click();
  await expect(tray(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(tray(page)).toBeVisible();
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
});

test('Submit retains content, refresh keeps its step, and bookmark excursions return there', async ({ page }) => {
  await page.goto('/?view=list');
  await page.getByRole('button', { name: 'Close Browse ideas', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  await page.getByTestId('pin-and-continue').click();
  await expect(page.getByRole('region', { name: 'Attach photos' })).toBeVisible();
  await bookmarks(page);
  await page.getByRole('button', { name: 'Close Saved ideas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Attach photos' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Attach photos' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Attach photos', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  const draft = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
  expect(draft.details).toContain('Improve safety');
});

test('My actions is a Details origin and Escape dismisses the inner layer first', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('improvement_map_actions_v1', JSON.stringify({ version: 1, saved: { a: { action: { key: 'a', summary: 'Contact the city', instructions: '', reason: '', sourceUrl: '' }, suggestionId: '2', suggestionSummary: 'Suggestion 2', savedAt: new Date().toISOString() } }, hidden: {}, generated: {} }));
  });
  await page.goto('/my-actions');
  await page.getByRole('link', { name: 'Suggestion 2', exact: true }).click();
  await ready(page);
  await page.locator('summary').filter({ hasText: 'Photos (2)' }).click();
  await page.getByRole('button', { name: 'Open photo 1: Crossing photo 1' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Photo preview' })).not.toBeVisible();
  await expect(detail(page)).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(detail(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/my-actions');
  await page.goto('/suggestion/2');
  await ready(page);
  await page.getByRole('button', { name: 'Close Idea details', exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
});

test('map failures, unsupported GPS, and broken thumbnails still allow bookmarks', async ({ page }) => {
  await page.route('https://invalid.test/missing.png', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }));
  await page.addInitScript(() => {
    window.google.maps.Map = class { constructor() { throw Error('Maps unavailable'); } };
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    window.__ux.items = [{ id: 'long', creationDate: '2026-10-01', emoji: '🌳', content: { summary: 'A very long idea summary '.repeat(10), photos: [{ url: 'https://invalid.test/missing.png' }] }, location: { address: 'A very long street name '.repeat(10) } }];
  });
  await page.goto('/?view=list');
  await page.getByRole('button', { name: 'Nearest to me', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Newest', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.getByText('Your location is unavailable. Showing newest ideas.', { exact: true })).toHaveCount(0);
  await expect(page.locator('.idea-thumbnail .fa-camera')).toBeVisible();
  await page.getByRole('button', { name: 'Bookmark idea', exact: true }).click();
  await bookmarks(page);
  await expect(page.getByRole('region', { name: 'Saved ideas', exact: true }).locator('[data-suggestion-id="long"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('nearest preference refresh retains its scroll and last usable coordinates', async ({ page }) => {
  await page.goto('/?view=list');
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = resolve => resolve({ coords: { latitude: 32.799, longitude: -96.8 } }); });
  await page.getByRole('button', { name: 'Nearest to me', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nearest to me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tray(page).locator('.map-tray-content').evaluate(el => { el.scrollTop = 250; });
  await expect.poll(() => page.evaluate(() => history.state.ideaView?.scroll)).toBe(250);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nearest to me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Distances use your last location.', { exact: false })).toBeVisible();
  await expect.poll(() => tray(page).locator('.map-tray-content').evaluate(el => el.scrollTop)).toBe(250);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = resolve => resolve({ coords: { latitude: 32.799, longitude: -96.8 } }); });
  await page.getByRole('button', { name: 'Retry location', exact: true }).click();
  await expect(page.getByText('Distances use your last location.', { exact: false })).toHaveCount(0);
  await expect.poll(() => tray(page).locator('.map-tray-content').evaluate(el => el.scrollTop)).toBe(250);
});


test('bookmark menu fits a narrow screen with 44px targets', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?view=list');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Saved ideas', exact: true })).toBeVisible();
  await page.locator('.map-menu-popover').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
  });
  for (const button of await page.getByRole('menu', { name: 'Map options' }).locator('button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(43.99); // Allow subpixel rounding at the settled 44px size.
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
  }
  await page.screenshot({ path: info.outputPath('bookmark-menu-320.png') });
});
