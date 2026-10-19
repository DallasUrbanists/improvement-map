import AxeBuilder from '@axe-core/playwright';
import { test, expect, draftKey } from './fixture.js';
import { inspectLayout, assertDraft } from './audit.js';

test('bundled icons render with every external resource blocked', async ({ page }) => {
  await page.goto('/');
  const icon = page.getByRole('button', { name: 'Menu', exact: true }).locator('i');
  await expect(icon).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await icon.evaluate(el => {
    const css = getComputedStyle(el, '::before');
    return css.content !== 'none' && css.content !== 'normal' && document.fonts.check('900 16px "Font Awesome 6 Free"');
  })).toBe(true);
});

test('audit detects deliberately introduced overflow and inaccessible buttons', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const el = document.createElement('button');
    el.id = 'audit-canary'; el.style.cssText = 'position:absolute;left:0;top:0;width:200vw;height:44px';
    document.body.append(el);
  });
  expect((await inspectLayout(page)).some(x => x.kind === 'overflow' || x.kind === 'clipped-control')).toBe(true);
  const results = await new AxeBuilder({ page }).include('#audit-canary').analyze();
  expect(results.violations.some(x => x.id === 'button-name')).toBe(true);
});

test('draft oracle detects deliberately corrupted persisted data', async ({ page }) => {
  await page.goto('/');
  await assertDraft(page, draftKey, { step: 1 });
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ step: 99 })), draftKey);
  await expect(assertDraft(page, draftKey, { step: 1 }, 100)).rejects.toThrow();
});

test('firewall blocks external and same-origin writes', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    // Reserved domains ensure even a broken firewall cannot write to a real API.
    const urls = ['https://api.example.invalid/suggestions', 'https://uploads.test/photo', '/api/public-improvements/suggestions'];
    return Promise.all(urls.map(async url => {
      try { await fetch(url, { method: 'POST', body: 'audit-canary' }); return 'sent'; }
      catch { return 'blocked'; }
    }));
  });
  expect(results).toEqual(['blocked', 'blocked', 'blocked']);
});
