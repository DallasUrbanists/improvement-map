import { test, expect } from '@playwright/test';
import { renderSourceTransit } from '../src/services/sourceRailRendering.js';

const geo = ([x, y]) => ({ lon: (x - 240) / 111195, lat: (240 - y) / 111195 });
const project = (p) => ({ x: p.lon * 111195, y: -p.lat * 111195 });
const screen = (p) => ({ x: p.x + 240, y: p.y + 240 });
const render = (segments) => renderSourceTransit({
  lines: [{ id: 'A', color: '#ff0000' }, { id: 'B', color: '#0000ff' }, { id: 'C', color: '#00aa00' }],
  segments: segments.map(([a, b, keys], i) => ({ id: String(i), geometry: [geo(a), geo(b)], keys })),
}, { lat: 0, lon: 0 }, 240, project, screen, 1);

test('preserves every source vertex along a curve without straightening or shortcuts', { tag: '@unit' }, () => {
  const points = [[40, 160], [70, 168], [100, 190], [130, 220], [160, 245], [190, 260], [220, 265]];
  const result = render(points.slice(1).map((point, i) => [points[i], point, ['A']]));
  expect(result.segments).toHaveLength(1);
  expect(result.segments[0].points).toHaveLength(points.length);
  for (const [i, point] of result.segments[0].points.entries()) {
    expect(point.x).toBeCloseTo(points[i][0], 8);
    expect(point.y).toBeCloseTo(points[i][1], 8);
  }
});

test('does not join unrelated endpoints even when they are only four meters apart', { tag: '@unit' }, () => {
  const result = render([[[40, 160], [120, 160], ['A']], [[124, 160], [200, 190], ['A']]]);
  expect(result.segments).toHaveLength(2);
  expect(result.segments[0].points.at(-1).x).toBeCloseTo(120, 8);
  expect(result.segments[1].points[0].x).toBeCloseTo(124, 8);
});

test('equivalent route variants keep all service lanes apart through their shared corridor', { tag: '@unit' }, () => {
  const result = render([
    [[40, 200], [120, 200], ['A', 'B', 'C']],
    [[120, 200], [200, 202], ['A', 'B']], [[200, 202], [280, 200], ['A', 'B']],
    [[120, 200], [280, 200], ['C']],
    [[280, 200], [400, 210], ['A', 'B', 'C']],
  ]);
  // A/B are one detailed shape, C is a nearly identical shortcut. Reuse the
  // detailed shape for both services rather than splitting and recentering lanes.
  expect(result.segments).toHaveLength(3);
  for (const segment of result.segments) {
    expect(segment.sourcePoints).toHaveLength(5);
    expect(segment.points).toHaveLength(5);
  }
  for (let i = 0; i < 5; i++) {
    const gap = Math.hypot(result.segments[0].points[i].x - result.segments[1].points[i].x,
      result.segments[0].points[i].y - result.segments[1].points[i].y);
    expect(gap).toBeGreaterThanOrEqual(5.49);
  }
});

test('matches same-color junction endpoints and retains geometry away from local transitions', { tag: '@unit' }, () => {
  const result = render([
    [[240, 240], [310, 240], ['A', 'B']], [[310, 240], [400, 260], ['A', 'B']],
    [[40, 120], [100, 150], ['A']], [[100, 150], [160, 210], ['A']], [[160, 210], [240, 240], ['A']],
    [[40, 360], [100, 330], ['B']], [[100, 330], [160, 270], ['B']], [[160, 270], [240, 240], ['B']],
  ]);
  for (const line of ['A', 'B']) {
    const segments = result.segments.filter((segment) => segment.line === line);
    expect(segments).toHaveLength(2);
    const a = segments[0].points; const b = segments[1].points;
    const gaps = [a[0], a.at(-1)].flatMap((first) => [b[0], b.at(-1)].map((last) => Math.hypot(first.x - last.x, first.y - last.y)));
    expect(Math.min(...gaps)).toBe(0);
    const branch = segments.find((segment) => segment.sourcePoints.length === 4);
    // The two upstream bends survive exactly; only the final 24px can change.
    for (const [x, y] of line === 'A' ? [[100, 150], [160, 210]] : [[100, 330], [160, 270]]) {
      expect(branch.points.some((p) => Math.hypot(p.x - x, p.y - y) < 1e-8)).toBe(true);
    }
  }
  expect(result.paths.some((path) => path.includes(' C'))).toBe(true);
});
