import { test, expect } from './fixture.js';
import { audit } from './audit.js';

const key = 'improvement_map_bookmarks_v1';
const row = (page, id) => page.locator('.idea-row').filter({ has: page.locator('[data-suggestion-id="' + id + '"]') });
const details = page => page.getByRole('region', { name: 'Idea details', exact: true });
async function ready(page) { await expect(details(page)).toHaveAttribute('aria-busy', 'false'); }
async function openBookmarks(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Saved ideas', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved ideas', exact: true })).toBeVisible();
}
async function closeDetails(page) { await page.getByRole('button', { name: 'Close Idea details', exact: true }).click(); }

test('bookmarks persist, stay separate from row activation, and synchronize across tabs', async ({ page, context, baseURL }) => {
  await page.goto('/?view=list');
  const first = row(page, '1');
  await first.getByRole('button', { name: 'Bookmark idea', exact: true }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(first.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  expect(saved.saved['1'].suggestion.content.photos).toEqual([]);
  await page.reload();
  await expect(row(page, '1').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-suggestion-id="1"]').click();
  await ready(page);
  await expect(details(page).getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.route('**/storage-peer', route => route.fulfill({ contentType: 'text/html', body: '<title>Storage peer</title>' }));
  await other.goto(baseURL + '/storage-peer');
  await other.evaluate(key => localStorage.removeItem(key), key);
  await expect(details(page).getByRole('button', { name: 'Bookmark idea', exact: true })).toBeVisible();
  await other.close();
  await details(page).getByRole('button', { name: 'Bookmark idea', exact: true }).click();
  await closeDetails(page);
  await expect(row(page, '1').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
});

test('source list order, scroll, focus, refresh, and nested bookmark returns', async ({ page }) => {
  await page.goto('/?view=list');
  await row(page, '8').scrollIntoViewIfNeeded();
  await row(page, '8').getByRole('button').click();
  await row(page, '9').getByRole('button').click();
  await page.locator('[data-suggestion-id="8"]').focus();
  await page.locator('[data-suggestion-id="8"]').press('Enter');
  await ready(page);
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page).toHaveURL('/suggestion/9');
  await ready(page);
  await page.reload();
  await ready(page);
  await closeDetails(page);
  await expect(page).toHaveURL(/view=list/);
  await expect(page.locator('[data-suggestion-id="8"]')).toBeFocused();
  await expect.poll(() => page.locator('.map-tray-content').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.locator('[data-suggestion-id="8"]').click();
  await ready(page);
  await openBookmarks(page);
  const ids = await page.locator('[data-suggestion-id]').evaluateAll(els => els.map(el => el.dataset.suggestionId));
  await page.locator('[data-suggestion-id="' + ids[0] + '"]').click();
  await ready(page);
  await expect(page.getByRole('button', { name: 'Previous idea', exact: true })).toBeDisabled();
  await details(page).getByRole('button', { name: 'Remove bookmark', exact: true }).click();
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page).toHaveURL('/suggestion/' + ids[1]);
  await ready(page);
  await closeDetails(page);
  await expect(page).toHaveURL('/bookmarks');
  await expect(page.locator('.idea-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close Saved ideas', exact: true }).click();
  await expect(page).toHaveURL('/suggestion/8');
  await ready(page);
  await closeDetails(page);
  await expect(page).toHaveURL(/view=list/);
  await page.goForward();
  await ready(page);
});

test('bookmark empty state, unavailable ideas, removal focus, and storage failures', async ({ page }) => {
  await page.goto('/bookmarks');
  await expect(page.getByText('No saved ideas')).toBeVisible();
  await page.getByRole('link', { name: 'Browse ideas', exact: true }).click();
  await row(page, '1').getByRole('button').click();
  await row(page, '2').getByRole('button').click();
  await openBookmarks(page);
  const button = page.locator('.idea-row button').first();
  await button.focus();
  await button.press('Enter');
  await expect(page.locator('.idea-row button')).toBeFocused();
  await page.evaluate(async key => {
    const value = JSON.parse(localStorage.getItem(key));
    value.saved.missing = { savedAt: new Date().toISOString(), suggestion: { id: 'missing', content: { summary: 'Unavailable idea' } } };
    localStorage.setItem(key, JSON.stringify(value));
  }, key);
  await page.reload();
  await page.getByRole('link', { name: 'Unavailable idea' }).click();
  await ready(page);
  await expect(page.getByText('Idea unavailable', { exact: true })).toBeVisible();
  await closeDetails(page);
  await row(page, 'missing').getByRole('button').click();
  await expect(row(page, 'missing')).toHaveCount(0);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); }; });
  await page.locator('.idea-row button').click();
  await expect(page.getByRole('alert')).toContainText('Unable to save bookmarks');
  await expect(page.locator('.idea-row')).toHaveCount(1);
});

test('unreadable bookmark data is preserved', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{broken'), key);
  await page.goto('/?view=list');
  await row(page, '1').getByRole('button').click();
  await expect(page.getByRole('alert')).toContainText('Existing browser data has not been changed');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{broken');
  await expect(row(page, '1').getByRole('button')).toHaveAttribute('aria-pressed', 'false');
});

test('nearest sorting explains GPS failure, retries, and follows distance order', async ({ page }) => {
  await page.goto('/?view=list');
  await page.getByRole('button', { name: 'Nearest to me', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Newest', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Your location is unavailable.', { exact: false })).toBeVisible();
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = resolve => resolve({ coords: { latitude: 32.799, longitude: -96.8 } });
  });
  await page.getByRole('button', { name: 'Retry location', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nearest to me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-suggestion-id]').first()).toHaveAttribute('data-suggestion-id', '20');
  await page.locator('[data-suggestion-id="20"]').click();
  await ready(page);
  await page.getByRole('button', { name: 'Next idea', exact: true }).click();
  await expect(page).toHaveURL('/suggestion/19');
  await ready(page);
  await closeDetails(page);
  await expect(page.getByRole('button', { name: 'Nearest to me', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Newest', exact: true }).click();
  await expect(page.locator('[data-suggestion-id]').first()).toHaveAttribute('data-suggestion-id', '1');
});

test('list loading and error are distinct from a confirmed empty list', async ({ page }) => {
  await page.addInitScript(() => { window.__ux.listFail = true; window.__ux.hold = true; });
  await page.goto('/?view=list');
  await expect(page.getByText('Loading ideas…')).toBeVisible();
  await page.evaluate(() => { window.__ux.hold = false; });
  await expect(page.getByRole('alert')).toContainText('Ideas could not be loaded');
  await expect(page.getByText('No ideas yet')).toHaveCount(0);
  await page.evaluate(() => { window.__ux.listFail = false; window.__ux.empty = true; });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('No ideas yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Submit an idea', exact: true })).toBeVisible();
});

test('mobile and desktop idea trays retain usable controls and readable rows', async ({ page }, info) => {
  await page.goto('/?view=list');
  const check = audit(page, info);
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    const tray = page.locator('.idea-list-tray');
    const box = await tray.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    if (size.width >= 1024) expect(box.width).toBe(420);
    await expect(page.getByRole('button', { name: 'Close Browse ideas' })).toBeInViewport();
    const bookmark = page.locator('.idea-row button').first();
    const target = await bookmark.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    await check('idea-list-' + size.width);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('[data-suggestion-id="1"]').click();
  await ready(page);
  for (const button of await details(page).locator('header button').all()) await expect(button).toBeInViewport();
  await check('idea-detail-bookmark-320');
});
