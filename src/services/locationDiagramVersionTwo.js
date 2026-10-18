import { renderSourceTransit } from './sourceRailRendering.js';
import { createStreetLabel } from './streetLabels.js';
import { createSimpleTransitStops, snapRailStopsToPaths, placeRailStopLabels } from './simpleTransitStops.js';

const SIZE = 480;
const HEIGHT = SIZE / 1.91;
const CENTER = SIZE / 2;
const CENTER_Y = HEIGHT / 2;
const METERS_PER_DEGREE = 111195;
const LABEL_TARGET = 4;
const EXCLUDED_LABEL_HIGHWAYS = new Set(['service', 'cycleway', 'path', 'footway', 'bridleway', 'track', 'steps']);
const ROAD_HIGHWAYS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified',
  'residential', 'living_street', 'service', 'road', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
// Tailwind blue-700, also used by this page's primary action buttons.
const PRIMARY_BLUE = '#1447e6';
const ROAD_STROKE_WIDTH = 2.5;
export const DEFAULT_HIDDEN_PATH_TYPES = Object.freeze(['construction', 'corridor', 'motorway']);
const shortName = (name) => name.replace(/\bNorth\b/g, 'N').replace(/\bSouth\b/g, 'S')
  .replace(/\bStreet\b/g, 'St').replace(/\bAvenue\b/g, 'Ave').replace(/\bBoulevard\b/g, 'Blvd')
  .replace(/\bParkway\b/g, 'Pkwy').replace(/\bDrive\b/g, 'Dr').replace(/\bRoad\b/g, 'Rd');

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);
const n = (value) => value.toFixed(1);

function boxesOverlap(a, b) {
  return Math.abs(a.x - b.x) <= (a.width + b.width) / 2
    && Math.abs(a.y - b.y) <= (a.height + b.height) / 2;
}

function pathCrossesBox(points, box, strokeWidth) {
  const halfWidth = (box.width + strokeWidth) / 2;
  const halfHeight = (box.height + strokeWidth) / 2;
  return points.slice(1).some((b, i) => {
    const a = points[i]; let low = 0; let high = 1;
    for (const [start, delta, center, extent] of [
      [a.x, b.x - a.x, box.x, halfWidth], [a.y, b.y - a.y, box.y, halfHeight],
    ]) {
      if (Math.abs(delta) < 1e-9) {
        if (Math.abs(start - center) > extent) return false;
      } else {
        const first = (center - extent - start) / delta;
        const last = (center + extent - start) / delta;
        low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last));
        if (low > high) return false;
      }
    }
    return true;
  });
}

function placeCopyright(transit, labeledRoads, stops, streetLabels, stationLabels) {
  // Conservative Arial 11px text bounds, including the white casing.
  const textWidth = 176;
  const candidates = [
    { side: 'right', x: SIZE - 12, anchor: 'end', centerX: SIZE - 12 - textWidth / 2 },
    { side: 'left', x: 12, anchor: 'start', centerX: 12 + textWidth / 2 },
  ];
  const railLines = new Map();
  for (const segment of transit.segments) {
    if (!railLines.has(segment.line)) railLines.set(segment.line, []);
    railLines.get(segment.line).push(segment.points);
  }
  for (const candidate of candidates) {
    const box = { x: candidate.centerX, y: HEIGHT - 16, width: textWidth + 4, height: 18 };
    candidate.collisions = [...railLines.values()].filter((paths) => paths.some((points) => pathCrossesBox(points, box, 8.5))).length
      + [...labeledRoads.values()].filter((paths) => paths.some((points) => pathCrossesBox(points, box, ROAD_STROKE_WIDTH))).length
      + stops.filter((stop) => {
        const radius = stop.radius + (stop.mode === 'rail' && !stop.streetcar ? ROAD_STROKE_WIDTH : 0.75);
        const dx = Math.max(0, Math.abs(stop.x - box.x) - box.width / 2);
        const dy = Math.max(0, Math.abs(stop.y - box.y) - box.height / 2);
        return dx * dx + dy * dy <= radius * radius;
      }).length
      + streetLabels.filter((label) => label.glyphBoxes.some((glyph) => boxesOverlap(glyph, box))).length
      + stationLabels.filter((label) => boxesOverlap(label, box)).length;
  }
  // Keep the established right-hand corner when both sides are equally clear.
  return candidates[1].collisions < candidates[0].collisions ? candidates[1] : candidates[0];
}

function nearestDistance(points) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy))) : 0;
    distance = Math.min(distance, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return distance;
}

