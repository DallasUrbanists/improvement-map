import fixture from '../../src/data/test-location-osm.json';
import { locations } from '../fixtures.js';

const svgNS = 'http://www.w3.org/2000/svg';
const point = (lat, lng) => ({ x: (lng + 180) / 360 * 256, y: (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 256 });
const unpoint = ({ x, y }) => new LatLng(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 256))) * 180 / Math.PI, x / 256 * 360 - 180);
const coords = value => value instanceof LatLng ? value : new LatLng(value);

class Events {
  listeners = new Map();
  addListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); return { remove: () => this.listeners.get(name)?.delete(fn) }; }
  fire(name, value) { for (const fn of this.listeners.get(name) || []) fn(value); }
}
class LatLng {
  constructor(lat, lng) {
    this.latitude = typeof lat === 'object' ? (typeof lat.lat === 'function' ? lat.lat() : lat.lat) : lat;
    this.longitude = typeof lat === 'object' ? (typeof lat.lng === 'function' ? lat.lng() : lat.lng) : lng;
  }
  lat() { return this.latitude; }
  lng() { return this.longitude; }
  toJSON() { return { lat: this.lat(), lng: this.lng() }; }
  equals(other) { return other && this.lat() === other.lat() && this.lng() === other.lng(); }
}
class LatLngBounds {
  constructor(sw, ne) { this.south = Infinity; this.west = Infinity; this.north = -Infinity; this.east = -Infinity; if (sw) this.extend(sw); if (ne) this.extend(ne); }
  extend(value) { const p = coords(value); this.south = Math.min(this.south, p.lat()); this.north = Math.max(this.north, p.lat()); this.west = Math.min(this.west, p.lng()); this.east = Math.max(this.east, p.lng()); return this; }
  getCenter() { return new LatLng((this.south + this.north) / 2, (this.west + this.east) / 2); }
  getNorthEast() { return new LatLng(this.north, this.east); }
  getSouthWest() { return new LatLng(this.south, this.west); }
  contains(value) { const p = coords(value); return p.lat() >= this.south && p.lat() <= this.north && p.lng() >= this.west && p.lng() <= this.east; }
  toJSON() { return { south: this.south, west: this.west, north: this.north, east: this.east }; }
}
class Collection {
  items = [];
  constructor(change = () => {}) { this.change = change; }
  push(value) { this.items.push(value); this.change(); return this.items.length; }
  getLength() { return this.items.length; }
  getAt(index) { return this.items[index]; }
  removeAt(index) { const [value] = this.items.splice(index, 1); this.change(); return value; }
  forEach(fn) { this.items.forEach(fn); }
}

