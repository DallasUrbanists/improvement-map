// OSM place labels supplement Google's basemap at close zoom levels.
const ENDPOINTS = import.meta.env?.DEV
  ? ['https://overpass-api.de/api/interpreter', '/__overpass-kumi']
  : ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const cache = new Map();

export function parseNeighborhoods(elements = []) {
  const labels = [];
  for (const element of elements) {
    const name = element.tags?.['name:en'] || element.tags?.name;
    const { lat, lon } = element.type === 'node' ? element : (element.center || {});
    if (!['neighbourhood', 'quarter', 'suburb'].includes(element.tags?.place)
      || typeof name !== 'string' || !name.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (labels.some(label => label.name.toLowerCase() === name.trim().toLowerCase()
      && Math.abs(label.lat - lat) < 0.01 && Math.abs(label.lng - lon) < 0.01)) continue;
    labels.push({ name: name.trim(), lat, lng: lon });
  }
  return labels.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchNeighborhoods(bounds, signal) {
  const key = [bounds.south, bounds.west, bounds.north, bounds.east].join(',');
  if (cache.has(key)) return cache.get(key);
  const query = `[out:json][timeout:10];nwr["place"~"^(neighbourhood|quarter|suburb)$"]["name"](${key});out center;`;
  let lastError;
  for (const endpoint of ENDPOINTS) {
    if (signal.aborted) throw signal.reason;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit',
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      });
      if (!response.ok) throw new Error(`Neighborhood labels: HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.remark || !Array.isArray(payload.elements)) throw new Error('Incomplete neighborhood response');
      const labels = parseNeighborhoods(payload.elements);
      cache.set(key, labels);
      if (cache.size > 12) cache.delete(cache.keys().next().value);
      return labels;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function createNeighborhoodLabelLayer(map, maps, onVisibilityChange) {
  const overlay = new maps.OverlayView();
  const root = document.createElement('div');
  root.className = 'neighborhood-label-layer';
  root.style.cssText = 'position:absolute;pointer-events:none;';
  const credit = document.createElement('a');
  credit.href = 'https://www.openstreetmap.org/copyright';
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.textContent = 'Neighborhoods © OpenStreetMap';
  credit.style.cssText = 'display:none;background:#24282bee;color:#d8c394;font:10px Roboto,sans-serif;padding:2px 5px;';
  const controls = map.controls[maps.ControlPosition.BOTTOM_LEFT];
  controls.push(credit);
  let enabled = false;
  let visible = false;
  let color = '#d8c394';
  let nodes = [];
  let coverage = null;
  let request = null;
  let pendingBounds = null;
  let timer = null;
  let disposed = false;
  let retryAfter = 0;

  const active = () => enabled && map.getZoom() >= 16 && map.getZoom() <= 19;
  const setVisible = value => {
    credit.style.display = value ? '' : 'none';
    if (value === visible) return;
    visible = value;
    onVisibilityChange();
  };

  overlay.onAdd = () => overlay.getPanes().overlayLayer.appendChild(root);
  overlay.onRemove = () => root.remove();
  overlay.draw = () => {
    root.style.display = active() ? '' : 'none';
    const projection = overlay.getProjection();
    if (!active() || !projection) return setVisible(false);
    const width = map.getDiv().clientWidth;
    const height = map.getDiv().clientHeight;
    const occupied = [];
    let count = 0;
    for (const { label, node } of nodes) {
      node.style.display = 'none';
      const position = new maps.LatLng(label.lat, label.lng);
      const point = projection.fromLatLngToContainerPixel(position);
      const divPoint = projection.fromLatLngToDivPixel(position);
      if (!point || !divPoint) continue;
      const halfWidth = Math.min(240, label.name.length * 8 + 16) / 2;
      const box = { left: point.x - halfWidth, right: point.x + halfWidth, top: point.y - 13, bottom: point.y + 13 };
      if (box.left < 8 || box.right > width - 8 || box.top < 8 || box.bottom > height - 8
        || occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      occupied.push(box);
      node.style.display = '';
      node.style.left = `${divPoint.x}px`;
      node.style.top = `${divPoint.y}px`;
      node.style.color = color;
      count++;
    }
    setVisible(count > 0);
  };

  const load = async () => {
    if (disposed || !active() || !map.getDiv().isConnected) return;
    const viewport = map.getBounds()?.toJSON();
    if (!viewport || viewport.west > viewport.east) return;
    if (coverage && viewport.south >= coverage.south && viewport.north <= coverage.north
      && viewport.west >= coverage.west && viewport.east <= coverage.east) return;
    if (request && pendingBounds && viewport.south >= pendingBounds.south && viewport.north <= pendingBounds.north
      && viewport.west >= pendingBounds.west && viewport.east <= pendingBounds.east) return;
    if (Date.now() < retryAfter) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    // Fetch a padded, snapped region so small pans/zooms reuse the same data.
    const bounds = {
      south: Math.max(-90, Math.floor(viewport.south * 25) / 25 - 0.04),
      west: Math.max(-180, Math.floor(viewport.west * 25) / 25 - 0.04),
      north: Math.min(90, Math.ceil(viewport.north * 25) / 25 + 0.04),
      east: Math.min(180, Math.ceil(viewport.east * 25) / 25 + 0.04),
    };
    pendingBounds = bounds;
    try {
      const labels = await fetchNeighborhoods(bounds, controller.signal);
      if (disposed || controller.signal.aborted || request !== controller) return;
      coverage = bounds;
      root.replaceChildren();
      nodes = labels.map(label => {
        const node = document.createElement('span');
        node.textContent = label.name;
        node.className = 'neighborhood-map-label';
        node.style.cssText = 'position:absolute;transform:translate(-50%,-50%);white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis;font:600 12px Roboto,sans-serif;letter-spacing:.04em;pointer-events:none;-webkit-text-stroke:3px #24282b;paint-order:stroke fill;';
        root.appendChild(node);
        return { label, node };
      });
      overlay.draw();
    } catch (error) {
      if (!controller.signal.aborted && !disposed) {
        retryAfter = Date.now() + 60000;
        console.warn('Neighborhood label data unavailable; retaining native map labels.', error.message);
      }
    } finally {
      if (request === controller) { request = null; pendingBounds = null; }
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    if (active()) timer = setTimeout(load, 500);
  };
  const idleListener = map.addListener('idle', schedule);
  overlay.setMap(map);

  return {
    get visible() { return visible; },
    update(options) {
      enabled = options.enabled;
      color = options.color;
      if (!active()) { request?.abort(); clearTimeout(timer); }
      overlay.draw();
      schedule();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      request?.abort();
      idleListener.remove();
      overlay.setMap(null);
      for (let i = controls.getLength() - 1; i >= 0; i--) {
        if (controls.getAt(i) === credit) controls.removeAt(i);
      }
    },
  };
}
