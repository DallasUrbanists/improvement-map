import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { roundedRailPath } from '../src/services/locationDiagram.js';
import { generateMinimalLocationDiagram } from '../src/services/locationDiagramMinimal.js';
import { generateLocationDiagram, railCatalog } from './railFixtures.js';

const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-boundaries.json', import.meta.url), 'utf8'));

const data = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));

test('minimal renderer includes centered labels and individual stops without agency or contextual artwork', { tag: '@unit' }, () => {
  const result = generateMinimalLocationDiagram(data, { ...data.center, buildings: false, railCatalog });
  expect(result.svg).toBe(generateMinimalLocationDiagram(data, { ...data.center, buildings: false, railCatalog }).svg);
  expect(result.svg).toContain(`viewBox="0 0 480 ${480 / 1.91}"`);
  expect(result.svg).toContain('data-layer="roads"');
  expect(result.svg).toContain('data-road="Elm Street"');
  expect(result.svg).toContain(`Center pin: ${data.center.lat}, ${data.center.lon}`);
  expect(result.svg).toContain('data-layer="rail-lines"');
  expect(result.svg).toContain('data-transit-line="DART:BLUE"');
  expect(result.svg).toContain('data-transit-stop');
  expect(result.svg).not.toContain('<symbol id="agency-');
  expect(result.svg).not.toContain('data-bike-route');
  expect(result.svg).toContain('textPath');
  expect(result.streetLabels.map((label) => label.name)).toEqual(result.streets.map((street) => street.name));
  expect(result.svg).not.toContain('administrative-boundary');
  expect(result.svg).not.toMatch(/NaN|Infinity|<script|<foreignObject/);
  expect(result.transitLines.map((line) => line.id)).toEqual(['DART:BLUE', 'DART:GREEN', 'DART:ORANGE', 'DART:RED']);
  expect(result.railSegments.length).toBeGreaterThan(0);
  expect(result.streets).toEqual(generateLocationDiagram(data, data.center).streets);
});

test('minimal renderer connects each service at the source West End rail junction', { tag: '@unit' }, () => {
  const fixture = additional.find((location) => location.id === 'west-end');
  const options = { ...fixture.center, railCatalog };
  const minimal = generateMinimalLocationDiagram(fixture, options);
  const source = railCatalog.segments.flatMap((segment) => segment.geometry)
    .find((point) => point.lon.toFixed(6) === '-96.808690' && point.lat.toFixed(6) === '32.780369');
  const scale = 480 / (2 * Math.max(120, minimal.streets.at(-1).distance * 1.65));
  const node = { x: 240 + (source.lon - fixture.center.lon) * 111195 * Math.cos(fixture.center.lat * Math.PI / 180) * scale,
    y: 480 / 1.91 / 2 - (source.lat - fixture.center.lat) * 111195 * scale };
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
  for (const line of ['DART:GREEN', 'DART:ORANGE', 'DART:BLUE', 'DART:RED']) {
    const connected = minimal.railSegments.filter((segment) => segment.line === line)
      .flatMap((segment) => [[segment.sourcePoints[0], segment.points[0]], [segment.sourcePoints.at(-1), segment.points.at(-1)]])
      .filter(([point]) => near(point, node));
    expect(connected).toHaveLength(2);
    expect(connected[0][1]).toEqual(connected[1][1]);
  }
  expect(minimal.railJunctions.map((junction) => ({ ...junction,
    branchOrders: junction.branchOrders.map((order) => [...order].sort()),
  }))).toContainEqual({
    trunkOrder: ['DART:GREEN', 'DART:ORANGE', 'DART:RED', 'DART:BLUE'],
    branchOrders: [['DART:GREEN', 'DART:ORANGE'], ['DART:BLUE', 'DART:RED']],
  });
  for (const line of minimal.transitLines) {
    expect(minimal.svg).toContain(`data-transit-line="${line.id}"`);
    expect(minimal.svg).toContain(`stroke="${line.color}"`);
  }
  expect(minimal.svg).toContain('data-transit-stop');
});

