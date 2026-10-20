import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createTransitStopMarkers } from '../src/services/transitStops.js';
import { generateLocationDiagram } from './railFixtures.js';

const stop = (id, name, x, y, tags = {}) => ({ id, type: 'node', lat: 0, lon: 0, x, y,
  tags: { highway: 'bus_stop', name, network: 'DART', ...tags } });
const road = (name = 'Elm Street', points = [{ x: 40, y: 100 }, { x: 440, y: 100 }]) => ({
  tags: { name, highway: 'residential' }, points,
});
const render = (transitStops, roadPaths, scale = 1, extra = {}) => createTransitStopMarkers(
  { transitStops, ...extra }, (entry) => ({ x: entry.x, y: entry.y }), scale, 480,
  roadPaths === undefined ? undefined : { roadPaths },
);

for (const [first, second] of [
  ['Elm @ Akard - W - NS', 'Elm @ Akard - E - NS'],
  ['Elm @ Akard - WB - FS', 'Elm @ Akard - EB - platform 2'],
  ['Elm @ Akard - N - NS', 'Elm @ Akard - S - MB'],
  ['Elm @ Akard - NB - near side', 'Elm @ Akard - SB - far side'],
  ['Elm Street at Akard Street (Westbound) (platform A)', 'Elm St. @ Akard St. - Eastbound - bay 2'],
  ['Elm@Akard-W-NS', 'Elm@Akard-E-FS'],
  ['Elm @ Avenue E - W - NS', 'Elm @ Avenue E - E - FS'],
  ['Elm @ Akard WB NS', 'Elm @ Akard EB FS'],
]) {
  test(`normalizes complementary bus identities: ${first}`, { tag: '@unit' }, () => {
    const result = render([stop('a', first, 100, 92), stop('b', second, 120, 108)], [road()]);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]).toMatchObject({ id: 'bus-pair:node:a|node:b', mode: 'bus',
      agencies: ['dart'], stopX: 110, stopY: 100, pairedStopIds: ['node:a', 'node:b'] });
    expect(result.pairs[0]).toMatchObject({ evidence: 'opposite-directions', projected: true,
      midpoint: { x: 110, y: 100 }, roadName: 'Elm Street' });
    expect(result.markers[0].name).not.toMatch(/platform|bound|bay| - /i);
    expect(render([stop('b', second, 120, 108), stop('a', first, 100, 92)], [road()])).toEqual(result);
  });
}

test('projects the actual midpoint onto the rendered road, independently of badge placement', { tag: '@unit' }, () => {
  const result = render([stop('a', 'Elm @ Akard - W - NS', 230, 222),
    stop('b', 'Elm @ Akard - E - NS', 250, 255)], [road('Elm', [{ x: 80, y: 240 }, { x: 400, y: 240 }])]);
  expect(result.pairs[0].midpoint).toEqual({ x: 240, y: 238.5 });
  expect(result.markers[0]).toMatchObject({ stopX: 240, stopY: 240 });
  expect(Math.hypot(result.markers[0].x - 240, result.markers[0].y - 240)).toBeGreaterThan(30);
});

test('badges avoid supplied protected label boxes while preserving paired stop projection and pin clearance', { tag: '@unit' }, () => {
  const stops = [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108),
    stop('pin', 'Pin-adjacent stop', 240, 240)];
  const data = { transitStops: stops };
  const screenPoint = (entry) => ({ x: entry.x, y: entry.y });
  const paths = [road()];
  const protectedBoxes = Object.freeze([70, 110, 150].map((x) => Object.freeze({ x, y: 100, width: 12, height: 20 })));
  const baseline = createTransitStopMarkers(data, screenPoint, 1, 480, { roadPaths: paths });
  const result = createTransitStopMarkers(data, screenPoint, 1, 480, { roadPaths: paths, occupied: protectedBoxes });
  const paired = result.markers.find((marker) => marker.pairedStopIds);
  expect(paired).toMatchObject({ stopX: 110, stopY: 100 });
  expect(paired.y).not.toBe(baseline.markers.find((marker) => marker.pairedStopIds).y);
  expect(result.pairs).toEqual(baseline.pairs);
  const pin = { x: 240, y: 240, width: 66, height: 66 };
  for (const marker of result.markers) {
    for (const box of [...protectedBoxes, pin]) {
      const overlaps = Math.abs(marker.x - box.x) < (marker.width + box.width) / 2 + 3
        && Math.abs(marker.y - box.y) < (marker.height + box.height) / 2 + 3;
      expect(overlaps).toBe(false);
    }
  }
  expect(result.occupied).toEqual(result.markers.map(({ x, y, width, height }) => ({ x, y, width, height })));
  expect(result.occupied).toHaveLength(2);
  expect(createTransitStopMarkers({}, screenPoint, 1, 480, { occupied: protectedBoxes }).occupied).toEqual([]);
});

