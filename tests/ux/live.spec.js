import { test, expect } from '@playwright/test';

test('read-only live map integration smoke', async ({ page, context }, info) => {
  test.skip(!process.env.UX_LIVE_URL, 'Explicit UX_LIVE_URL required; no live access in deterministic CI');
  await context.route('**/*', route => {
    const req = route.request();
    // Strictly read-only. Some SDK telemetry POSTs will be blocked as well.
    return ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort('blockedbyclient');
  });
  await page.goto(process.env.UX_LIVE_URL);
  await expect(page.locator('[data-testid="persistent-map"] .gm-style')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.fake-map')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map view options' })).toBeVisible();
  await page.getByRole('button', { name: 'Browse', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Browse suggestions' })).toBeVisible();
  await info.attach('live-map.png', { body: await page.screenshot(), contentType: 'image/png' });
});
