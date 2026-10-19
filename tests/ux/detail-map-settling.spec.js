import { test, expect } from './fixture.js';

for (const motion of ['no-preference', 'reduce']) {
  test(`detail navigation lands once with ${motion} motion`, async ({ page }) => {
    // Allow the short tray to shrink below its viewport height cap.
    await page.setViewportSize({ width: 967, height: 1004 });
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto('/suggestion/2');
    const tray = page.locator('.submission-detail-tray');
    await expect(tray).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
    await page.evaluate(() => {
      const { Map, LatLng } = window.google.maps;
      // Supply the world projection absent from the lightweight map fixture.
      Map.prototype.getProjection = () => ({
        fromLatLngToPoint: position => ({ x: position.lng(), y: -position.lat() }),
        fromPointToLatLng: point => new LatLng(-point.y, point.x),
      });
      window.__settling = [];
      window.__navigationCenters = [];
      window.__trayHeightFrames = [];
      window.__overlappingMotion = false;
      window.__synchronizedFrames = [];
      let heightAnimation;
      const tray = document.querySelector('.submission-detail-tray');
      const animate = tray.animate.bind(tray);
      tray.animate = (...args) => {
        const animation = animate(...args);
        heightAnimation = animation;
        const sample = () => {
          window.__trayHeightFrames.push(tray.getBoundingClientRect().height);
          if (animation.playState === 'running') requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        return animation;
      };
      let navigationStarted = false;
      const setCenter = Map.prototype.setCenter;
      Map.prototype.setCenter = function (center) {
        const loading = document.querySelector('.submission-detail-tray')?.getAttribute('aria-busy') === 'true';
        if (loading) {
          if (!navigationStarted) window.__initialLatitude = this.getCenter().lat();
          navigationStarted = true;
          window.__navigationCenters.push(center);
          if (heightAnimation) window.__synchronizedFrames.push({
            latitude: typeof center.lat === 'function' ? center.lat() : center.lat,
            progress: heightAnimation.playState === 'finished' ? 1 : heightAnimation.effect.getComputedTiming().progress,
          });
          if (tray.getAnimations().some(animation => animation.playState === 'running')) {
            window.__overlappingMotion = true;
          }
        }
        // The initial pointer-down intentionally interrupts existing motion.
        if (navigationStarted && !loading) {
          window.__settling.push(this.__panning ? 'pan' : 'snap');
        }
        return setCenter.call(this, center);
      };
      Map.prototype.panTo = function (center) {
        this.__panning = true;
        this.setCenter(center);
        this.__panning = false;
      };
      window.__ux.details = 'A shorter incoming description.';
      window.__ux.summaries = { '20': 'Improve pedestrian safety and crossing convenience by adjusting signal timing or narrowing this wide intersection.' };
    });
    await page.getByRole('button', { name: 'Next idea', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(tray).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.detail-description')).not.toHaveClass(/detail-description-revealing/);
    // Include the debounced ResizeObserver correction after the reveal ends.
    await page.waitForTimeout(300);
    await expect(page.locator('.detail-marker-summary .sr-only')).toHaveText('Improve pedestrian safety and crossing convenience by adjusting signal timing or narrowing this wide intersection.');
    const settling = await page.evaluate(() => window.__settling);
    expect(await page.evaluate(() => window.__navigationCenters.length)).toBeGreaterThan(0);
    expect(settling).toEqual([]);
    const heights = await page.evaluate(() => window.__trayHeightFrames);
    if (motion === 'reduce') expect(heights).toEqual([]);
    else {
      const synchronization = await page.evaluate(() => ({ start: window.__initialLatitude, frames: window.__synchronizedFrames }));
      const end = synchronization.frames.at(-1).latitude;
      expect(synchronization.frames.at(-1).progress).toBe(1);
      for (const frame of synchronization.frames) {
        expect((frame.latitude - synchronization.start) / (end - synchronization.start)).toBeCloseTo(frame.progress ?? 0, 5);
      }
      expect(await page.evaluate(() => window.__overlappingMotion)).toBe(true);
      expect(heights.length).toBeGreaterThan(2);
      const min = Math.min(...heights), max = Math.max(...heights);
      expect(max - min).toBeGreaterThan(1);
      expect(heights.some(height => height > min + .1 && height < max - .1)).toBe(true);
    }
  });
}
