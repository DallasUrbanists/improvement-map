import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { removeTinyDeadEndNubs, promoteShortDividedGaps, deriveRoadAcquisitionBounds } from '../src/services/roadVisualCleanup.js';
import { mergeDividedStreets, collapseDividedTransitions } from '../src/services/dividedStreets.js';

const point = (x, y) => ({ x, y });
const way = (id, points, tags = {}, metadata = {}) => ({
  id, tags: { highway: 'footway', ...tags }, points,
  minor: true, extraLight: false, bike: false, labelEligible: false, ...metadata,
});
const bounds = { minX: -500, minY: -500, maxX: 500, maxY: 500 };
const cleanup = (ways, options = {}) => removeTinyDeadEndNubs(ways, {
  sourceWays: ways, visibleBounds: bounds, acquisitionBounds: bounds, ...options,
});
const trunk = way('trunk', [point(-100, 0), point(0, 0), point(100, 0)], { highway: 'cycleway', name: 'Trail' }, { bike: true });
const nub = way('nub', [point(0, 0), point(0, 4), point(0, 9)], {}, { bike: true });
const road = (id, points, tags = {}, metadata = {}) => way(id, points,
  { highway: 'secondary', name: 'Main Road', ...tags }, { minor: false, labelEligible: true, ...metadata });
const bracket = () => [
  road('left', [point(-100, 0), point(-10, 0)], {}, { divided: true }),
  road('gap', [point(-10, 0), point(0, 0), point(10, 0)], {}, { bike: true, transitionTail: true }),
  road('right', [point(10, 0), point(100, 0)], {}, { divided: true }),
];
const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-locations-osm.json', import.meta.url), 'utf8'));
const fixture = fixtures.find((entry) => entry.id === 'location-9');
const project = (p) => point((p.lon - fixture.center.lon) * 111195 * Math.cos(fixture.center.lat * Math.PI / 180),
  -(p.lat - fixture.center.lat) * 111195);
const sourceWays = fixture.elements.filter((e) => e.tags?.highway && e.geometry?.length >= 2)
  .map((e) => way(e.id, e.geometry.map(project), e.tags));
const halfExtent = fixture.compaction.viewportHalfExtentMeters;
const visibleBounds = { minX: -halfExtent, minY: -halfExtent, maxX: halfExtent, maxY: halfExtent };
const bbox = fixture.acquisition.bbox;
const northwest = project({ lat: bbox.north, lon: bbox.west });
const southeast = project({ lat: bbox.south, lon: bbox.east });
const acquisitionBounds = { minX: northwest.x, minY: northwest.y, maxX: southeast.x, maxY: southeast.y };
const realOptions = { sourceWays, visibleBounds, acquisitionBounds };

test('removes only the tiny attached dead end and is pure and idempotent', () => {
  const input = [trunk, nub];
  const snapshot = structuredClone(input);
  const result = cleanup(input);
  expect(result).toEqual([trunk]);
  expect(input).toEqual(snapshot);
  expect(cleanup(result, { sourceWays: input })).toEqual(result);
  expect(cleanup([nub, trunk])).toEqual([trunk]);
});

test('retains standalone paths, long branches, short hosts and endpoint continuations', () => {
  for (const input of [[nub], [trunk],
    [trunk, { ...nub, points: [point(0, 0), point(0, 30)] }],
    [{ ...trunk, points: [point(-20, 0), point(0, 0), point(20, 0)] }, nub],
    [way('end-trail', [point(-100, 0), point(0, 0)]), nub]]) {
    expect(cleanup(input)).toEqual(input);
  }
});