test('real medical-district badges clear primary Harry Hines glyphs while retaining Kendall pair centerline target', { tag: '@unit' }, () => {
  const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const id of ['medical-district', 'bachman']) {
    const fixture = fixtures.find((entry) => entry.id === id);
    const diagram = generateLocationDiagram(fixture, fixture.center);
    expect(diagram.streets).toHaveLength(4);
    const primary = diagram.streetLabels.find((label) => label.rank === 1);
    expect(primary).toMatchObject({ name: 'Harry Hines Boulevard', placed: true });
    expect(primary.glyphBoxes.length).toBeGreaterThan(0);
    for (const badge of diagram.transitStops) {
      for (const glyph of primary.glyphBoxes) {
        const overlaps = Math.abs(badge.x - glyph.x) < (badge.width + glyph.width) / 2
          && Math.abs(badge.y - glyph.y) < (badge.height + glyph.height) / 2;
        expect(overlaps, `${id}: ${badge.name} must clear every primary glyph`).toBe(false);
      }
    }
    if (id === 'medical-district') {
      const kendall = diagram.transitStops.find((badge) => badge.name === 'Harry Hines @ Kendall');
      const pair = diagram.busStopPairs.find((entry) => entry.id === kendall.id);
      expect(pair.projected).toBe(true);
      expect(kendall).toMatchObject({ stopX: pair.stopX, stopY: pair.stopY });
      const displacement = Math.hypot(kendall.x - kendall.stopX, kendall.y - kendall.stopY);
      expect(displacement).toBeGreaterThan(0);
      expect(displacement).toBeLessThanOrEqual(100);
      expect(diagram.svg).toContain(`d="M${kendall.stopX.toFixed(1)},${kendall.stopY.toFixed(1)} L${kendall.x.toFixed(1)},${kendall.y.toFixed(1)}"`);
    }
  }
});

test('real dense fixtures keep every badge above the copyright row', { tag: '@unit' }, () => {
  const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const fixture of fixtures) {
    const diagram = generateLocationDiagram(fixture, fixture.center);
    for (const badge of diagram.transitStops) {
      expect(badge.y + badge.height / 2, `${fixture.id}: ${badge.name}`).toBeLessThanOrEqual(432);
    }
  }
  const stops = Array.from({ length: 10 }, (_, index) => stop(String(index), `Dense footer ${index}`, 80 + index * 30, 470));
  for (const badge of render(stops).markers) expect(badge.y + badge.height / 2).toBeLessThanOrEqual(432);
});

test('protected occupancy options preserve legacy defaults and returned rectangle shape', { tag: '@unit' }, () => {
  const data = { transitStops: [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108)] };
  const screenPoint = (entry) => ({ x: entry.x, y: entry.y });
  const legacy = createTransitStopMarkers(data, screenPoint, 1);
  expect(createTransitStopMarkers(data, screenPoint, 1, 480, {})).toEqual(legacy);
  expect(createTransitStopMarkers(data, screenPoint, 1, undefined, { occupied: [] })).toEqual(legacy);
  expect(legacy.occupied).toEqual(legacy.markers.map(({ x, y, width, height }) => ({ x, y, width, height })));
  const roadOptions = { roadPaths: [road()] };
  expect(createTransitStopMarkers(data, screenPoint, 1, 480, { ...roadOptions, occupied: [] }))
    .toEqual(createTransitStopMarkers(data, screenPoint, 1, 480, roadOptions));
});

