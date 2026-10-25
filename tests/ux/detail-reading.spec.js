import { test, expect } from './fixture.js';

async function dispatchTouch(locator, type, { touches }) {
  await locator.evaluate((element, { type, touches }) => {
    // WebKit does not expose constructible Touch objects. Supply the gesture
    // data directly, as the deterministic flick tests below do.
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: touches.map((point, identifier) => ({ ...point, identifier, target: element })) });
    element.dispatchEvent(event);
  }, { type, touches });
}

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
    await expect(page.locator('.detail-marker-byline')).toHaveCount(0);
    await expect(page.locator('.detail-description-byline')).toHaveText('October 1 · Test Contributor');
    await expect.poll(async () => {
      const search = await page.locator('.map-search-panel').boundingBox();
      const marker = await page.locator('.detail-map-target').boundingBox();
      const caption = await summary.boundingBox();
      const sheet = await tray.boundingBox();
      return Math.abs((marker.y + caption.y + caption.height) / 2 - (search.y + search.height + sheet.y) / 2);
    }).toBeLessThan(1);
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
      await dispatchTouch(content, 'touchstart', { touches: [{ clientX: 150, clientY: from }] });
      await dispatchTouch(content, 'touchmove', { touches: [{ clientX: 150, clientY: to }] });
      await dispatchTouch(content, 'touchend', { touches: [] });
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

test('wheel gestures move between medium and max only at the scroll boundary', async ({ page }) => {
  await page.goto('/suggestion/1');
  const tray = page.locator('.submission-detail-tray');
  const trayLayer = page.locator('.tray-layer').filter({ has: tray });
  await expect(tray).not.toHaveAttribute('aria-busy', 'true');
  await expect(trayLayer).toHaveAttribute('data-position', 'medium');

  const wheel = deltaY => tray.evaluate((el, deltaY) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  }, deltaY);
  expect(await wheel(120)).toBe(true);
  await expect(trayLayer).toHaveAttribute('data-position', 'max');
  await tray.locator('.tray__content').evaluate(el => { el.style.minHeight = '1600px'; });
  await expect.poll(() => tray.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);

  await tray.evaluate(el => { el.scrollTop = 40; });
  await expect.poll(() => tray.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await wheel(-120)).toBe(false);
  await expect(trayLayer).toHaveAttribute('data-position', 'max');

  await tray.evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => tray.evaluate(el => el.scrollTop)).toBe(0);
  expect(await wheel(-120)).toBe(true);
  await expect(trayLayer).toHaveAttribute('data-position', 'medium');
});

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
  const start = async () => dispatchTouch(handle, 'touchstart', { touches: [{ clientX: 180, clientY: 500 }] });
  const move = async y => dispatchTouch(handle, 'touchmove', { touches: [{ clientX: 180, clientY: y }] });
  await start();
  await move(450);
  expect(Math.abs((await tray.boundingBox()).height - original.height - 50)).toBeLessThan(1);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  // A hold before release must clear flick momentum.
  await page.waitForTimeout(160);
  await dispatchTouch(handle, 'touchend', { touches: [] });
  await expect.poll(async () => Math.abs((await tray.boundingBox()).height - original.height)).toBeLessThan(1);
  await start();
  await move(100);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await dispatchTouch(handle, 'touchend', { touches: [] });
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

