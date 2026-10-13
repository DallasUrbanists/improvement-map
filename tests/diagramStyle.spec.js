import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { bikeFacility, freewayStreet, locationContext, truncateContext } from '../src/services/diagramContext.js';
import { generateLocationDiagram, railCatalog } from './railFixtures.js';

const additional = JSON.parse(fs.readFileSync(new URL('../src/data/additional-test-locations-osm.json', import.meta.url), 'utf8'));
const extra = JSON.parse(fs.readFileSync(new URL('../src/data/extra-test-locations-osm.json', import.meta.url), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(new URL('../src/data/test-location-boundaries.json', import.meta.url), 'utf8'));
const road = (id, name, geometry, tags = {}) => ({ id, tags: { highway: 'residential', name, ...tags }, geometry });
const horizontal = road(1, 'Victory Avenue', [{ x: 0, y: 200 }, { x: 220, y: 200 }, { x: 480, y: 200 }]);
const vertical = road(2, 'All Star Way', [{ x: 220, y: 0 }, { x: 220, y: 200 }, { x: 220, y: 480 }]);
const station = { id: 'rail', name: 'Victory Station', mode: 'rail', agencyNames: ['DART'], stopX: 350, stopY: 300 };
const boundary = { name: 'Dallas', adminLevel: 8, verification: { containingAdministrativeAreas: [
  { name: 'Texas', adminLevel: 4 }, { name: 'Dallas County', adminLevel: 6 }, { name: 'United States', adminLevel: 2 },
] } };

test('footer abbreviates administrative names and only strips intersection road types', () => {
  const a = { ...horizontal, tags: { ...horizontal.tags, name: 'Boll Street' } };
  const b = { ...vertical, tags: { ...vertical.tags, name: 'McKinney Avenue' } };
  expect(locationContext([a, b], (point) => point, [], boundary).names)
    .toEqual(['Boll & McKinney', 'Dallas', 'Dallas County', 'TX', 'USA']);
  const extension = { ...a, tags: { ...a.tags, name: 'Elm Street Extension' } };
  const saint = { ...b, tags: { ...b.tags, name: 'St. Paul Street' } };
  expect(locationContext([extension, saint], (point) => point, [], boundary).names[0]).toBe('Elm Extension & St. Paul');
  expect(locationContext([a], (point) => point, [], boundary).names[0]).toBe('Boll St');
  const nonState = { ...boundary, name: 'Texas', adminLevel: 8 };
  expect(locationContext([a], (point) => point, [], nonState).names).toContain('Texas');
});

test('copyright is above the boundary row, right-aligned, with no background panel', () => {
  const fixture = additional[0];
  const result = generateLocationDiagram(fixture, { ...fixture.center, administrativeBoundary: boundaries[fixture.id] });
  expect(result.svg).toMatch(/data-administrative-boundary="[^"]*" x="12" y="470"/);
  expect(result.svg).toContain('<rect x="0" y="452" width="480" height="28"');
  expect(result.svg).not.toContain('<rect x="0" y="432"');
  expect(result.svg).toContain('<text x="468" y="450" font-size="11" text-anchor="end">© OpenStreetMap contributors</text>');
});

test('bike facilities require protection or an off-street bicycle designation', () => {
  for (const tags of [{ highway: 'cycleway' }, { highway: 'path', bicycle: 'designated' },
    { highway: 'residential', 'cycleway:right': 'track' },
    { highway: 'residential', 'cycleway:left': 'lane', 'cycleway:left:separation': 'bollard' }]) expect(bikeFacility(tags)).toBe(true);
  for (const tags of [{ highway: 'path' }, { highway: 'footway', bicycle: 'no' },
    { highway: 'residential', cycleway: 'lane' }, { highway: 'residential', cycleway: 'shared_lane' },
    { highway: 'residential', cycleway: 'lane', 'cycleway:buffer': 'yes' },
    { highway: 'cycleway', access: 'private' }]) expect(bikeFacility(tags)).toBe(false);
});

test('location context orders intersection, nearby station, and all administrative areas', () => {
  const result = locationContext([horizontal, vertical], (point) => point, [station], boundary);
  expect(result.names).toEqual(['Victory & All Star', 'DART Victory Station', 'Dallas', 'Dallas County', 'TX', 'USA']);
  const closeStop = { ...station, mode: 'bus', stopX: 240, stopY: 239, name: 'Bus Stop' };
  expect(locationContext([horizontal, vertical], (point) => point, [station, closeStop], boundary).names[0]).toBe('DART Bus Stop');
  expect(locationContext([horizontal], (point) => point, [], boundary).names[0]).toBe('Victory Ave');
  const bridge = { ...vertical, tags: { ...vertical.tags, bridge: 'yes', layer: '1' } };
  expect(locationContext([horizontal, bridge], (point) => point, [], boundary).intersections).toEqual([]);
  const outside = { ...vertical, geometry: [{ x: 600, y: 0 }, { x: 600, y: 480 }] };
  expect(locationContext([horizontal, outside], (point) => point, [], boundary).intersections).toEqual([]);
  const bendA = road(3, 'First Street', [{ x: 0, y: 200 }, { x: 200, y: 200 }]);
  const bendB = road(4, 'Second Street', [{ x: 200, y: 200 }, { x: 300, y: 250 }]);
  expect(locationContext([bendA, bendB], (point) => point, [], boundary).intersections).toEqual([]);
  expect(truncateContext(result.names.join(', '), 150)).toMatch(/…$/);
  expect(truncateContext('Dallas')).toBe('Dallas');
});

test('grayscale streets have rounded paths, uncased minor roads, and green bicycle facilities', () => {
  const center = { lat: 32.8, lon: -96.8 };
  const geometry = [{ lat: 32.799, lon: -96.801 }, { lat: 32.8, lon: -96.801 }, { lat: 32.8, lon: -96.799 }];
  const data = { elements: [road(1, 'Street', geometry), road(2, 'Alley', geometry, { highway: 'service', service: 'alley' }),
    road(3, 'Trail', geometry, { highway: 'cycleway' }), road(4, 'Unprotected', geometry, { cycleway: 'lane' })] };
  const result = generateLocationDiagram(data, { ...center, railCatalog: null });
  const layer = (name) => result.svg.match(new RegExp(`<g data-layer="${name}"[^>]*>(.*?)</g>`))[0];
  expect(result.svg).not.toMatch(/data-layer="(?:street|divided-street|freeway)-casing"/);
  expect(result.svg).toContain('<circle r="17" fill="#ffa800" stroke="none"/>');
  expect(layer('minor-streets')).toContain('stroke-width="1.5"');
  expect(layer('minor-streets')).toContain('data-street="Alley"');
  expect(layer('streets')).toContain(' Q');
  expect(layer('bike-routes')).toContain('stroke="#218739" stroke-width="3"');
  expect(layer('bike-routes')).toContain('data-bike-route="Trail"');
  expect(layer('bike-routes')).not.toContain('Unprotected');
  const colors = [...result.svg.matchAll(/(?:fill|stroke)="(#[a-f0-9]{6})"/gi)].map((match) => match[1]);
  expect(colors.every((color) => ['#218739', '#ffa800'].includes(color) || color.slice(1, 3) === color.slice(3, 5) && color.slice(3, 5) === color.slice(5, 7))).toBe(true);
});

test('closest-street labels and distances ignore service roads, even when names match regular roads', () => {
  const center = { lat: 32.8, lon: -96.8 };
  const geometryAt = (offset) => [{ lat: center.lat + offset, lon: center.lon - 0.001 }, { lat: center.lat + offset, lon: center.lon + 0.001 }];
  const data = { elements: [road(1, 'Access Lane', geometryAt(0), { highway: 'service' }),
    road(2, 'First Street', geometryAt(0.0001)), road(3, 'Second Street', geometryAt(0.0002)),
    road(4, 'Third Street', geometryAt(0.0003)), road(5, 'Third Street', geometryAt(0), { highway: 'service', service: 'driveway' })] };
  const diagram = generateLocationDiagram(data, { ...center, railCatalog: null });
  expect(diagram.streets.map((street) => street.name)).toEqual(['First Street', 'Second Street', 'Third Street']);
  expect(diagram.streets[2].distance).toBeCloseTo(33.36, 1);
  expect(diagram.renderedStreets).toContain('Access Lane');
  expect(diagram.streetLabels.some((label) => label.name === 'Access Lane')).toBe(false);
  for (const fixture of [additional.find((entry) => entry.id === 'west-end'), additional.find((entry) => entry.id === 'carrollton'), extra[0]]) {
    const result = generateLocationDiagram(fixture, fixture.center);
    const eligibleNames = new Set(fixture.elements.filter((element) => element.tags?.highway !== 'service').map((element) => element.tags?.name));
    expect(result.streets.every((street) => eligibleNames.has(street.name))).toBe(true);
    expect(result.streets.map((street) => street.name)).not.toContain('Elm Street Extension');
    expect(result.streets.map((street) => street.name)).not.toContain('Hebron Station Bus Lane');
  }
  const serviceOnly = generateLocationDiagram({ elements: [data.elements[0]] }, { ...center, railCatalog: null });
  expect(serviceOnly.streets).toEqual([]);
  expect(serviceOnly.coverageMeters).toBe(240);
  expect(serviceOnly.svg).toContain('data-street="Access Lane"');
});

test('parking aisles and highway ramps are extra-light, thin, and uncased', () => {
  const center = { lat: 32.8, lon: -96.8 };
  const geometry = [{ lat: center.lat - 0.001, lon: center.lon - 0.001 }, { lat: center.lat + 0.001, lon: center.lon + 0.001 }];
  const elements = [road(1, 'Parking Aisle', geometry, { highway: 'service', service: 'parking_aisle' }),
    road(2, 'Driveway', geometry, { highway: 'service', service: 'driveway' }),
    road(3, 'Regular Street', geometry), ...['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].map((kind, i) => road(i + 4, `${kind} ramp`, geometry, { highway: `${kind}_link` }))];
  const diagram = generateLocationDiagram({ elements }, { ...center, railCatalog: null });
  const layer = (name) => diagram.svg.match(new RegExp(`<g data-layer="${name}"[^>]*>(.*?)</g>`))[0];
  expect(layer('extra-light-streets')).toContain('stroke="#d6d6d6" stroke-width="0.75"');
  expect(layer('extra-light-streets')).toContain('Parking Aisle');
  for (const kind of ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']) expect(layer('extra-light-streets')).toContain(`${kind} ramp`);
  expect(layer('minor-streets')).toContain('Driveway');
  expect(layer('extra-light-streets')).not.toContain('Driveway');
  expect(diagram.svg).not.toContain('data-layer="street-casing"');
  const restoredParking = [...additional, ...extra].flatMap((fixture) => fixture.elements).filter((element) => element.tags?.service === 'parking_aisle');
  expect(restoredParking.length).toBeGreaterThan(0);
});

test('freeway mainlines use minor-road gray at twice the divided-road weight, excluding ramps', () => {
  const center = { lat: 32.8, lon: -96.8 };
  const geometry = [{ lat: center.lat - 0.001, lon: center.lon - 0.001 }, { lat: center.lat + 0.001, lon: center.lon + 0.001 }];
  const elements = [road(1, 'IH-35', geometry, { highway: 'motorway' }),
    road(2, 'Julius Schepps Freeway', geometry, { highway: 'motorway' }),
    road(3, 'Expressway', geometry, { highway: 'trunk', expressway: 'yes' }),
    road(4, 'Ramp', geometry, { highway: 'motorway_link' }),
    road(5, 'Ordinary Trunk', geometry, { highway: 'trunk' })];
  const diagram = generateLocationDiagram({ elements }, { ...center, railCatalog: null });
  const layer = (name) => diagram.svg.match(new RegExp(`<g data-layer="${name}"[^>]*>(.*?)</g>`))[0];
  expect(layer('freeways')).toContain('stroke="#bcbcbc" stroke-width="14"');
  for (const name of ['IH-35', 'Julius Schepps Freeway', 'Expressway']) expect(layer('freeways')).toContain(`data-street="${name}"`);
  expect(layer('freeways')).not.toContain('Ramp');
  expect(layer('freeways')).not.toContain('Ordinary Trunk');
  expect(layer('extra-light-streets')).toContain('data-street="Ramp"');
  expect(layer('streets')).toContain('data-street="Ordinary Trunk"');
  expect(diagram.svg).not.toContain('data-layer="freeway-casing"');
  expect(freewayStreet({ highway: 'motorway_link' })).toBe(false);
  expect(freewayStreet({ highway: 'primary', expressway: 'yes' })).toBe(true);
  expect(freewayStreet({ highway: 'tertiary', name: 'North Good-Latimer Expressway' })).toBe(true);
  expect(freewayStreet({ highway: 'primary_link', name: 'Expressway Ramp', expressway: 'yes' })).toBe(false);
  expect(freewayStreet({ highway: 'service', name: 'Expressway Access Road' })).toBe(false);
  const fixture = extra.find((entry) => entry.id === 'location-17');
  const realDiagram = generateLocationDiagram(fixture, fixture.center);
  const mainlines = fixture.elements.filter((element) => element.tags?.highway === 'motorway');
  expect(mainlines.length).toBeGreaterThan(0);
  expect(realDiagram.svg).toMatch(/<g data-layer="freeways"[^>]*stroke-width="14"[^>]*><path/);
  expect(realDiagram.svg.match(/<g data-layer="freeways"[^>]*>(.*?)<\/g>/)[1]).toContain('data-street="North Good-Latimer Expressway"');
});

test('rail lines have white casing underneath matching colored geometry, without street casing', () => {
  const fixture = additional.find((entry) => entry.id === 'west-end');
  const result = generateLocationDiagram(fixture, fixture.center);
  const casings = [...result.svg.matchAll(/<path data-rail-casing="([^"]+)" d="([^"]+)" stroke="#fff"/g)];
  const colored = [...result.svg.matchAll(/<path data-transit-line="([^"]+)" d="([^"]+)" stroke="[^"]+"/g)];
  expect(casings.length).toBeGreaterThan(0);
  expect(casings.map((match) => match.slice(1, 3))).toEqual(colored.map((match) => match.slice(1, 3)));
  expect(result.svg).toContain('data-layer="rail-casing" fill="none" stroke-width="8.5"');
  expect(result.svg.indexOf('data-layer="rail-casing"')).toBeLessThan(result.svg.indexOf('data-layer="rail-lines"'));
  expect(result.svg).not.toMatch(/data-layer="(?:street|divided-street|freeway)-casing"/);
});

test('Harry Hines labels remain visible at locations six and seven', () => {
  for (const fixture of additional.filter((entry) => ['medical-district', 'bachman'].includes(entry.id))) {
    const result = generateLocationDiagram(fixture, { ...fixture.center, administrativeBoundary: boundaries[fixture.id] });
    expect(result.streetLabels.some((label) => label.text === 'Harry Hines Blvd')).toBe(true);
    expect(result.svg).toContain('data-street-label="Harry Hines Boulevard"');
    expect(result.contextLabels).toContain('Dallas');
  }
});

test('University Crossing Trail is green and Silver renders where its catalog crosses a pin', () => {
  const fixture = extra.find((entry) => entry.id === 'location-9');
  expect(generateLocationDiagram(fixture, fixture.center).svg).toContain('data-bike-route="University Crossing Trail"');
  const silver = railCatalog.segments.find((segment) => segment.keys.includes('DART:SILVER'));
  const center = silver.geometry[0];
  const data = { elements: [road(1, 'Test Street', [{ lat: center.lat - 0.001, lon: center.lon }, { lat: center.lat + 0.001, lon: center.lon }])] };
  expect(generateLocationDiagram(data, center).transitLines.some((line) => line.id === 'DART:SILVER')).toBe(true);
});