test('uses polyline segments and screen-pixel scale for diagonal rendered streets', { tag: '@unit' }, () => {
  const result = render([stop('a', 'Elm @ Akard - W', 180, 196), stop('b', 'Elm @ Akard - E', 220, 204)],
    [road('Elm', [{ x: 60, y: 300 }, { x: 100, y: 100 }, { x: 300, y: 300 }])], 2);
  expect(result.markers).toHaveLength(1);
  expect(result.markers[0].stopX).toBeCloseTo(200);
  expect(result.markers[0].stopY).toBeCloseTo(200);
});

test('requires rendered opposite-side geometry when names have no direction', { tag: '@unit' }, () => {
  const stops = [stop('a', 'Elm @ Akard - platform A', 100, 92),
    stop('b', 'Elm @ Akard - platform B', 120, 108)];
  expect(render(stops).markers).toHaveLength(2);
  const result = render(stops, [road()]);
  expect(result.markers).toHaveLength(1);
  expect(result.pairs[0].evidence).toBe('opposite-sides');
  expect(render(stops, []).markers).toHaveLength(2);
});

test('ignores unnamed, invalid and zero-length rendered road segments', { tag: '@unit' }, () => {
  const stops = [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108)];
  const paths = [road(null), road(undefined, [{ x: NaN, y: 0 }, { x: 100, y: 100 }]),
    road('Elm', [{ x: 100, y: 100 }, { x: 100, y: 100 }]), road()];
  expect(render(stops, paths).markers[0]).toMatchObject({ id: 'bus-pair:node:a|node:b', stopX: 110, stopY: 100 });
});

test('explicit complementary identity falls back to midpoint without supplied road paths', { tag: '@unit' }, () => {
  const result = render([stop('a', 'Elm @ Akard - W', 100, 91), stop('b', 'Elm @ Akard - E', 120, 109)]);
  expect(result.markers).toHaveLength(1);
  expect(result.markers[0]).toMatchObject({ stopX: 110, stopY: 100 });
  expect(result.pairs[0]).toMatchObject({ projected: false, roadName: null });
});

