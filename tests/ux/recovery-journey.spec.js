import { test, expect } from './fixture.js';
import { audit } from './audit.js';

test('empty, denied location, unavailable detail and enlarged text', async ({ page }, info) => {
  const check = audit(page, info);
  await page.addInitScript(() => { window.__ux.empty = true; });
  await page.goto('/?view=list');
  await expect(page.getByRole('heading', { name: 'No ideas yet' })).toBeVisible();
  await check('browse-empty');
  await page.getByRole('button', { name: 'Nearest to me' }).click();
  await check('location-denied');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await check('enlarged-text');
  await page.goto('/suggestion/missing');
  await expect(page.getByRole('heading', { name: 'Idea unavailable' })).toBeVisible();
  await check('detail-error');
});
