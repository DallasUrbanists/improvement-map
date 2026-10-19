import { test, expect } from '@playwright/test';

test('density follows the viewport after panning and accumulates nearby suggestions', async ({ page }) => {
  await page.route('**/density-overlay-test', route => route.fulfill({ contentType: 'text/html', body: '<div id="map" style="width:400px;height:300px;position:relative"></div>' }));
  await page.goto('/density-overlay-test');
  const result = await page.evaluate(async () => {
    const { createSuggestionDensityOverlay } = await import('/src/services/suggestionDensityOverlay.js');
    const holder = document.getElementById('map');
    let origin = { x: 500, y: -240 };
    class OverlayView {
      setMap(map) {
        if (this.map === map) return;
        if (this.map) this.onRemove();
        this.map = map;
        if (map) { this.onAdd(); this.draw(); }
      }
      getPanes() { return { overlayLayer: holder }; }
      getProjection() {
        return { fromContainerPixelToLatLng: () => origin, fromLatLngToDivPixel: point => point };
      }
    }
    const map = { getDiv: () => holder };
    const overlay = createSuggestionDensityOverlay(map, { OverlayView, Point: class {} });
    const position = { x: 600, y: -90 };
    overlay.setData([position]);
    overlay.setMap(map);
    const sample = (x, y) => {
      const canvas = holder.querySelector('canvas');
      return [...canvas.getContext('2d').getImageData(Math.floor(x / 2), Math.floor(y / 2), 1, 1).data];
    };
    const first = { left: holder.firstChild.style.left, top: holder.firstChild.style.top, pixel: sample(100, 150), empty: sample(0, 0) };
    overlay.setData(Array.from({ length: 8 }, () => position));
    const dense = sample(100, 150);
    const defaultOpacity = holder.firstChild.style.opacity;
    overlay.setOpacity(0.2);
    const adjusted = { opacity: holder.firstChild.style.opacity, pixel: sample(100, 150) };
    origin = { x: 450, y: -220 };
    overlay.draw();
    const panned = { left: holder.firstChild.style.left, top: holder.firstChild.style.top, pixel: sample(150, 130), empty: sample(0, 0) };
    const originalEdge = sample(190, 130);
    overlay.setRadius(24);
    const smallerEdge = sample(190, 130);
    overlay.setMap(null);
    const removed = holder.childElementCount === 0;
    overlay.setMap(map);
    return { first, dense, defaultOpacity, adjusted, panned, originalEdge, smallerEdge, removed, restored: sample(150, 130), restoredEdge: sample(190, 130), restoredOpacity: holder.firstChild.style.opacity };
  });
  expect(result.first.left).toBe('500px');
  expect(result.first.top).toBe('-240px');
  expect(result.first.pixel[3]).toBeGreaterThan(0);
  expect(result.first.empty[3]).toBe(0);
  expect(result.dense[0]).toBeGreaterThan(result.first.pixel[0]);
  expect(result.dense[3]).toBeGreaterThan(result.first.pixel[3]);
  expect(result.defaultOpacity).toBe('0.4');
  expect(result.adjusted.opacity).toBe('0.2');
  expect(result.adjusted.pixel).toEqual(result.dense);
  expect(result.restoredOpacity).toBe('0.2');
  expect(result.panned.left).toBe('450px');
  expect(result.panned.top).toBe('-220px');
  expect(result.panned.pixel[3]).toBeGreaterThan(0);
  expect(result.panned.empty[3]).toBe(0);
  expect(result.originalEdge[3]).toBeGreaterThan(0);
  expect(result.smallerEdge[3]).toBe(0);
  expect(result.restoredEdge[3]).toBe(0);
  expect(result.removed).toBe(true);
  expect(result.restored[3]).toBeGreaterThan(0);
});
