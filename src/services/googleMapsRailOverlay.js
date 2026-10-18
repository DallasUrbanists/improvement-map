import { renderSourceTransit } from './sourceRailRendering.js';

const ANCHOR = { lat: 32.7767, lng: -96.797 };
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
const cache = new WeakMap();

function geometryAtZoom(catalog, worldWidth, project) {
  let zooms = cache.get(catalog);
  if (!zooms) { zooms = new Map(); cache.set(catalog, zooms); }
  if (zooms.has(worldWidth)) return zooms.get(worldWidth);
  const scale = worldWidth / (EARTH_CIRCUMFERENCE * Math.cos(ANCHOR.lat * Math.PI / 180));
  // Build the complete network so panning cannot change chain endpoints, lane
  // order, or junctions. The SVG viewport clips it without changing topology.
  const transit = renderSourceTransit(catalog, { lat: ANCHOR.lat, lon: ANCHOR.lng }, 0,
    project, (point) => point, scale, { sourceSegments: catalog.segments, clip: false });
  const casing = transit.paths.map((path) => path.replace('data-transit-line=', 'data-rail-casing=')
    .replace(/stroke="[^"]+"/, 'stroke="#fff"')).join('');
  const markup = `<g data-layer="rail-casing" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">${casing}</g>`
    + `<g data-layer="rail-lines" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${transit.paths.join('')}</g>`;
  zooms.set(worldWidth, markup);
  // Fractional zooms must not leave an unbounded cache behind.
  if (zooms.size > 4) zooms.delete(zooms.keys().next().value);
  return markup;
}

/** Geographic SVG overlay for flat, north-up Google Maps; never intercepts gestures. */
export function createGoogleMapsRailOverlay(map, maps, catalog) {
  const overlay = new maps.OverlayView();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.dataset.mapRailOverlay = '';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;';
  const anchor = new maps.LatLng(ANCHOR.lat, ANCHOR.lng);
  let worldWidth = null;
  let disposed = false;

  overlay.onAdd = () => overlay.getPanes().overlayLayer.appendChild(svg);
  overlay.onRemove = () => svg.remove();
  const draw = () => {
    if (disposed) return;
    const projection = overlay.getProjection();
    const width = map.getDiv().clientWidth; const height = map.getDiv().clientHeight;
    if (!projection || !width || !height || !Number.isFinite(map.getZoom())) return;
    const div = projection.fromLatLngToDivPixel(anchor);
    const container = projection.fromLatLngToContainerPixel(anchor);
    if (!div || !container) return;
    const nextWorldWidth = projection.getWorldWidth();
    if (!Number.isFinite(nextWorldWidth) || nextWorldWidth <= 0) return;
    if (worldWidth !== nextWorldWidth) {
      // Use Google's own projection, not the diagram's local-meter approximation.
      const project = (point) => {
        const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lon));
        return { x: pixel.x - div.x, y: pixel.y - div.y };
      };
      svg.innerHTML = geometryAtZoom(catalog, nextWorldWidth, project);
      worldWidth = nextWorldWidth;
    }
    svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `${-container.x} ${-container.y} ${width} ${height}`);
    svg.style.left = `${div.x - container.x}px`;
    svg.style.top = `${div.y - container.y}px`;
  };
  // Maps can rebase its overlay pane when a drag finishes. Update in the same
  // draw callback: deferring to requestAnimationFrame leaves the old SVG origin
  // under the new pane transform for one painted frame, causing a visible jump.
  overlay.draw = draw;
  const lockCamera = () => {
    if (map.getHeading()) map.setHeading(0);
    if (map.getTilt()) map.setTilt(0);
  };
  map.setOptions({ heading: 0, tilt: 0, rotateControl: false,
    headingInteractionEnabled: false, tiltInteractionEnabled: false });
  const listeners = ['heading_changed', 'tilt_changed'].map((event) => map.addListener(event, lockCamera));
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => overlay.draw());
  resizeObserver?.observe(map.getDiv());
  overlay.setMap(map);
  return {
    dispose() {
      disposed = true;
      resizeObserver?.disconnect();
      listeners.forEach((listener) => listener.remove());
      overlay.setMap(null);
    },
  };
}