class MockMap extends Events {
  markers = new Set(); overlays = new Set(); tiles = [];
  constructor(div, options = {}) {
    super(); this.div = div; this.options = { ...options }; this.center = coords(options.center); this.zoom = options.zoom || 13; this.type = options.mapTypeId || 'roadmap';
    div.dataset.localMap = 'ready';
    this.canvas = document.createElement('div'); this.canvas.className = 'gm-style'; this.canvas.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#d9e1de;touch-action:none'; div.append(this.canvas);
    this.base = document.createElementNS(svgNS, 'svg'); this.base.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; this.canvas.append(this.base);
    this.tilePane = document.createElement('div'); this.tilePane.style.cssText = 'position:absolute;inset:0;pointer-events:none'; this.canvas.append(this.tilePane);
    this.pane = document.createElement('div'); this.pane.style.cssText = 'position:absolute;inset:0;pointer-events:none'; this.canvas.append(this.pane);
    this.controls = {};
    for (const position of [3, 6]) {
      const holder = document.createElement('div'); holder.style.cssText = `position:absolute;z-index:10;${position === 3 ? 'top:8px;right:8px' : 'bottom:24px;left:8px'}`; this.canvas.append(holder);
      this.controls[position] = new Collection(() => holder.replaceChildren(...this.controls[position].items));
    }
    const credit = document.createElement('div'); credit.textContent = 'Offline preview · recorded Elm Street geometry © OpenStreetMap contributors'; credit.style.cssText = 'position:absolute;bottom:0;left:0;max-width:100%;padding:2px 5px;font:10px sans-serif;color:#fff;background:#17202ddd;pointer-events:none;z-index:10'; this.canvas.append(credit);
    this.overlayMapTypes = new Collection(() => this.draw());
    this.mapTypes = { get: () => ({ minZoom: 1, maxZoom: 22 }) };
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(div);
    this.drag = null;
    this.canvas.addEventListener('pointerdown', event => {
      if (event.target.closest('button') || this.options.gestureHandling === 'none') return;
      this.drag = { x: event.clientX, y: event.clientY, origin: point(this.center.lat(), this.center.lng()), moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 3) { this.drag.moved = true; this.fire('dragstart'); }
      if (this.drag.moved) { this.center = unpoint({ x: this.drag.origin.x - dx / 2 ** this.zoom, y: this.drag.origin.y - dy / 2 ** this.zoom }); this.draw(); this.fire('bounds_changed'); }
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.drag) return;
      const moved = this.drag.moved; this.drag = null;
      if (moved) this.fire('dragend');
      else { const rect = this.canvas.getBoundingClientRect(); this.fire('click', { latLng: this.unproject({ x: event.clientX - rect.left, y: event.clientY - rect.top }) }); }
      this.scheduleIdle();
    });
    this.canvas.addEventListener('wheel', event => { if (this.options.gestureHandling === 'none') return; event.preventDefault(); this.setZoom(this.zoom + (event.deltaY < 0 ? 1 : -1)); }, { passive: false });
    if (options.zoomControl) {
      for (const [label, delta] of [['Zoom in', 1], ['Zoom out', -1]]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = delta > 0 ? '+' : '−'; button.setAttribute('aria-label', label); if (div.closest('[aria-hidden="true"]')) button.tabIndex = -1; button.style.cssText = 'display:block;padding:4px 12px;background:white;color:#111;border:1px solid #777;font:24px sans-serif'; button.onclick = () => this.setZoom(this.zoom + delta); this.controls[3].push(button);
      }
    }
    this.draw(); this.scheduleIdle();
  }
  scheduleIdle() { clearTimeout(this.idle); this.idle = setTimeout(() => this.fire('idle'), 0); }
  project(value) { const p = coords(value), target = point(p.lat(), p.lng()), center = point(this.center.lat(), this.center.lng()), scale = 2 ** this.zoom; return { x: this.div.clientWidth / 2 + (target.x - center.x) * scale, y: this.div.clientHeight / 2 + (target.y - center.y) * scale }; }
  unproject(p) { const center = point(this.center.lat(), this.center.lng()); return unpoint({ x: center.x + (p.x - this.div.clientWidth / 2) / 2 ** this.zoom, y: center.y + (p.y - this.div.clientHeight / 2) / 2 ** this.zoom }); }
  draw() {
    if (!this.base) return;
    const dark = this.options.styles?.some(rule => rule.elementType === 'geometry' && rule.stylers?.some(style => style.color === '#4d6059'));
    this.canvas.style.background = this.type === 'roadmap' ? (dark ? '#354840' : '#e1e8df') : '#384535';
    this.base.setAttribute('viewBox', `0 0 ${this.div.clientWidth} ${this.div.clientHeight}`);
    this.base.replaceChildren();
    // The saved fixture is compacted: way type is implicit, geometry is retained.
    for (const way of fixture.elements.filter(item => item.geometry?.length && (item.tags?.highway || item.tags?.building))) {
      const points = way.geometry.map(p => this.project({ lat: p.lat, lng: p.lon }));
      const line = document.createElementNS(svgNS, way.tags.building ? 'polygon' : 'polyline');
      line.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' ')); line.setAttribute('fill', way.tags.building ? (dark ? '#49534c' : '#c6ccc2') : 'none'); line.setAttribute('stroke', dark ? '#a8b0a8' : '#8b938c'); line.setAttribute('stroke-width', way.tags.building ? '1' : '5'); this.base.append(line);
    }
    for (const marker of this.markers) marker.draw();
    for (const overlay of this.overlays) overlay.draw?.();
    for (const { type, tile } of this.tiles) type.releaseTile?.(tile);
    this.tiles = []; this.tilePane.replaceChildren();
    const zoom = Math.round(this.zoom), scale = 2 ** zoom, center = point(this.center.lat(), this.center.lng());
    const left = center.x * scale - this.div.clientWidth / 2, top = center.y * scale - this.div.clientHeight / 2;
    for (const type of this.overlayMapTypes?.items || []) {
      if (type instanceof StyledMapType) continue;
      for (let x = Math.floor(left / 256); x <= Math.floor((left + this.div.clientWidth) / 256); x++) {
        for (let y = Math.floor(top / 256); y <= Math.floor((top + this.div.clientHeight) / 256); y++) {
          const tile = type.getTile({ x, y }, zoom, document); if (!tile) continue;
          tile.style.position = 'absolute'; tile.style.left = `${x * 256 - left}px`; tile.style.top = `${y * 256 - top}px`; this.tilePane.append(tile); this.tiles.push({ type, tile });
        }
      }
    }
  }
  getDiv() { return this.div; } getCenter() { return this.center; } getZoom() { return this.zoom; } getMapTypeId() { return this.type; }
  get(name) { return this.options[name]; }
  setOptions(options) { Object.assign(this.options, options); this.draw(); }
  setCenter(value) { this.center = coords(value); this.draw(); this.fire('bounds_changed'); this.scheduleIdle(); }
  panTo(value) { this.setCenter(value); }
  panBy(x, y) { this.setCenter(this.unproject({ x: this.div.clientWidth / 2 + x, y: this.div.clientHeight / 2 + y })); }
  setZoom(value) { this.zoom = Math.max(1, Math.min(22, value)); this.draw(); this.fire('zoom_changed'); this.scheduleIdle(); }
  setMapTypeId(value) { this.type = value; this.draw(); this.fire('maptypeid_changed'); }
  getHeading() { return 0; } getTilt() { return 0; } setHeading() {} setTilt() {}
  getProjection() { return { fromLatLngToPoint: p => point(coords(p).lat(), coords(p).lng()), fromPointToLatLng: unpoint }; }
  getBounds() { return new LatLngBounds(this.unproject({ x: 0, y: this.div.clientHeight }), this.unproject({ x: this.div.clientWidth, y: 0 })); }
  fitBounds(bounds) { this.setCenter(bounds.getCenter()); this.setZoom(this.zoom + 2); }
  dispose() { this.observer.disconnect(); clearTimeout(this.idle); for (const { type, tile } of this.tiles) type.releaseTile?.(tile); this.canvas.remove(); }
}
class Marker extends Events {
  static MAX_ZINDEX = 100000;
  constructor(options = {}) { super(); this.options = { ...options }; this.node = document.createElement('button'); this.node.type = 'button'; this.node.style.cssText = 'position:absolute;pointer-events:auto;background:none;border:0;padding:0;transform:translate(-50%,-50%);cursor:pointer'; this.node.addEventListener('pointerdown', event => event.stopPropagation()); this.node.onclick = event => { event.stopPropagation(); this.fire('click'); }; if (options.map) this.setMap(options.map); }
  setMap(map) { this.map?.markers.delete(this); this.node.remove(); this.map = map; if (map) { this.node.tabIndex = map.div.closest('[aria-hidden="true"]') ? -1 : 0; map.markers.add(this); map.pane.append(this.node); this.draw(); } }
  getMap() { return this.map; } getPosition() { return coords(this.options.position); } getVisible() { return this.options.visible !== false; }
  setPosition(value) { this.options.position = value; this.draw(); } setIcon(value) { this.options.icon = value; this.draw(); } setTitle(value) { this.options.title = value; this.draw(); }
  setVisible(value) { this.options.visible = value; this.draw(); } setZIndex(value) { this.options.zIndex = value; this.draw(); } setOpacity(value) { this.node.style.opacity = value; }
  getIcon() { return this.options.icon; }
  draw() {
    if (!this.map) return;
    const p = this.map.project(this.getPosition()), icon = this.options.icon;
    this.node.style.left = `${p.x}px`; this.node.style.top = `${p.y}px`; this.node.style.zIndex = String(this.options.zIndex || 1); this.node.style.display = this.getVisible() ? '' : 'none'; this.node.setAttribute('aria-label', this.options.title || 'Map marker'); this.node.title = this.options.title || '';
    if (icon?.url) { const img = document.createElement('img'); img.src = icon.url; img.alt = ''; img.width = icon.scaledSize?.width || 48; img.height = icon.scaledSize?.height || 48; this.node.replaceChildren(img); }
    else { this.node.textContent = '●'; this.node.style.color = icon?.fillColor || '#488be3'; this.node.style.fontSize = '24px'; }
  }
}
class OverlayView extends Events {
  static preventMapHitsAndGesturesFrom(element) { element.style.pointerEvents = 'auto'; }
  setMap(map) { if (this.map) { this.map.overlays.delete(this); this.onRemove?.(); } this.map = map; if (map) { map.overlays.add(this); this.onAdd?.(); this.draw?.(); } }
  getMap() { return this.map; }
  getPanes() { return { overlayLayer: this.map.pane, overlayMouseTarget: this.map.pane, floatPane: this.map.pane, markerLayer: this.map.pane }; }
  getProjection() { return { fromLatLngToDivPixel: p => this.map.project(p), fromLatLngToContainerPixel: p => this.map.project(p), fromDivPixelToLatLng: p => this.map.unproject(p), fromContainerPixelToLatLng: p => this.map.unproject(p) }; }
}
class StyledMapType { constructor(styles) { this.styles = styles; } }
class Geocoder {
  geocode(request, callback) {
    const location = request.location ? { ...coords(request.location).toJSON(), address: 'Selected location, Dallas, TX' } : locations.find(item => item.id === request.placeId || item.address.toLowerCase().includes(String(request.address).toLowerCase()));
    const results = location ? [{ formatted_address: location.address, geometry: { location: new LatLng(location.lat, location.lng) }, place_id: location.id || 'local-selected' }] : [];
    callback?.(results, results.length ? 'OK' : 'ZERO_RESULTS'); return Promise.resolve({ results });
  }
}
class InfoWindow extends Events {
  setContent(content) { this.content = content; }
  open({ map }) { this.close(); this.node = document.createElement('div'); this.node.style.cssText = 'position:absolute;top:40%;left:30%;z-index:20;background:white;padding:12px;pointer-events:auto'; if (typeof this.content === 'string') this.node.textContent = this.content; else if (this.content) this.node.append(this.content); map.canvas.append(this.node); }
  close() { this.node?.remove(); }
}

