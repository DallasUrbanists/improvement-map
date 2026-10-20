import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildRailGeometry } from '../src/services/railGeometry.js';
import { applyRailServiceOverrides } from '../src/services/railServiceOverrides.js';
import { renderSourceTransit } from '../src/services/sourceRailRendering.js';
import { RAIL_DISPLAY_CORRIDORS } from '../src/services/railDisplayCorridors.js';
import { corridorBlend, corridorReference } from '../src/services/railCorridorGrouping.js';
import { snapRailStopsToPaths } from '../src/services/simpleTransitStops.js';
import { generateVersionTwoLocationDiagram } from '../src/services/locationDiagramVersionTwo.js';
import { railSvgLayers } from '../src/services/railSvgLayers.js';
import { railThickness } from '../src/services/railSettings.js';
import { createGoogleMapsRailOverlay } from '../src/services/googleMapsRailOverlay.js';

const earth = 2 * Math.PI * 6378137;
const ppm = (lat, zoom) => 256 * 2 ** zoom / (earth * Math.cos(lat * Math.PI / 180));
const root = new URL('../src/data/rails/', import.meta.url);
const catalog = applyRailServiceOverrides(buildRailGeometry(Object.fromEntries(fs.readdirSync(root)
  .filter((f) => f.endsWith('.geojson')).map((f) => [f, JSON.parse(fs.readFileSync(new URL(f, root), 'utf8'))]))));

function fixture(rule) {
  const lat = rule.start[1]; const lon = rule.start[0];
  const northSouth = rule.sign < 0;
  const geographic = (x, y) => ({ lon: lon + x / (111195 * Math.cos(lat * Math.PI / 180)), lat: lat - y / 111195 });
  const metric = (point) => ({ x: (point.lon - lon) * 111195 * Math.cos(lat * Math.PI / 180), y: (lat - point.lat) * 111195 });
  const reference = [[0, 0], [northSouth ? 30 : 700, northSouth ? 700 : -30], [northSouth ? 30 : 1400, northSouth ? 1400 : -30],
    [northSouth ? 0 : 2100, northSouth ? 2100 : 0]];
  const start = geographic(...reference[0]); const end = geographic(...reference.at(-1));
  // Synthetic offset fixtures exercise deformation independently of fixed trunks.
  const corridor = { ...rule, fixedServices: undefined, laneOffsets: undefined, start: [start.lon, start.lat], end: [end.lon, end.lat], maxGapMeters: 200 };
  const segments = rule.order.flatMap((line, rank) => {
    const displacement = line === rule.reference ? 0 : (rank + 1) * 15;
    const points = reference.map(([x, y]) => geographic(x + (northSouth ? displacement : 0), y + (northSouth ? 0 : displacement)));
    return points.slice(1).map((p, i) => ({ id: `${line}:${i}`, keys: [line], geometry: [points[i], p] }));
  });
  const data = { lines: [...rule.order, 'UNRELATED'].map((id) => ({ id, color: '#123456' })), segments };
  const render = (zoom, corridors = [corridor], translation = { x: 0, y: 0 }, clip = false) => {
    const scale = ppm(lat, zoom);
    return renderSourceTransit(data, { lat, lon }, 10000, metric,
      (p) => ({ x: p.x * scale + translation.x, y: p.y * scale + translation.y }), scale,
      { corridors, clip, width: 480, height: 252 });
  };
  return { render, data, corridor, lat, northSouth };
}