test('retains true connections, loops and cul-de-sac or access evidence', () => {
  const connection = way('connection', [point(0, 9), point(100, 30)]);
  expect(cleanup([trunk, nub, connection])).toEqual([trunk, nub, connection]);
  const loop = { ...nub, points: [point(0, 0), point(2, 3), point(-2, 3), point(0, 0)] };
  expect(cleanup([trunk, loop])).toEqual([trunk, loop]);
  for (const tags of [{ name: 'Named Spur' }, { noexit: 'yes' }, { access: 'private' },
    { footway: 'sidewalk' }, { footway: 'traffic_island' }, { footway: 'crossing' },
    { highway: 'cycleway', cycleway: 'crossing' }, { highway: 'residential', name: 'Side Road' },
    { highway: 'secondary_link' }, { highway: 'service' }, { service: 'driveway' }, { oneway: 'yes' }]) {
    const protectedWay = { ...nub, tags: { ...nub.tags, ...tags } };
    expect(cleanup([trunk, protectedWay])).toEqual([trunk, protectedWay]);
  }
  for (const tags of [{ highway: 'turning_circle' }, { highway: 'turning_loop' }, { barrier: 'gate' }, { entrance: 'yes' }]) {
    const protectedWay = { ...nub, nodeTags: [{}, {}, tags] };
    expect(cleanup([trunk, protectedWay])).toEqual([trunk, protectedWay]);
  }
});

test('requires acquisition and viewport safety, even for a geometrically short branch', () => {
  const input = [trunk, nub];
  expect(removeTinyDeadEndNubs(input)).toBe(input);
  for (const options of [{ sourceWays: undefined }, { visibleBounds: undefined }, { acquisitionBounds: undefined },
    { visibleBounds: { ...bounds, maxY: 15 } }, { acquisitionBounds: { ...bounds, maxY: 25 } },
    { acquisitionBounds: { ...bounds, minY: 1 } }]) expect(cleanup(input, options)).toEqual(input);
  const continued = { ...nub, points: [...nub.points, point(0, 700)] };
  expect(cleanup([trunk, continued])).toEqual([trunk, continued]);
  // A rendered/clipped endpoint must not masquerade as a full source endpoint.
  expect(cleanup([trunk, nub], { sourceWays: [trunk, continued] })).toEqual([trunk, nub]);
});

test('grade differences do not prove a junction, and grade-separated tips remain protected', () => {
  for (const tags of [{ layer: '1' }, { bridge: 'yes' }, { tunnel: 'yes' }]) {
    const other = { ...trunk, tags: { ...trunk.tags, ...tags } };
    expect(cleanup([other, nub])).toEqual([other, nub]);
    const tipConnection = way('overhead', [point(0, 9), point(80, 9)], tags);
    expect(cleanup([trunk, nub, tipConnection])).toEqual([trunk, nub, tipConnection]);
  }
});

test('trims a mixed crossing way at its source junction without losing the genuine crossing', () => {
  const mixed = way('mixed', [point(0, -8), point(0, 0), point(0, 5)], { footway: 'crossing' },
    { bike: true, street: { name: 'Crossing' } });
  const connected = way('connected', [point(0, -8), point(-50, -8)]);
  const result = cleanup([trunk, mixed, connected]);
  expect(result.find((w) => w.id === 'mixed')).toEqual({ ...mixed, points: mixed.points.slice(0, 2) });
  const reversed = { ...mixed, points: [...mixed.points].reverse() };
  expect(cleanup([trunk, reversed, connected]).find((w) => w.id === 'mixed').points)
    .toEqual([point(0, 0), point(0, -8)]);
  // Source geometry supplies the junction even if the render simplifier removed it.
  const simplified = { ...mixed, points: [mixed.points[0], mixed.points[2]] };
  expect(cleanup([trunk, simplified, connected], { sourceWays: [trunk, mixed, connected] })
    .find((w) => w.id === 'mixed').points).toEqual(mixed.points.slice(0, 2));
});

test('same-road terminal overshoots can be trimmed, but side roads and channels cannot', () => {
  const host = road('host', [point(-100, 0), point(0, 0), point(100, 0)]);
  const mixed = road('mixed', [point(0, -80), point(0, 0), point(5, 0)]);
  const result = cleanup([host, mixed]);
  expect(result[1].points).toEqual(mixed.points.slice(0, 2));
  for (const tags of [{ name: 'Side Road' }, { highway: 'tertiary' }, { oneway: 'yes' }]) {
    const sideRoad = { ...mixed, tags: { ...mixed.tags, ...tags } };
    expect(cleanup([host, sideRoad])).toEqual([host, sideRoad]);
  }
});

