import { test, expect, photo } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';

const caption = 'A long caption describing the crossing and the improvements needed. '.repeat(12);
const portrait = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="400"><rect width="180" height="400" fill="steelblue"/></svg>');
for (const width of [320, 360, 412]) {
  test(`detail photos and captions at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 740 });
    await page.addInitScript(({ photo, portrait, caption }) => {
      window.__ux.photos = [{ url: photo }, { url: portrait, caption }, { url: photo, caption: 'Short caption' }];
    }, { photo, portrait, caption });
    await page.goto('/suggestion/1');
    await expect(page.getByRole('region', { name: 'Idea details', exact: true })).toHaveAttribute('aria-busy', 'false');
    const summary = page.locator('summary').filter({ hasText: 'Photos (3)' });
    await summary.click();
    expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(48);
    const cards = page.locator('.detail-photo-thumbnail');
    await expect(cards.first().locator('.detail-photo-caption')).toHaveCount(0);
    for (const img of await cards.locator('img').all()) {
      const box = await img.boundingBox(); expect(box.width).toBe(144); expect(box.height).toBe(108);
    }
    expect((await cards.nth(1).locator('.detail-photo-caption').boundingBox()).height).toBeLessThanOrEqual(36);
    await cards.nth(1).click();
    const dialog = page.getByRole('dialog', { name: 'Photo preview' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('p')).toHaveText(caption.trim());
    const close = dialog.getByRole('button', { name: 'Close photo preview' });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(cards.nth(1)).toBeFocused();
    await cards.last().click(); await close.click(); await expect(cards.last()).toBeFocused();
    await page.locator('.detail-photo-row').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect.poll(() => page.locator('.detail-photo-row').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.detail-photo-row').evaluate(el => { el.scrollLeft = 0; });
    await summary.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('detail-strip.png') });
    await info.attach(`detail-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    const results = await new AxeBuilder({ page }).include('.submission-detail-tray').disableRules(['meta-viewport']).analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 740, height: 360 });
    await page.locator('html').evaluate(el => { el.style.fontSize = '20px'; });
    await cards.first().click(); await expect(close).toBeInViewport();
    await close.click();
    await summary.click(); await expect(summary.locator('..')).not.toHaveAttribute('open', '');
    await summary.click(); await expect(summary.locator('..')).toHaveAttribute('open', '');
    await page.locator('summary').filter({ hasText: 'Representatives' }).click();
    await expect(summary.locator('..')).toHaveAttribute('open', '');
  });
}
for (const count of [0, 1]) {
  test(`detail with ${count} uncaptioned photos`, async ({ page }) => {
    await page.addInitScript(({ photo, count }) => { window.__ux.photos = Array.from({ length: count }, () => ({ url: photo })); }, { photo, count });
    await page.goto('/suggestion/1');
    await expect(page.getByRole('region', { name: 'Idea details', exact: true })).toHaveAttribute('aria-busy', 'false');
    const summary = page.locator('summary').filter({ hasText: 'Photos' });
    if (!count) { await expect(summary).toHaveCount(0); return; }
    await summary.click();
    await expect(page.locator('.detail-photo-caption')).toHaveCount(0);
    expect((await page.locator('.detail-photo-thumbnail').boundingBox()).height).toBe(108);
  });
}