for (const rule of RAIL_DISPLAY_CORRIDORS) {
  test(`${rule.id}: separate, blended, grouped, ordered, and translation invariant`, { tag: '@unit' }, () => {
    const { render, data, lat, northSouth } = fixture(rule);
    const original = JSON.stringify(data);
    const close = render(rule.zoom + 1); const disabled = render(rule.zoom + 1, []);
    expect(close.segments.map((s) => s.path)).toEqual(disabled.segments.map((s) => s.path));
    expect(corridorBlend(ppm(lat, rule.zoom + 0.5), lat, rule.zoom)).toBeCloseTo(0.5, 6);
    const halfway = render(rule.zoom + 0.5); const grouped = render(rule.zoom);
    expect(halfway.displayCorridors[0].blend).toBeCloseTo(0.5, 5);
    expect(grouped.displayCorridors[0].blend).toBeCloseTo(1, 5);
    const positions = rule.order.map((line) => {
      const station = 1050 * ppm(lat, rule.zoom);
      const axis = northSouth ? 'y' : 'x';
      const matches = grouped.segments.filter((s) => s.line === line).flatMap((s) => s.points.slice(1)
        .map((p, i) => [s.points[i], p]).filter(([a, b]) => Math.min(a[axis], b[axis]) <= station
          && Math.max(a[axis], b[axis]) >= station));
      expect(matches).toHaveLength(1);
      const [a, b] = matches[0];
      const t = (station - a[axis]) / (b[axis] - a[axis]);
      const cross = northSouth ? 'x' : 'y'; return a[cross] + (b[cross] - a[cross]) * t;
    });
    for (let i = 1; i < positions.length; i++) expect(positions[i] - positions[i - 1]).toBeCloseTo(5.5, 3);
    const translated = render(rule.zoom, undefined, { x: 100, y: -75 });
    expect(translated.segments.map((s) => s.points.length)).toEqual(grouped.segments.map((s) => s.points.length));
    for (const [i, segment] of grouped.segments.entries()) for (const [j, point] of segment.points.entries()) {
      // Polyline projection ties may differ below SVG's 0.1-pixel precision.
      expect(Math.abs(translated.segments[i].points[j].x - point.x - 100)).toBeLessThan(0.02);
      expect(Math.abs(translated.segments[i].points[j].y - point.y + 75)).toBeLessThan(0.02);
    }
    expect(JSON.stringify(data)).toBe(original);
  });
}

test('all real corridor anchors resolve and all requested services participate', { tag: '@unit' }, () => {
  const before = JSON.stringify(catalog);
  for (const corridor of RAIL_DISPLAY_CORRIDORS) {
    const points = corridorReference(catalog, corridor);
    expect(points.length).toBeGreaterThan(2);
    expect(corridor.order.every((id) => catalog.lines.some((line) => line.id === id))).toBe(true);
  }
  expect(JSON.stringify(catalog)).toBe(before);
});

test('duplicate direction traces share one core stroke while unrelated tracks stay unchanged', { tag: '@unit' }, () => {
  const rule = RAIL_DISPLAY_CORRIDORS.find((c) => c.id === 'm-line-st-paul');
  const { data, render } = fixture(rule);
  const originals = data.segments.filter((s) => s.keys.includes('DART:425'));
  data.segments.push(...originals.map((s) => ({ ...s, id: `second:${s.id}`,
    geometry: s.geometry.map((p) => ({ ...p, lat: p.lat + 0.00008 })) })));
  data.segments.push(...originals.map((s) => ({ ...s, id: `unrelated:${s.id}`, keys: ['UNRELATED'] })));
  const result = render(rule.zoom, undefined, { x: 0, y: 100 }); const baseline = render(rule.zoom, [], { x: 0, y: 100 });
  expect(result.segments.filter((s) => s.line === 'UNRELATED').map((s) => s.path))
    .toEqual(baseline.segments.filter((s) => s.line === 'UNRELATED').map((s) => s.path));
  const x = 1050 * ppm(rule.start[1], rule.zoom);
  const crossings = result.segments.filter((s) => s.line === 'DART:425').flatMap((s) => s.points.slice(1)
    .map((p, i) => [s.points[i], p]).filter(([a, b]) => Math.min(a.x, b.x) < x && Math.max(a.x, b.x) > x));
  expect(crossings).toHaveLength(1);
  const stop = { mode: 'rail', lines: ['DART:425'], x, y: 100 };
  const snapped = snapRailStopsToPaths([stop], result.segments, 480, 480);
  expect(snapped).toHaveLength(1);
  expect(Math.abs(snapped[0].y - crossings[0][0].y)).toBeLessThan(0.1);
});