test('location 9 removes the actual trail nub and crossing overshoot, not Mockingbird connectors', () => {
  const snapshot = structuredClone(sourceWays);
  const result = removeTinyDeadEndNubs(sourceWays, realOptions);
  expect(result.some((w) => w.id === '1132401559')).toBe(false);
  const crossing = sourceWays.find((w) => w.id === '934470842');
  expect(result.find((w) => w.id === crossing.id)).toEqual({ ...crossing, points: crossing.points.slice(1) });
  expect(result.find((w) => w.id === '581790880')).toEqual(sourceWays.find((w) => w.id === '581790880'));
  for (const id of ['729929460', '267745787', '267745790', '450109915', '560993524', '562961427', '1468557345']) {
    expect(result.find((w) => w.id === id), id).toEqual(sourceWays.find((w) => w.id === id));
  }
  const mockingbird = sourceWays.filter((w) => w.tags.name === 'East Mockingbird Lane');
  expect(mockingbird.length).toBeGreaterThan(10);
  expect(result.filter((w) => w.tags.name === 'East Mockingbird Lane')).toEqual(mockingbird);
  expect(sourceWays).toEqual(snapshot);
  expect(removeTinyDeadEndNubs(result, realOptions)).toEqual(result);
});

test('location 9 partial thumbnails and acquisition edges protect otherwise removable geometry', () => {
  const candidate = sourceWays.find((w) => w.id === '1132401559');
  for (const option of ['visibleBounds', 'acquisitionBounds']) {
    const small = { ...bounds, maxX: candidate.points[0].x + 2 };
    const result = removeTinyDeadEndNubs(sourceWays, { ...realOptions, [option]: small });
    expect(result.find((w) => w.id === candidate.id)).toEqual(candidate);
  }
});

test('promotes a short big-small-big gap without changing continuous geometry or bike metadata', () => {
  const input = bracket();
  input[1].street = { name: 'Main Road' };
  const snapshot = structuredClone(input);
  const result = promoteShortDividedGaps(input);
  expect(result).toEqual([input[0], { ...input[1], divided: true }, input[2]]);
  expect(result[1].points).toBe(input[1].points);
  expect(result[1].street).toBe(input[1].street);
  expect(result[1].bike).toBe(true);
  expect(result[0].points.at(-1)).toEqual(result[1].points[0]);
  expect(result[1].points.at(-1)).toEqual(result[2].points[0]);
  expect(input).toEqual(snapshot);
  expect(promoteShortDividedGaps(result)).toEqual(result);
});

test('promotes split short chains in either order or direction but not partial brackets', () => {
  const [left, gap, right] = bracket();
  const a = { ...gap, id: 'a', points: [point(-10, 0), point(0, 0)] };
  const b = { ...gap, id: 'b', points: [point(0, 0), point(10, 0)], bike: false };
  for (const input of [[left, a, b, right], [right, { ...b, points: [...b.points].reverse() }, a, left]]) {
    const result = promoteShortDividedGaps(input);
    expect(result.every((w) => w.divided)).toBe(true);
    expect(result.map((w) => w.points)).toEqual(input.map((w) => w.points));
    expect(result.find((w) => w.id === 'b').bike).toBe(false);
  }
  expect(promoteShortDividedGaps([left, gap])).toEqual([left, gap]);
  expect(promoteShortDividedGaps([gap, right])).toEqual([gap, right]);
});