test('quick flicks use direction while slow drags use the nearest position', async ({ page }) => {
  await page.goto('/suggestion/1');
  await expect(page.locator('.submission-detail-tray')).toHaveAttribute('aria-busy', 'false');
  const handle = page.locator('.detail-tray-handle');
  const gesture = async (delta, duration, cancel = false) => handle.evaluate((el, { delta, duration, cancel }) => {
    const original = performance.now.bind(performance);
    let time = original();
    performance.now = () => time;
    const fire = (type, y) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'touches', { value: type === 'touchmove' || type === 'touchstart' ? [{ clientX: 180, clientY: y }] : [] }); el.dispatchEvent(event); };
    try {
      fire('touchstart', 400);
      for (let i = 1; i <= 4; i++) { time += duration / 4; fire('touchmove', 400 + delta * i / 4); }
      fire(cancel ? 'touchcancel' : 'touchend', 400 + delta);
    } finally { performance.now = original; }
  }, { delta, duration, cancel });
  // Both travel only 40px, well short of the midpoint.
  await gesture(-40, 400);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
  await gesture(-40, 50);
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  await gesture(40, 400);
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  await gesture(40, 50, true);
  await expect(handle).toHaveAttribute('aria-expanded', 'true');
  await gesture(40, 50);
  await expect(handle).toHaveAttribute('aria-expanded', 'false');
});

test('map icon, summary and spotlight fade with tray motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/suggestion/1');
  const tray = page.locator('.submission-detail-tray');
  await expect(tray).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
  const target = page.locator('.detail-map-target');
  const handle = page.locator('.detail-tray-handle');
  await page.evaluate(() => {
    window.__markerOpacity = 1;
    window.google.maps.Marker.prototype.setOpacity = function (value) { window.__markerOpacity = value; };
    const el = document.querySelector('.submission-detail-tray');
    const animate = el.animate.bind(el);
    el.animate = (frames, options) => {
      const animation = animate(frames, options);
      if (frames.some(frame => frame.maxHeight === 'none')) animation.pause();
      return animation;
    };
  });
  for (const expanded of [true, false]) {
    await handle.click();
    const sample = await tray.evaluate(async el => {
      const animation = el.getAnimations().find(a => a.effect.getKeyframes().some(k => k.maxHeight === 'none'));
      animation.currentTime = animation.effect.getTiming().duration / 2;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const text = Number(getComputedStyle(document.querySelector('.detail-map-target')).opacity);
      const marker = window.__markerOpacity;
      const backdrop = getComputedStyle(document.querySelector('.workspace-backdrop-detail'));
      const spotlight = Number(backdrop.getPropertyValue('--spotlight-opacity'));
      const mask = backdrop.maskImage || backdrop.webkitMaskImage;
      const dimming = backdrop.backgroundColor;
      animation.finish();
      return { text, marker, spotlight, mask, dimming };
    });
    expect(sample.text).toBeGreaterThan(0);
    expect(sample.text).toBeLessThan(1);
    expect(sample.marker).toBeCloseTo(sample.text, 1);
    expect(sample.spotlight).toBeCloseTo(sample.text, 1);
    expect(sample.mask).toContain('radial-gradient');
    const centerAlpha = Number(sample.mask.match(/rgba\(0, 0, 0, ([\d.]+)\)/)?.[1]);
    expect(centerAlpha).toBeCloseTo(1 - sample.text, 1);
    expect(sample.dimming).not.toBe('rgba(0, 0, 0, 0)');
    await expect(target).toHaveCSS('opacity', expanded ? '0' : '1');
    await expect(page.locator('.workspace-backdrop-detail')).toHaveCSS('--spotlight-opacity', expanded ? '0' : '1');
  }
  await dispatchTouch(handle, 'touchstart', { touches: [{ clientX: 180, clientY: 500 }] });
  await dispatchTouch(handle, 'touchmove', { touches: [{ clientX: 180, clientY: 450 }] });
  const first = await target.evaluate(el => Number(getComputedStyle(el).opacity));
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(1);
  await dispatchTouch(handle, 'touchmove', { touches: [{ clientX: 180, clientY: 400 }] });
  expect(await target.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(first);
  await dispatchTouch(handle, 'touchmove', { touches: [{ clientX: 180, clientY: 450 }] });
  expect(await target.evaluate(el => Number(getComputedStyle(el).opacity))).toBeCloseTo(first, 1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await dispatchTouch(handle, 'touchcancel', { touches: [] });
  await expect(target).toHaveCSS('opacity', '1');
});
