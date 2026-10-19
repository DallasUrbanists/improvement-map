import { test, expect } from './fixture.js';
for (const size of [{ width: 375, height: 667 }, { width: 320, height: 568 }]) {
  test(`reading sheet ${size.width}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    await page.goto('/suggestion/1');
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => {
      // Match the fixture overlay's linear projection when framing the marker.
      window.google.maps.Map.prototype.panBy = function (x, y) {
        this.setCenter({ lat: this.getCenter().lat() - y / 10000, lng: this.getCenter().lng() + x / 10000 });
      };
    });
    const summary = page.locator('.detail-marker-summary');
    // Use the reported long headline to exercise the actual layout observer.
    await summary.locator('[aria-hidden="true"]').evaluate(el => { el.textContent = 'Improve pedestrian safety and crossing convenience by adjusting signal timing or narrowing this wide intersection.'; });
    await page.setViewportSize({ ...size, height: size.height - 1 });
    await expect.poll(() => summary.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await expect.poll(async () => {
      const a = await summary.boundingBox(); const b = await tray.boundingBox(); return b.y - a.y - a.height;
    }).toBeGreaterThanOrEqual(10);
    const marker = await page.locator('.detail-map-target').boundingBox();
    const byline = await page.locator('.detail-marker-byline').boundingBox();
    expect(byline.y + byline.height).toBeLessThan(marker.y);
    const search = await page.locator('.map-search-panel').boundingBox();
    expect(Math.abs(byline.y + byline.height / 2 - (search.y + search.height + marker.y) / 2)).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath('compact.png') });
    await page.getByRole('button', { name: 'Expand details', exact: true }).click();
    await expect(tray).toHaveClass(/is-reading/);
    expect((await tray.boundingBox()).y).toBe(82);
    await expect(page.locator('.detail-reading-heading')).toBeVisible();
    await expect(summary).toBeHidden();
    await page.screenshot({ path: info.outputPath('reading.png') });
    await page.getByRole('button', { name: 'Show map', exact: true }).click();
    await expect(tray).not.toHaveClass(/is-reading/);
    const content = tray.locator('.map-tray-content');
    const swipe = async (from, to) => {
      await content.dispatchEvent('touchstart', { touches: [{ clientX: 150, clientY: from }] });
      await content.dispatchEvent('touchmove', { touches: [{ clientX: 150, clientY: to }] });
      await content.dispatchEvent('touchend', { touches: [] });
    };
    await swipe(450, 100);
    await expect(tray).toHaveClass(/is-reading/);
    await content.evaluate(el => { el.scrollTop = 0; });
    await swipe(100, 450);
    await expect(tray).not.toHaveClass(/is-reading/);
    await page.getByRole('button', { name: 'Expand details', exact: true }).click();
    await page.getByRole('button', { name: 'Next idea', exact: true }).click();
    await expect(tray).not.toHaveClass(/is-reading/);
  });
}

test('reading tray animates both directions and resizes its grip', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/suggestion/1');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  const handle = page.locator('.detail-tray-handle');
  const bounds = await handle.boundingBox();
  expect(bounds.height).toBe(22);
  expect(Math.abs(bounds.width - ((await tray.boundingBox()).width - 2) / 2)).toBeLessThan(1);
  await tray.evaluate(el => {
    const animate = el.animate.bind(el);
    el.animate = (frames, options) => {
      const animation = animate(frames, options);
      // Hold the sheet animation before a slower browser/tool round trip can finish it.
      if (frames.some(frame => frame.maxHeight === 'none')) animation.pause();
      return animation;
    };
  });
  for (const expanded of [true, false]) {
    const before = (await tray.boundingBox()).height;
    await handle.click();
    const motion = await tray.evaluate(async el => {
      const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(k => k.maxHeight === 'none'));
      if (!animation) return null;
      animation.pause();
      animation.currentTime = 160;
      const middle = el.getBoundingClientRect().height;
      animation.finish();
      await animation.finished;
      return { middle, end: el.getBoundingClientRect().height };
    });
    expect(motion).not.toBeNull();
    expect(motion.middle).toBeGreaterThan(Math.min(before, motion.end));
    expect(motion.middle).toBeLessThan(Math.max(before, motion.end));
    await expect(handle).toHaveAttribute('aria-expanded', String(expanded));
  }
});

test('tray tracks a finger and snaps on release without moving the lower grip', async ({ page }) => {
  await page.goto('/suggestion/1');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  const handle = page.locator('.detail-tray-handle');
  const original = await tray.boundingBox();
  const start = async () => handle.dispatchEvent('touchstart', { touches: [{ clientX: 180, clientY: 500 }] });
  const move = async y => handle.dispatchEvent('touchmove', { touches: [{ clientX: 180, clientY: y }] });
  await start();
  await move(450);
  expect(Math.abs((await tray.boundingBox()).height - original.height - 50)).toBeLessThan(1);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await handle.dispatchEvent('touchend', { touches: [] });
  await expect.poll(async () => Math.abs((await tray.boundingBox()).height - original.height)).toBeLessThan(1);
  await start();
  await move(100);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await handle.dispatchEvent('touchend', { touches: [] });
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  const grip = await page.locator('.detail-tray-grip').evaluate(el => ({ upper: getComputedStyle(el, '::before').visibility, lower: getComputedStyle(el, '::after').visibility, height: el.getBoundingClientRect().height }));
  expect(grip).toEqual({ upper: 'hidden', lower: 'visible', height: 10 });
  expect((await handle.boundingBox()).height).toBe(22);
});

test.describe('desktop pointer', () => {
  test.use({ isMobile: false, hasTouch: false });
test('mouse handle shows a hint and supports dragging', async ({ page }) => {
  await page.goto('/suggestion/1');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  const handle = page.locator('.detail-tray-handle');
  const grip = page.locator('.detail-tray-grip');
  await page.mouse.move(1, 1);
  await expect(grip).toHaveCSS('opacity', '0.6');
  await expect(handle).toHaveAttribute('title', 'Drag to resize, or click to expand');
  const bounds = await handle.boundingBox();
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const before = (await tray.boundingBox()).height;
  await page.mouse.move(x, y);
  await expect(grip).toHaveCSS('opacity', '1');
  await page.mouse.down();
  await page.mouse.move(x, y - 50, { steps: 4 });
  expect(Math.abs((await tray.boundingBox()).height - before - 50)).toBeLessThan(1);
  await page.mouse.move(x, 85, { steps: 5 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
});

});
