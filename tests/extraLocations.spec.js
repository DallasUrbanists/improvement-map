import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { generateLocationDiagram } from './railFixtures.js';

const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-locations-osm.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-location-boundaries.json', import.meta.url), 'utf8'));
const coordinates = [
  [32.83814506838985, -96.7731340047915],
  [33.001813110019896, -96.70296632362526],
  [32.95941194002825, -96.82840664037901],
  [32.955146925092116, -96.90811334087718],
  [32.98136101766843, -96.92593125735448],
  [32.77596198547017, -96.80706128199367],
  [32.758132552395956, -96.82213765879978],
  [32.74611472078265, -96.80361207513822],
  [32.789129903174846, -96.7932561403813],
  [32.76352725600037, -96.78637914756813],
];

test('all ten added coordinates have persistent attributed fixtures and valid local-rail diagrams', () => {
  expect(fixtures.map((data) => [data.center.lat, data.center.lon])).toEqual(coordinates);
  expect(fixtures.map((data) => data.id)).toEqual(coordinates.map((_, index) => `location-${index + 9}`));
  for (const data of fixtures) {
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

test('curved label anchors lie on their named rendered streets and closest labels stay in frame', () => {
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

test('all eighteen previews render offline and location 18 downloads as a standalone SVG', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const hostname = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort();
  });
  await page.goto('/test');
  await expect(page.getByTestId('additional-diagram-preview')).toHaveCount(17);
  for (const data of fixtures) {
    const card = page.getByTestId(`location-${data.id}`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('heading', { name: `Location ${Number(data.id.split('-')[1])}`, exact: true })).toBeVisible();
    const image = card.getByTestId('additional-diagram-preview');
    await expect.poll(() => image.evaluate((image) => image.complete && image.naturalWidth === 480 && image.naturalHeight === 480)).toBe(true);
    const bounds = await image.boundingBox();
    expect(bounds.width).toBeCloseTo(bounds.height, 0);
    await expect(card).toContainText(`${data.center.lat}, ${data.center.lon}`);
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download SVG for location 18', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('location-diagram-18.svg');
  const content = fs.readFileSync(await download.path(), 'utf8');
  expect(content).toContain('data-transit-line');
  expect(content).not.toContain('upload.wikimedia.org');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
