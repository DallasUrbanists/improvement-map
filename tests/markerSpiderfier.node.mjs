import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterAppearance, spiderOffsets, shouldSpiderfy, createMarkerSpiderfier } from '../src/services/markerSpiderfier.js';

test('cluster size increases and gold darkens with volume, with contrasting count text', () => {
  const brightness = color => color.slice(1).match(/../g).reduce((total, hex) => total + parseInt(hex, 16), 0);
  const sizes = [2, 4, 8, 16, 64, 256, 512].map(clusterAppearance);
  for (let index = 1; index < sizes.length; index++) {
    assert.ok(sizes[index].diameter >= sizes[index - 1].diameter);
    assert.ok(brightness(sizes[index].fill) < brightness(sizes[index - 1].fill));
  }
  assert.equal(sizes[0].fill, '#fff0ce');
  assert.equal(sizes.at(-1).text, '#ffffff');
  assert.ok(clusterAppearance(100000).diameter <= 76);
});

test('each fan page keeps 44px touch targets separated', () => {
  for (let count = 2; count <= 8; count++) {
    const positions = spiderOffsets(count);
    for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
      assert.ok(Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y) >= 44);
    }
  }
});

class LatLng {
  constructor(lat, lng) { this.y = lat; this.x = lng; }
  equals(other) { return this.x === other.x && this.y === other.y; }
}
const marker = (lat, lng, title = 'Suggestion') => ({ getPosition: () => new LatLng(lat, lng), getTitle: () => title });
const projection = {
  fromLatLngToPoint: position => ({ x: position.x, y: position.y }),
  fromLatLngToDivPixel: position => ({ x: position.x, y: position.y }),
  fromLatLngToContainerPixel: position => ({ x: position.x, y: position.y }),
  fromDivPixelToLatLng: point => new LatLng(point.y, point.x),
};
function fakeMap() {
  return {
    zoom: 12, listeners: new Map(),
    get: () => undefined, getZoom() { return this.zoom; }, getMapTypeId: () => 'roadmap',
    mapTypes: { get: () => ({ maxZoom: 21 }) }, getProjection: () => projection,
    getDiv: () => ({ clientWidth: 390, clientHeight: 844 }),
    addListener(event, callback) {
      this.listeners.set(event, callback);
      return { remove: () => this.listeners.delete(event) };
    },
  };
}
test('spiderfies coincident and sub-touch-distance groups; spread-out groups still zoom', () => {
  const map = fakeMap();
  assert.equal(shouldSpiderfy([marker(1, 1), marker(1, 1)], map), true);
  assert.equal(shouldSpiderfy([marker(1, 1), marker(1.000001, 1)], map), true);
  assert.equal(shouldSpiderfy([marker(1, 1), marker(1.001, 1)], map), false);
  map.zoom = 21;
  assert.equal(shouldSpiderfy([marker(1, 1), marker(2, 2)], map), true);
});

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.events = {}; }
  get isConnected() { return this === document.body || Boolean(this.parent?.isConnected); }
  appendChild(child) { child.remove(); this.children.push(child); child.parent = this; return child; }
  replaceChildren(...children) { [...this.children].forEach(child => child.remove()); children.forEach(child => this.appendChild(child)); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { document.activeElement = this; this.events.focus?.(); }
  click() { assert.ok(!this.disabled); this.events.click?.(); }
}
test('paged fan selection, focus, viewport positioning, collapse, and disposal', () => {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const keyboard = new Map();
  globalThis.document = { body: new Element('body'), createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
  globalThis.window = { addEventListener: (name, callback) => keyboard.set(name, callback), removeEventListener: name => keyboard.delete(name) };
  try {
    const trigger = document.body.appendChild(new Element('button'));
    trigger.focus();
    class OverlayView {
      static preventMapHitsAndGesturesFrom() {}
      getProjection() { return projection; }
      getPanes() { return { floatPane: document.body }; }
      setMap(map) { if (map) { this.onAdd(); this.draw(); } else this.onRemove(); }
    }
    class MVCObject { set(key, value) { this[key] = value; } }
    const map = fakeMap();
    let selection;
    const fan = createMarkerSpiderfier(map, { OverlayView, MVCObject, Point: class { constructor(x, y) { this.x = x; this.y = y; } } }, (...args) => { selection = args; });
    const group = Array.from({ length: 18 }, (_, index) => marker(200, 200, `Idea ${index}`));
    fan.expand(group, new LatLng(200, 200));
    let root = document.body.children.at(-1);
    const targets = () => root.children.filter(child => child.className === 'spiderfied-suggestion');
    assert.equal(targets().length, 8);
    assert.equal(document.activeElement, targets()[0]);
    targets()[0].events.keydown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(document.activeElement, targets()[1]);
    for (const target of targets()) {
      assert.ok(parseFloat(target.style.left) >= 22 && parseFloat(target.style.left) <= 368);
    }
    const controls = () => root.children.find(child => child.className === 'map-ui');
    controls().children.find(child => child.attributes['aria-label'] === 'Next overlapping suggestions').click();
    controls().children.find(child => child.attributes['aria-label'] === 'Next overlapping suggestions').click();
    assert.equal(targets().length, 2);
    targets()[1].click();
    assert.equal(selection[0], group[17]);
    assert.ok(selection[1].position instanceof LatLng);
    keyboard.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
    assert.equal(document.body.children.length, 1);
    assert.equal(document.activeElement, trigger);
    fan.expand(group, new LatLng(200, 200));
    root = document.body.children.at(-1);
    map.listeners.get('zoom_changed')();
    assert.equal(root.isConnected, false);
    fan.dispose();
    assert.equal(map.listeners.size, 0);
    assert.equal(keyboard.size, 0);
  } finally {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  }
});
