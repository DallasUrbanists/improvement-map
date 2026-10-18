import { STREET_LABEL_TARGET } from './diagramSettings.js';

// Vite proxies this path in development to avoid browser CORS restrictions.
const ENDPOINTS = import.meta.env?.DEV
  ? ['/__overpass', '/__overpass-kumi']
  : ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const METERS_PER_DEGREE = 111195;
const MAX_HALF_EXTENT = 3000;
const ATTRIBUTION = '© OpenStreetMap contributors';
const EXCLUDED_STREETS = new Set(['service', 'cycleway', 'path', 'footway', 'bridleway', 'track', 'steps']);

export function parseCoordinateString(input) {
  const decimal = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  if (typeof input !== 'string' || !new RegExp(`^\\s*(${decimal})\\s*,\\s*(${decimal})\\s*$`).test(input)) {
    throw new Error('Enter exactly two decimal numbers separated by a comma: latitude, longitude.');
  }
  const [lat, lon] = input.split(',').map(Number);
  validateCenter({ lat, lon });
  return { lat, lon };
}

function validateCenter(center) {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)
    || Math.abs(center.lat) > 90 || Math.abs(center.lon) > 180) {
    throw new Error('Latitude must be between -90 and 90; longitude between -180 and 180.');
  }
}

function boundingBoxes(center, halfExtent) {
  const latitudeDelta = halfExtent / METERS_PER_DEGREE;
  const longitudeDelta = latitudeDelta / Math.abs(Math.cos(center.lat * Math.PI / 180));
  if (longitudeDelta > 180) throw new Error('Requested viewport is oversized near the pole; cannot safely acquire complete geometry.');
  const south = Math.max(-90, center.lat - latitudeDelta);
  const north = Math.min(90, center.lat + latitudeDelta);
  const west = center.lon - longitudeDelta;
  const east = center.lon + longitudeDelta;
  const ranges = west < -180 ? [[west + 360, 180], [-180, east]]
    : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
  return ranges.map(([w, e]) => [south, w, north, e]);
}

function queryFor(center, bounds, includeAdministrativeAreas = true) {
  const local = bounds.map((box) => {
    const bbox = box.join(',');
    return `way["highway"](${bbox});way["building"](${bbox});rel["building"](${bbox});`;
  }).join('');
  const stops = bounds.map((box) => {
    const bbox = box.join(',');
    return `nw["highway"~"^(bus_stop|platform)$"](${bbox});nw["public_transport"~"^(platform|stop_position|station)$"](${bbox});nw["railway"~"^(station|halt|tram_stop|stop|platform)$"](${bbox});`;
  }).join('');
  // Route bodies provide membership refs/tags only. Never recurse into rail route ways or request their geometry.
  return `[out:json][timeout:20][maxsize:25000000];(${local})->.local;(${stops})->.stops;(.local;.stops;);out body geom;` 
    + `(rel(bn.stops)["type"="route"];rel(bw.stops)["type"="route"];rel(bn.stops)["public_transport"="stop_area"];rel(bw.stops)["public_transport"="stop_area"];);out body;`
    + (includeAdministrativeAreas ? `is_in(${center.lat},${center.lon})->.containing;area.containing["boundary"="administrative"];out tags;` : '');
}

function missingAdministrativeAreaIndex(payload) {
  return /No such file or directory/.test(payload?.remark || '')
    && /\/(?:area_tags_(?:local|global)|area_blocks|areas)\.bin\b/.test(payload.remark);
}

function validatePayload(payload) {
  if (!payload || payload.remark) throw new Error(`Overpass error: ${payload?.remark || 'malformed response'}`);
  if (!Array.isArray(payload.elements)) throw new Error('Malformed Overpass response: missing elements.');
  for (const element of payload.elements) {
    if (!element || !['node', 'way', 'relation', 'area'].includes(element.type)
      || !Number.isSafeInteger(element.id) || element.id < 0
      || (element.tags !== undefined && (!element.tags || typeof element.tags !== 'object' || Array.isArray(element.tags)))
      || (element.geometry !== undefined && (!Array.isArray(element.geometry) || element.geometry.some((p) => !validPoint(p))))
      || (element.type === 'node' && !validPoint(element))
      || (element.members !== undefined && (!Array.isArray(element.members) || element.members.some((member) =>
        !member || !['node', 'way', 'relation'].includes(member.type) || !Number.isSafeInteger(member.ref)
        || (member.geometry !== undefined && (!Array.isArray(member.geometry) || member.geometry.some((p) => !validPoint(p)))))))) {
      throw new Error('Malformed Overpass element or geometry.');
    }
    if (element.type === 'way' && !Array.isArray(element.geometry)) throw new Error('Malformed Overpass way: missing geometry.');
  }
}

