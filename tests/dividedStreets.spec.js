import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { mergeDividedStreets, collapseDividedTransitions } from '../src/services/dividedStreets.js';
import { generateLocationDiagram } from './railFixtures.js';

const way = (id, points, tags = {}, extra = {}) => ({ id, points, tags: { name: 'Boulevard', highway: 'primary', ...tags },
  minor: false, bike: false, labelEligible: true, ...extra });
const first = way(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }], { oneway: 'yes' });
const second = way(2, [{ x: 100, y: 10 }, { x: 0, y: 10 }], { oneway: 'yes' });

const fixtures = [...JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url))),
  ...JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-locations-osm.json', import.meta.url)))];

test('opposite carriageways become one centered path, preserving protected bike metadata', () => {
  const result = mergeDividedStreets([first, { ...second, bike: true }]);
  expect(result).toHaveLength(1);
  expect(result[0].divided).toBe(true);
  expect(result[0].bike).toBe(true);
  expect(result[0].points).toEqual([{ x: 0, y: 5 }, { x: 100, y: 5 }]);
  expect(mergeDividedStreets([second, first])[0].points).toEqual(result[0].points);
  const reversed = [first, second].map((entry) => ({ ...entry, points: [...entry.points].reverse(), tags: { ...entry.tags, oneway: '-1' } }));
  expect(mergeDividedStreets(reversed)[0].points).toEqual(result[0].points);
});

test('partial overlaps merge only their shared extent and connect ordinary tails', () => {
  const short = { ...second, points: [{ x: 80, y: 10 }, { x: 20, y: 10 }] };
  const result = mergeDividedStreets([first, short]);
  expect(result.find((entry) => entry.divided).points).toEqual([{ x: 20, y: 5 }, { x: 80, y: 5 }]);
  expect(result.filter((entry) => !entry.divided).map((entry) => entry.points)).toEqual([
    [{ x: 0, y: 0 }, { x: 20, y: 5 }], [{ x: 80, y: 5 }, { x: 100, y: 0 }],
  ]);
});

test('curved and fragmented carriageways form a continuous centered polyline', () => {
  const a = way(1, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 10 }]);
  const b = way(2, [{ x: 0, y: 10 }, { x: 50, y: 10 }]);
  const c = way(3, [{ x: 50, y: 10 }, { x: 100, y: 20 }]);
  const result = mergeDividedStreets([a, b, c]);
  const centered = result.filter((entry) => entry.divided);
  expect(centered).toHaveLength(1);
  expect(centered[0].points.length).toBeGreaterThan(2);
  expect(centered[0].points[0]).toEqual({ x: 0, y: 5 });
  expect(centered[0].points.at(-1).y).toBeGreaterThan(14);
});

test('unrelated, crossing, distant, same-direction, minor, and grade-separated roads stay separate', () => {
  for (const other of [
    { ...second, tags: { ...second.tags, name: 'Other Road' } },
    { ...second, tags: { ...second.tags, highway: 'secondary' } },
    { ...second, tags: { ...second.tags, layer: '1', bridge: 'yes' } },
    { ...second, tags: { ...second.tags, tunnel: 'yes' } },
    { ...second, tags: { ...second.tags, junction: 'roundabout' } },
    { ...second, tags: { ...second.tags, oneway: 'no' } },
    { ...second, minor: true },
    { ...second, points: [...second.points].reverse() },
    { ...second, points: [{ x: 100, y: 50 }, { x: 0, y: 50 }] },
    { ...second, points: [{ x: 50, y: -50 }, { x: 50, y: 50 }] },
  ]) expect(mergeDividedStreets([first, other])).toEqual([first, other]);
});

test('geometric inference supports older extracts without directional tags', () => {
  const ways = [first, second].map((entry) => ({ ...entry, tags: { name: 'Boulevard', highway: 'primary' } }));
  expect(mergeDividedStreets(ways)).toHaveLength(1);
  expect(mergeDividedStreets(ways)[0].divided).toBe(true);
});

test('triangular transition fans collapse to the crossing median and preserve connected endpoints', () => {
  const median = way(1, [{ x: 0, y: 0 }, { x: 100, y: 0 }], {}, { divided: true });
  const a = way(2, [{ x: 0, y: 0 }, { x: -10, y: -5 }], {}, { transitionTail: true });
  const b = way(3, [{ x: 0, y: 0 }, { x: -10, y: 5 }], {}, { transitionTail: true });
  const base = way(4, [{ x: -10, y: -5 }, { x: -10, y: 5 }], { name: 'Cross Street' });
  const crossing = way(5, [{ x: -15, y: -30 }, { x: -15, y: -10 }], { name: 'Cross Street' }, { divided: true });
  const connected = way(6, [{ x: -10, y: 5 }, { x: -15, y: 10 }], { name: 'Cross Street' });
  const input = [median, a, b, base, crossing, connected];
  const snapshot = structuredClone(input);
  const result = collapseDividedTransitions(input);
  expect(result).toHaveLength(4);
  expect(result.find((entry) => entry.id === 2).points).toEqual([{ x: 0, y: 0 }, { x: -15, y: 0 }]);
  expect(result.find((entry) => entry.id === 6).points[0]).toEqual({ x: -15, y: 0 });
  expect(result.find((entry) => entry.id === 1)).toEqual(median);
  expect(input).toEqual(snapshot);
  for (const altered of [{ ...base, tags: { ...base.tags, layer: '1' } }, { ...base, minor: true }, { ...base, bike: true }]) {
    expect(collapseDividedTransitions([median, a, b, altered])).toEqual([median, a, b, altered]);
  }
});

