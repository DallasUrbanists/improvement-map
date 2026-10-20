import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const center = { lat: 32.7845, lon: -96.803 };
const response = {
  version: 0.6, osm3s: { timestamp_osm_base: '2026-10-13T09:00:00Z' },
  elements: [
    { type: 'way', id: 90001, tags: { highway: 'residential', name: 'Live Example Street' }, geometry: [
      { lat: center.lat + 0.0001, lon: center.lon - 0.003 }, { lat: center.lat + 0.0001, lon: center.lon + 0.003 },
    ] },
    { type: 'way', id: 90002, tags: { highway: 'residential', name: 'Live Avenue' }, geometry: [
      { lat: center.lat - 0.003, lon: center.lon + 0.0003 }, { lat: center.lat + 0.003, lon: center.lon + 0.0003 },
    ] },
    { type: 'way', id: 90003, tags: { highway: 'residential', name: 'Live Boulevard' }, geometry: [
      { lat: center.lat - 0.0006, lon: center.lon - 0.003 }, { lat: center.lat - 0.0006, lon: center.lon + 0.003 },
    ] },
    { type: 'way', id: 90005, tags: { highway: 'residential', name: 'Fourth Live Street' }, geometry: [
      { lat: center.lat + 0.0008, lon: center.lon - 0.003 }, { lat: center.lat + 0.0008, lon: center.lon + 0.003 },
    ] },
    { type: 'node', id: 90004, lat: center.lat + 0.0003, lon: center.lon - 0.0003,
      tags: { highway: 'bus_stop', public_transport: 'platform', name: 'Live Bus Stop', network: 'DART' } },
    { type: 'area', id: 3606571629, tags: { boundary: 'administrative', name: 'Dallas', admin_level: '8' } },
    { type: 'area', id: 3600114690, tags: { boundary: 'administrative', name: 'Texas', admin_level: '4' } },
    { type: 'area', id: 3600148838, tags: { boundary: 'administrative', name: 'United States', admin_level: '2' } },
  ],
};

const providers = ['**/__overpass', '**/__overpass-kumi', '**/api/interpreter'];
const routeProviders = (page, handler) => Promise.all(providers.map((url) => page.route(url, handler)));

test('invalid coordinate input does not make requests or replace the previous preview', async ({ page }) => {
  let requests = 0;
  await routeProviders(page, async (route) => { requests++; await route.abort(); });
  await page.goto('/test');
  const previous = await page.getByTestId('diagram-preview').getAttribute('src');
  await page.getByLabel('Coordinates (latitude, longitude)').fill('91, -96.8');
  await page.getByRole('button', { name: 'Generate diagram', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('diagram-preview')).toHaveAttribute('src', previous);
  expect(requests).toBe(0);
});

test('custom coordinates update preview, comparison link, download, and reset without altering the gallery', async ({ page }) => {
  await routeProviders(page, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }));
  await page.goto('/test');
  await page.getByLabel('Renderer').selectOption('current');
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-testid="diagram-preview"]');
    return image?.complete && image.naturalWidth === 480 && image.naturalHeight === 480;
  });
  const original = await page.getByTestId('diagram-preview').getAttribute('src');
  const originalCoordinates = await page.getByLabel('Coordinates (latitude, longitude)').inputValue();
  const originalGallery = await page.getByTestId('additional-diagram-preview').evaluateAll((images) => images.map((image) => image.getAttribute('src')));
  await page.getByLabel('Coordinates (latitude, longitude)').fill(`${center.lat}, ${center.lon}`);
  await page.getByRole('button', { name: 'Generate diagram', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Generated diagram for');
  await expect(page.getByTestId('active-diagram-coordinates')).toContainText(`${center.lat}, ${center.lon}`);
  await expect(page.getByRole('link', { name: 'Compare with OpenStreetMap', exact: true })).toHaveAttribute('href',
    `https://www.openstreetmap.org/?mlat=${center.lat}&mlon=${center.lon}#map=19/${center.lat}/${center.lon}`);
  const svg = decodeURIComponent((await page.getByTestId('diagram-preview').getAttribute('src')).split(',').slice(1).join(','));
  expect(svg).toContain('Live Example Street');
  expect(svg).toContain('Fourth Live Street');
  expect(svg).toContain(`The crosshair marks ${center.lat}, ${center.lon}`);
  expect(svg).toContain('Live Bus Stop');
  expect(svg).toContain('Dallas');
  expect(await page.getByTestId('additional-diagram-preview').evaluateAll((images) => images.map((image) => image.getAttribute('src')))).toEqual(originalGallery);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download SVG', exact: true }).first().click()]);
  expect(fs.readFileSync(await download.path(), 'utf8')).toContain(`The crosshair marks ${center.lat}, ${center.lon}`);
  await page.getByRole('button', { name: 'Reset example' }).click();
  await expect(page.getByTestId('diagram-preview')).toHaveAttribute('src', original);
  await expect(page.getByLabel('Coordinates (latitude, longitude)')).toHaveValue(originalCoordinates);
  expect(await page.getByTestId('additional-diagram-preview').evaluateAll((images) => images.map((image) => image.getAttribute('src')))).toEqual(originalGallery);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('provider failures retain the previous diagram and allow another attempt', async ({ page }) => {
  await routeProviders(page, (route) => route.fulfill({ status: 503, contentType: 'text/plain', body: 'Provider temporarily unavailable' }));
  await page.goto('/test');
  const previous = await page.getByTestId('diagram-preview').getAttribute('src');
  await page.getByLabel('Coordinates (latitude, longitude)').fill(`${center.lat}, ${center.lon}`);
  await page.getByRole('button', { name: 'Generate diagram', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Previous preview retained.');
  await expect(page.getByRole('button', { name: 'Generate diagram', exact: true })).toBeEnabled();
  await expect(page.getByTestId('diagram-preview')).toHaveAttribute('src', previous);
});

test('canceling prevents a late provider response from replacing the preview', async ({ page }) => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  await routeProviders(page, async (route) => {
    await wait;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) }).catch(() => {});
  });
  await page.goto('/test');
  const previous = await page.getByTestId('diagram-preview').getAttribute('src');
  await page.getByLabel('Coordinates (latitude, longitude)').fill(`${center.lat}, ${center.lon}`);
  await page.getByRole('button', { name: 'Generate diagram', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  release();
  await expect(page.getByRole('status')).toContainText('Generation canceled');
  await expect(page.getByRole('button', { name: 'Generate diagram', exact: true })).toBeEnabled();
  await expect(page.getByTestId('diagram-preview')).toHaveAttribute('src', previous);
});
