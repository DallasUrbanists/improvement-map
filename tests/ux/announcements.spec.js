import { test, expect } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';
test.use({ storageState: { cookies: [], origins: [] } });
test('welcome and long release notes retain exits and accessible mobile layouts', async ({ page }, testInfo) => {
  const releases = [{ id: 1, version: '5.3.0', title: 'Better ways to share ideas', publishedAt: '2026-10-19T12:00:00Z', body: '## Improvements\n\n' + '- Easier browsing and clearer next steps.\n'.repeat(25), url: 'https://github.com/DallasUrbanists/improvement-map/releases/tag/v5.3.0' }];
  await page.route('**/*virtual*release-manifest*', route => route.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify({ schemaVersion: 1, appVersion: '5.3.0', buildCommit: 'fixture', releases })}` }));
  await page.goto('/');
  const dialog = page.locator('.announcement-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3').first()).toHaveText('Share an idea');
  for (const screen of ['welcome', 'history']) {
    await expect(dialog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect((await new AxeBuilder({ page }).include('.announcement-dialog').analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const before = await dialog.locator('.announcement-footer').boundingBox();
    await dialog.locator('.announcement-content').evaluate(el => el.scrollTop = el.scrollHeight);
    expect(await dialog.locator('.announcement-footer').boundingBox()).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath(`${screen}.png`), animations: 'disabled' });
    await dialog.locator('.announcement-primary').click();
    if (screen === 'welcome') {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('menuitem', { name: "What's new" }).click();
    }
  }
});
