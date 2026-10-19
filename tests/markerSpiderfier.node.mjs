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
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.attributes = {}; this.events = {}; this.animations = []; }
  get isConnected() { return this === document.body || Boolean(this.parent?.isConnected); }
  appendChild(child) { child.remove(); this.children.push(child); child.parent = this; return child; }
  replaceChildren(...children) { [...this.children].forEach(child => child.remove()); children.forEach(child => this.appendChild(child)); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() { document.activeElement = this; this.events.focus?.(); }
  click() { assert.ok(!this.disabled); this.events.click?.(); }
  animate(keyframes, options) {
    const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
  getAnimations() { return this.animations.filter(animation => !animation.cancelled); }
}
test('emoji fan pages switch instantly with fixed controls and leaders below markers across reopenings', () => {
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const keyboard = new Map();
  let reducedMotion = false;
  let scheduledTimeouts = 0;
  globalThis.document = { body: new Element('body'), createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag) };
  globalThis.window = {
    addEventListener: (name, callback) => keyboard.set(name, callback), removeEventListener: name => keyboard.delete(name),
    matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: (...args) => { scheduledTimeouts++; return setTimeout(...args); }, clearTimeout,
  };
  try {
    const leaderPane = document.body.appendChild(new Element('div'));
    const trigger = document.body.appendChild(new Element('button'));
    trigger.focus();
    let spiderOverlay;
    class OverlayView {
      constructor() { spiderOverlay = this; }
      static preventMapHitsAndGesturesFrom() {}
      getProjection() { return projection; }
      getPanes() { return { overlayLayer: leaderPane, overlayMouseTarget: document.body }; }
      setMap(map) {
        if (map) {
          this.onAdd();
          assert.equal(document.body.children.at(-1).style.visibility, 'hidden');
          this.draw();
        } else this.onRemove();
      }
    }
    class MVCObject { set(key, value) { this[key] = value; } }
    const map = fakeMap();
    let selection;
    const fan = createMarkerSpiderfier(map, { OverlayView, MVCObject, Point: class { constructor(x, y) { this.x = x; this.y = y; } } }, (...args) => { selection = args; }, undefined, undefined, undefined, item => item.emoji);
    const group = Array.from({ length: 18 }, (_, index) => marker(200, 200, `Idea ${index}`));
    group[0].emoji = '🦆';
    group[1].emoji = '👩‍👩‍👧‍👦';
    group[2].emoji = '';
    group[3].emoji = '  ';
    fan.expand(group, new LatLng(200, 200));
    let root = document.body.children.at(-1);
    const targets = () => root.children.filter(child => child.className === 'spiderfied-suggestion');
    assert.equal(targets().length, 8);
    assert.equal(root.style.visibility, 'visible');
    // Delayed targets and leaders must stay at their invisible starting state
    // until their stagger begins, rather than flash at the final position.
    const entranceTargets = [...targets(), ...leaderPane.children[0].children];
    for (const target of entranceTargets) {
      assert.equal(target.animations.length, 1);
      const animation = target.animations[0];
      assert.equal(animation.keyframes[0].opacity, 0);
      assert.equal(animation.options.fill, 'backwards');
    }
    assert.ok(targets()[1].animations[0].options.delay > 0);
    spiderOverlay.draw();
    fan.expand([...group].reverse(), new LatLng(200, 200));
    assert.deepEqual(targets(), entranceTargets.slice(0, 8));
    assert.ok(entranceTargets.every(target => target.animations.length === 1));
    assert.deepEqual(targets().slice(0, 5).map(target => target.children[0].textContent), ['🦆', '👩‍👩‍👧‍👦', '💡', '💡', '💡']);
    assert.equal(leaderPane.children.length, 1);
    assert.equal(root.children.some(child => child.tag === 'svg'), false);
    assert.equal(document.activeElement, targets()[0]);
    targets()[0].events.keydown({ key: 'ArrowRight', preventDefault() {} });
    assert.equal(document.activeElement, targets()[1]);
    for (const target of targets()) {
      assert.ok(parseFloat(target.style.left) >= 22 && parseFloat(target.style.left) <= 368);
    }
    const controls = () => root.children.find(child => child.className === 'map-ui');
    const controlsPosition = { left: controls().style.left, top: controls().style.top };
    assert.equal(controls().animations.length, 0);
    controls().children.find(child => child.attributes['aria-label'] === 'Next overlapping suggestions').click();
    assert.equal(targets()[0].attributes['aria-label'], 'Idea 8, 9 of 18');
    assert.equal(targets()[0].animations.length, 0);
    controls().children.find(child => child.attributes['aria-label'] === 'Next overlapping suggestions').click();
    assert.equal(targets().length, 2);
    assert.deepEqual({ left: controls().style.left, top: controls().style.top }, controlsPosition);
    assert.equal(controls().animations.length, 0);
    assert.equal(scheduledTimeouts, 0);
    targets()[1].click();
    assert.equal(selection[0], group[17]);
    assert.ok(selection[1].position instanceof LatLng);
    reducedMotion = true;
    keyboard.get('keydown')({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
    assert.equal(document.body.children.length, 2);
    assert.equal(leaderPane.children.length, 0);
    assert.equal(document.activeElement, trigger);
    reducedMotion = false;
    for (let cycle = 0; cycle < 5; cycle++) {
      fan.expand(group, new LatLng(200, 200));
      root = document.body.children.at(-1);
      assert.equal(leaderPane.children.length, 1);
      controls().children.find(child => child.attributes['aria-label'] === 'Next overlapping suggestions').click();
      controls().children.find(child => child.attributes['aria-label'] === 'Previous overlapping suggestions').click();
      assert.equal(controls().animations.length, 0);
      assert.equal(targets()[0].animations.length, 0);
      assert.equal(leaderPane.children[0].children.length, 8);
      fan.collapse(false, false);
      assert.equal(leaderPane.children.length, 0);
      assert.equal(root.isConnected, false);
    }
    reducedMotion = true;
    fan.expand(group, new LatLng(200, 200));
    root = document.body.children.at(-1);
    assert.equal(targets()[0].animations.length, 0);
    map.listeners.get('click')();
    assert.equal(root.isConnected, false);
    fan.dispose();
    assert.equal(map.listeners.size, 0);
    assert.equal(keyboard.size, 0);
  } finally {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
  }
});