function validPoint(point) {
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lon)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;
}

function isStop(tags = {}) {
  return ['bus_stop', 'platform'].includes(tags.highway)
    || ['platform', 'stop_position', 'station'].includes(tags.public_transport)
    || ['station', 'halt', 'tram_stop', 'stop', 'platform'].includes(tags.railway);
}

function centroid(geometry) {
  const points = geometry.length > 1 && geometry[0].lat === geometry.at(-1).lat
    && geometry[0].lon === geometry.at(-1).lon ? geometry.slice(0, -1) : geometry;
  // Area centroid for closed platforms; line/degenerate platforms use the vertex mean.
  if (points.length >= 3 && points.length !== geometry.length) {
    const origin = points[0];
    let area = 0; let x = 0; let y = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i]; const b = points[(i + 1) % points.length];
      const ax = a.lon - origin.lon; const ay = a.lat - origin.lat;
      const bx = b.lon - origin.lon; const by = b.lat - origin.lat;
      const cross = ax * by - bx * ay;
      area += cross; x += (ax + bx) * cross; y += (ay + by) * cross;
    }
    if (Math.abs(area) > 1e-20) return { lat: origin.lat + y / (3 * area), lon: origin.lon + x / (3 * area) };
  }
  return { lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lon: points.reduce((sum, p) => sum + p.lon, 0) / points.length };
}

function normalize(payload) {
  const unique = [...new Map(payload.elements.map((element) => [`${element.type}:${element.id}`, element])).values()];
  const elements = unique.filter((element) => element.type === 'way' && (element.tags?.highway || element.tags?.building));
  const buildingRelations = unique.filter((element) => element.type === 'relation' && element.tags?.building);
  for (const relation of buildingRelations) {
    const remaining = (relation.members || []).filter((member) => member.type === 'way' && (!member.role || member.role === 'outer'))
      .map((member) => ({ ref: member.ref, geometry: [...(member.geometry || [])] }));
    const same = (a, b) => a && b && a.lat === b.lat && a.lon === b.lon;
    while (remaining.length) {
      const { ref, geometry } = remaining.shift();
      if (geometry.length < 2) throw new Error('Malformed Overpass building relation: missing outer geometry.');
      while (!same(geometry[0], geometry.at(-1))) {
        const index = remaining.findIndex((member) => same(geometry.at(-1), member.geometry[0]) || same(geometry.at(-1), member.geometry.at(-1)));
        if (index < 0) throw new Error('Malformed Overpass building relation: unclosed outer geometry.');
        const next = remaining.splice(index, 1)[0].geometry;
        if (!same(geometry.at(-1), next[0])) next.reverse();
        geometry.push(...next.slice(1));
      }
      if (geometry.length < 4) throw new Error('Malformed Overpass building relation: degenerate footprint.');
      elements.push({ type: 'way', id: `relation:${relation.id}:${ref}`, tags: { ...relation.tags }, geometry,
        buildingRelation: relation.id });
    }
  }
  const transitStops = unique.filter((element) => ['node', 'way'].includes(element.type) && isStop(element.tags))
    .map((element) => ({ ...element, ...(element.type === 'way' && element.geometry.length ? centroid(element.geometry) : {}) }))
    .filter(validPoint);
  const keys = new Set(transitStops.map((stop) => `${stop.type}:${stop.id}`));
  const membership = (relation) => ({ id: relation.id, type: relation.type, tags: relation.tags,
    members: (relation.members || []).filter((member) => keys.has(`${member.type}:${member.ref}`))
      .map(({ type, ref, role }) => ({ type, ref, role })) });
  return { elements, transitStops, buildingRelations,
    transitRoutes: unique.filter((e) => e.type === 'relation' && e.tags?.type === 'route').map(membership),
    stopAreas: unique.filter((e) => e.type === 'relation' && e.tags?.public_transport === 'stop_area').map(membership) };
}

