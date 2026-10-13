import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { generateLocationDiagram } from './railFixtures.js';
import { createTransitStopMarkers } from '../src/services/transitStops.js';

const original = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));
const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
const coordinates = [
  [32.780017580621774, -96.80887918446064],
  [32.79031836911971, -96.81145872166579],
  [32.797646133410474, -96.80142278473127],
  [32.80595531491456, -96.79461026102173],
  [32.806472820267075, -96.83042844171591],
  [32.85352890117053, -96.8787510771719],
  [33.01065228733186, -96.95918249975571],
];

test('original diagram embeds DART artwork for both Elm bus stop and Akard station', () => {
  const result = generateLocationDiagram(original, original.center);
  expect(result.transitStops.length).toBeGreaterThanOrEqual(2);
  expect(result.transitStops.find((stop) => stop.mode === 'bus')).toMatchObject({ name: 'Elm @ Akard - W - NS', agencies: ['dart'] });
  expect(result.transitStops.find((stop) => stop.mode === 'rail')).toMatchObject({ name: 'Akard', agencies: ['dart'] });
  expect(result.svg).toContain('<symbol id="agency-dart"');
  expect(result.svg.match(/<use href="#agency-dart"/g)).toHaveLength(result.transitStops.filter((stop) => stop.agencies.includes('dart')).length);
  expect(result.svg).toContain('fill="#fcd006"');
  for (const marker of result.transitStops) {
    expect(Math.hypot(marker.x - 240, marker.y - 240)).toBeGreaterThan(50);
  }
});

test('agency matching preserves provider identity when shared stop-area modes are combined', () => {
  const tags = [
    { network: 'DART', highway: 'bus_stop', name: 'DART bus' },
    { operator: 'Denton County Transportation Authority', railway: 'station', name: 'DCTA rail' },
    { network: 'MATA', railway: 'tram_stop', name: 'M-Line rail' },
    { operator: 'Trinity Railway Express', railway: 'station', name: 'TRE rail' },
    { network: 'Trinity Metro', highway: 'bus_stop', name: 'Metro bus' },
    { highway: 'bus_stop', name: 'Inferred bus' },
    { bus: 'yes', public_transport: 'station', name: 'Unknown bus station' },
    { network: 'DART', railway: 'station', name: 'Outside frame' },
  ];
  const stops = tags.map((tags, index) => ({ id: String(index), type: 'node', lat: 0, lon: 0, tags }));
  const fixture = { transitStops: stops, transitRoutes: [
    { tags: { route: 'bus', network: 'Trinity Metro' }, members: [{ type: 'node', ref: '0' }] },
    { tags: { route: 'bus', network: 'DART' }, members: [{ type: 'node', ref: '5' }] },
  ], stopAreas: [{ id: 'shared', tags: {}, members: [{ type: 'node', ref: '0' }, { type: 'node', ref: '2' }] }] };
  const markers = createTransitStopMarkers(fixture, (stop) => ({ x: stop.id === '7' ? 900 : 70 + Number(stop.id) * 45, y: 90 }), 1).markers;
  const shared = markers.find((marker) => marker.mode === 'bus+rail');
  expect(shared.agencies).toEqual(['dart', 'm-line']);
  expect(shared.agencies).not.toContain('trinity-metro');
  expect(markers.find((marker) => marker.name === 'DCTA rail').agencies).toEqual(['dcta']);
  expect(markers.find((marker) => marker.name === 'TRE rail').agencies).toEqual(['tre']);
  expect(markers.find((marker) => marker.name === 'Metro bus').agencies).toEqual(['trinity-metro']);
  expect(markers.find((marker) => marker.name === 'Inferred bus').agencies).toEqual(['dart']);
  expect(markers.find((marker) => marker.name === 'Unknown bus station')).toMatchObject({ mode: 'bus', agencies: [] });
  expect(markers.some((marker) => marker.name === 'Outside frame')).toBe(false);
});

test('locations 3 and 5 retain only their combined rail agency marker', () => {
  for (const id of ['victory', 'cityplace']) {
    const data = additional.find((location) => location.id === id);
    const result = generateLocationDiagram(data, data.center);
    const rail = result.transitStops.filter((stop) => stop.mode === 'rail' || stop.mode === 'bus+rail');
    expect(rail).toHaveLength(1);
    expect(rail[0].agencies).toEqual(id === 'victory' ? ['dart', 'tre'] : ['dart', 'm-line']);
  }
});

test('locations 7 and 8 combine shared bus and rail stations without merging unrelated stops', () => {
  for (const [id, name, agencies] of [['bachman', 'Bachman', ['dart']], ['carrollton', 'Hebron', ['dcta']]]) {
    const data = additional.find((location) => location.id === id);
    const result = generateLocationDiagram(data, data.center);
    const combined = result.transitStops.filter((stop) => stop.mode === 'bus+rail');
    expect(combined).toHaveLength(1);
    expect(combined[0]).toMatchObject({ name, agencies });
    expect(result.svg).toContain('>B+R</text>');
  }
  const data = additional.find((location) => location.id === 'bachman');
  const result = generateLocationDiagram(data, data.center);
  expect(result.transitStops.find((stop) => stop.name.includes('Greyhound'))).toMatchObject({ mode: 'bus', agencies: ['greyhound'] });
});