for (const rule of RAIL_DISPLAY_CORRIDORS) test(`${rule.id}: real services join without mutating their catalog`, { tag: '@unit' }, () => {
  const before = JSON.stringify(catalog);
  const latitude = (rule.start[1] + rule.end[1]) / 2; const scale = ppm(latitude, rule.zoom);
  const project = (p) => ({ x: (p.lon - rule.start[0]) * 111195 * Math.cos(latitude * Math.PI / 180),
    y: (rule.start[1] - p.lat) * 111195 });
  const screen = (p) => ({ x: p.x * scale, y: p.y * scale });
  const result = renderSourceTransit(catalog, { lat: latitude, lon: rule.start[0] }, 0, project, screen, scale,
    { clip: false, corridors: [rule] });
  for (const line of rule.order.filter((id) => !rule.fixedServices?.includes(id))) expect(result.segments.some((s) => s.line === line && s.displayCorridors?.includes(rule.id))).toBe(true);
  expect(JSON.stringify(catalog)).toBe(before);
});

test('real network preserves connected endpoints and equivalent SVG/Mercator grouping scales', { tag: '@unit' }, () => {
  const lat = 32.8; const zoom = 14.5; const scale = ppm(lat, zoom);
  const project = (p) => ({ x: (p.lon + 96.8) * 111195 * Math.cos(lat * Math.PI / 180), y: (lat - p.lat) * 111195 });
  const screen = (p) => ({ x: p.x * scale, y: p.y * scale });
  const result = renderSourceTransit(catalog, { lat, lon: -96.8 }, 0, project, screen, scale, { clip: false });
  expect(result.displayCorridors).toHaveLength(RAIL_DISPLAY_CORRIDORS.length);
  expect(result.segments.filter((s) => s.displayCorridors?.length).length).toBeGreaterThan(5);
  const mercator = (p) => ({ x: (p.lon + 96.8) / 360 * 256 * 2 ** zoom,
    y: (Math.asinh(Math.tan(lat * Math.PI / 180)) - Math.asinh(Math.tan(p.lat * Math.PI / 180)))
      / (2 * Math.PI) * 256 * 2 ** zoom });
  const google = renderSourceTransit(catalog, { lat, lon: -96.8 }, 0, mercator, (p) => p, scale, { clip: false });
  for (const corridor of result.displayCorridors) {
    const other = google.displayCorridors.find((c) => c.id === corridor.id);
    expect(Math.abs(corridor.blend - other.blend)).toBeLessThan(0.01);
  }
  // Existing same-service junctions must still have the same display endpoint.
  const endpoints = (segments) => {
    const map = new Map();
    for (const segment of segments) for (const p of [segment.points[0], segment.points.at(-1)]) {
      const key = `${segment.line}:${p.x.toFixed(5)},${p.y.toFixed(5)}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.values()].filter((n) => n === 1).length;
  };
  const baseline = renderSourceTransit(catalog, { lat, lon: -96.8 }, 0, project, screen, scale,
    { clip: false, corridors: [], sourceSegments: catalog.segments });
  expect(endpoints(result.segments)).toBe(endpoints(baseline.segments));
});

test('Version Two renders deterministic grouped diagrams and supports a missing catalog', { tag: '@unit' }, () => {
  const center = { lat: 32.79, lon: -96.81 };
  const data = { elements: [{ type: 'way', id: 1, tags: { highway: 'residential', name: 'Example Street' },
    geometry: [{ lat: 32.81, lon: -96.82 }, { lat: 32.81, lon: -96.80 }] }] };
  const options = { ...center, buildings: false, railCatalog: catalog };
  const result = generateVersionTwoLocationDiagram(data, options);
  expect(result.svg).toBe(generateVersionTwoLocationDiagram(data, options).svg);
  expect(result.svg).toContain('data-transit-line="TRE:TRE"');
  expect(result.svg).not.toMatch(/NaN|Infinity/);
  expect(generateVersionTwoLocationDiagram(data, center).svg).not.toMatch(/NaN|Infinity/);
});

test('Maps manages rail tiles, caches geometry, updates labels and releases resources', { tag: '@unit' }, () => {
  const types = [];
  const listeners = [];
  const maps = {
    Size: class { constructor(width, height) { Object.assign(this, { width, height }); } },
    StyledMapType: class { constructor(styles) { this.styles = styles; } },
  };
  const map = {
    overlayMapTypes: { push: type => types.push(type), getLength: () => types.length,
      getAt: i => types[i], removeAt: i => types.splice(i, 1) },
    setOptions() {}, getHeading: () => 0, getTilt: () => 0,
    addListener: () => { const listener = { removed: false, remove() { this.removed = true; } }; listeners.push(listener); return listener; },
  };
  const ownerDocument = { createElementNS: () => ({
    dataset: {}, style: {}, attributes: {}, innerHTML: '',
    setAttribute(name, value) { this.attributes[name] = value; },
  }) };
  const overlay = createGoogleMapsRailOverlay(map, maps, catalog);
  try {
    const rail = types[0];
    expect(rail.tileSize).toEqual({ width: 256, height: 256 });
    const first = rail.getTile({ x: 100, y: 100 }, 14, ownerDocument);
    const adjacent = rail.getTile({ x: 101, y: 100 }, 14, ownerDocument);
    expect(first.innerHTML).toContain('data-transit-line');
    expect(adjacent.innerHTML).toBe(first.innerHTML);
    expect(Number(adjacent.attributes.viewBox.split(' ')[0]) - Number(first.attributes.viewBox.split(' ')[0])).toBe(256);
    const wrapped = rail.getTile({ x: 100 + 2 ** 14, y: 100 }, 14, ownerDocument);
    expect(wrapped.attributes.viewBox).toBe(first.attributes.viewBox);
    const fractional = rail.getTile({ x: 100, y: 100 }, 14.5, ownerDocument);
    expect(fractional.innerHTML).not.toBe(first.innerHTML);
    expect(rail.getTile({ x: 100, y: 100 }, 14, ownerDocument).innerHTML).toBe(first.innerHTML);
    overlay.update({ styles: [], mapType: 'roadmap' });
    expect(types).toHaveLength(2);
    const labels = types[1];
    overlay.update({ styles: [], mapType: 'roadmap' });
    expect(types[1]).toBe(labels);
    overlay.update({ styles: [], mapType: 'satellite' });
    expect(types).toEqual([rail]);
    rail.releaseTile(first);
    const markup = first.innerHTML;
    const previous = railThickness.value;
    try {
      railThickness.value = previous + 1;
      expect(first.innerHTML).toBe(markup);
      expect(adjacent.innerHTML).not.toBe(markup);
    } finally { railThickness.value = previous; }
  } finally { overlay.dispose(); }
  expect(types).toEqual([]);
  expect(listeners.every(listener => listener.removed)).toBe(true);
  overlay.update({ styles: [], mapType: 'roadmap' });
  expect(types).toEqual([]);
});

test('terminal bundles keep the full lane separation through both terminal caps', { tag: '@unit' }, () => {
  const rule = RAIL_DISPLAY_CORRIDORS.find((c) => c.id === 'a-train-trinity');
  const { render } = fixture(rule);
  const result = render(rule.zoom);
  const lanes = rule.order.map((line) => result.segments.filter((s) => s.line === line));
  for (const end of [0, -1]) {
    const a = lanes[0][0].points.at(end);
    const b = lanes[1][0].points.at(end);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(5.5, 2);
  }
});

test('streetcar casing and ink are beneath rail, with a local Green bridge above Silver', { tag: '@unit' }, () => {
  const lat = 32.95508; const lon = -96.90864; const scale = ppm(lat, 14);
  const project = (p) => ({ x: (p.lon - lon) * 111195 * Math.cos(lat * Math.PI / 180), y: (lat - p.lat) * 111195 });
  const transit = renderSourceTransit(catalog, { lat, lon }, 0, project,
    (p) => ({ x: p.x * scale, y: p.y * scale }), scale, { clip: false });
  expect(transit.overpasses.length).toBeGreaterThan(0);
  expect(transit.overpasses.every((path) => path.includes('data-transit-line="DART:GREEN"'))).toBe(true);
  const svg = railSvgLayers(transit);
  const layers = ['streetcar-casing', 'streetcar-lines', 'rail-casing', 'rail-lines', 'rail-bridge-lines'];
  const indices = layers.map((layer) => svg.indexOf(`data-layer="${layer}"`));
  expect(indices.every((index, i) => index >= 0 && (!i || index > indices[i - 1]))).toBe(true);
});
