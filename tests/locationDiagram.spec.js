import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { roundedRailPath } from '../src/services/locationDiagram.js';
import { generateLocationDiagram } from './railFixtures.js';

const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-boundaries.json', import.meta.url), 'utf8'));

const data = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));

test('diagram selects three distinct closest streets and is deterministic', () => {
  const result = generateLocationDiagram(data, data.center);
  expect(result.streets.map((street) => street.name)).toEqual(['Elm Street', 'North Akard Street', 'Pacific Avenue']);
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

test('all visible streets render but only the three closest streets are labeled', () => {
  const result = generateLocationDiagram(data, data.center);
  expect(result.renderedStreets).toContain('Main Street');
  expect(result.renderedStreets.length).toBeGreaterThan(3);
  expect(result.svg).toContain('data-street="Main Street"');
  const labels = [...result.svg.matchAll(/<text transform="[^"]+">([^<]+)<\/text>/g)].map((match) => match[1]);
  expect(labels).toEqual(['Elm St', 'N Akard St', 'Pacific Ave']);
  expect(labels).not.toContain('Main St');
  const extra = { id: 'unnamed', tags: { highway: 'residential' }, geometry: [
    { lat: data.center.lat - 0.0002, lon: data.center.lon - 0.002 },
    { lat: data.center.lat - 0.0002, lon: data.center.lon + 0.002 },
  ] };
  const withUnnamed = generateLocationDiagram({ ...data, elements: [...data.elements, extra] }, data.center);
  expect(withUnnamed.svg).toContain('data-street="Unnamed street"');
  expect(withUnnamed.streets).toEqual(result.streets);
});

test('DART rail services are discovered, deduplicated and offset through shared-track bends', () => {
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

test('rail paths round bends without moving endpoints or exceeding short segments', () => {
  const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }];
  expect(roundedRailPath(points, 10)).toBe('M0.0,0.0 L20.0,0.0 Q30.0,0.0 30.0,10.0 L30.0,30.0');
  expect(roundedRailPath([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], 10))
    .toContain('L1.2,0.0 Q2.0,0.0 2.0,0.8');
  const result = generateLocationDiagram(data, data.center);
  expect(result.svg.match(/data-transit-line="[^"]+" d="([^"]+)"/)[1]).toContain(' Q');
});

test('location 2 trunk order matches branches and every service meets at the same endpoint', () => {
  const fixture = additional.find((location) => location.id === 'west-end');
  const result = generateLocationDiagram(fixture, fixture.center);
  expect(result.railJunctions).toContainEqual({
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

test('administrative footers use verified containing boundaries for the exact pin only', () => {
  const expectedNames = ['Downtown PID', 'West End Historic District', 'Dallas', 'Uptown PID', 'Uptown PID', 'Dallas', 'Dallas', 'Lewisville'];
  for (const [index, fixture] of [data, ...additional].entries()) {
    const boundary = boundaries[fixture.id];
    const result = generateLocationDiagram(fixture, { ...fixture.center, administrativeBoundary: boundary });
    expect(boundary.name).toBe(expectedNames[index]);
    expect(result.administrativeBoundary).toEqual(boundary);
    expect(result.svg).toContain(`data-administrative-boundary="${boundary.osmId}"`);
    expect(result.svg).toContain(`>${expectedNames[index]}</text>`);
    expect(result.svg).not.toContain('SCHEMATIC · NOT FOR NAVIGATION');
    expect(result.svg).toContain('Not for navigation');
  }
  const mismatched = generateLocationDiagram(data, { ...data.center, administrativeBoundary: boundaries['west-end'] });
  expect(mismatched.administrativeBoundary).toBeNull();
  expect(mismatched.svg).toContain('Administrative area unavailable');
  const escaped = generateLocationDiagram(data, { ...data.center, administrativeBoundary: { ...boundaries.original, name: '<District & City>' } });
  expect(escaped.svg).toContain('&lt;District &amp; City&gt;');
});

test('diagram escapes names, ranks by segment distance, and allows no buildings', () => {
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

test('test route renders square previews and exports a standalone SVG', async ({ page }) => {
  await page.goto('/test');
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
