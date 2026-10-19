import { test, expect } from './fixture.js';

for (const motion of ['no-preference', 'reduce']) {
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
