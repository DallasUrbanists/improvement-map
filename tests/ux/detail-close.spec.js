import { test, expect } from './fixture.js';

for (const motion of ['no-preference', 'reduce']) {
  test(`closing details to map retains the camera with ${motion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/?view=map');
    await expect(page.locator('.map-zoom-ui')).toBeVisible();
    await page.evaluate(async () => {
      const { default: router } = await import('/src/router/index.js');
      await router.push('/suggestion/1');
    });
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
    const before = await page.evaluate(async () => {
      const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
      const map = sharedBrowseMap.value.map;
      window.__closeCamera = [];
      document.addEventListener('keydown', () => {
        for (const method of ['setCenter', 'panTo', 'setZoom']) {
          const original = map[method].bind(map);
          map[method] = (...args) => { window.__closeCamera.push(method); return original(...args); };
        }
      }, { once: true, capture: true });
      return { ...map.getCenter().toJSON(), zoom: map.getZoom() };
    });
    await page.getByRole('button', { name: 'Close Idea details', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/?\?view=map$/);
    await expect(tray).toHaveCount(0);
    const after = await page.evaluate(async () => {
      const { sharedBrowseMap } = await import('/src/services/sharedBrowseMap.js');
      const map = sharedBrowseMap.value.map;
      return { camera: { ...map.getCenter().toJSON(), zoom: map.getZoom() }, calls: window.__closeCamera, saved: window.history.state.ideaView.viewport };
    });
    expect(after.camera).toEqual(before);
    expect(after.calls).toEqual([]);
    expect(after.saved).toMatchObject(before);
  });

  test(`closing details restores the camera after exit with ${motion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/?view=map');
    await page.getByRole('button', { name: 'Browse', exact: true }).click();
    const card = page.locator('[data-suggestion-id="1"]');
    await card.click();
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
    await page.evaluate(() => {
      window.__closeCamera = [];
      window.__closeOpacity = [];
      window.__recordClose = false;
      // Observe the close action, excluding initial ResizeObserver settling
      // that can run while Playwright is moving focus to the close control.
      document.addEventListener('keydown', event => {
        if (event.key === 'Enter') window.__recordClose = true;
      }, { once: true, capture: true });
      const prototype = window.google.maps.Map.prototype;
      for (const method of ['setCenter', 'panTo']) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          if (window.__recordClose) window.__closeCamera.push({ method, detail: !!document.querySelector('.detail-map-target') });
          return original.apply(this, args);
        };
      }
      const tray = document.querySelector('.submission-detail-tray');
      const sample = () => {
        if (!tray.isConnected) return;
        window.__closeOpacity.push(Number(getComputedStyle(tray).opacity));
        requestAnimationFrame(sample);
      };
      sample();
    });
    // Keyboard activation avoids the separate pointer-down camera interruption.
    await page.getByRole('button', { name: 'Close Idea details', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(tray).toHaveCount(0);
    await expect(card).toBeFocused();
    const evidence = await page.evaluate(() => ({ camera: window.__closeCamera, opacity: window.__closeOpacity }));
    expect(evidence.camera.length).toBeGreaterThan(0);
    expect(evidence.camera.every(event => !event.detail)).toBe(true);
    expect(evidence.camera.filter(event => event.method === 'panTo')).toHaveLength(motion === 'reduce' ? 0 : 1);
    if (motion === 'no-preference') expect(evidence.opacity.some(value => value > 0 && value < 1)).toBe(true);
  });
}
