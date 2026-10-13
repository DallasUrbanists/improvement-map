import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createStreetLabel, roundedStreetLabelPath } from '../src/services/streetLabels.js';
import { roundedRailPath, generateLocationDiagram } from '../src/services/locationDiagram.js';

const line = (a, b) => [a, b];
const horizontal = line({ x: -80, y: 150 }, { x: 560, y: 150 });
const curve = [{ x: -80, y: 170 }, { x: 70, y: 150 }, { x: 140, y: 160 },
  { x: 210, y: 185 }, { x: 290, y: 220 }, { x: 370, y: 240 }, { x: 560, y: 260 }];
const crosshair = { x: 240, y: 240, width: 65, height: 65 };
const input = (overrides = {}) => ({ name: 'Market Center Boulevard', text: 'Market Center Blvd', rank: 1,
  polylines: [horizontal], occupied: [crosshair], ...overrides });
const limits = (box) => ({ left: box.x - box.width / 2, right: box.x + box.width / 2,
  top: box.y - box.height / 2, bottom: box.y + box.height / 2 });
const renderedPoints = (d) => {
  const commands = [...d.matchAll(/([MLQ])([\d., -]+)/g)].map((match) => ({ type: match[1], values: match[2].trim().split(/[ ,]+/).map(Number) }));
  return [commands[0], ...commands.filter((command) => command.type === 'Q'), commands.at(-1)]
    .map((command) => ({ x: command.values[0], y: command.values[1] }));
};
const overlaps = (a, b) => {
  const x = limits(a); const y = limits(b);
  return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
};
const svgFor = (labels, roads = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><defs>${labels.map((label) => label.defs).join('')}</defs><rect width="480" height="480" fill="white"/>${roads}<g text-anchor="middle" dominant-baseline="central">${labels.map((label) => label.markup).join('')}</g></svg>`;

async function raster(page, svg) {
  return page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 480;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 480, 480).data;
    const points = [];
    for (let y = 0; y < 480; y++) for (let x = 0; x < 480; x++) {
      const i = (y * 480 + x) * 4;
      if (pixels[i] < 90 && pixels[i + 1] < 90 && pixels[i + 2] < 90 && pixels[i + 3] > 100) points.push({ x, y });
    }
    return { count: points.length, left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
      top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)), points };
  }, svg);
}

test('rounded label geometry matches the actual renderer, including duplicate vertices', () => {
  for (const points of [horizontal, curve, [{ x: 50, y: 100 }, { x: 50, y: 100 }, { x: 100, y: 130 }, { x: 300, y: 80 }]]) {
    expect(roundedStreetLabelPath(points)).toBe(roundedRailPath(points, 5));
  }
});

test('placement is deterministic, immutable, self-contained and fully titled', () => {
  const options = input();
  const original = structuredClone(options);
  const result = createStreetLabel(options);
  expect(result).toEqual(createStreetLabel(options));
  expect(options).toEqual(original);
  expect(result.diagnostics.placed).toBe(true);
  expect(result.markup).toContain('<title>Market Center Boulevard</title>');
  expect(result.markup).toContain('<textPath href="#');
  expect(result.markup).toContain('>Market Center Blvd</textPath>');
  expect(result.defs).toContain(`id="${result.diagnostics.pathId}"`);
  expect(result.markup + result.defs).not.toMatch(/<script|onload=|https?:|<foreignObject/);
  expect(result.occupied.length).toBeGreaterThan(options.occupied.length);
  expect(result.anchors.length).toBeGreaterThan(20);
  expect(new Set([1, 2, 3, 4].map((rank) => createStreetLabel(input({ rank })).diagnostics.pathId)).size).toBe(4);
  const escaped = createStreetLabel(input({ name: 'A & <Road> "Title"', text: 'A & <Road>' }));
  expect(escaped.markup).toContain('<title>A &amp; &lt;Road&gt; &quot;Title&quot;</title>');
});

test('gray halo is the default and a safe color override preserves all layout geometry', () => {
  const gray = createStreetLabel(input());
  expect(gray.markup).toContain('stroke="#f5f5f5" stroke-width="5"');
  for (const haloColor of ['#fff', '#ababab', '#FFF']) {
    const custom = createStreetLabel(input({ haloColor }));
    expect(custom.markup).toContain(`stroke="${haloColor}" stroke-width="5"`);
    expect(custom.defs).toBe(gray.defs);
    expect(custom.occupied).toEqual(gray.occupied);
    expect(custom.anchors).toEqual(gray.anchors);
    expect(custom.diagnostics).toEqual(gray.diagnostics);
  }
  for (const haloColor of [null, '', 'url(https://example.com/paint)', '#fff" onload="bad', '#12345']) {
    expect(createStreetLabel(input({ haloColor })).diagnostics.reason).toBe('invalid-options');
  }
});

test('rank one reserves every glyph envelope, including halo, inside all frame margins', () => {
  for (const polylines of [[horizontal], [curve], [line({ x: 80, y: -50 }, { x: 350, y: 520 })],
    [line({ x: 150, y: 540 }, { x: 150, y: -60 })]]) {
    const result = createStreetLabel(input({ polylines, occupied: [] }));
    expect(result.diagnostics.placed).toBe(true);
    expect(result.diagnostics.fullyInFrame).toBe(true);
    expect(result.diagnostics.clipped).toBe(false);
    for (const box of result.diagnostics.glyphBoxes) {
      const bound = limits(box);
      expect(bound.left).toBeGreaterThanOrEqual(12);
      expect(bound.right).toBeLessThanOrEqual(468);
      expect(bound.top).toBeGreaterThanOrEqual(35);
      expect(bound.bottom).toBeLessThanOrEqual(426);
    }
  }
  expect(createStreetLabel(input({ polylines: [line({ x: -100, y: 45 }, { x: 600, y: 45 })] })).markup).toBe('');
});

test('secondary ranks prefer partial clipping to omission but require a majority visible', () => {
  const points = line({ x: -100, y: 110 }, { x: 140, y: 110 });
  expect(createStreetLabel(input({ polylines: [points] })).markup).toBe('');
  for (const rank of [2, 3, 4]) {
    const result = createStreetLabel(input({ rank, polylines: [points], occupied: [] }));
    expect(result.diagnostics.placed).toBe(true);
    expect(result.diagnostics.fullyInFrame).toBe(false);
    expect(result.diagnostics.clipped).toBe(true);
    expect(result.diagnostics.visibleFraction).toBeGreaterThanOrEqual(0.65);
  }
  const mostlyOutside = line({ x: -230, y: 110 }, { x: 25, y: 110 });
  expect(createStreetLabel(input({ rank: 2, polylines: [mostlyOutside] })).markup).toBe('');
});

test('full secondary placements outrank clipped placements and preserve rank/index conventions', () => {
  const clipped = line({ x: -100, y: 110 }, { x: 100, y: 110 });
  const result = createStreetLabel(input({ rank: undefined, index: 1, polylines: [clipped, horizontal] }));
  expect(result.diagnostics.rank).toBe(2);
  expect(result.diagnostics.pathIndex).toBe(1);
  expect(result.diagnostics.fullyInFrame).toBe(true);
});

test('curved labels avoid the crosshair, transit badges and previously placed text', () => {
  const badge = { x: 80, y: 159, width: 60, height: 40 };
  const obstacles = [crosshair, badge];
  const first = createStreetLabel(input({ text: 'Market Blvd', polylines: [curve], occupied: obstacles }));
  expect(first.diagnostics.placed).toBe(true);
  for (const box of first.diagnostics.glyphBoxes) for (const obstacle of obstacles) expect(overlaps(box, obstacle)).toBe(false);
  const second = createStreetLabel(input({ name: 'Second Avenue', text: 'Second Ave', rank: 2,
    polylines: [curve, line({ x: -40, y: 330 }, { x: 540, y: 330 })], occupied: first.occupied }));
  expect(second.diagnostics.placed).toBe(true);
  for (const box of second.diagnostics.glyphBoxes) for (const obstacle of first.occupied) expect(overlaps(box, obstacle)).toBe(false);
  const blocked = createStreetLabel(input({ occupied: [{ x: 240, y: 240, width: 1000, height: 1000 }] }));
  expect(blocked.diagnostics.reason).toBe('no-clear-span');
});

test('right-to-left source paths are exactly reversed, remain on the curve, and read upright', () => {
  const result = createStreetLabel(input({ polylines: [[...curve].reverse()], occupied: [] }));
  expect(result.diagnostics.placed).toBe(true);
  expect(result.diagnostics.reversed).toBe(true);
  expect(result.diagnostics.d).toBe(roundedStreetLabelPath(curve));
  expect(result.anchors.every((anchor) => Math.abs(anchor.angle) <= Math.PI / 2 + 0.025)).toBe(true);
  expect(result.diagnostics.curvature).toBeGreaterThan(0.1);
});

test('tiny, disconnected, invalid and ineligible paths and unsupported names are omitted safely', () => {
  for (const polylines of [[], [[]], [[{ x: 20, y: 20 }]], [line({ x: 50, y: 100 }, { x: 80, y: 100 })],
    [line({ x: NaN, y: 100 }, { x: 400, y: 100 })], [horizontal.map((point) => ({ ...point, x: Infinity }))],
    [{ points: horizontal, labelEligible: false }],
    [line({ x: 20, y: 150 }, { x: 110, y: 150 }), line({ x: 200, y: 150 }, { x: 290, y: 150 })]]) {
    const result = createStreetLabel(input({ polylines }));
    expect(result.markup).toBe('');
    expect(result.defs).toBe('');
    expect(result.anchors).toEqual([]);
    expect(result.occupied).toEqual([crosshair]);
  }
  for (const text of ['', '  ', '東京', 'Name\nStreet', 'A'.repeat(101)]) {
    expect(createStreetLabel(input({ text })).diagnostics.reason).toBe('unsupported-name');
  }
  for (const options of [{ rank: 0 }, { rank: 5 }, { size: NaN }, { minVisible: 0.1 }, { radius: -1 },
    { margins: { top: NaN } }, { margins: { left: 600 } }, { polylines: null }, { occupied: null }]) {
    expect(createStreetLabel(input(options)).diagnostics.reason).toBe('invalid-options');
  }
});

test('four ranked labels expose non-vacuous layout diagnostics and distinct SVG hooks', async ({ page }) => {
  let occupied = [crosshair];
  const results = [90, 150, 330, 390].map((y, index) => {
    const result = createStreetLabel(input({ name: `Street ${index + 1}`, text: `Street ${index + 1}`, index, rank: undefined,
      polylines: [line({ x: -40, y }, { x: 540, y })], occupied }));
    occupied = result.occupied;
    return result;
  });
  expect(results.filter((result) => result.diagnostics.placed)).toHaveLength(4);
  await page.setContent(svgFor(results));
  await expect(page.locator('[data-street-label]')).toHaveCount(4);
  for (const [index, result] of results.entries()) {
    const label = page.locator(`[data-label-rank="${index + 1}"]`);
    await expect(label).toHaveAttribute('data-label-text', result.diagnostics.text);
    await expect(label).toHaveAttribute('data-label-path', result.diagnostics.pathId);
    await expect(label).toHaveAttribute('data-label-fully-in-frame', 'true');
    await expect(label).toHaveAttribute('data-label-clipped', 'false');
    expect(result.diagnostics.anchors).toEqual(result.anchors);
    expect(result.diagnostics.supportingPaths[0].d).toBe(roundedRailPath(result.diagnostics.supportingPaths[0].points, 5));
    expect(result.diagnostics.pathPoints.length).toBeGreaterThan(10);
  }
});

test('touching short fragments join their exact rendered curves without bridging disconnected streets', () => {
  const pieces = [[{ x: 30, y: 150 }, { x: 130, y: 150 }],
    [{ x: 130, y: 150 }, { x: 180, y: 150 }, { x: 230, y: 160 }],
    [{ x: 230, y: 160 }, { x: 300, y: 180 }, { x: 390, y: 190 }]];
  const result = createStreetLabel(input({ polylines: pieces, occupied: [] }));
  expect(result.diagnostics.placed).toBe(true);
  expect(result.diagnostics.supportingPaths).toHaveLength(3);
  expect(result.diagnostics.d).toContain('Q');
  for (const supporting of result.diagnostics.supportingPaths) {
    expect(supporting.d).toBe(roundedRailPath(supporting.points, 5));
  }
  expect(result.diagnostics.curvature).toBeGreaterThan(0.1);
});

test('sharp hairpins cannot make text reverse direction mid-label', () => {
  const result = createStreetLabel(input({ text: 'Long Hairpin Boulevard', occupied: [],
    polylines: [[{ x: 100, y: 140 }, { x: 240, y: 140 }, { x: 100, y: 155 }]] }));
  expect(result.markup).toBe('');
});

test('browser glyph extents and raster keep the complete closest label inside the frame', async ({ page }) => {
  for (const polylines of [[curve], [line({ x: 70, y: 540 }, { x: 370, y: -80 })],
    [line({ x: 140, y: 540 }, { x: 140, y: -80 })]]) {
    const result = createStreetLabel(input({ polylines, occupied: [] }));
    expect(result.diagnostics.placed).toBe(true);
    const svg = svgFor([result]);
    await page.setContent(svg);
    const glyphs = await page.locator('text').evaluate((text) => Array.from({ length: text.getNumberOfChars() }, (_, i) => {
      const box = text.getExtentOfChar(i);
      return { x: box.x, y: box.y, width: box.width, height: box.height, rotation: text.getRotationOfChar(i) };
    }));
    expect(glyphs).toHaveLength('Market Center Blvd'.length);
    for (const box of glyphs) {
      expect(box.x - 2.5).toBeGreaterThanOrEqual(12);
      expect(box.x + box.width + 2.5).toBeLessThanOrEqual(468);
      expect(box.y - 2.5).toBeGreaterThanOrEqual(35);
      expect(box.y + box.height + 2.5).toBeLessThanOrEqual(426);
      expect(Math.abs(box.rotation)).toBeLessThanOrEqual(91.5);
    }
    const ink = await raster(page, svg);
    expect(ink.count).toBeGreaterThan(350);
    expect(ink.left).toBeGreaterThanOrEqual(12);
    expect(ink.right).toBeLessThanOrEqual(468);
    expect(ink.top).toBeGreaterThanOrEqual(35);
    expect(ink.bottom).toBeLessThanOrEqual(426);
  }
});

test('standalone SVG textPath resolves internally offline and curved diagnostic anchors lie on its rendered path', async ({ page }) => {
  const result = createStreetLabel(input({ polylines: [curve], occupied: [] }));
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/*', (route) => route.abort());
  await page.setContent(svgFor([result]));
  const distances = await page.evaluate(({ pathId, anchors }) => {
    const path = document.getElementById(pathId);
    return anchors.map((anchor) => {
      const point = path.getPointAtLength(anchor.offset);
      return Math.hypot(point.x - anchor.x, point.y - anchor.y);
    });
  }, { pathId: result.diagnostics.pathId, anchors: result.anchors });
  expect(Math.max(...distances)).toBeLessThan(0.15);
  const textLength = await page.locator('text').evaluate((text) => text.getComputedTextLength());
  expect(textLength).toBeCloseTo(result.diagnostics.textLength, 0);
  expect((await raster(page, svgFor([result]))).count).toBeGreaterThan(350);
  expect(requests).toEqual([]);
});

test('a clipped secondary label still rasterizes the majority of the full name', async ({ page }) => {
  const result = createStreetLabel(input({ rank: 2, polylines: [line({ x: -100, y: 110 }, { x: 140, y: 110 })], occupied: [] }));
  expect(result.diagnostics.clipped).toBe(true);
  const clipped = await raster(page, svgFor([result]));
  const full = await raster(page, svgFor([createStreetLabel(input({ occupied: [] }))]));
  expect(clipped.count / full.count).toBeGreaterThan(0.6);
  expect(clipped.left).toBe(0);
  expect(result.markup).toContain('<title>Market Center Boulevard</title>');
});

test('expanded four-street medical district and Bachman retain full primary Harry Hines labels before badges', async ({ page }) => {
  const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  for (const [id, coverageMeters, fontSize] of [['medical-district', 787, 18], ['bachman', 621, 17]]) {
    const fixture = fixtures.find((entry) => entry.id === id);
    const diagram = generateLocationDiagram(fixture, { ...fixture.center, railCatalog: null });
    expect(diagram.streets).toHaveLength(4);
    expect(diagram.streets[0].name).toBe('Harry Hines Boulevard');
    expect(diagram.coverageMeters).toBe(coverageMeters);
    const roads = [...diagram.svg.matchAll(/<path data-street="Harry Hines Boulevard" d="([^"]+)"/g)].map((match) => match[1]);
    expect(roads.length).toBeGreaterThan(0);
    const result = createStreetLabel({ name: 'Harry Hines Boulevard', text: 'Harry Hines Blvd', rank: 1,
      polylines: roads.map(renderedPoints), occupied: [crosshair] });
    expect(result.diagnostics.placed, id).toBe(true);
    expect(result.diagnostics.fontSize).toBe(fontSize);
    expect(result.diagnostics.scaled).toBe(fontSize < 18);
    expect(result.diagnostics.fullyInFrame).toBe(true);
    expect(result.diagnostics.clipped).toBe(false);
    expect(result.diagnostics.text).toBe('Harry Hines Blvd');
    for (const box of result.diagnostics.glyphBoxes) {
      expect(overlaps(box, crosshair)).toBe(false);
      const bound = limits(box);
      expect(bound.left).toBeGreaterThanOrEqual(12);
      expect(bound.right).toBeLessThanOrEqual(468);
      expect(bound.top).toBeGreaterThanOrEqual(35);
      expect(bound.bottom).toBeLessThanOrEqual(426);
    }
    const svg = svgFor([result]);
    await page.setContent(svg);
    const glyphs = await page.locator('text').evaluate((text) => Array.from({ length: text.getNumberOfChars() }, (_, i) => {
      const box = text.getExtentOfChar(i);
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    expect(glyphs).toHaveLength('Harry Hines Blvd'.length);
    for (const glyph of glyphs) {
      expect(glyph.x - 2.5).toBeGreaterThanOrEqual(12);
      expect(glyph.x + glyph.width + 2.5).toBeLessThanOrEqual(468);
      expect(glyph.y - 2.5).toBeGreaterThanOrEqual(35);
      expect(glyph.y + glyph.height + 2.5).toBeLessThanOrEqual(426);
    }
    const ink = await raster(page, svg);
    expect(ink.count).toBeGreaterThan(300);
    expect(ink.left).toBeGreaterThanOrEqual(12);
    expect(ink.right).toBeLessThanOrEqual(468);
    expect(ink.top).toBeGreaterThanOrEqual(35);
    expect(ink.bottom).toBeLessThanOrEqual(426);
  }
});

test('genuine location 6 Market Center Boulevard label follows its rendered curved road', async ({ page }) => {
  const fixtures = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
  const fixture = fixtures.find((entry) => entry.id === 'medical-district');
  // Exercise persistent road geometry independently of transit grouping, reserving the crosshair.
  const roadsOnly = { ...fixture, elements: fixture.elements.filter((element) => element.tags?.highway
      && typeof element.tags.name === 'string' && !['bus_stop', 'platform'].includes(element.tags.highway)) };
  const diagram = generateLocationDiagram(roadsOnly, { ...fixture.center, railCatalog: null });
  const roads = [...diagram.svg.matchAll(/<path data-street="Market Center Boulevard" d="([^"]+)"/g)].map((match) => match[1]);
  expect(roads.length).toBeGreaterThan(0);
  // Recover vertices from the actual rendered M/L/Q paths; Q controls are the original road corners.
  const polylines = roads.map(renderedPoints);
  const result = createStreetLabel(input({ rank: 2, polylines, occupied: [crosshair] }));
  expect(result.diagnostics.placed).toBe(true);
  expect(result.diagnostics.curvature).toBeGreaterThan(0.12);
  await page.setContent(svgFor([result], result.diagnostics.pathIndices.map((index) => `<path data-actual-market-road="${index}" d="${roads[index]}" fill="none" stroke="#999" stroke-width="3"/>`).join('')));
  const geometry = await page.evaluate(({ anchors }) => {
    const roadPoints = [...document.querySelectorAll('[data-actual-market-road]')].flatMap((path) => {
      const length = path.getTotalLength();
      return Array.from({ length: Math.ceil(length / 0.1) + 1 }, (_, i) => path.getPointAtLength(Math.min(i * 0.1, length)));
    });
    const text = document.querySelector('text');
    const rotations = Array.from({ length: text.getNumberOfChars() }, (_, i) => text.getRotationOfChar(i));
    return { distances: anchors.map((anchor) => Math.min(...roadPoints.map((point) => Math.hypot(point.x - anchor.x, point.y - anchor.y)))),
      rotationRange: Math.max(...rotations) - Math.min(...rotations) };
  }, { anchors: result.anchors });
  expect(Math.max(...geometry.distances)).toBeLessThan(0.2);
  expect(geometry.rotationRange).toBeGreaterThan(7);
  expect((await raster(page, svgFor([result]))).count).toBeGreaterThan(300);
});
