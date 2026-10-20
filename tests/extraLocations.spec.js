import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { generateMinimalLocationDiagram } from '../src/services/locationDiagramMinimal.js';
import { railCatalog } from './railFixtures.js';
import { generateLocationDiagram } from './railFixtures.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-locations-osm.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-location-boundaries.json', import.meta.url), 'utf8'));

test('offline fixtures have finite coordinates, attribution and valid local-rail diagrams', { tag: '@unit' }, () => {
  for (const data of fixtures) {
    expect(Number.isFinite(data.center.lat) && Number.isFinite(data.center.lon)).toBe(true);
    expect(data.source).toBeTruthy();
    expect(data.license).toBeTruthy();
    expect(data.elements.some((element) => element.tags.railway && !element.tags.highway)).toBe(false);
    const options = { ...data.center, administrativeBoundary: boundaries[data.id] };
    const diagram = generateLocationDiagram(data, options);
    expect(diagram.svg).toBe(generateLocationDiagram(data, options).svg);
    expect(diagram.svg).toContain('viewBox="0 0 480 480"');
    expect(diagram.svg).not.toMatch(/NaN|Infinity|<script|<foreignObject/);
    expect(diagram.streets.length).toBeGreaterThan(0);
    expect(diagram.railSegments.every((segment) => segment.points.length >= 2)).toBe(true);
    if (boundaries[data.id]?.verification?.contains) {
      expect(diagram.administrativeBoundary).toEqual(boundaries[data.id]);
    }
  }
});

test('curved label anchors lie on their named rendered streets and closest labels stay in frame', { tag: '@unit' }, () => {
  for (const data of fixtures) {
    const diagram = generateLocationDiagram(data, data.center);
    const paths = [...diagram.svg.matchAll(/<path data-street="([^"]+)" d="([^"]+)"/g)].map((match) => {
      let previous;
      const segments = [];
      for (const command of match[2].matchAll(/([MLQ])([\d., -]+)/g)) {
        const values = command[2].trim().split(/[ ,]+/).map(Number);
        const end = values.slice(-2);
        if (command[1] === 'L') segments.push([...previous, ...end]);
        if (command[1] === 'Q') {
          const start = previous;
          for (let step = 1; step <= 30; step++) {
            const t = step / 30;
            const point = [0, 1].map((axis) => (1 - t) ** 2 * start[axis]
              + 2 * (1 - t) * t * values[axis] + t ** 2 * end[axis]);
            segments.push([...previous, ...point]);
            previous = point;
          }
        }
        previous = end;
      }
      return { name: match[1].replaceAll('&amp;', '&'), segments };
    });
    expect(diagram.streetLabels.length, `No labels at ${data.id}`).toBeGreaterThan(0);
    for (const label of diagram.streetLabels) {
      expect(label.anchors.length).toBeGreaterThan(0);
      const segments = paths.filter((path) => path.name === label.name).flatMap((path) => path.segments);
      expect(segments.length).toBeGreaterThan(0);
      for (const { x, y } of label.anchors) {
        const distance = Math.min(...segments.map(([ax, ay, bx, by]) => {
          const dx = bx - ax; const dy = by - ay;
          const denominator = dx * dx + dy * dy;
          const t = denominator ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / denominator)) : 0;
          return Math.hypot(x - ax - dx * t, y - ay - dy * t);
        }));
        expect(distance, `Label must follow ${label.name} at ${data.id}`).toBeLessThan(0.2);
      }
      if (label.rank === 1) {
        expect(label.fullyInFrame).toBe(true);
        for (const box of label.glyphBoxes) {
          expect(box.x - box.width / 2).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width / 2).toBeLessThanOrEqual(480);
          expect(box.y - box.height / 2).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height / 2).toBeLessThanOrEqual(480);
        }
      }
    }
  }
});

test('both inserted locations have attributed offline geometry and support both renderers', { tag: '@unit' }, () => {
  for (const file of [
    'arts-district-test-location.json',
    'downtown-test-location.json',
  ]) {
    const { data, administrativeBoundary } = JSON.parse(fs.readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8'));
    const center = data.center;
    expect(Number.isFinite(center.lat) && Number.isFinite(center.lon)).toBe(true);
    expect(data.attribution).toContain('OpenStreetMap');
    expect(data.provenance.acquisitions.length).toBeGreaterThan(0);
    expect(data.elements.length).toBeGreaterThan(0);
    for (const render of [generateLocationDiagram, generateMinimalLocationDiagram]) {
      const result = render(data, { ...center, railCatalog, administrativeBoundary });
      expect(result.svg).not.toMatch(/NaN|Infinity/);
      // Field/Elm's rail corridor is outside Version Two's shorter viewport.
      if (render === generateMinimalLocationDiagram && file === 'downtown-test-location.json') {
        expect(result.transitLines).toEqual([]);
      } else {
        expect(result.transitLines.length).toBeGreaterThan(0);
      }
    }
  }
});

test('every gallery fixture renders deterministically with both supported renderers', { tag: '@unit' }, () => {
  const original = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));
  const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const data of [original, ...additional, ...fixtures]) {
    for (const render of [generateLocationDiagram, generateMinimalLocationDiagram]) {
      const options = { ...data.center, railCatalog };
      const result = render(data, options);
      expect(result.svg, data.id).not.toMatch(/NaN|Infinity|<script|<foreignObject/);
      expect(result.svg).toContain('OpenStreetMap');
      expect(result.svg).toBe(render(data, options).svg);
      expect(result.streets.length).toBeGreaterThan(0);
    }
  }
});
