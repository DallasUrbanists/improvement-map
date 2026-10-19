import { test, expect } from './fixture.js';

const action = { id: '1', summary: 'Contact your representative', instructions: 'Share your idea.', reason: 'Improve the street.' };
async function open(page) {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.locator('summary').filter({ hasText: 'Recommended Actions' }).click();
}
test('save and hide independently, reload, review and remove from My actions', async ({ page }) => {
  await page.addInitScript(a => { window.__ux.actions = [a]; }, action);
  await open(page);
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await page.getByRole('button', { name: 'Hide', exact: true }).click();
  await expect(page.getByText('All recommendations are hidden.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate recommended actions' })).toHaveCount(0);
  await page.reload();
  await page.locator('summary').filter({ hasText: 'Recommended Actions' }).click();
  await page.getByRole('button', { name: 'Show hidden (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove from My actions' })).toBeVisible();
  await page.getByRole('button', { name: 'Unhide', exact: true }).click();
  await page.getByRole('link', { name: 'My actions (1)' }).click();
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('No saved actions yet.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Close My actions', exact: true }).click();
  await expect(page).toHaveURL(/suggestion\/1$/);
});
test('generation is explicit, cached, and identity survives attached results', async ({ page }) => {
  await page.addInitScript(a => { window.__ux.generated = [{ ...a, why: 'Catalog reason' }]; }, action);
  await open(page);
  await expect(page.getByRole('button', { name: 'Generate recommended actions' })).toBeVisible();
  expect(await page.evaluate(() => window.__ux.matches || 0)).toBe(0);
  await page.getByRole('button', { name: 'Generate recommended actions' }).click();
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await page.reload();
  await page.locator('summary').filter({ hasText: 'Recommended Actions' }).click();
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
  expect(await page.evaluate(() => window.__ux.matches || 0)).toBe(0);
  await page.evaluate(a => { window.__ux.actions = [{ ...a, id: 'attached', recommendableId: '1' }]; }, action);
  await page.getByRole('button', { name: 'Refresh idea', exact: true }).click();
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  await page.locator('summary').filter({ hasText: 'Recommended Actions' }).click();
  await expect(page.getByRole('button', { name: 'Remove from My actions' })).toBeVisible();
});
test('errors stay distinct from empty results and failed storage never claims success', async ({ page }) => {
  await page.addInitScript(() => { window.__ux.actionsFail = true; });
  await open(page);
  await expect(page.getByRole('button', { name: 'Generate recommended actions' })).toHaveCount(0);
  await page.evaluate(() => { window.__ux.actionsFail = false; window.__ux.matchFail = true; });
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await page.getByRole('button', { name: 'Generate recommended actions' }).click();
  await expect(page.getByText('Matching failed')).toBeVisible();
  await page.evaluate(a => { window.__ux.matchFail = false; window.__ux.generated = [a]; }, action);
  await page.getByRole('button', { name: 'Generate recommended actions' }).click();
  await expect(page.getByRole('heading', { name: action.summary })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('Quota'); }; });
  await page.getByRole('button', { name: 'Add to My actions', exact: true }).click();
  await expect(page.getByText('Unable to save on this device.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to My actions', exact: true })).toBeVisible();
});
for (const size of [{ width: 360, height: 880 }, { width: 320, height: 568 }, { width: 880, height: 360 }]) {
  test(`100 recommendations fit ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript(a => { window.__ux.actions = Array.from({ length: 100 }, (_, i) => ({ ...a, id: String(i), summary: `${i} ${'LongTitle'.repeat(12)}`, instructions: 'Long instructions. '.repeat(100) })); }, action);
    await open(page);
    await expect(page.locator('.action-card')).toHaveCount(10);
    await page.getByRole('button', { name: 'Show 10 more' }).click();
    await expect(page.locator('.action-card')).toHaveCount(20);
    await page.locator('.action-card').first().locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const buttons = await page.locator('.action-card').first().locator('button').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    expect(buttons.every(height => height >= 44)).toBe(true);
    await page.screenshot({ path: info.outputPath('recommendations.png') });
  });
}