for (const [label, stops, paths] of [
  ['same-side geometry', [stop('a', 'Elm @ Akard - W', 100, 91), stop('b', 'Elm @ Akard - E', 120, 94)], [road()]],
  ['same-direction duplicates', [stop('a', 'Elm @ Akard - W - NS', 100, 92), stop('b', 'Elm @ Akard - W - FS', 120, 108)], [road()]],
  ['same-name same-side duplicates', [stop('a', 'Elm @ Akard', 100, 92), stop('b', 'Elm @ Akard', 102, 93)], [road()]],
  ['no intersection identity', [stop('a', 'Elm', 100, 92), stop('b', 'Elm', 102, 93)], [road()]],
  ['different main streets', [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Commerce @ Akard - E', 120, 108)], [road()]],
  ['different cross streets', [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Lamar - E', 120, 108)], [road()]],
  ['directional cross-street identity', [stop('a', 'Elm @ North Akard - W', 100, 92), stop('b', 'Elm @ South Akard - E', 120, 108)], [road()]],
  ['different street types', [stop('a', 'Elm Street @ Akard - W', 100, 92), stop('b', 'Elm Avenue @ Akard - E', 120, 108)], [road()]],
  ['lettered cross streets', [stop('a', 'Elm @ Avenue E - W - NS', 100, 92), stop('b', 'Elm @ Avenue W - E - NS', 120, 108)], [road()]],
  ['cardinal-only cross streets', [stop('a', 'Elm @ E - W - NS', 100, 92), stop('b', 'Elm @ W - E - NS', 120, 108)], [road()]],
  ['distant stops', [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 220, 108)], [road()]],
  ['wrong named rendered road', [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108)], [road('Commerce')]],
  ['distant shared road', [stop('a', 'Elm @ Akard - W', 100, 192), stop('b', 'Elm @ Akard - E', 120, 208)], [road()]],
  ['coincident points', [stop('a', 'Elm @ Akard - W', 100, 100), stop('b', 'Elm @ Akard - E', 100, 100)], [road()]],
  ['incompatible recognized agencies', [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108, { network: 'Trinity Metro' })], [road()]],
  ['incompatible unknown agency evidence', [stop('a', 'Elm @ Akard - W', 100, 92, { network: 'Local A' }), stop('b', 'Elm @ Akard - E', 120, 108, { network: 'Local B' })], [road()]],
]) {
  test(`does not pair ${label}`, { tag: '@unit' }, () => {
    const result = render(stops, paths);
    expect(result.markers).toHaveLength(2);
    expect(result.pairs).toEqual([]);
  });
}

test('preserves agency inference and unions compatible multi-agency evidence', { tag: '@unit' }, () => {
  const a = stop('a', 'Elm @ Akard - W', 100, 92, { network: 'DART; Trinity Metro' });
  const b = stop('b', 'Elm @ Akard - E', 120, 108, { network: undefined });
  const result = render([a, b], [road()], 1, { transitRoutes: [{
    tags: { route: 'bus', network: 'DART' }, members: [{ type: 'node', ref: 'b' }],
  }] });
  expect(result.markers).toHaveLength(1);
  expect(result.markers[0].agencies).toEqual(['dart', 'trinity-metro']);
  expect(render([a, { ...b, tags: { ...b.tags, direction: 'eastbound' } }], [road()]).markers).toHaveLength(1);
});

test('pairing keeps shared stop-area rail deduplication and B+R mode working', { tag: '@unit' }, () => {
  const stops = [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 120, 108),
    stop('rail', 'Akard', 110, 100, { highway: undefined, railway: 'station' }),
    stop('rail-platform', 'Akard station', 111, 101, { highway: undefined, railway: 'platform' })];
  const result = render(stops, [road()], 1, { stopAreas: [{ id: 'shared', tags: { name: 'Akard' },
    members: stops.map((entry) => ({ type: 'node', ref: entry.id })) }] });
  expect(result.markers).toHaveLength(1);
  expect(result.markers[0]).toMatchObject({ mode: 'bus+rail', agencies: ['dart'],
    pairedStopIds: ['node:a', 'node:b'] });
  expect(result.pairs).toHaveLength(1);
});

test('pairing is deterministic, one-to-one, and does not mutate input or roads', { tag: '@unit' }, () => {
  const stops = [stop('a', 'Elm @ Akard - W', 100, 92), stop('b', 'Elm @ Akard - E', 110, 108),
    stop('c', 'Elm @ Akard - W', 160, 92)];
  const paths = [road()];
  const before = JSON.stringify({ stops, paths });
  const first = render(stops, paths);
  const second = render([...stops].reverse(), paths);
  expect(first.markers).toEqual(second.markers);
  expect(first.pairs.map((pair) => pair.id)).toEqual(['bus-pair:node:a|node:b']);
  expect(first.markers).toHaveLength(2);
  expect(JSON.stringify({ stops, paths })).toBe(before);
});

test('genuine offline Dallas fixtures pair Riverfront and Lamar complementary stops', { tag: '@unit' }, () => {
  const original = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));
  const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const [fixture, prefix] of [[original, 'Lamar @ Commerce'],
    [additional.find((entry) => entry.id === 'west-end'), 'Riverfront @ Justice']]) {
    const stops = fixture.transitStops.filter((entry) => entry.tags?.name?.startsWith(prefix));
    expect(stops).toHaveLength(2);
    const lat = (stops[0].lat + stops[1].lat) / 2;
    const lon = (stops[0].lon + stops[1].lon) / 2;
    const screenPoint = (entry) => ({ x: 200 + (entry.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180),
      y: 180 - (entry.lat - lat) * 111320 });
    const result = createTransitStopMarkers({ ...fixture, transitStops: stops }, screenPoint, 1);
    expect(result.markers).toHaveLength(1);
    expect(result.markers[0]).toMatchObject({ name: prefix, agencies: ['dart'], mode: 'bus' });
    expect(result.markers[0].stopX).toBeCloseTo(200);
    expect(result.markers[0].stopY).toBeCloseTo(180);
    expect(result.pairs[0].stopIds).toEqual(stops.map((entry) => `node:${entry.id}`).sort());
  }
});