test('outer tips between aligned median endpoints move onto the centerline without removing branches', () => {
  const a = way(1, [{ x: -8, y: 0 }, { x: 0, y: -10 }], {}, { transitionTail: true });
  const b = way(2, [{ x: -8, y: 0 }, { x: 0, y: 10 }], {}, { transitionTail: true });
  const top = way(3, [{ x: 0, y: -100 }, { x: 0, y: -10 }], {}, { divided: true });
  const bottom = way(4, [{ x: 0, y: 10 }, { x: 0, y: 100 }], {}, { divided: true });
  const result = collapseDividedTransitions([a, b, top, bottom]);
  expect(result).toHaveLength(4);
  expect(result[0].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: -10 }]);
  expect(result[1].points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 10 }]);
  expect(collapseDividedTransitions([{ ...a, transitionTail: false }, { ...b, transitionTail: false }, top, bottom]))
    .toEqual([{ ...a, transitionTail: false }, { ...b, transitionTail: false }, top, bottom]);
});

test('short median-gap connectors center without flattening long loops or bike connectors', () => {
  const top = way(1, [{ x: 0, y: -100 }, { x: 0, y: -10 }], {}, { divided: true });
  const bottom = way(2, [{ x: 0, y: 10 }, { x: 0, y: 100 }], {}, { divided: true });
  const connector = way(3, [{ x: 8, y: -10 }, { x: 8, y: 10 }]);
  expect(collapseDividedTransitions([top, bottom, connector])[2].points).toEqual([{ x: 0, y: -10 }, { x: 0, y: 10 }]);
  for (const excluded of [{ ...connector, bike: true }, { ...connector, minor: true },
    { ...connector, points: [{ x: 8, y: -10 }, { x: 100, y: -10 }, { x: 100, y: 10 }, { x: 8, y: 10 }] }]) {
    expect(collapseDividedTransitions([top, bottom, excluded])).toEqual([top, bottom, excluded]);
  }
});

test('Colorado and Beckley no longer retain the spread transition corners', () => {
  const fixture = fixtures.find((entry) => entry.id === 'location-15');
  const project = (point) => ({ x: (point.lon - fixture.center.lon) * 111195 * Math.cos(fixture.center.lat * Math.PI / 180),
    y: -(point.lat - fixture.center.lat) * 111195 });
  const groups = ['East Colorado Boulevard', 'North Beckley Avenue'].map((name) => fixture.elements
    .filter((entry) => entry.tags?.name === name).map((entry) => way(entry.id, entry.geometry.map(project), entry.tags)));
  const before = groups.flatMap(mergeDividedStreets);
  const after = collapseDividedTransitions(before);
  expect(after.length).toBeLessThan(before.length);
  expect(after.some((entry) => entry.id === '1030046288')).toBe(false);
  const spreadCorners = fixture.elements.find((entry) => entry.id === '1030046288').geometry.map(project);
  for (const corner of [spreadCorners[0], spreadCorners.at(-1)]) {
    expect(after.some((entry) => entry.points.some((point) => Math.hypot(point.x - corner.x, point.y - corner.y) < 0.1))).toBe(false);
  }
  const diagram = generateLocationDiagram(fixture, fixture.center);
  expect(diagram.svg).not.toMatch(/NaN|Infinity/);
  expect(diagram.svg).toBe(generateLocationDiagram(fixture, fixture.center).svg);
  const scale = 480 / (2 * Math.max(120, diagram.streets.at(-1).distance * 1.65));
  const renderedPoints = [...diagram.svg.matchAll(/<path data-street="(?:East Colorado Boulevard|North Beckley Avenue)" d="([^"]+)"/g)]
    .flatMap((path) => [...path[1].matchAll(/([\d.-]+),([\d.-]+)/g)].map((point) => ({ x: +point[1], y: +point[2] })));
  for (const corner of [spreadCorners[0], spreadCorners.at(-1)]) {
    const screen = { x: 240 + corner.x * scale, y: 240 + corner.y * scale };
    expect(renderedPoints.some((point) => Math.hypot(point.x - screen.x, point.y - screen.y) < 0.15)).toBe(false);
  }
});

test('requested real-world examples render thick merged roads and retain their street selection', () => {
  const examples = [
    ['medical-district', ['Harry Hines Boulevard', 'Market Center Boulevard']],
    ['bachman', ['Harry Hines Boulevard']],
    ['location-15', ['East Colorado Boulevard']],
    ['location-17', ['Routh Street']],
  ];
  for (const [id, names] of examples) {
    const fixture = fixtures.find((entry) => entry.id === id);
    const diagram = generateLocationDiagram(fixture, fixture.center);
    const layer = diagram.svg.match(/<g data-layer="divided-streets"[^>]*>(.*?)<\/g>/)[0];
    expect(layer).toContain('stroke-width="7"');
    for (const name of names) expect(layer).toContain(`data-street="${name}"`);
    expect(diagram.svg).not.toMatch(/NaN|Infinity/);
    expect(diagram.svg).toBe(generateLocationDiagram(fixture, fixture.center).svg);
  }
});