function viewport(elements, center) {
  const distances = new Map();
  const cosine = Math.cos(center.lat * Math.PI / 180);
  for (const way of elements) {
    if (!way.tags?.name || !way.tags.highway || EXCLUDED_STREETS.has(way.tags.highway) || way.geometry.length < 2) continue;
    let distance = Infinity;
    for (let i = 1; i < way.geometry.length; i++) {
      const a = way.geometry[i - 1]; const b = way.geometry[i];
      const x = (a.lon - center.lon) * METERS_PER_DEGREE * cosine;
      const y = (a.lat - center.lat) * METERS_PER_DEGREE;
      const dx = (b.lon - a.lon) * METERS_PER_DEGREE * cosine;
      const dy = (b.lat - a.lat) * METERS_PER_DEGREE;
      const t = dx || dy ? Math.max(0, Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy))) : 0;
      distance = Math.min(distance, Math.hypot(x + t * dx, y + t * dy));
    }
    distances.set(way.tags.name, Math.min(distances.get(way.tags.name) ?? Infinity, distance));
  }
  const nearest = [...distances.values()].sort((a, b) => a - b).slice(0, STREET_LABEL_TARGET);
  return { count: nearest.length, furthestDistance: nearest.at(-1) || 0, halfExtent: Math.max(120, (nearest.at(-1) || 0) * 1.65) };
}

function boundaryFrom(payload, center, provenance) {
  const areas = payload.elements.filter((e) => e.type === 'area' && e.tags?.boundary === 'administrative');
  if (!areas.length) return null;
  const candidates = areas.map((area) => {
    const osmType = area.id >= 3600000000 ? 'relation' : area.id >= 2400000000 ? 'way' : 'area';
    const osmId = area.id - (osmType === 'relation' ? 3600000000 : osmType === 'way' ? 2400000000 : 0);
    const level = /^\d+$/.test(area.tags.admin_level || '') ? Number(area.tags.admin_level) : null;
    return { areaId: area.id, osmType, osmId, ...(area.tags.name ? { name: area.tags.name } : {}), adminLevel: level,
      boundary: 'administrative', tags: area.tags,
      source: osmType === 'area' ? provenance.endpoint : `https://www.openstreetmap.org/${osmType}/${osmId}` };
  }).sort((a, b) => (b.adminLevel ?? -1) - (a.adminLevel ?? -1) || a.areaId - b.areaId);
  return { ...candidates[0], center: { ...center }, attribution: ATTRIBUTION, license: 'ODbL-1.0',
    verification: { contains: true, method: 'provider area-index containment', independentlyPolygonVerified: false,
      selection: 'Highest admin_level returned by Overpass is_in; ties use area ID. Area-index completeness and freshness are provider-dependent.',
      containingAdministrativeAreas: candidates, retrievedAt: provenance.retrievedAt,
      discoverySource: provenance.endpoint, discoveryQuery: provenance.query,
      discoveryOsmTimestamp: payload.osm3s?.timestamp_osm_base ?? null,
      discoveryAreasTimestamp: payload.osm3s?.timestamp_areas_base ?? null } };
}

/**
 * Acquire renderer fixtures; onProgress receives display strings.
 * Limits: 20 s provider queries, 25 s requests, 90 s overall, two endpoints per
 * round, five rounds maximum, 400 m initial / 3 km maximum square half-width.
 * Keep supplying the existing local railCatalog to generateLocationDiagram.
 */
