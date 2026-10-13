import { test, expect } from '@playwright/test';
import { parseCoordinateString, fetchLocationData } from '../src/services/liveLocationData.js';
import { generateLocationDiagram } from './railFixtures.js';
import { createTransitStopMarkers } from '../src/services/transitStops.js';

const center = { lat: 32.7842, lon: -96.7856 };
const meters = 111195;
const point = (x, y) => ({ lat: center.lat + y / meters, lon: center.lon + x / (meters * Math.cos(center.lat * Math.PI / 180)) });
const road = (id, distance, tags = {}) => ({ type: 'way', id, tags: { highway: 'residential', name: `Street ${id}`, ...tags },
  geometry: [point(-600, distance), point(600, distance)] });
const roads = (distances = [20, 60, 80, 100]) => distances.map((distance, i) => road(i + 1, distance));
const response = (elements = roads(), extra = {}) => ({ ok: true, status: 200, json: async () => ({ elements, ...extra }) });
const mockFetch = (elements = roads(), extra = {}) => async () => response(elements, extra);

for (const [input, expected] of [['32.7842, -96.7856', center], [' +90 , -180 ', { lat: 90, lon: -180 }],
  ['-.5, +.25', { lat: -0.5, lon: 0.25 }], ['0,0', { lat: 0, lon: 0 }], ['1.,2.0', { lat: 1, lon: 2 }]]) {
  test(`parses decimal coordinate pair ${input}`, () => expect(parseCoordinateString(input)).toEqual(expected));
}
for (const input of ['', '1', '1,2,3', ',2', '1,', 'NaN,0', 'Infinity,0', '1e2,0', '0x10,0', '91,0',
  '0,-181', '1 2,3', '1;2', '1\n2,3', null, {}, '1,2 trailing']) {
  test(`rejects invalid coordinates ${JSON.stringify(input)}`, () => expect(() => parseCoordinateString(input)).toThrow());
}

test('preserves renderer geometry, every street tag, stop centroids and stop-only memberships', async () => {
  const tags = { highway: 'service', name: 'Parking', service: 'parking_aisle', oneway: 'yes', layer: '-1',
    expressway: 'yes', cycleway: 'track', 'cycleway:left:separation': 'kerb', access: 'private' };
  const building = { type: 'way', id: 20, tags: { building: 'yes', name: 'Building' },
    geometry: [point(-10, -10), point(10, -10), point(10, 10), point(-10, 10), point(-10, -10)] };
  const bus = { type: 'node', id: 30, ...point(80, -60), tags: { highway: 'bus_stop', name: 'Bus' } };
  const platform = { type: 'way', id: 31, tags: { railway: 'platform', public_transport: 'platform', name: 'Rail' },
    geometry: [point(80, 70), point(100, 70), point(100, 90), point(80, 90), point(80, 70)] };
  const route = { type: 'relation', id: 40, tags: { type: 'route', route: 'light_rail', network: 'DART' },
    members: [{ type: 'way', ref: 31, role: 'platform' }, { type: 'way', ref: 999, role: '' }] };
  const busArea = { type: 'relation', id: 41, tags: { public_transport: 'stop_area', network: 'Trinity Metro' },
    members: [{ type: 'node', ref: 30, role: 'stop' }, { type: 'way', ref: 998, role: '' }] };
  const relationBuilding = { type: 'relation', id: 42, tags: { type: 'multipolygon', building: 'retail' },
    members: [{ type: 'way', ref: 43, role: 'outer', geometry: building.geometry }] };
  let request;
  const progress = [];
  const { data, administrativeBoundary } = await fetchLocationData(center, { onProgress: (p) => progress.push(p),
    fetchImpl: async (url, options) => { request = { url, ...options }; return response([...roads(), road(10, 40, tags),
      building, bus, platform, route, busArea, relationBuilding]); } });
  expect(request).toMatchObject({ method: 'POST', mode: 'cors', credentials: 'omit' });
  expect(request.body).toBeInstanceOf(URLSearchParams);
  const query = request.body.get('data');
  expect(query).toContain(`is_in(${center.lat},${center.lon})`);
  expect(query).toContain('out body geom;');
  expect(query).toContain('rel(bw.stops)["type"="route"]');
  expect(query).not.toContain('railway"="rail');
  expect(query).not.toMatch(/out body geom;[^]*out body geom;/);
  expect(query).not.toMatch(/(?:>>|>;) /);
  expect(data.elements.find((e) => e.id === 10).tags).toEqual(tags);
  expect(data.elements.find((e) => e.id === 20)).toEqual(building);
  expect(data.elements.find((e) => e.buildingRelation === 42).geometry).toEqual(building.geometry);
  expect(data.transitStops.find((e) => e.id === 30)).toEqual(bus);
  const rail = data.transitStops.find((e) => e.id === 31);
  expect(rail.lat).toBeCloseTo(point(90, 80).lat, 10);
  expect(rail.lon).toBeCloseTo(point(90, 80).lon, 10);
  expect(rail.geometry).toEqual(platform.geometry);
  expect(data.transitRoutes[0].members).toEqual([{ type: 'way', ref: 31, role: 'platform' }]);
  expect(data.stopAreas[0].members).toEqual([{ type: 'node', ref: 30, role: 'stop' }]);
  expect(administrativeBoundary).toBeNull();
  expect(data).toMatchObject({ center, attribution: '© OpenStreetMap contributors', license: 'ODbL-1.0' });
  expect(data.provenance.acquisitions).toHaveLength(1);
  expect(progress).toHaveLength(2);
  expect(progress[0]).toContain('400 m half-width');
  expect(progress[1]).toBe('Live map data acquired.');
  const markers = createTransitStopMarkers(data, (stop) => ({ x: 240 + (stop.lon - center.lon) * meters,
    y: 240 - (stop.lat - center.lat) * meters }), 1).markers;
  expect(markers.find((m) => m.mode === 'rail').agencies).toEqual(['dart']);
  expect(markers.find((m) => m.mode === 'bus').agencies).toEqual(['trinity-metro']);
  const diagram = generateLocationDiagram(data, { ...center, administrativeBoundary });
  expect(diagram.coverageMeters).toBe(330);
  expect(diagram.svg).toContain('OpenStreetMap');
});