test('all eleven agencies match their supplied logos and embed artwork without remote requests', () => {
  const operators = ['Amtrak', 'Dallas Area Rapid Transit', 'Denton County Transportation Authority', 'FlixBus',
    'Greyhound', 'McKinney Avenue Transit Authority', 'Red Coach', 'STAR Transit', 'Trinity Railway Express', 'Trinity Metro', 'Vonlane'];
  const agencies = ['amtrak', 'dart', 'dcta', 'flixbus', 'greyhound', 'm-line', 'redcoach', 'star-transit', 'tre', 'trinity-metro', 'vonlane'];
  const data = { transitStops: operators.map((operator, index) => ({ id: String(index), type: 'node',
    lat: 0, lon: 0, tags: { operator, highway: 'bus_stop', name: `Stop ${index}` } })) };
  const result = createTransitStopMarkers(data, (stop) => ({ x: 60 + Number(stop.id) % 4 * 100,
    y: 80 + Math.floor(Number(stop.id) / 4) * 130 }), 1);
  expect(result.markers).toHaveLength(11);
  for (const [index, agency] of agencies.entries()) {
    expect(result.markers.find((marker) => marker.name === `Stop ${index}`).agencies).toEqual([agency]);
    expect(result.logos[agency].markup).not.toMatch(/(?:href|src)="https?:\/\//);
    expect(result.logos[agency].markup).not.toMatch(/<script|<foreignObject/);
  }
  expect(result.logos['star-transit'].markup).toContain('data:image/png;base64,');
  for (const [id, agency] of [['medical-district', 'flixbus'], ['bachman', 'greyhound']]) {
    const fixture = additional.find((location) => location.id === id);
    const diagram = generateLocationDiagram(fixture, fixture.center);
    expect(diagram.svg).toContain(`<use href="#agency-${agency}"`);
    expect(diagram.transitStops.some((stop) => stop.agencies.includes(agency))).toBe(true);
  }
});

test('all eleven embedded agency artworks rasterize offline', async ({ page }) => {
  await page.route('**/*', (route) => route.abort());
  const logos = createTransitStopMarkers({}, () => ({ x: 0, y: 0 }), 1).logos;
  for (const [agency, logo] of Object.entries(logos)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="${logo.viewBox}">${logo.markup}</svg>`;
    const result = await page.evaluate(async (svg) => {
      const image = new Image();
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 100; canvas.height = 100;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, 100, 100);
      const pixels = context.getImageData(0, 0, 100, 100).data;
      let painted = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 20 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 200) painted++;
      }
      return painted;
    }, svg);
    expect(result, `Artwork must render for ${agency}`).toBeGreaterThan(10);
  }
});

test('nearby unrelated bus and rail stops do not merge because their badges overlap', () => {
  const fixture = { transitStops: [
    { id: 'rail', type: 'node', lat: 0, lon: 0, tags: { name: 'Station A', railway: 'station', network: 'DART' } },
    { id: 'bus', type: 'node', lat: 0, lon: 0, tags: { name: 'Different street stop', highway: 'bus_stop', network: 'DART' } },
  ] };
  const markers = createTransitStopMarkers(fixture, () => ({ x: 100, y: 100 }), 1).markers;
  expect(markers.map((marker) => marker.mode).sort()).toEqual(['bus', 'rail']);
});

test('all seven requested locations generate deterministic self-contained diagrams', () => {
  expect(additional.map((data) => [data.center.lat, data.center.lon])).toEqual(coordinates);
  for (const data of additional) {
    const result = generateLocationDiagram(data, data.center);
    expect(result.svg).toBe(generateLocationDiagram(data, data.center).svg);
    expect(result.transitStops.length).toBeGreaterThan(0);
    expect(result.svg).not.toMatch(/NaN|Infinity|<script|<foreignObject|(?:href|src)="https?:\/\/(?!www\.openstreetmap\.org\/copyright)/);
    expect(result.svg).toContain('viewBox="0 0 480 480"');
  }
});

test('location previews render with embedded logos offline and download correctly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
    return route.abort();
  });
  await page.goto('/test');
  const primary = page.getByTestId('diagram-preview');
  await expect.poll(() => primary.evaluate((image) => image.complete && image.naturalWidth === 480)).toBe(true);
  const result = generateLocationDiagram(original, original.center);
  for (const marker of result.transitStops) {
    const pixels = await primary.evaluate((image, marker) => {
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
  const previews = page.getByTestId('additional-diagram-preview');
  await expect(previews).toHaveCount(17);
  for (let i = 0; i < additional.length; i++) {
    const preview = previews.nth(i);
    await preview.scrollIntoViewIfNeeded();
    await expect.poll(() => preview.evaluate((image) => image.complete && image.naturalWidth === 480 && image.naturalHeight === 480)).toBe(true);
    const bounds = await preview.boundingBox();
    expect(bounds.width).toBeCloseTo(bounds.height, 0);
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download SVG for location 8', exact: true }).click(),
  ]);
  const svg = fs.readFileSync(await download.path(), 'utf8');
  expect(svg).toContain('<symbol id="agency-dcta"');
  expect(svg).toContain('<use href="#agency-dcta"');
  expect(svg).not.toContain('upload.wikimedia.org');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