export async function fetchLocationData(center, { signal, onProgress, fetchImpl = fetch } = {}) {
  validateCenter(center);
  center = { lat: center.lat, lon: center.lon };
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const deadline = setTimeout(() => controller.abort(new DOMException('Live map acquisition timed out.', 'TimeoutError')), 90000);
  const acquisitions = [];
  const providersWithoutAreas = new Set();
  const checkAbort = () => { if (controller.signal.aborted) throw controller.signal.reason || new DOMException('Aborted', 'AbortError'); };
  try {
    let halfExtent = 400;
    for (let round = 0; round < 5; round++) {
      checkAbort();
      const bounds = boundingBoxes(center, halfExtent);
      let query;
      onProgress?.(`${round ? 'Expanding' : 'Fetching'} live OpenStreetMap streets, buildings, stops and administrative areas (${halfExtent} m half-width)…`);
      let payload; let endpoint; let lastError;
      const endpointErrors = [];
      for (endpoint of ENDPOINTS) {
        checkAbort();
        query = queryFor(center, bounds, !providersWithoutAreas.has(endpoint));
        const requestController = new AbortController();
        const relay = () => requestController.abort(controller.signal.reason);
        controller.signal.addEventListener('abort', relay, { once: true });
        const timer = setTimeout(() => requestController.abort(new DOMException('Overpass request timed out.', 'TimeoutError')), 25000);
        let removeAbort;
        try {
          const aborted = new Promise((_, reject) => {
            const listener = () => reject(requestController.signal.reason);
            removeAbort = () => requestController.signal.removeEventListener('abort', listener);
            requestController.signal.addEventListener('abort', listener, { once: true });
          });
          const result = await Promise.race([aborted, (async () => {
            const requestPayload = async () => {
              const response = await fetchImpl(endpoint, { method: 'POST', mode: 'cors', credentials: 'omit',
                body: new URLSearchParams({ data: query }), signal: requestController.signal });
              if (!response.ok) {
                const error = new Error(`Overpass HTTP ${response.status}`);
                error.retryable = [403, 406, 429].includes(response.status) || response.status >= 500;
                throw error;
              }
              let json;
              try { json = await response.json(); } catch { throw new Error('Malformed Overpass JSON response.'); }
              return json;
            };
            let json = await requestPayload();
            if (missingAdministrativeAreaIndex(json) && !providersWithoutAreas.has(endpoint)) {
              providersWithoutAreas.add(endpoint);
              query = queryFor(center, bounds, false);
              onProgress?.('Provider administrative-area index unavailable; fetching streets, buildings and stops without boundary labels…');
              json = await requestPayload();
            }
            validatePayload(json);
            return json;
          })()]);
          payload = result;
          break;
        } catch (error) {
          checkAbort();
          lastError = error;
          endpointErrors.push(`${endpoint}: ${error.message || 'network error'}`);
          if (!(error instanceof TypeError) && error.name !== 'TimeoutError' && !error.retryable) throw error;
          onProgress?.(`Overpass unavailable (${error.message || 'network error'}); trying the fallback provider…`);
        } finally {
          clearTimeout(timer); removeAbort?.();
          controller.signal.removeEventListener('abort', relay);
        }
      }
      if (!payload) throw new Error(`Unable to acquire live map data. ${endpointErrors.join('; ') || lastError?.message || 'Providers unavailable.'}`);
      checkAbort();
      const provenance = { endpoint, query, bounds, halfExtentMeters: halfExtent, retrievedAt: new Date().toISOString(),
        administrativeAreaIndexAvailable: !providersWithoutAreas.has(endpoint),
        osmTimestamp: payload.osm3s?.timestamp_osm_base ?? null, areasTimestamp: payload.osm3s?.timestamp_areas_base ?? null };
      acquisitions.push(provenance);
      const data = normalize(payload);
      const extent = viewport(data.elements, center);
      if (extent.count === STREET_LABEL_TARGET && extent.furthestDistance <= halfExtent && extent.halfExtent + 20 <= halfExtent) {
        Object.assign(data, { center, source: endpoint, capturedAt: provenance.retrievedAt, attribution: ATTRIBUTION,
          license: 'ODbL-1.0', provenance: { provider: 'Overpass / OpenStreetMap', acquisitions,
            viewportHalfExtentMeters: extent.halfExtent, coverageHalfExtentMeters: halfExtent,
            railGeometry: 'Not acquired; renderer must use the existing local rail catalog.' } });
        const administrativeBoundary = boundaryFrom(payload, center, provenance);
        onProgress?.('Live map data acquired.');
        return { data, administrativeBoundary };
      }
      if (halfExtent >= MAX_HALF_EXTENT) break;
      const next = Math.max(halfExtent * 2, Math.ceil(extent.halfExtent + 30));
      if (extent.halfExtent + 20 > MAX_HALF_EXTENT) break;
      halfExtent = Math.min(MAX_HALF_EXTENT, next);
    }
    throw new Error(`Requested diagram viewport is oversized or lacks ${STREET_LABEL_TARGET} named non-service streets within 3 km; complete geometry cannot be safely acquired.`);
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}