test('assembles split building outlines and retains raw multipolygon members including holes', async () => {
  const outline = [point(0, 0), point(10, 0), point(10, 10), point(0, 10), point(0, 0)];
  const relation = { type: 'relation', id: 50, tags: { building: 'yes', type: 'multipolygon' }, members: [
    { type: 'way', ref: 51, role: 'outer', geometry: outline.slice(0, 3) },
    { type: 'way', ref: 52, role: 'outer', geometry: outline.slice(2).reverse() },
    { type: 'way', ref: 53, role: 'inner', geometry: [point(2, 2), point(3, 2), point(3, 3), point(2, 2)] },
  ] };
  const { data } = await fetchLocationData(center, { fetchImpl: mockFetch([...roads(), relation]) });
  expect(data.elements.find((e) => e.buildingRelation === 50).geometry).toEqual(outline);
  expect(data.buildingRelations).toEqual([relation]);
});

test('open way platforms retain geometry with finite centroid', async () => {
  const geometry = [point(10, 10), point(20, 20)];
  const { data } = await fetchLocationData(center, { fetchImpl: mockFetch([...roads(),
    { type: 'way', id: 10, tags: { public_transport: 'platform', bus: 'yes' }, geometry }]) });
  expect(data.transitStops[0].lat).toBeCloseTo(point(15, 15).lat, 10);
  expect(data.transitStops[0].geometry).toEqual(geometry);
});

test('enumerates positive provider area containment ordered most-specific without claiming polygon verification', async () => {
  const area = (id, level, name) => ({ type: 'area', id: 3600000000 + id,
    tags: { boundary: 'administrative', admin_level: level, ...(name ? { name } : {}) } });
  const { administrativeBoundary } = await fetchLocationData(center, { fetchImpl: mockFetch([...roads(),
    area(1, '4', 'Texas'), area(2, '8', 'Dallas'), area(3, '10', 'District'), area(4, '', null)],
  { osm3s: { timestamp_osm_base: '2026-10-13T09:00:00Z', timestamp_areas_base: '2026-10-12T09:00:00Z' } }) });
  expect(administrativeBoundary).toMatchObject({ name: 'District', adminLevel: 10, osmId: 3, osmType: 'relation',
    center, boundary: 'administrative', verification: { contains: true, method: 'provider area-index containment',
      independentlyPolygonVerified: false, discoveryAreasTimestamp: '2026-10-12T09:00:00Z' } });
  expect(administrativeBoundary.verification.containingAdministrativeAreas.map((a) => a.adminLevel)).toEqual([10, 8, 4, null]);
  expect(administrativeBoundary.verification).not.toHaveProperty('strictInterior');
  expect(administrativeBoundary).not.toHaveProperty('geometry');
});

test('does not fabricate a boundary/name from nearby relations or unnamed containing areas', async () => {
  const relation = { type: 'relation', id: 2, tags: { boundary: 'administrative', name: 'Nearby, not containing' } };
  const none = await fetchLocationData(center, { fetchImpl: mockFetch([...roads(), relation]) });
  expect(none.administrativeBoundary).toBeNull();
  const unnamed = await fetchLocationData(center, { fetchImpl: mockFetch([...roads(),
    { type: 'area', id: 3600000002, tags: { boundary: 'administrative', admin_level: '8' } }]) });
  expect(unnamed.administrativeBoundary).not.toHaveProperty('name');
  expect(unnamed.administrativeBoundary.verification.contains).toBe(true);
});

test('refetches to cover the exact renderer square and includes newly exposed buildings', async () => {
  const calls = [];
  const extraBuilding = { type: 'way', id: 99, tags: { building: 'yes' },
    geometry: [point(490, -10), point(510, -10), point(510, 10), point(490, -10)] };
  const { data } = await fetchLocationData(center, { fetchImpl: async (_, options) => {
    calls.push(options.body.get('data'));
    return response([...roads([20, 60, 80, 350]), ...(calls.length > 1 ? [extraBuilding] : [])]);
  } });
  expect(calls).toHaveLength(2);
  expect(calls[0]).not.toEqual(calls[1]);
  expect(data.elements).toContainEqual(extraBuilding);
  const rendererExtent = generateLocationDiagram(data, center).coverageMeters / 2;
  expect(data.provenance.coverageHalfExtentMeters).toBeGreaterThan(rendererExtent);
  expect(data.provenance.viewportHalfExtentMeters).toBeCloseTo(577.5, 6);
});