/** Version Two: landscape street diagram with source rail geometry and individual stops. */
export function generateVersionTwoLocationDiagram(data, { lat, lon, buildings = true, railCatalog = null, hiddenPathTypes = DEFAULT_HIDDEN_PATH_TYPES } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('Valid coordinates are required.');
  }
  const project = (point) => ({
    x: (point.lon - lon) * METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180),
    y: -(point.lat - lat) * METERS_PER_DEGREE,
  });
  const ways = (data.elements || []).filter((element) => element.tags?.highway && element.geometry?.length >= 2)
    .map((element) => ({ ...element, projected: element.geometry.map(project) }));
  const named = new Map();
  for (const way of ways) {
    if (!way.tags.name || EXCLUDED_LABEL_HIGHWAYS.has(way.tags.highway)) continue;
    named.set(way.tags.name, Math.min(named.get(way.tags.name) ?? Infinity, nearestDistance(way.projected)));
  }
  const streets = [...named].map(([name, distance]) => ({ name, distance }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name)).slice(0, LABEL_TARGET);
  if (!streets.length) throw new Error('No named streets are available in this map extract.');

  const halfExtent = Math.max(120, streets.at(-1).distance * 1.65);
  const scale = SIZE / (halfExtent * 2);
  const screen = (point) => ({ x: CENTER + point.x * scale, y: CENTER_Y + point.y * scale });
  // Visibility controls do not change the streets used to fit the viewport.
  const hiddenTypes = new Set(hiddenPathTypes);
  const visibleWays = ways.filter((way) => !hiddenTypes.has(way.tags.highway));
  const d = (points) => points.map((point, i) => `${i ? 'L' : 'M'}${n(point.x)},${n(point.y)}`).join(' ');
  const transit = renderSourceTransit(railCatalog, { lat, lon }, halfExtent, project, screen, scale, { width: SIZE, height: HEIGHT });
  const stops = snapRailStopsToPaths(createSimpleTransitStops(data, (point) => screen(project(point)), SIZE, railCatalog, HEIGHT), transit.segments, SIZE, HEIGHT);
  const labelDefinitions = []; const labels = []; const streetLabels = [];
  let occupied = [{ x: CENTER, y: CENTER_Y, width: 65, height: 65 }, ...stops.filter((stop) => stop.mode === 'rail')
    .map((stop) => ({ x: stop.x, y: stop.y, width: stop.radius * 2 + 6, height: stop.radius * 2 + 6 }))];
  for (const [index, street] of streets.entries()) {
    const label = createStreetLabel({ name: street.name, text: shortName(street.name), rank: index + 1,
      id: `minimal-${index}`, size: SIZE, height: HEIGHT, margins: { top: 12, bottom: 24 }, allowPrimaryClipping: true, radius: 0, inheritPaint: true, haloColor: '#fff', occupied,
      polylines: visibleWays.filter((way) => way.tags.name === street.name && !EXCLUDED_LABEL_HIGHWAYS.has(way.tags.highway))
        .map((way) => way.projected.map(screen)) });
    if (!label.markup) continue;
    labelDefinitions.push(label.defs); labels.push(label.markup);
    streetLabels.push(label.diagnostics); occupied = label.occupied;
  }
  const labeledNames = new Set(streetLabels.map((label) => label.name));
  const roadPaths = []; const minorPaths = []; const labeledRoads = new Map();
  for (const way of visibleWays) {
    const points = way.projected.map(screen);
    const opacity = labeledNames.has(way.tags.name) && !EXCLUDED_LABEL_HIGHWAYS.has(way.tags.highway) ? 1 : 0.2;
    if (opacity === 1) {
      if (!labeledRoads.has(way.tags.name)) labeledRoads.set(way.tags.name, []);
      labeledRoads.get(way.tags.name).push(points);
    }
    (ROAD_HIGHWAYS.has(way.tags.highway) ? roadPaths : minorPaths)
      .push(`<path data-road="${escapeXml(way.tags.name || '')}" stroke-opacity="${opacity}" d="${d(points)}"/>`);
  }
  const footprints = buildings ? (data.elements || []).filter((element) => element.tags?.building && element.geometry?.length >= 4)
    .map((element) => `<path d="${d(element.geometry.map(project).map(screen))} Z"/>`).join('') : '';
  const railPaths = transit.paths.join('');
  const railCasingPaths = transit.paths.map((railPath) => railPath.replace('data-transit-line=', 'data-rail-casing=')
    .replace(/stroke="[^"]+"/, 'stroke="#fff"')).join('');
  const stationLabels = placeRailStopLabels(stops, [
    { x: CENTER, y: CENTER_Y, width: 34, height: 34 },
    { x: CENTER, y: CENTER_Y, width: 48, height: 7 },
    { x: CENTER, y: CENTER_Y, width: 7, height: 48 },
    ...streetLabels.flatMap((label) => label.glyphBoxes),
  ], SIZE, HEIGHT);
  const copyright = placeCopyright(transit, labeledRoads, stops, streetLabels, stationLabels);
  const stationText = stationLabels.map((label) => `<text data-rail-stop-label="${escapeXml(label.stopId)}" x="${n(label.x)}" font-family="Arial, sans-serif" font-size="${label.fontSize}" font-weight="700" text-anchor="middle">${label.lines.map((text, i) => `<tspan x="${n(label.x)}" y="${n(label.y + (i - (label.lines.length - 1) / 2) * label.lineHeight + label.fontSize / 3)}">${escapeXml(text)}</tspan>`).join('')}</text>`).join('');
  const leaders = stationLabels.map((label) => `<path data-rail-stop-leader="${escapeXml(label.stopId)}" d="${label.leaderPoints.map((point, i) => `${i ? 'L' : 'M'}${n(point.x)},${n(point.y)}`).join(' ')}"/>`).join('');
  const stopsSvg = stops.map((stop) => `<g data-transit-stop="${escapeXml(stop.id)}" data-mode="${stop.mode}" data-source="${stop.source}" transform="translate(${n(stop.x)} ${n(stop.y)})"><title>${escapeXml(stop.name)}</title><circle r="${stop.radius}" fill="#fff" stroke="#000" stroke-width="${stop.mode === 'rail' && !stop.streetcar ? ROAD_STROKE_WIDTH * 2 : 1.5}"/><text fill="#000" font-family="Arial, sans-serif" font-size="${stop.radius / 7 * 9}" font-weight="700" text-anchor="middle" dominant-baseline="central">${stop.mode === 'rail' ? 'R' : 'B'}</text></g>`).join('');
  const centerLat = lat; const centerLon = lon;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${HEIGHT}" viewBox="0 0 ${SIZE} ${HEIGHT}" role="img" aria-labelledby="title description">
<title id="title">Simple street diagram</title>
<desc id="description">Street diagram near ${escapeXml(streets.map(({ name }) => name).join(', '))}. Rail transit: ${escapeXml(transit.lines.map((line) => `${line.network} ${line.name}`).join(', ') || 'none')}. Center pin: ${centerLat}, ${centerLon}. Map data: OpenStreetMap contributors, ODbL.</desc>
<defs><clipPath id="frame"><rect width="${SIZE}" height="${HEIGHT}" rx="16"/></clipPath>${labelDefinitions.join('')}</defs>
<g clip-path="url(#frame)"><rect width="${SIZE}" height="${HEIGHT}" fill="#fff"/>
<g fill="#e5e5e5" stroke="#d0d0d0" stroke-width="1">${footprints}</g>
<g data-layer="minor-paths" fill="none" stroke="#999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${minorPaths.join('')}</g>
<g data-layer="roads" fill="none" stroke="#555" stroke-width="${ROAD_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${roadPaths.join('')}</g>
<g data-layer="rail-casing" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">${railCasingPaths}</g>
<g data-layer="rail-lines" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${railPaths}</g>
<g data-layer="rail-stop-leaders" fill="none" stroke="#000" stroke-width="${ROAD_STROKE_WIDTH * 2}">${leaders}</g>
<g data-layer="transit-stops">${stopsSvg}</g>
<g data-layer="street-label-casing" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"><g data-layer="station-label-casing" fill="#000" stroke="#000">${stationText}</g>${labels.join('')}</g>
<g data-layer="street-label-ink" fill="#000" stroke="none"><g data-layer="station-label-ink" fill="#fff">${stationText}</g>${labels.join('')}</g>
<g data-layer="crosshair" transform="translate(${CENTER} ${CENTER_Y})" stroke="${PRIMARY_BLUE}" stroke-width="3"><circle r="14" fill="${PRIMARY_BLUE}" fill-opacity="0.25"/><path d="M-22 0H22 M0-22V22"/><circle r="3" fill="${PRIMARY_BLUE}"/></g>
<text data-copyright-corner="${copyright.side}" x="${copyright.x}" y="${HEIGHT - 12}" text-anchor="${copyright.anchor}" font-family="Arial,sans-serif" font-size="11" fill="#333" stroke="#fff" stroke-width="2" stroke-linejoin="round" paint-order="stroke">© OpenStreetMap contributors</text></g></svg>`;
  return { svg, streets, renderedStreets: visibleWays.map((way) => way.tags.name || 'Unnamed street'),
    transitLines: transit.lines, transitStops: stops, railJunctions: transit.junctions, railSegments: transit.segments, administrativeBoundary: null,
    contextLabels: [], intersections: [], streetLabels, railStopLabels: stationLabels, busStopPairs: [], width: SIZE, height: HEIGHT,
    coverageHeightMeters: Math.round(HEIGHT / scale), coverageMeters: Math.round(halfExtent * 2) };
}