test('rail casings do not erase perpendicular rail colors and labels paint above individual stop markers', async ({ page }) => {
  const point = (x, y) => ({ lon: (x - 240) / (111195 * 2), lat: (480 / 1.91 / 2 - y) / (111195 * 2) });
  const result = generateMinimalLocationDiagram({ elements: [
    { tags: { highway: 'residential', name: 'Example Street' }, geometry: [point(0, 480 / 1.91 / 2), point(480, 480 / 1.91 / 2)] },
  ] }, { lat: 0, lon: 0, buildings: false, railCatalog: {
    lines: [{ id: 'RED', color: '#ff0000' }, { id: 'BLUE', color: '#0000ff' }],
    segments: [
      { geometry: [point(80, 60), point(400, 60)], keys: ['RED'] },
      { geometry: [point(240, 20), point(240, 100)], keys: ['BLUE'] },
    ],
  } });
  await page.setContent(`<img id="raster" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}"/>`);
  const image = page.locator('#raster');
  await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth === 480)).toBe(true);
  const pixels = await image.evaluate((img) => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 480;
    const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
    return [236, 240].map((x) => [...context.getImageData(x, 60, 1, 1).data]);
  });
  expect(pixels[0].slice(0, 3)).toEqual([255, 0, 0]);
  expect(pixels[1].slice(0, 3)).toEqual([0, 0, 255]);
  const layers = [...result.svg.matchAll(/data-layer="([^"]+)"/g)].map((match) => match[1]);
  expect(layers.indexOf('transit-stops')).toBeLessThan(layers.indexOf('street-label-casing'));
  expect(layers.indexOf('street-label-casing')).toBeLessThan(layers.indexOf('street-label-ink'));
  expect(layers.indexOf('street-label-ink')).toBeLessThan(layers.indexOf('crosshair'));
});

test('diagram selects four distinct closest streets and is deterministic', { tag: '@unit' }, () => {
  const result = generateLocationDiagram(data, data.center);
  expect(result.streets.map((street) => street.name)).toEqual(['Elm Street', 'North Akard Street', 'Pacific Avenue', 'Main Street']);
  expect(result.streets[0].distance).toBeCloseTo(7.73, 1);
  expect(result.svg).toBe(generateLocationDiagram(data, data.center).svg);
  expect(result.svg).toContain('viewBox="0 0 480 480"');
  expect(result.svg).toContain('translate(240 240)');
  expect(result.svg).toContain('Elm St');
  expect(result.svg).toContain('N Akard St');
  expect(result.svg).toContain('Pacific Ave');
  expect(result.svg).toContain('https://www.openstreetmap.org/copyright');
  expect(result.svg).not.toMatch(/NaN|Infinity|<script|<foreignObject/);
});

test('all visible streets render but only the four closest streets are label candidates', { tag: '@unit' }, () => {
  const result = generateLocationDiagram(data, data.center);
  expect(result.renderedStreets).toContain('Main Street');
  expect(result.renderedStreets.length).toBeGreaterThan(4);
  expect(result.svg).toContain('data-street="Main Street"');
  const labels = result.streetLabels.map((label) => label.text);
  expect(labels).toEqual(['Elm St', 'N Akard St', 'Pacific Ave', 'Main St']);
  expect(result.streetLabels[0].fullyInFrame).toBe(true);
  expect(result.svg).toContain('<textPath');
  const extra = { id: 'unnamed', tags: { highway: 'residential' }, geometry: [
    { lat: data.center.lat - 0.0002, lon: data.center.lon - 0.002 },
    { lat: data.center.lat - 0.0002, lon: data.center.lon + 0.002 },
  ] };
  const withUnnamed = generateLocationDiagram({ ...data, elements: [...data.elements, extra] }, data.center);
  expect(withUnnamed.svg).toContain('data-street="Unnamed street"');
  expect(withUnnamed.streets).toEqual(result.streets);
});

test('DART rail services are discovered, deduplicated and offset through shared-track bends', { tag: '@unit' }, () => {
  const result = generateLocationDiagram(data, data.center);
  expect(result.transitLines.map(({ id, name, network, color }) => ({ id, name, network, color }))).toEqual([
    { id: 'DART:BLUE', name: 'Blue Line', network: 'DART', color: '#198BC3' },
    { id: 'DART:GREEN', name: 'Green Line', network: 'DART', color: '#006F38' },
    { id: 'DART:ORANGE', name: 'Orange Line', network: 'DART', color: '#F68B1F' },
    { id: 'DART:RED', name: 'Red Line', network: 'DART', color: '#FD3E3E' },
  ]);
  const paths = [...result.svg.matchAll(/<path data-transit-line="([^"]+)" d="([^"]+)" stroke="([^"]+)"/g)];
  expect(paths).toHaveLength(4);
  expect(new Set(paths.map((match) => match[2])).size).toBe(4);
  for (const line of result.transitLines) {
    const rendered = paths.find((match) => match[1] === line.id);
    expect(rendered[3]).toBe(line.color);
    expect(rendered[2].split('L').length).toBeGreaterThan(2);
  }
  const reversed = { ...data, elements: data.elements.map((way) => way.tags.railway
    ? { ...way, geometry: [...way.geometry].reverse() } : way) };
  const reversedDiagram = generateLocationDiagram(reversed, data.center);
  expect(reversedDiagram.transitLines).toEqual(result.transitLines);
  expect([...reversedDiagram.svg.matchAll(/data-transit-line="([^"]+)" d="([^"]+)"/g)]
    .map((match) => match[2])).toEqual(paths.map((match) => match[2]));
  const noRoutes = generateLocationDiagram({ ...data, transitRoutes: [] }, data.center);
  expect(noRoutes.transitLines).toEqual(result.transitLines);
  expect(noRoutes.railSegments).toEqual(result.railSegments);
  const noCatalog = generateLocationDiagram(data, { ...data.center, railCatalog: null });
  expect(noCatalog.transitLines).toEqual([]);
  expect(noCatalog.svg).not.toContain('data-transit-line');
});