test('groups same-name road pieces and excludes service/cycleway from fitting', async () => {
  let calls = 0;
  await fetchLocationData(center, { fetchImpl: async () => { calls++;
    return response([...roads([20, 40]), road(10, 60, { name: 'Street 1' }),
      road(11, 10, { highway: 'service' }), road(12, 15, { highway: 'cycleway' }),
      ...(calls > 1 ? [road(3, 450), road(4, 500)] : [])]);
  } });
  expect(calls).toBe(3);
});

test('errors clearly instead of silently using incomplete oversized geometry', async () => {
  let calls = 0;
  await expect(fetchLocationData(center, { fetchImpl: async () => { calls++; return response(roads([20, 40, 80, 2500])); } }))
    .rejects.toThrow(/oversized/);
  expect(calls).toBe(1);
  await expect(fetchLocationData(center, { fetchImpl: mockFetch([]) })).rejects.toThrow(/4 named/);
});

test('retries once on provider/network failure with a different CORS endpoint', async () => {
  const urls = [];
  const { data } = await fetchLocationData(center, { fetchImpl: async (url) => {
    urls.push(url);
    return urls.length === 1 ? { ok: false, status: 429 } : response();
  } });
  expect(urls).toHaveLength(2);
  expect(urls[0]).not.toEqual(urls[1]);
  expect(data.source).toBe(urls[1]);
  let calls = 0;
  await expect(fetchLocationData(center, { fetchImpl: async () => { calls++; throw new TypeError('Network/CORS unavailable'); } }))
    .rejects.toThrow(/Network\/CORS unavailable/);
  expect(calls).toBe(2);
});

for (const [title, fetchImpl, error] of [
  ['remark', mockFetch(roads(), { remark: 'runtime error: Query timed out' }), /Overpass error/],
  ['missing elements', async () => ({ ok: true, json: async () => ({}) }), /Malformed/],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }), /Malformed/],
  ['bad geometry', mockFetch([{ ...road(1, 10), geometry: [{ lat: NaN, lon: 0 }] }]), /Malformed/],
  ['missing way geometry', mockFetch([{ type: 'way', id: 1, tags: { highway: 'residential' } }]), /Malformed/],
  ['invalid node', mockFetch([{ type: 'node', id: 1, lat: 100, lon: 0 }]), /Malformed/],
  ['invalid element', mockFetch([null]), /Malformed/],
  ['HTTP 400', async () => ({ ok: false, status: 400 }), /HTTP 400/],
]) {
  test(`errors without retrying on ${title}`, async () => {
    let calls = 0;
    await expect(fetchLocationData(center, { fetchImpl: (...args) => { calls++; return fetchImpl(...args); } })).rejects.toThrow(error);
    expect(calls).toBe(1);
  });
}

test('pre-aborted requests never contact provider; in-flight abort interrupts even an uncooperative fetch', async () => {
  const before = new AbortController(); before.abort();
  let calls = 0;
  await expect(fetchLocationData(center, { signal: before.signal, fetchImpl: async () => { calls++; return response(); } }))
    .rejects.toMatchObject({ name: 'AbortError' });
  expect(calls).toBe(0);
  const active = new AbortController();
  let requestedSignal;
  const pending = fetchLocationData(center, { signal: active.signal, fetchImpl: (_, options) => {
    requestedSignal = options.signal;
    queueMicrotask(() => active.abort());
    return new Promise(() => {});
  } });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(requestedSignal.aborted).toBe(true);
});

test('bounded request timeout falls back and overall deadline aborts uncooperative providers', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  try {
    globalThis.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, delay === 25000 ? 0 : delay, ...args);
    let calls = 0;
    const { data } = await fetchLocationData(center, { fetchImpl: async () => {
      calls++;
      return calls === 1 ? new Promise(() => {}) : response();
    } });
    expect(calls).toBe(2);
    expect(data.source).toContain('kumi');
    globalThis.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, delay === 90000 ? 0 : delay, ...args);
    await expect(fetchLocationData(center, { fetchImpl: () => new Promise(() => {}) }))
      .rejects.toMatchObject({ name: 'TimeoutError', message: 'Live map acquisition timed out.' });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('bounds reject invalid numeric centers before HTTP and near-pole oversized extents', async () => {
  for (const value of [null, { lat: '32', lon: -96 }, { lat: 0, lon: Infinity }, { lat: -91, lon: 0 }]) {
    await expect(fetchLocationData(value, { fetchImpl: () => { throw new Error('Should not fetch'); } })).rejects.toThrow(/Latitude/);
  }
  await expect(fetchLocationData({ lat: 90, lon: 0 }, { fetchImpl: mockFetch() })).rejects.toThrow(/oversized near the pole/);
});
