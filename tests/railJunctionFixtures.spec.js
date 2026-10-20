import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { applyRailJunctionFixtures } from '../src/services/railJunctionFixtures.js';
import { roundedRailPath } from '../src/services/locationDiagram.js';
import { generateLocationDiagram } from './railFixtures.js';

const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
const westEnd = additional.find((fixture) => fixture.id === 'west-end');
const trunkKeys = ['DART:GREEN', 'DART:ORANGE', 'DART:BLUE', 'DART:RED'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const vector = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1,
  (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y))))) * 180 / Math.PI;
const oriented = (points, trunk) => [trunk[0], trunk.at(-1)].some((p) => samePoint(points.at(-1), p))
  ? points : [...points].reverse();

function manualLanes({ factor = 1, reverseSecond = false, reverseAll = false, shift = 0 } = {}) {
  const joins = trunkKeys.map((_, i) => ({ x: 270, y: 160 + i * 5.5 }));
  const approaches = joins.map((p) => ({ x: p.x - 12, y: p.y }));
  const branchPoints = [
    [{ x: 90, y: -20 }, { x: 130, y: 120 }],
    [{ x: 84.5, y: -20 }, { x: 124.5, y: 125.5 }],
    [{ x: 150, y: 500 }, { x: 95, y: 390 }, { x: 100, y: 270 }, { x: 160, y: 195 }],
    [{ x: 155.5, y: 500 }, { x: 100.5, y: 390 }, { x: 105.5, y: 275.5 }, { x: 165.5, y: 200.5 }],
  ];
  const groups = [
    trunkKeys.map((key, i) => [key, [joins[i], { x: 500, y: joins[i].y }]]),
    trunkKeys.slice(0, 2).map((key, i) => [key, [...branchPoints[i], approaches[i], { ...joins[i] }]]),
    trunkKeys.slice(2).map((key, i) => [key, [...branchPoints[i + 2], approaches[i + 2], { ...joins[i + 2] }]]),
    [['TRE:TRE', [{ x: 65, y: -20 }, { x: 87, y: 86 }, { x: 67, y: 374 }, { x: 128, y: 500 }]]],
  ];
  return new Map(groups.map((entries, index) => {
    const reverse = reverseAll !== (index === 2 && reverseSecond);
    if (reverse && index !== 3) entries.reverse();
    const services = new Map(entries.map(([key, points]) => [key,
      (reverse ? [...points].reverse() : points).map((p) => ({
        x: 240 + (p.x - 240) * factor + shift, y: 240 + (p.y - 240) * factor - shift,
      }))]));
    const keys = [...services.keys()];
    return [{ keys, signature: keys.join('|') }, services];
  }));
}

function finalLanes(diagram) {
  const junction = diagram.railJunctions.find((junction) => junction.trunkOrder.length === 4
    && trunkKeys.every((key) => junction.trunkOrder.includes(key)));
  expect(junction).toBeTruthy();
  const remaining = [...diagram.railSegments];
  const groups = [junction.trunkOrder, ...junction.branchOrders];
  const lanes = new Map(groups.map((keys) => {
    const services = new Map(keys.map((key) => {
      // Renderer emits the trunk before its branches; never classify by vertex count.
      const index = remaining.findIndex((segment) => segment.line === key);
      expect(index, `Existing final lane ${key}`).toBeGreaterThanOrEqual(0);
      const [segment] = remaining.splice(index, 1);
      return [key, segment.points];
    }));
    return [{ keys, signature: keys.join('|') }, services];
  }));
  for (const segment of remaining) lanes.set({ keys: [segment.line] }, new Map([[segment.line, segment.points]]));
  return lanes;
}

function crosses(a, b, c, d) {
  const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < -1e-8 && side(c, d, a) * side(c, d, b) < -1e-8;
}

