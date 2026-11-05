import { test, expect } from './fixture.js';
import AxeBuilder from '@axe-core/playwright';

async function idea(page) {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
}

test('map settings preserve the idea tray and theme is one reversible control', async ({ page }) => {
  await idea(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const theme = page.getByRole('menuitemcheckbox', { name: 'Dark mode' });
  const initial = await theme.getAttribute('aria-checked');
  await theme.click();
  await expect(theme).toHaveAttribute('aria-checked', initial === 'true' ? 'false' : 'true');
  await theme.click();
  await page.getByRole('link', { name: 'Map settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Map settings' });
  await expect(settings).toBeVisible();
  await expect(page.locator('.submission-detail-tray')).toBeVisible();
  await expect(settings.locator('#map-marker-pulse-easing')).toBeHidden();
  await settings.getByRole('switch').click();
  await expect(settings.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await settings.getByRole('button', { name: 'Rail', exact: true }).click();
  await expect(settings.getByLabel('Line width')).toBeVisible();
  await expect(page.locator('.floating-modal[aria-modal="true"]')).toHaveCount(1);
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).toHaveURL(/suggestion\/1$/);
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeFocused();
});

test('saved idea removal can be undone without changing saved order', async ({ page }) => {
  await page.goto('/?view=list');
  await page.locator('.idea-row').nth(0).getByRole('button').click();
  await page.locator('.idea-row').nth(1).getByRole('button').click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: 'Saved ideas' }).click();
  await expect(page.locator('.idea-row')).toHaveCount(2);
  const before = await page.locator('[data-suggestion-id]').evaluateAll(els => els.map(el => el.dataset.suggestionId));
  await page.locator('.idea-row').first().getByRole('button').click();
  await expect(page.locator('.idea-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.locator('[data-suggestion-id]').evaluateAll(els => els.map(el => el.dataset.suggestionId))).toEqual(before);
});

test('action removal undo restores the saved action', async ({ page }) => {
  await page.addInitScript(() => { window.__ux.actions = [{ id: 'a', summary: 'Attend the meeting', instructions: 'Bring your idea.' }]; });
  await idea(page);
  await page.locator('summary').filter({ hasText: 'Recommended actions' }).click();
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await page.getByRole('link', { name: 'My actions (1)' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Attend the meeting' })).toBeVisible();
});

for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`context previews and full sheets fit ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      window.__ux.boundaries = Array.from({ length: 6 }, (_, i) => ({ id: i, entityName: 'City of Dallas', bodyName: 'City Council', districtName: `District ${i + 1}`, description: 'Local representation and neighborhood services.', whenToContact: 'For local street improvements.' }));
      window.__ux.representatives = Array.from({ length: 6 }, (_, i) => ({ id: i, name: `Representative ${i + 1}`, title: 'Council member', boundary: { entityName: 'City of Dallas', districtName: `District ${i + 1}` }, emails: ['office@example.test'], phones: ['2145550100'], webpage_url: 'https://example.test' }));
    });
    await idea(page);
    await page.locator('html').evaluate(el => { el.style.fontSize = '20px'; });
    await page.locator('summary').filter({ hasText: 'Neighborhoods & districts' }).click();
    await expect(page.locator('.context-card')).toHaveCount(2);
    const trigger = page.getByRole('button', { name: 'View all areas' });
    await trigger.click();
    const areas = page.getByRole('dialog', { name: 'Neighborhoods & districts' });
    await expect(areas.locator('.context-card')).toHaveCount(6);
    expect(await areas.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('areas.png') });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await page.locator('summary').filter({ hasText: /^Representatives/ }).click();
    await page.getByRole('button', { name: 'View all representatives' }).click();
    const representatives = page.getByRole('dialog', { name: 'Representatives' });
    await expect(representatives.getByRole('link', { name: /^Call/ })).toHaveCount(6);
    await expect(representatives.getByRole('link', { name: /^Email/ }).first()).toHaveAttribute('href', 'mailto:office@example.test');
    expect((await new AxeBuilder({ page }).include('.detail-sheet[open]').analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('representatives.png') });
  });
}


test('saved list restores reading position and searches a larger collection', async ({ page }) => {
  await page.goto('/bookmarks');
  await page.evaluate(async () => {
    const { saveBookmark } = await import('/src/services/bookmarks.js');
    for (let i = 1; i <= 15; i++) saveBookmark({ id: String(i), content: { summary: `Suggestion ${i}` }, location: { address: 'Elm Street, Dallas, TX' } });
  });
  const saved = page.getByRole('dialog', { name: 'Saved ideas', exact: true });
  await expect(saved.locator('.idea-row')).toHaveCount(15);
  const item = saved.locator('[data-suggestion-id="3"]');
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Close Idea details', exact: true }).click();
  await expect(saved).toBeVisible();
  await expect.poll(() => saved.locator('.map-tray-content').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await saved.getByRole('searchbox', { name: 'Search saved ideas' }).fill('Suggestion 12');
  await expect(saved.locator('.idea-row')).toHaveCount(1);
  await expect(saved.locator('[data-suggestion-id="12"]')).toBeVisible();
  await expect(page).toHaveTitle('Saved ideas | Improvement Map');
});
