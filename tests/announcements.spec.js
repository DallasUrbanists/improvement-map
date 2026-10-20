import { test, expect } from './ux/fixture.js';
const key = 'improvement_map_announcements_v1';
test.use({ storageState: { cookies: [], origins: [] } });
const releases = ['5.3.0', '5.2.0', '5.1.0'].map((version, i) => ({ id: i + 1, version, title: `Release ${version}`, publishedAt: '2026-10-19T12:00:00Z', body: '## Improvements\n\n- Easier browsing\n- Clearer actions\n\n<script>window.unsafe=true</script>\n\n[unsafe](javascript:alert(1))\n\n[GitHub](https://github.com)', url: `https://github.com/DallasUrbanists/improvement-map/releases/tag/v${version}` }));
test.beforeEach(async ({ page }) => {
  await page.route('**/*virtual*release-manifest*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify({ schemaVersion: 1, appVersion: '5.3.0', buildCommit: 'test', releases })}` }));
});
async function seed(page, acknowledged = '5.1.0', skipWelcome = true) {
  await page.addInitScript(({ key, acknowledged, skipWelcome }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, initialized: true, skipWelcome, acknowledged })); }, { key, acknowledged, skipWelcome });
}
test('first visit: approved welcome, opt out, manual history and safe Markdown', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Welcome & guide' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3').first()).toHaveText('Share an idea');
  await expect(page.getByText('Help shape a better Dallas.')).toHaveCount(0);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Go to app' }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: "What's new" }).click();
  await expect(page.locator('.announcement-release')).toHaveCount(3);
  await expect(page.getByText('Release history', { exact: true })).toHaveCount(0);
  await expect(page.locator('.release-markdown script, .release-markdown a[href^="javascript:"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
});
test('returning visitor sees welcome then all unseen releases, acknowledgement survives refresh', async ({ page }) => {
  await seed(page, '5.1.0', false);
  await page.goto('/');
  await page.getByRole('button', { name: 'Go to app' }).click();
  await expect(page.getByText('2 releases since your last visit')).toBeVisible();
  await expect(page.locator('.announcement-release')).toHaveCount(2);
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).acknowledged, key)).toBe('5.3.0');
});
test('direct idea link defers updates until Browse and keeps the route', async ({ page }) => {
  await seed(page);
  await page.goto('/suggestion/1');
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/suggestion\/1/);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
});
test('blocked preference writes use in-memory state without reopening', async ({ page }) => {
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v) { if (k === key) throw new DOMException('Blocked', 'SecurityError'); return original.call(this, k, v); };
  }, key);
  await page.goto('/');
  await expect(page.getByText('Preferences cannot be remembered in this browser. You can still use the app.')).toBeVisible();
  await page.getByRole('button', { name: 'Go to app' }).click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
test('competing dialog defers announcements and keyboard focus stays inside', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const blocker = document.createElement('dialog'); blocker.id = 'competing'; blocker.textContent = 'Existing dialog'; document.body.append(blocker); blocker.showModal();
    });
  });
  await page.goto('/');
  await expect(page.locator('#competing')).toBeVisible();
  await expect(page.locator('.announcement-dialog')).not.toBeVisible();
  await page.locator('#competing').evaluate(el => el.close());
  await expect(page.getByRole('button', { name: 'Go to app' })).toBeVisible();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('.announcement-dialog') !== null)).toBe(true);
  }
});
test('submission draft is untouched and welcome waits for Browse', async ({ page }) => {
  await page.goto('/submit');
  await expect(page.getByTestId('pin-and-continue')).toBeVisible();
  const draft = await page.evaluate(() => localStorage.getItem('improvement_map_wizard_draft_v1'));
  await expect(page.locator('.announcement-dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Go to app' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('improvement_map_wizard_draft_v1'))).toBe(draft);
});
test('cross-tab acknowledgement closes stale updates; rollback and offline do not repeat', async ({ page, context }) => {
  await seed(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/favicon.svg');
  await other.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 1, initialized: true, skipWelcome: true, acknowledged: '5.4.0' })), key);
  await expect(page.locator('.announcement-dialog')).not.toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: "What's new" }).click();
  await expect(page.locator('.announcement-release')).toHaveCount(3);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).acknowledged, key)).toBe('5.4.0');
  await context.setOffline(false);
});
