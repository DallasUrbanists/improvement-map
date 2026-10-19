import { test, expect } from './fixture.js';
test.use({ reducedMotion: 'no-preference' });
for (const size of [{width:360,height:880},{width:412,height:915},{width:880,height:360}]) {
  test(`content fitting tray ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => { window.__ux.details = 'Short description.'; });
    await page.goto('/suggestion/1');
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy','false');
    const content = tray.locator('.map-tray-content');
    const summary = page.locator('summary').filter({hasText:'Photos'});
    await expect(page.locator('.detail-description-inner > p').first()).toHaveText('Short description.');
    await page.evaluate(() => {
      window.google.maps.Map.prototype.panBy = function (x, y) {
        this.setCenter({ lat: this.getCenter().lat() - y / 10000, lng: this.getCenter().lng() + x / 10000 });
      };
      window.dispatchEvent(new Event('resize'));
    });
    await expect.poll(async () => {
      const headline = await page.locator('.detail-marker-summary').boundingBox();
      const frame = await tray.boundingBox();
      return frame.y - headline.y - headline.height;
    }).toBeGreaterThanOrEqual(21);
    const closed = await tray.boundingBox();
    await expect.poll(async () => {
      const headline = await page.locator('.detail-marker-summary').boundingBox();
      const frame = await tray.boundingBox();
      return headline.x - frame.x;
    }).toBeGreaterThanOrEqual(19);
    const headline = await page.locator('.detail-marker-summary').boundingBox();
    expect(headline.x + headline.width).toBeLessThanOrEqual(closed.x + closed.width - 19);
    expect(headline.y + headline.height).toBeLessThanOrEqual(closed.y - 15);
    await page.screenshot({ path: info.outputPath('content-fitting-tray.png') });
    const metrics = await content.evaluate(el => ({height:el.clientHeight, scroll:el.scrollHeight}));
    expect(metrics.height).toBeGreaterThan(0);
    expect(metrics.scroll).toBeGreaterThanOrEqual(metrics.height);
    await summary.click();
    await expect(summary.locator('..')).toHaveAttribute('open','');
    await expect.poll(async () => (await tray.boundingBox()).height).toBeGreaterThanOrEqual(closed.height);
    const open = await tray.boundingBox();
    expect(Math.abs(open.y + open.height - closed.y - closed.height)).toBeLessThan(2);
    await expect(summary).toBeInViewport();
    await summary.click();
    await expect.poll(async () => Math.abs((await tray.boundingBox()).height-closed.height)).toBeLessThan(2);
    await expect(summary).toBeInViewport();
    await page.evaluate(() => { window.__ux.details = 'Long description for scrolling. '.repeat(200); });
    await page.getByRole('button',{name:'Refresh idea',exact:true}).click();
    await expect(tray).toHaveAttribute('aria-busy','false');
    await summary.scrollIntoViewIfNeeded();
    const before = await content.evaluate(el => el.scrollTop);
    await summary.click();
    await expect(summary).toBeInViewport();
    expect(Math.abs(await content.evaluate(el => el.scrollTop)-before)).toBeLessThan(2);
    await summary.click();
    await expect(summary).toBeInViewport();
    expect(Math.abs(await content.evaluate(el => el.scrollTop)-before)).toBeLessThan(2);
    await page.evaluate(() => { window.__ux.delay = 250; window.__ux.actions = [{id:'action',summary:'Test action',instructions:'Details arriving later. '.repeat(80)}]; });
    const actions = page.locator('summary').filter({hasText:'Recommended actions'});
    await actions.click();
    await expect(page.getByRole('heading',{name:'Test action'})).toBeVisible();
    await expect(actions).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
