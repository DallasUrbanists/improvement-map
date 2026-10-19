// A deterministic Maps SDK surface for workspace navigation tests. Styling,
// search, zoom controls, and overlay lifecycle still use the production service.
export function installWorkspaceMaps() {
  window.GOOGLE_MAPS_API_KEY = 'workspace-test';
  window.__mapConstructions = 0;
  class Events {
    constructor() { this.listeners = {}; }
    addListener(name, fn) {
      (this.listeners[name] ||= new Set()).add(fn);
      return { remove: () => this.listeners[name].delete(fn) };
    }
    fire(name, value) { for (const fn of this.listeners[name] || []) fn(value); }
  }
  class LatLng {
    constructor(lat, lng) { this.latitude = typeof lat === 'object' ? lat.lat : lat; this.longitude = typeof lat === 'object' ? lat.lng : lng; }
    lat() { return this.latitude; }
    lng() { return this.longitude; }
    toJSON() { return { lat: this.lat(), lng: this.lng() }; }
  }
  class Map extends Events {
    constructor(div, options) {
      super(); window.__mapConstructions++; this.div = div; this.options = { ...options };
      this.center = new LatLng(options.center); this.zoom = options.zoom; this.type = options.mapTypeId;
      div.classList.add('fake-map');
      const canvas = document.createElement('div'); canvas.className = 'gm-style'; canvas.style.cssText = 'position:absolute;inset:0'; div.append(canvas);
      // Model rendered tiles separately from the SDK's loading surface. Production
      // theme rules may change that surface, but must not recolor our fixed basemap.
      const tiles = document.createElement('div');
      tiles.className = 'fake-map-tiles';
      tiles.setAttribute('aria-hidden', 'true');
      tiles.style.cssText = 'position:absolute;inset:0;background:#4d6059;pointer-events:none';
      canvas.append(tiles);
      this.pane = document.createElement('div'); canvas.append(this.pane);
      this.controls = {};
      for (const position of [3, 6]) {
        const values = [];
        const holder = document.createElement('div');
        holder.style.cssText = position === 3 ? 'position:absolute;top:0;right:0' : 'position:absolute;bottom:0;left:0';
        canvas.append(holder);
        this.controls[position] = {
          push: element => { values.push(element); holder.append(element); },
          getLength: () => values.length, getAt: index => values[index],
          removeAt: index => { values.splice(index, 1)[0]?.remove(); },
        };
      }
      this.mapTypes = { get: () => ({ minZoom: 0, maxZoom: 22 }) };
      setTimeout(() => this.fire('idle'), 0);
    }
    getDiv() { return this.div; }
    getCenter() { return this.center; }
    getZoom() { return this.zoom; }
    getMapTypeId() { return this.type; }
    get(name) { return this.options[name]; }
    setOptions(options) { Object.assign(this.options, options); }
    setCenter(center) { this.center = center instanceof LatLng ? center : new LatLng(center); setTimeout(() => this.fire('idle'), 0); }
    panTo(center) { this.setCenter(center); }
    setZoom(zoom) { this.zoom = zoom; this.fire('zoom_changed'); setTimeout(() => this.fire('idle'), 0); }
    setMapTypeId(type) { this.type = type; this.fire('maptypeid_changed'); }
    getBounds() {
      const { lat, lng } = this.center.toJSON();
      return { toJSON: () => ({ south: lat - .01, north: lat + .01, west: lng - .01, east: lng + .01 }) };
    }
  }
  class Marker extends Events {
    constructor(options) { super(); this.options = options; }
    setMap(map) { this.map = map; }
    getPosition() { return new LatLng(this.options.position); }
    getVisible() { return true; }
    setIcon(icon) { this.options.icon = icon; }
    setTitle(title) { this.options.title = title; }
    setVisible(visible) { this.options.visible = visible; }
    setZIndex(zIndex) { this.options.zIndex = zIndex; }
    setPosition(position) { this.options.position = position; }
  }
  class OverlayView {
    static preventMapHitsAndGesturesFrom() {}
    setMap(map) { this.map = map; if (map) { this.onAdd?.(); this.draw?.(); } else this.onRemove?.(); }
    getPanes() { return { overlayLayer: this.map.pane, overlayMouseTarget: this.map.pane }; }
    getProjection() {
      const project = position => ({ x: this.map.div.clientWidth / 2 + (position.lng() - this.map.center.lng()) * 10000, y: this.map.div.clientHeight / 2 - (position.lat() - this.map.center.lat()) * 10000 });
      const unproject = point => new LatLng(this.map.center.lat() - (point.y - this.map.div.clientHeight / 2) / 10000, this.map.center.lng() + (point.x - this.map.div.clientWidth / 2) / 10000);
      return { fromLatLngToDivPixel: project, fromLatLngToContainerPixel: project, fromContainerPixelToLatLng: unproject, fromDivPixelToLatLng: unproject };
    }
  }
  class InfoWindow extends Events {
    setContent(content) { this.content = content; }
    open({ map }) { map.div.append(this.content); }
    close() { this.content?.remove(); }
  }
  class Geocoder {
    geocode(request, callback) {
      window.__geocodeCalls = (window.__geocodeCalls || 0) + 1;
      callback([{ formatted_address: 'Selected address, Dallas, TX', geometry: { location: new LatLng(request.location || { lat: 32.81, lng: -96.76 }) }, place_id: 'test-address' }], 'OK');
    }
  }
  window.google = { maps: {
    Map, Marker, OverlayView, InfoWindow, Geocoder, LatLng,
    GeocoderStatus: { OK: 'OK' }, MapTypeId: { ROADMAP: 'roadmap', HYBRID: 'hybrid' },
    ControlPosition: { RIGHT_TOP: 3, TOP_RIGHT: 3, BOTTOM_LEFT: 6 },
    Point: class { constructor(x, y) { this.x = x; this.y = y; } },
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    SymbolPath: { CIRCLE: 0 }, Animation: {},
    places: { PlacesServiceStatus: { OK: 'OK' }, AutocompleteService: class {
      getPlacePredictions(_, callback) { callback([{ place_id: 'test-address', description: 'Searched address, Dallas, TX' }], 'OK'); }
    } },
    event: { trigger: (object, name) => object.fire?.(name), clearInstanceListeners: object => { object.listeners = {}; } },
  } };
}

export const clustererModule = `
export class SuperClusterAlgorithm {}
export class MarkerClusterer {
 constructor({map,markers}){this.map=map;this.markers=markers;}
 setMap(map){this.map=map;}
 clearMarkers(){this.markers=[];}
 render(){}
 addMarker(marker){this.markers.push(marker);}
 removeMarker(marker){this.markers=this.markers.filter(item=>item!==marker);}
}
`;