test('does not promote genuine long narrow portions or a long chain of short portions', () => {
  const left = road('left', [point(-100, 0), point(0, 0)], {}, { divided: true });
  const right = road('right', [point(60, 0), point(160, 0)], {}, { divided: true });
  const long = road('long', [point(0, 0), point(60, 0)]);
  const input = [left, long, right];
  expect(promoteShortDividedGaps(input, { maxGapLength: 1000 })).toEqual(input);
  const split = [left, road('a', [point(0, 0), point(30, 0)]), road('b', [point(30, 0), point(60, 0)]), right];
  expect(promoteShortDividedGaps(split)).toEqual(split);
  const forty = [left, road('gap', [point(0, 0), point(40, 0)]),
    road('right', [point(40, 0), point(140, 0)], {}, { divided: true })];
  expect(promoteShortDividedGaps(forty).every((w) => w.divided)).toBe(true);
});

test('excludes incompatible grade, names/classes, ramps, minor roads and roundabouts', () => {
  for (const tags of [{ layer: '1' }, { bridge: 'yes' }, { tunnel: 'yes' },
    { name: 'Different Road' }, { highway: 'tertiary' }, { highway: 'secondary_link' }, { junction: 'roundabout' }]) {
    const input = bracket();
    input[1] = { ...input[1], tags: { ...input[1].tags, ...tags } };
    expect(promoteShortDividedGaps(input)).toEqual(input);
  }
  for (const metadata of [{ minor: true }, { extraLight: true }]) {
    const input = bracket();
    input[1] = { ...input[1], ...metadata };
    expect(promoteShortDividedGaps(input)).toEqual(input);
  }
});

test('rejects curves, reversed approaches, parallel offsets and ambiguous brackets', () => {
  const cases = [];
  const curve = bracket(); curve[1].points = [point(-10, 0), point(0, 6), point(10, 0)]; cases.push(curve);
  const offset = bracket(); offset[1].points = [point(-10, 2), point(10, 2)]; cases.push(offset);
  const perpendicular = bracket(); perpendicular[0].points = [point(-10, -100), point(-10, 0)]; cases.push(perpendicular);
  const folded = bracket(); folded[0].points = [point(100, 0), point(-10, 0)]; cases.push(folded);
  const duplicate = bracket(); duplicate.push({ ...duplicate[0], id: 'duplicate' }); cases.push(duplicate);
  const fork = bracket(); fork.push(road('branch', [point(-10, 0), point(0, 10)])); cases.push(fork);
  const longFork = bracket(); longFork.push(road('branch', [point(0, 0), point(0, 100)])); cases.push(longFork);
  for (const input of cases) expect(promoteShortDividedGaps(input)).toEqual(input);
});

test('derives acquisition bounds from recorded evidence for all eighteen saved extracts', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));
  const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const data of [original, ...additional, ...fixtures]) {
    const project = (p) => point((p.lon - data.center.lon) * 111195 * Math.cos(data.center.lat * Math.PI / 180),
      -(p.lat - data.center.lat) * 111195);
    const derived = deriveRoadAcquisitionBounds(data, project);
    expect(derived, data.id).not.toBeNull();
    const query = data.bicycleAcquisition.queryBbox;
    const nw = project({ lat: query.north, lon: query.west });
    const se = project({ lat: query.south, lon: query.east });
    expect(derived.minX).toBeGreaterThanOrEqual(nw.x);
    expect(derived.minY).toBeGreaterThanOrEqual(nw.y);
    expect(derived.maxX).toBeLessThanOrEqual(se.x);
    expect(derived.maxY).toBeLessThanOrEqual(se.y);
  }
  const derived = deriveRoadAcquisitionBounds(fixture, project);
  const result = removeTinyDeadEndNubs(sourceWays, { ...realOptions, acquisitionBounds: derived });
  expect(result.some((w) => w.id === '1132401559')).toBe(false);
  expect(result.find((w) => w.id === '934470842').points).toEqual(sourceWays.find((w) => w.id === '934470842').points.slice(1));
});