function verifyCurves(lanes, before = null, diagram = null) {
  const trunk = [...lanes.values()][0];
  for (const [chain, services] of lanes) {
    if (chain.keys.length !== 2) continue;
    for (const [key, native] of services) {
      const trunkPoints = trunk.get(key);
      const points = oriented(native, trunkPoints);
      const join = points.at(-1);
      const trunkEnd = samePoint(join, trunkPoints.at(-1));
      expect(join).toEqual(trunkEnd ? trunkPoints.at(-1) : trunkPoints[0]);
      const neighbor = trunkEnd ? trunkPoints.at(-2) : trunkPoints[1];
      const tangent = vector(join, neighbor);
      expect(angle(vector(points.at(-2), join), tangent)).toBeLessThan(0.00001);
      expect(points.length).toBeGreaterThan(15);
      const original = before ? oriented(before.get(chain).get(key), trunkPoints) : null;
      let start = points.length - 3;
      while (start > 0 && distance(points[start], points[start - 1]) <= 2.5) start--;
      if (original) start = original.length - 2;
      expect(start).toBeGreaterThan(0);
      expect(points.length - start).toBeGreaterThan(15);
      for (let i = start; i < points.length - 1; i++) {
        expect(angle(vector(points[i - 1], points[i]), vector(points[i], points[i + 1]))).toBeLessThan(5);
      }
      expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      expect(points.slice(1).every((p, i) => distance(p, points[i]) > 0.1)).toBe(true);
      const rendered = roundedRailPath(native, 12);
      expect(rendered).not.toMatch(/NaN|Infinity/);
      expect(rendered).toContain(' Q');
      if (diagram) expect(diagram.svg).toContain(`data-transit-line="${key}" d="${rendered}"`);
      // Normalize direction just for inspecting the terminal SVG approach tangent.
      const normalized = roundedRailPath(points, 12);
      const terminal = [...normalized.matchAll(/ L([\d.-]+),([\d.-]+)/g)].at(-1);
      expect(terminal.slice(1).map(Number)).toEqual([Number(join.x.toFixed(1)), Number(join.y.toFixed(1))]);
      const lastCurve = [...normalized.matchAll(/ Q[\d.-]+,[\d.-]+ ([\d.-]+),([\d.-]+)/g)].at(-1);
      expect(angle(vector({ x: Number(lastCurve[1]), y: Number(lastCurve[2]) },
        { x: Number(terminal[1]), y: Number(terminal[2]) }), tangent)).toBeLessThan(1);
    }
    const [a, b] = [...services.values()];
    for (let i = 1; i < a.length; i++) {
      for (let j = 1; j < b.length; j++) expect(crosses(a[i - 1], a[i], b[j - 1], b[j])).toBe(false);
    }
    const atEnd = samePoint(oriented(a, trunk.get([...services.keys()][0])).at(-1), a.at(-1));
    const first = atEnd ? a.length - 14 : 1;
    const last = atEnd ? a.length : 14;
    for (let i = first; i < last; i++) {
      const tangent = vector(a[i - 1], a[i]);
      const separation = vector(a[i], b[i]);
      expect(tangent.x * separation.y - tangent.y * separation.x).toBeGreaterThan(0);
    }
  }
}

function verifyPreservation(before, result) {
  expect(result).not.toBe(before);
  expect([...result.keys()]).toEqual([...before.keys()]);
  const trunk = [...before.values()][0];
  for (const [chain, services] of before) {
    const adjusted = result.get(chain);
    expect([...adjusted.keys()]).toEqual([...services.keys()]);
    expect(chain.keys).toEqual([...services.keys()]);
    if (chain.keys.length !== 2) {
      expect(adjusted).toBe(services);
      continue;
    }
    for (const [key, native] of services) {
      const old = oriented(native, trunk.get(key));
      const points = oriented(adjusted.get(key), trunk.get(key));
      expect(points.length).toBeGreaterThan(old.length);
      for (let i = 0; i < old.length - 2; i++) expect(points[i]).toBe(old[i]);
      expect(points.at(-2)).toBe(old.at(-2));
      expect(points.at(-1)).toBe(old.at(-1));
    }
  }
}