test('rail paths round bends without moving endpoints or exceeding short segments', { tag: '@unit' }, () => {
  const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }];
  expect(roundedRailPath(points, 10)).toBe('M0.0,0.0 L20.0,0.0 Q30.0,0.0 30.0,10.0 L30.0,30.0');
  expect(roundedRailPath([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], 10))
    .toContain('L1.2,0.0 Q2.0,0.0 2.0,0.8');
  const result = generateLocationDiagram(data, data.center);
  expect(result.svg.match(/data-transit-line="[^"]+" d="([^"]+)"/)[1]).toContain(' Q');
});

test('location 2 trunk order matches branches and every service meets at the same endpoint', { tag: '@unit' }, () => {
  const fixture = additional.find((location) => location.id === 'west-end');
  const result = generateLocationDiagram(fixture, fixture.center);
  expect(result.railJunctions.map((junction) => ({ ...junction,
    branchOrders: junction.branchOrders.map((order) => [...order].sort()) }))).toContainEqual({
    trunkOrder: ['DART:GREEN', 'DART:ORANGE', 'DART:BLUE', 'DART:RED'],
    branchOrders: [['DART:GREEN', 'DART:ORANGE'], ['DART:BLUE', 'DART:RED']],
  });
  for (const line of ['DART:GREEN', 'DART:ORANGE', 'DART:BLUE', 'DART:RED']) {
    const segments = result.railSegments.filter((segment) => segment.line === line);
    expect(segments).toHaveLength(2);
    const endpoints = segments.map((segment) => [segment.points[0], segment.points.at(-1)]);
    const distances = endpoints[0].flatMap((a) => endpoints[1].map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
    expect(Math.min(...distances)).toBe(0);
  }
});

test('administrative footers use verified containing boundaries for the exact pin only', { tag: '@unit' }, () => {
  const expectedNames = ['Downtown PID', 'West End Historic District', 'Dallas', 'Uptown PID', 'Uptown PID', 'Dallas', 'Dallas', 'Lewisville'];
  for (const [index, fixture] of [data, ...additional].entries()) {
    const boundary = boundaries[fixture.id];
    const result = generateLocationDiagram(fixture, { ...fixture.center, administrativeBoundary: boundary });
    expect(boundary.name).toBe(expectedNames[index]);
    expect(result.administrativeBoundary).toEqual(boundary);
    expect(result.svg).toContain(`data-administrative-boundary="${boundary.osmId}"`);
    expect(result.contextLabels).toContain(expectedNames[index]);
    expect(result.contextLabels).toContain('TX');
    expect(result.contextLabels).toContain('USA');
    expect(result.svg).toContain(`<title>${result.contextLabels.join(', ').replaceAll('&', '&amp;')}</title>`);
    expect(result.svg).not.toContain('SCHEMATIC · NOT FOR NAVIGATION');
    expect(result.svg).toContain('Not for navigation');
  }
  const mismatched = generateLocationDiagram(data, { ...data.center, administrativeBoundary: boundaries['west-end'] });
  expect(mismatched.administrativeBoundary).toBeNull();
  expect(mismatched.svg).toContain('Administrative area unavailable');
  const escaped = generateLocationDiagram(data, { ...data.center, administrativeBoundary: { ...boundaries.original, name: '<District & City>' } });
  expect(escaped.svg).toContain('&lt;District &amp; City&gt;');
});

test('diagram escapes names, ranks by segment distance, and allows no buildings', { tag: '@unit' }, () => {
  const fixture = { elements: [
    { tags: { highway: 'residential', name: '<script> & "Street"' }, geometry: [{ lat: -0.01, lon: 0.00001 }, { lat: 0.01, lon: 0.00001 }] },
    { tags: { highway: 'residential', name: 'Farther Street' }, geometry: [{ lat: 0.0002, lon: 0 }, { lat: 0.0002, lon: 0.0001 }] },
    { tags: { highway: 'residential', name: 'Farther Street' }, geometry: [{ lat: 0.0002, lon: 0.0001 }, { lat: 0.0002, lon: 0.0003 }] },
  ] };
  const result = generateLocationDiagram(fixture, { lat: 0, lon: 0 });
  expect(result.streets).toHaveLength(2);
  expect(result.streets[0].name).toBe('<script> & "Street"');
  expect(result.svg).toContain('&lt;script&gt; &amp; &quot;');
  expect(result.svg).not.toContain('<script>');
  const withoutBuildings = generateLocationDiagram(data, { ...data.center, buildings: false });
  expect(withoutBuildings.streets).toEqual(generateLocationDiagram(data, data.center).streets);
  expect(withoutBuildings.svg.length).toBeLessThan(generateLocationDiagram(data, data.center).svg.length);
  expect(() => generateLocationDiagram(data, { lat: NaN, lon: 0 })).toThrow('Valid coordinates');
  expect(() => generateLocationDiagram({ elements: [] }, data.center)).toThrow('No named streets');
});

test('Current renderer previews offline, switches controls and exports a standalone SVG', async ({ page }) => {
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto('/test');
  await page.getByLabel('Renderer').selectOption('current');
  await expect(page.getByRole('heading', { name: 'Location diagram', exact: true })).toBeVisible();
  const preview = page.getByTestId('diagram-preview');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((image) => image.complete && image.naturalWidth === 480 && image.naturalHeight === 480)).toBe(true);
  const bounds = await preview.boundingBox();
  expect(bounds.width).toBeCloseTo(bounds.height, 0);
  await expect(page.getByText('Elm Street', { exact: true })).toBeVisible();
  await expect(page.getByText('North Akard Street', { exact: true })).toBeVisible();
  await expect(page.getByText('Pacific Avenue', { exact: true })).toBeVisible();
  for (const name of ['Blue', 'Green', 'Orange', 'Red']) {
    await expect(page.getByText(`DART ${name} Line`, { exact: true })).toBeVisible();
  }
  const result = generateLocationDiagram(data, data.center);
  for (const marker of result.transitStops) {
    const pixels = await preview.evaluate((image, marker) => {
      const canvas = document.createElement('canvas');
      canvas.width = 480; canvas.height = 480;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 480, 480);
      const pixels = context.getImageData(Math.round(marker.x - 15), Math.round(marker.y - 15), 30, 30).data;
      let yellow = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 220 && pixels[i + 1] > 160 && pixels[i + 2] < 60) yellow++;
      }
      return yellow;
    }, marker);
    expect(pixels).toBeGreaterThan(20);
  }
  const original = await preview.getAttribute('src');
  await page.getByRole('checkbox', { name: 'Show buildings' }).uncheck();
  await expect(preview).not.toHaveAttribute('src', original);
  const download = page.getByRole('link', { name: 'Download SVG', exact: true });
  await expect(download).toHaveAttribute('download', 'location-diagram.svg');
  await expect(download).toHaveAttribute('href', await preview.getAttribute('src'));
  const [saved] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(saved.suggestedFilename()).toBe('location-diagram.svg');
  const content = fs.readFileSync(await saved.path(), 'utf8');
  expect(content).toContain('<svg xmlns=');
  expect(content).toContain('© OpenStreetMap contributors');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Version Two previews offline, switches renderers and exports landscape SVG', async ({ page }) => {
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto('/test');
  const preview = page.getByTestId('diagram-preview');
  await expect(page.getByLabel('Renderer')).toHaveValue('minimal');
  await expect.poll(() => preview.evaluate(img => img.complete && img.naturalWidth === 480 && Math.abs(img.naturalHeight - 480 / 1.91) < 1)).toBe(true);
  const landscape = await preview.getAttribute('src');
  await page.getByLabel('Renderer').selectOption('current');
  await expect(preview).not.toHaveAttribute('src', landscape);
  await page.getByLabel('Renderer').selectOption('minimal');
  await expect(preview).toHaveAttribute('src', landscape);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download SVG', exact: true }).click(),
  ]);
  const svg = fs.readFileSync(await download.path(), 'utf8');
  expect(svg).toContain(`viewBox="0 0 480 ${480 / 1.91}"`);
  expect(svg).toContain('OpenStreetMap');
  expect(svg).toContain('data-transit-line');
  expect(svg).not.toMatch(/(?:href|src)="https?:\/\/(?!www\.openstreetmap\.org\/copyright)/);
});