test('uses final live bounds, centered coverage, and explicit compaction intersection', () => {
  const project = (p) => point(p.lon * 100, -p.lat * 100);
  const data = { center: { lat: 0, lon: 0 }, provenance: {
    coverageHalfExtentMeters: 200,
    acquisitions: [{ bounds: [[-0.1, -0.1, 0.1, 0.1]] }, { bounds: [[-1, -1, 1, 1]] }],
  } };
  expect(deriveRoadAcquisitionBounds(data, project)).toEqual({ minX: -100, minY: -100, maxX: 100, maxY: 100 });
  const coverageOnly = { center: { lat: 1, lon: 1 }, provenance: { coverageHalfExtentMeters: 50 } };
  expect(deriveRoadAcquisitionBounds(coverageOnly, project)).toEqual({ minX: 50, minY: -150, maxX: 150, maxY: -50 });
  const compacted = { ...data, compaction: { method: 'Retain ways intersecting square viewport plus padding',
    viewportHalfExtentMeters: 50, paddingMeters: 10 } };
  expect(deriveRoadAcquisitionBounds(compacted, project)).toEqual({ minX: -60, minY: -60, maxX: 60, maxY: 60 });
  const unknownAuxiliary = { ...data, bicycleAcquisition: { source: 'https://overpass-api.de/api/interpreter' } };
  expect(deriveRoadAcquisitionBounds(unknownAuxiliary, project)).toBeNull();
});

test('never infers acquisition coverage from full-way geometry or an unexplained radius', () => {
  const project = (p) => point(p.lon * 100, -p.lat * 100);
  const unknown = { center: { lat: 0, lon: 0 }, geometryRadiusMeters: 500,
    elements: [{ geometry: [{ lat: -1, lon: -1 }, { lat: 1, lon: 1 }] }] };
  expect(deriveRoadAcquisitionBounds(unknown, project)).toBeNull();
  const recorded = { ...unknown,
    source: 'https://www.openstreetmap.org/api/0.6/map?bbox=-0.5,-0.5,0.5,0.5' };
  expect(deriveRoadAcquisitionBounds(recorded, project)).toEqual({ minX: -50, minY: -50, maxX: 50, maxY: 50 });
  expect(deriveRoadAcquisitionBounds({ ...recorded, elements: [{ geometry: [{ lat: -89, lon: -179 }, { lat: 89, lon: 179 }] }] }, project))
    .toEqual(deriveRoadAcquisitionBounds(recorded, project));
  for (const source of ['https://www.openstreetmap.org/api/0.6/map?bbox=a,b,c,d',
    'https://www.openstreetmap.org/api/0.6/map?bbox=-1,,1,1',
    'https://www.openstreetmap.org/api/0.6/map?bbox=2,-1,-2,1',
    'https://example.com/api/0.6/map?bbox=-1,-1,1,1']) {
    expect(deriveRoadAcquisitionBounds({ source }, project)).toBeNull();
  }
  expect(deriveRoadAcquisitionBounds({ provenance: { acquisitions: [{ bounds: [[-1, 179, 1, 180], [-1, -180, 1, -179]] }] } }, project)).toBeNull();
  const ways = [trunk, nub];
  expect(cleanup(ways, { acquisitionBounds: deriveRoadAcquisitionBounds(unknown, project) })).toEqual(ways);
});

test('promotion integrates after consolidation and global transition collapse', () => {
  const tags = { oneway: 'yes' };
  const input = [
    road('a', [point(-100, -5), point(-10, -5)], tags),
    road('b', [point(-10, 5), point(-100, 5)], tags),
    road('gap', [point(-10, 0), point(10, 0)], {}, { bike: true }),
    road('c', [point(10, -5), point(100, -5)], tags),
    road('d', [point(100, 5), point(10, 5)], tags),
  ];
  const consolidated = collapseDividedTransitions(mergeDividedStreets(input));
  expect(consolidated.filter((w) => w.divided)).toHaveLength(2);
  const result = promoteShortDividedGaps(consolidated);
  expect(result.every((w) => w.divided)).toBe(true);
  expect(result.find((w) => w.id === 'gap').bike).toBe(true);
  expect(result.map((w) => w.points)).toEqual(consolidated.map((w) => w.points));
});