test('saved adjustment remains geographically scoped to location 2', { tag: '@unit' }, () => {
  const lanes = manualLanes();
  for (const center of [undefined, {}, { lat: NaN, lon: westEnd.center.lon },
    { ...westEnd.center, lat: westEnd.center.lat + 0.00001 },
    { ...westEnd.center, lon: westEnd.center.lon + 0.00001 },
    ...additional.filter((fixture) => fixture !== westEnd).map((fixture) => fixture.center)]) {
    expect(applyRailJunctionFixtures(lanes, center)).toBe(lanes);
  }
  expect(applyRailJunctionFixtures(lanes, westEnd.center)).not.toBe(lanes);
});

for (const [name, options] of [
  ['legacy three-street 368m viewport', {}],
  ['expanded four-street 484m viewport with RED/BLUE reversed', { factor: 368 / 484, reverseSecond: true }],
  ['smaller screen geometry with both chain directions reversed', { factor: 0.4, reverseSecond: true, reverseAll: true, shift: 200 }],
  ['larger translated screen geometry', { factor: 2, shift: -200 }],
]) {
  test(`${name} preserves endpoints, lane order and smooth tangents without mutation`, { tag: '@unit' }, () => {
    const lanes = manualLanes(options);
    const snapshot = JSON.stringify([...lanes].map(([chain, services]) => [chain, [...services]]));
    for (const services of lanes.values()) for (const points of services.values()) {
      points.forEach(Object.freeze);
      Object.freeze(points);
    }
    const result = applyRailJunctionFixtures(lanes, westEnd.center);
    verifyPreservation(lanes, result);
    verifyCurves(result, lanes);
    expect(JSON.stringify([...lanes].map(([chain, services]) => [chain, [...services]]))).toBe(snapshot);
    expect(applyRailJunctionFixtures(lanes, westEnd.center)).toEqual(result);
  });
}

test('current adaptive four-street renderer smooths both branch orientations and emits those curves', { tag: '@unit' }, () => {
  const diagram = generateLocationDiagram(westEnd, westEnd.center);
  expect(diagram.coverageMeters).toBeGreaterThan(368);
  expect(diagram.railJunctions).toContainEqual({ trunkOrder: trunkKeys,
    branchOrders: [['DART:GREEN', 'DART:ORANGE'], ['DART:RED', 'DART:BLUE']] });
  const lanes = finalLanes(diagram);
  verifyCurves(lanes, null, diagram);
  expect([...lanes.values()][0].get('DART:GREEN').length).toBeGreaterThan(2);
});

test('unrecognized, ambiguous or incomplete junction topology fails closed without partial changes', { tag: '@unit' }, () => {
  for (const modify of [
    (lanes) => lanes.delete([...lanes.keys()][2]),
    (lanes) => { [...lanes.values()][1].get('DART:GREEN').at(-1).x += 0.001; },
    (lanes) => {
      const branch = [...lanes.values()][1];
      const [approach, join] = branch.get('DART:GREEN').slice(-2);
      branch.set('DART:GREEN', [{ x: approach.x - 0.1, y: approach.y }, approach, join]);
    },
    (lanes) => { [...lanes.values()][0].set('OTHER:LINE', [{ x: 0, y: 0 }, { x: 1, y: 1 }]); },
    (lanes) => { [...lanes.values()][2].get('DART:BLUE')[1].x = NaN; },
    (lanes) => { const [chain, services] = [...lanes][1]; lanes.set({ ...chain }, services); },
    (lanes) => {
      const branch = [...lanes.values()][1];
      const points = branch.get('DART:GREEN');
      points.at(-2).y += 1;
    },
  ]) {
    const lanes = manualLanes();
    modify(lanes);
    expect(applyRailJunctionFixtures(lanes, westEnd.center)).toBe(lanes);
  }
});
