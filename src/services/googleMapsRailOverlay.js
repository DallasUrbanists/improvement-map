import { watch } from 'vue';
import { railThickness, railVisible, DEFAULT_RAIL_THICKNESS } from './railSettings.js';
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

/** Rail tiles followed by Google label tiles: both use Maps' managed tile lifecycle. */
export function createGoogleMapsRailOverlay(map, maps, catalog) {
  const tiles = new Map();
  let labelsMapType = null;
  let labelSignature = '';
  let disposed = false;
  let visible = railVisible.value;
  const projectWorld = (lat, lng, size) => {
    const sin = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180);
    return { x: (lng + 180) / 360 * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
  };
  const paintTile = (svg, coord, zoom) => {
    const size = 256 * 2 ** zoom;
    const anchor = projectWorld(ANCHOR.lat, ANCHOR.lng, size);
    const project = point => {
      const pixel = projectWorld(point.lat, point.lon, size);
      return { x: pixel.x - anchor.x, y: pixel.y - anchor.y };
    };
    svg.setAttribute('viewBox', `${coord.x * 256 - anchor.x} ${coord.y * 256 - anchor.y} 256 256`);
    svg.innerHTML = geometryAtZoom(catalog, size, project, railThickness.value);
  };
  const railMapType = {
    tileSize: new maps.Size(256, 256), minZoom: 0, maxZoom: 24,
    getTile(coord, zoom, ownerDocument) {
      const svg = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.dataset.mapRailOverlay = '';
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '256'); svg.setAttribute('height', '256');
      svg.style.cssText = 'pointer-events:none;overflow:hidden;';
      const normalized = { x: (coord.x % 2 ** zoom + 2 ** zoom) % 2 ** zoom, y: coord.y };
      paintTile(svg, normalized, zoom);
      tiles.set(svg, { coord: normalized, zoom });
      return svg;
    },
    releaseTile(tile) { tiles.delete(tile); },
  };
  const removeMapType = type => {
    for (let i = map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
      if (map.overlayMapTypes.getAt(i) === type) map.overlayMapTypes.removeAt(i);
    }
  };
  if (visible) map.overlayMapTypes.push(railMapType);
  const stopThicknessWatch = watch(railThickness, () => {
    for (const [tile, { coord, zoom }] of tiles) paintTile(tile, coord, zoom);
  }, { flush: 'sync' });
  const lockCamera = () => {
    if (map.getHeading()) map.setHeading(0);
    if (map.getTilt()) map.setTilt(0);
  };
  map.setOptions({ heading: 0, tilt: 0, rotateControl: false,
    headingInteractionEnabled: false, tiltInteractionEnabled: false });
  const listeners = ['heading_changed', 'tilt_changed'].map(event => map.addListener(event, lockCamera));
  return {
    setVisible(nextVisible) {
      if (disposed || visible === Boolean(nextVisible)) return;
      visible = Boolean(nextVisible);
      if (visible) map.overlayMapTypes.push(railMapType);
      else {
        removeMapType(railMapType);
        if (labelsMapType) removeMapType(labelsMapType);
        labelsMapType = null;
        labelSignature = '';
      }
    },
    update({ styles, mapType }) {
      if (disposed || !visible) return;
      // Let Maps initialize and manage StyledMapType tiles. Calling getTile
      // directly on an unregistered StyledMapType returns no label tiles.
      // Preserve street, city, and neighborhood styling above every rail service.
      const labelStyles = [
        { featureType: 'all', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
        ...styles.filter(rule => rule.elementType?.startsWith('labels') || rule.elementType === 'all')
          .map(rule => rule.elementType === 'all' ? { ...rule, elementType: 'labels' } : rule),
      ];
      if (mapType === 'hybrid') labelStyles.push(
        { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
        { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#24282b' }] },
      );
      const signature = JSON.stringify([mapType, labelStyles]);
      if (signature === labelSignature) return;
      if (labelsMapType) removeMapType(labelsMapType);
      labelsMapType = mapType === 'satellite' ? null : new maps.StyledMapType(labelStyles, { name: 'Labels above rail' });
      labelSignature = signature;
      if (labelsMapType) map.overlayMapTypes.push(labelsMapType);
    },
    dispose() {
      disposed = true;
      stopThicknessWatch();
      if (labelsMapType) removeMapType(labelsMapType);
      removeMapType(railMapType);
      tiles.clear();
      listeners.forEach((listener) => listener.remove());

    },
  };
}
