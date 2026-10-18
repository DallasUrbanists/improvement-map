import { test, expect } from '@playwright/test';
import { createSimpleTransitStops, snapRailStopsToPaths, placeRailStopLabels } from '../src/services/simpleTransitStops.js';

test('keeps nearby and coincident bus and rail source stops separate and at their actual positions', () => {
  const transitStops = [
    { type: 'node', id: 1, lat: 1, lon: 2, tags: { name: 'Bus A', highway: 'bus_stop' } },
    { type: 'node', id: 2, lat: 1, lon: 2.01, tags: { name: 'Bus B', highway: 'bus_stop' } },
    { type: 'node', id: 3, lat: 1, lon: 2, tags: { name: 'Rail A', railway: 'stop' } },
    { type: 'node', id: 4, lat: 1, lon: 2.01, tags: { name: 'Rail B', railway: 'stop' } },
  ];
  const catalog = { stops: [
    { id: 'geojson:3', lat: 1, lon: 2, name: 'Catalog Rail A' },
    { id: 'geojson:4', lat: 1, lon: 2.01, name: 'Catalog Rail B' },
  ] };
  const result = createSimpleTransitStops({ transitStops }, (p) => ({ x: p.lon * 100, y: p.lat * 100 }), 480, catalog);
  expect(result).toHaveLength(4);
  expect(result.map((stop) => stop.mode)).toEqual(['bus', 'bus', 'rail', 'rail']);
  for (const [i, stop] of result.entries()) {
    expect(stop.x).toBe(transitStops[i].lon * 100);
    expect(stop.y).toBe(transitStops[i].lat * 100);
    expect(stop.stopX).toBe(stop.x); expect(stop.stopY).toBe(stop.y);
  }
  expect(result[2].radius).toBe(result[0].radius * 1.5);
  expect(result.map((stop) => stop.source)).toEqual(['osm', 'osm', 'geojson', 'geojson']);
  expect(result[2].name).toBe('Catalog Rail A');
});

test('snaps a station to its matching source rail, not a closer unrelated or offset colored line', () => {
  const station = { id: 'station', mode: 'rail', x: 50, y: 60, lines: ['A'] };
  const bus = { id: 'bus', mode: 'bus', x: 20, y: 30 };
  const result = snapRailStopsToPaths([station, bus], [
    { line: 'A', sourcePoints: [{ x: 0, y: 100 }, { x: 100, y: 100 }], points: [{ x: 0, y: 90 }, { x: 100, y: 90 }] },
    { line: 'B', sourcePoints: [{ x: 0, y: 60 }, { x: 100, y: 60 }] },
  ]);
  expect(result[0]).toMatchObject({ x: 50, y: 100, sourceX: 50, sourceY: 60 });
  expect(result[1]).toEqual(bus);
  expect(station.y).toBe(60);
  expect(snapRailStopsToPaths([station], [])).toEqual([]);
});

test('streetcar stops keep small R icons and are exempt from station labels', () => {
  const result = createSimpleTransitStops({ transitStops: [] }, (point) => ({ x: point.lon, y: point.lat }), 480, {
    lines: [{ id: 'TROLLEY', mode: 'streetcar' }, { id: 'TRAIN', mode: 'rail' }],
    stops: [
      { id: 'streetcar', name: 'Trolley stop', lat: 100, lon: 100, lines: ['TROLLEY'] },
      { id: 'rail', name: 'Train station', lat: 150, lon: 150, lines: ['TRAIN'] },
    ],
  });
  expect(result[0]).toMatchObject({ radius: 7, labelRequired: false, mode: 'rail' });
  expect(result[1]).toMatchObject({ radius: 10.5, labelRequired: true });
  expect(placeRailStopLabels(result).map((label) => label.stopId)).toEqual(['rail']);
});

test('excludes OSM rail platforms and catalog stops outside the frame without falling back to OSM', () => {
  const result = createSimpleTransitStops({
    transitStops: [
      { type: 'way', id: 7, lat: 1, lon: 2, tags: { public_transport: 'platform' } },
      { type: 'node', id: 8, lat: 1, lon: 6, tags: { highway: 'bus_stop' } },
    ],
    transitRoutes: [{ tags: { route: 'light_rail' }, members: [{ type: 'way', ref: 7 }] }],
  }, (p) => ({ x: p.lon * 100, y: p.lat * 100 }));
  expect(result).toHaveLength(0);
});

test('each fixed rail marker gets its own nearby name and leader ending on the circle edge', () => {
  const stops = [
    { id: 'geojson:1', mode: 'rail', name: 'WEST END STATION', x: 220, y: 150, radius: 9 },
    { id: 'geojson:2', mode: 'rail', name: 'AKARD STATION', x: 260, y: 160, radius: 9 },
    { id: 'osm:3', mode: 'bus', name: 'Elm', x: 200, y: 250, radius: 7 },
  ];
  const before = structuredClone(stops);
  const labels = placeRailStopLabels(stops);
  expect(stops).toEqual(before);
  expect(labels).toHaveLength(2);
  for (const [i, label] of labels.entries()) {
    expect(label.stopId).toBe(stops[i].id);
    expect(Math.hypot(label.from.x - stops[i].x, label.from.y - stops[i].y)).toBeCloseTo(9, 8);
    expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width / 2).toBeLessThanOrEqual(480);
  }
});

test('labels prefer clear positions but allow overlaps on a crowded canvas while leaders stay straight', () => {
  const stops = [
    { id: 'A', mode: 'rail', name: 'FIRST STATION', x: 140, y: 180, radius: 10.5 },
    { id: 'B', mode: 'rail', name: 'SECOND STATION', x: 320, y: 180, radius: 10.5 },
  ];
  const protectedBoxes = [
    { x: 155, y: 180, width: 8, height: 90 },
    { x: 240, y: 240, width: 65, height: 65 },
    { x: 310, y: 310, width: 100, height: 22 },
  ];
  const labels = placeRailStopLabels(stops, protectedBoxes);
  expect(labels).toHaveLength(2);
  const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2
    && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
  for (const label of labels) {
    expect(label.leaderPoints).toHaveLength(2);
    for (const box of [...protectedBoxes, ...labels.filter((other) => other !== label)]) {
      expect(overlaps(label, box)).toBe(false);
    }
  }
  expect(placeRailStopLabels(stops, [{ x: 240, y: 240, width: 480, height: 480 }])).toHaveLength(2);
});