export function setOptions() {}
export async function importLibrary(name) {
  if (!window.google?.maps?.Map) window.google = { maps: {
    Map: MockMap, Marker, OverlayView, LatLng, LatLngBounds, Geocoder, InfoWindow, StyledMapType,
    MapTypeId: { ROADMAP: 'roadmap', HYBRID: 'hybrid', SATELLITE: 'satellite' },
    ControlPosition: { TOP_RIGHT: 3, RIGHT_TOP: 3, BOTTOM_LEFT: 6 },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } }, Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    GeocoderStatus: { OK: 'OK' }, SymbolPath: { CIRCLE: 0 }, Animation: {},
    places: { PlacesServiceStatus: { OK: 'OK' }, AutocompleteService: class {
      getPlacePredictions({ input }, callback) { callback(locations.filter(item => item.address.toLowerCase().includes(input.toLowerCase())).map(item => ({ place_id: item.id, description: item.address })), 'OK'); }
    } },
    event: { trigger: (object, event, ...args) => object.fire?.(event, ...args), clearInstanceListeners: object => { object.listeners?.clear?.(); }, addListener: (object, event, callback) => object.addListener(event, callback), removeListener: listener => listener?.remove(), addListenerOnce: (object, event, callback) => { const listener = object.addListener(event, (...args) => { listener.remove(); callback(...args); }); return listener; } },
  } };
  return window.google.maps[name] || window.google.maps;
}
