import { watch } from 'vue';
import { railThickness, DEFAULT_RAIL_THICKNESS } from './railSettings.js';
import { railSvgLayers } from './railSvgLayers.js';
import { renderSourceTransit } from './sourceRailRendering.js';

const ANCHOR = { lat: 32.7767, lng: -96.797 };
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
const cache = new WeakMap();

function geometryAtZoom(catalog, worldWidth, project, thickness) {
  const factor = thickness / DEFAULT_RAIL_THICKNESS;
  const cacheKey = `${worldWidth}:${thickness}`;
  let zooms = cache.get(catalog);
  if (!zooms) { zooms = new Map(); cache.set(catalog, zooms); }
  if (zooms.has(cacheKey)) return zooms.get(cacheKey);
  const scale = worldWidth / (EARTH_CIRCUMFERENCE * Math.cos(ANCHOR.lat * Math.PI / 180)) / factor;
  const scaledProject = (point) => { const pixel = project(point); return { x: pixel.x / factor, y: pixel.y / factor }; };
  // Build the complete network so panning cannot change chain endpoints, lane
  // order, or junctions. The SVG viewport clips it without changing topology.
  const transit = renderSourceTransit(catalog, { lat: ANCHOR.lat, lon: ANCHOR.lng }, 0,
    scaledProject, (point) => point, scale, { sourceSegments: catalog.segments, clip: false, displayPixelRatio: factor });
  const markup = `<g transform="scale(${factor})">${railSvgLayers(transit)}</g>`;
  zooms.set(cacheKey, markup);
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
  const labels = document.createElement('div');
  labels.dataset.mapRailLabels = '';
  labels.setAttribute('aria-hidden', 'true');
  labels.style.cssText = 'position:absolute;pointer-events:none;';
  const labelTiles = new Map();
  let labelsMapType = null;
  let labelSignature = '';
  const anchor = new maps.LatLng(ANCHOR.lat, ANCHOR.lng);
  let worldWidth = null;
  let paintedThickness = null;
  let disposed = false;

  const clearLabelTiles = () => {
    for (const { tile } of labelTiles.values()) labelsMapType?.releaseTile(tile);
    labelTiles.clear();
    labels.replaceChildren();
  };
  overlay.onAdd = () => {
    const pane = overlay.getPanes().overlayLayer;
    // Keep both below other overlays, including the map's popup shade.
    pane.insertBefore(svg, pane.firstChild);
    pane.insertBefore(labels, svg.nextSibling);
  };
  overlay.onRemove = () => { clearLabelTiles(); svg.remove(); labels.remove(); };
  const drawLabels = (width, height, worldWidth, origin) => {
    if (!labelsMapType) return;
    const tileSize = labelsMapType.tileSize?.width || 256;
    const zoom = Math.max(0, Math.round(Math.log2(worldWidth / 256)));
    const scale = worldWidth / (256 * 2 ** zoom);
    const tileWidth = tileSize * scale;
    const center = map.getProjection()?.fromLatLngToPoint(map.getCenter());
    if (!center) return;
    const left = center.x * worldWidth / 256 - width / 2;
    const top = center.y * worldWidth / 256 - height / 2;
    const count = 2 ** zoom;
    const visible = new Set();
    labels.style.left = `${origin.x}px`;
    labels.style.top = `${origin.y}px`;
    for (let y = Math.max(0, Math.floor(top / tileWidth)); y <= Math.min(count - 1, Math.floor((top + height) / tileWidth)); y++) {
      for (let x = Math.floor(left / tileWidth); x <= Math.floor((left + width) / tileWidth); x++) {
        const key = `${zoom}/${x}/${y}`;
        visible.add(key);
        let entry = labelTiles.get(key);
        if (!entry) {
          const tile = labelsMapType.getTile(new maps.Point((x % count + count) % count, y), zoom, document);
          if (!tile) continue;
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:absolute;pointer-events:none;transform-origin:0 0;';
          wrapper.appendChild(tile);
          labels.appendChild(wrapper);
          entry = { tile, wrapper };
          labelTiles.set(key, entry);
        }
        entry.wrapper.style.left = `${x * tileWidth - left}px`;
        entry.wrapper.style.top = `${y * tileWidth - top}px`;
        entry.wrapper.style.transform = `scale(${scale})`;
      }
    }
    for (const [key, entry] of labelTiles) {
      if (visible.has(key)) continue;
      labelsMapType.releaseTile(entry.tile);
      entry.wrapper.remove();
      labelTiles.delete(key);
    }
  };
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
    if (worldWidth !== nextWorldWidth || paintedThickness !== railThickness.value) {
      // Use Google's own projection, not the diagram's local-meter approximation.
      const project = (point) => {
        const pixel = projection.fromLatLngToDivPixel(new maps.LatLng(point.lat, point.lon));
        return { x: pixel.x - div.x, y: pixel.y - div.y };
      };
      svg.innerHTML = geometryAtZoom(catalog, nextWorldWidth, project, railThickness.value);
      worldWidth = nextWorldWidth;
      paintedThickness = railThickness.value;
    }
    svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `${-container.x} ${-container.y} ${width} ${height}`);
    svg.style.left = `${div.x - container.x}px`;
    svg.style.top = `${div.y - container.y}px`;
    drawLabels(width, height, nextWorldWidth, { x: div.x - container.x, y: div.y - container.y });
  };
  // Maps can rebase its overlay pane when a drag finishes. Update in the same
  // draw callback: deferring to requestAnimationFrame leaves the old SVG origin
  // under the new pane transform for one painted frame, causing a visible jump.
  overlay.draw = draw;
  const stopThicknessWatch = watch(railThickness, draw, { flush: 'sync' });
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
    update({ styles, mapType }) {
      if (disposed) return;
      // Google renders the base labels into its map tiles. Repaint only those
      // labels above our SVG; geometry stays transparent and the native labels
      // remain underneath while these tiles load.
      const labelStyles = [
        { featureType: 'all', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
        { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
        ...styles.filter(rule => (
          rule.featureType === 'all' && ['labels.text.fill', 'labels.text.stroke'].includes(rule.elementType)
        ) || (
          (rule.featureType === 'road' || rule.featureType?.startsWith('road.')) && rule.elementType?.startsWith('labels.text')
        )),
      ];
      if (mapType === 'hybrid') labelStyles.push(
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#24282b' }] },
      );
      const signature = JSON.stringify([mapType, labelStyles]);
      if (signature === labelSignature) return;
      clearLabelTiles();
      labelsMapType = mapType === 'satellite' ? null : new maps.StyledMapType(labelStyles, { name: 'Labels above rail' });
      labelSignature = signature;
      draw();
    },
    dispose() {
      disposed = true;
      stopThicknessWatch();
      resizeObserver?.disconnect();
      listeners.forEach((listener) => listener.remove());
      overlay.setMap(null);
    },
  };
}
