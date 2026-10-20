import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { buildRailGeometry, railSegmentsInBounds } from '../src/services/railGeometry.js';
import { railCatalog, railSources, generateLocationDiagram } from './railFixtures.js';

const original = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-osm.json', import.meta.url), 'utf8'));
const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));

const collection = (geometry, extra = {}) => ({ type: 'FeatureCollection', features: [{
  type: 'Feature', properties: { route_short_name: 'TEST', route_color: '123abc',
    agency: { agency_name: 'Test Agency' }, ...extra }, geometry,
}] });

test('all ten supplied rail files including Silver load with their source identities and colors', { tag: '@unit' }, () => {
  expect(Object.keys(railSources)).toHaveLength(10);
  expect(railCatalog.lines).toHaveLength(10);
  expect(railCatalog.lines.some((line) => line.id === 'DART:SILVER')).toBe(true);
  expect(railCatalog.lines.find((line) => line.id === 'DART:425').mode).toBe('streetcar');
  expect(railCatalog.lines.find((line) => line.id === 'DART:BLUE').mode).toBe('rail');
  expect(railCatalog.segments.length).toBeGreaterThan(0);
  for (const [source, data] of Object.entries(railSources)) {
    const properties = data.features[0].properties;
    const line = railCatalog.lines.find((line) => line.source === source);
    expect(line.sourceRouteId).toBe(properties.route_id);
    expect(line.sourceAgency).toBe(properties.agency.agency_name);
    expect(line.color).toBe(`#${properties.route_color}`);
  }
  const reversed = Object.fromEntries(Object.entries(railSources).reverse().map(([source, data]) => [source, {
    ...data, features: data.features.map((feature) => ({ ...feature, geometry: { ...feature.geometry,
      coordinates: feature.geometry.coordinates.map((part) => [...part].reverse()).reverse(),
    } })),
  }]));
  expect(buildRailGeometry(reversed)).toEqual(railCatalog);
});

test('LineString and MultiLineString use longitude-first coordinates and deduplicate directions', { tag: '@unit' }, () => {
  const points = [[-96.8, 32.78], [-96.79, 32.79], [-96.78, 32.80]];
  const sources = {
    first: collection({ type: 'MultiLineString', coordinates: [points, [...points].reverse()] }),
    second: collection({ type: 'LineString', coordinates: points }, { route_short_name: 'SECOND' }),
  };
  const catalog = buildRailGeometry(sources);
  expect(catalog.segments).toHaveLength(2);
  expect(catalog.segments[0].keys).toEqual(['Test Agency:SECOND', 'Test Agency:TEST']);
  expect(catalog.segments.flatMap((segment) => segment.geometry)).toContainEqual({ lon: -96.8, lat: 32.78 });
  expect(buildRailGeometry({ invalidColor: collection({ type: 'LineString', coordinates: points }, { route_color: 'not-a-color' }) }).lines[0].color)
    .toBe('#64748b');
  expect(() => buildRailGeometry({ invalid: collection({ type: 'Point', coordinates: points[0] }) })).toThrow('Unsupported rail geometry');
  expect(() => buildRailGeometry({ invalid: collection({ type: 'LineString', coordinates: [[200, 20], [0, 0]] }) })).toThrow('Invalid rail coordinate');
});

test('catalog exposes GeoJSON stops once per source identity, without clustering nearby stations', { tag: '@unit' }, () => {
  const stop = { id: 100, stop_id: 'station-1', stop_name: 'Shared Station', geometry: { type: 'Point', coordinates: [-96.8, 32.78] } };
  const geometry = { type: 'LineString', coordinates: [[-96.8, 32.78], [-96.79, 32.79]] };
  const catalog = buildRailGeometry({
    a: collection(geometry, { route_short_name: 'A', route_stops: [{ stop }] }),
    b: collection(geometry, { route_short_name: 'B', route_stops: [{ stop }, { stop: { ...stop, id: 101, stop_name: 'Separate Station' } }] }),
  });
  expect(catalog.stops).toHaveLength(2);
  expect(catalog.stops[0]).toMatchObject({ id: 'geojson:100', lat: 32.78, lon: -96.8, name: 'Shared Station', lines: ['Test Agency:A', 'Test Agency:B'] });
  expect(catalog.stops[1].id).toBe('geojson:101');
});

test('viewport filtering includes crossing segments even when both endpoints are outside', { tag: '@unit' }, () => {
  const catalog = buildRailGeometry({ crossing: collection({ type: 'LineString', coordinates: [[-0.1, 0], [0.1, 0]] }),
    distant: collection({ type: 'LineString', coordinates: [[2, 2], [3, 3]] }, { route_short_name: 'DISTANT' }) });
  const visible = railSegmentsInBounds(catalog, { lat: 0, lon: 0 }, 100);
  expect(visible).toHaveLength(1);
  expect(visible[0].keys).toEqual(['Test Agency:TEST']);
  expect(railSegmentsInBounds(null, { lat: 0, lon: 0 }, 100)).toEqual([]);
});

test('rail rendering is independent of API railway shapes, colors, and memberships', { tag: '@unit' }, () => {
  const before = generateLocationDiagram(original, original.center);
  const withoutHints = generateLocationDiagram({ ...original, transitRoutes: [] }, original.center);
  expect(withoutHints.railSegments).toEqual(before.railSegments);
  expect(withoutHints.transitLines).toEqual(before.transitLines);
  const oldApiData = { ...original, elements: [...original.elements, { id: 'fake', tags: { railway: 'light_rail' },
    geometry: [{ lat: 32.78, lon: -96.8 }, { lat: 32.79, lon: -96.79 }] }],
  transitRoutes: [{ tags: { route: 'light_rail', name: 'Fake line', colour: '#00ff00' }, members: [{ ref: 'fake' }] }] };
  expect(generateLocationDiagram(oldApiData, original.center).railSegments).toEqual(before.railSegments);
  for (const fixture of [original, ...additional]) {
    expect(fixture.elements.some((element) => element.tags.railway && !element.tags.highway)).toBe(false);
    const stopKeys = new Set(fixture.transitStops.map((stop) => `${stop.type}:${stop.id}`));
    for (const route of fixture.transitRoutes) {
      expect(route.members.every((member) => stopKeys.has(`${member.type}:${member.ref}`))).toBe(true);
    }
  }
});
