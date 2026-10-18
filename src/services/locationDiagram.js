import { createTransitStopMarkers } from './transitStops.js';
import { renderTransit } from './railRendering.js';
import { minorStreet, extraLightStreet, freewayStreet, bikeFacility, locationContext, truncateContext } from './diagramContext.js';
import { createStreetLabel } from './streetLabels.js';
import { mergeDividedStreets, collapseDividedTransitions } from './dividedStreets.js';
import { STREET_LABEL_TARGET } from './diagramSettings.js';
import { removeTinyDeadEndNubs, promoteShortDividedGaps, deriveRoadAcquisitionBounds } from './roadVisualCleanup.js';

const SIZE = 480;
const CENTER = SIZE / 2;
const METERS_PER_DEGREE = 111195;

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function nearestPoint(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
  return { x: start.x + t * dx, y: start.y + t * dy };
}

function simplify(points, tolerance = 3) {
  if (points.length <= 2) return points;
  let index = 0;
  let maximum = tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const nearest = nearestPoint(points[i], points[0], points.at(-1));
    const distance = Math.hypot(points[i].x - nearest.x, points[i].y - nearest.y);
    if (distance > maximum) { maximum = distance; index = i; }
  }
  if (!index) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance)];
}

function clipSegment(start, end, padding = 0) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let low = 0;
  let high = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - padding, SIZE - padding - start.x,
    start.y - padding, SIZE - padding - start.y];
  for (let i = 0; i < 4; i++) {
    if (!p[i]) { if (q[i] < 0) return null; continue; }
    const ratio = q[i] / p[i];
    if (p[i] < 0) low = Math.max(low, ratio);
    else high = Math.min(high, ratio);
    if (low > high) return null;
  }
  return [{ x: start.x + low * dx, y: start.y + low * dy },
    { x: start.x + high * dx, y: start.y + high * dy }];
}

export function roundedRailPath(points, radius = 12) {
  if (points.length < 3) return path(points);
  let result = `M${number(points[0].x)},${number(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1];
    const corner = points[i];
    const after = points[i + 1];
    const incoming = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
    if (incoming < 0.1 || outgoing < 0.1) continue;
    const trim = Math.min(radius, incoming * 0.4, outgoing * 0.4);
    const start = { x: corner.x + (before.x - corner.x) * trim / incoming,
      y: corner.y + (before.y - corner.y) * trim / incoming };
    const end = { x: corner.x + (after.x - corner.x) * trim / outgoing,
      y: corner.y + (after.y - corner.y) * trim / outgoing };
    result += ` L${number(start.x)},${number(start.y)} Q${number(corner.x)},${number(corner.y)} ${number(end.x)},${number(end.y)}`;
  }
  return `${result} L${number(points.at(-1).x)},${number(points.at(-1).y)}`;
}

const number = (value) => value.toFixed(1);
const path = (points) => points.map((point, i) => `${i ? 'L' : 'M'}${number(point.x)},${number(point.y)}`).join(' ');
const shortName = (name) => name.replace(/\bNorth\b/g, 'N').replace(/\bSouth\b/g, 'S')
  .replace(/\bStreet\b/g, 'St').replace(/\bAvenue\b/g, 'Ave').replace(/\bBoulevard\b/g, 'Blvd')
  .replace(/\bParkway\b/g, 'Pkwy').replace(/\bDrive\b/g, 'Dr').replace(/\bCircle\b/g, 'Cir')
  .replace(/\bLane\b/g, 'Ln').replace(/\bRoad\b/g, 'Rd');

export function generateLocationDiagram(data, { lat, lon, buildings = true, administrativeBoundary = null, railCatalog = null, hiddenPathTypes = [] }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error('Valid coordinates are required.');
  }
  const project = (point) => ({
    x: (point.lon - lon) * METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180),
    y: -(point.lat - lat) * METERS_PER_DEGREE,
  });
  const groups = new Map();
  for (const element of data.elements || []) {
    if (!element.tags?.highway || element.geometry?.length < 2) continue;
    const points = element.geometry.map(project);
    const key = element.tags.name || `unnamed:${element.id}`;
    const group = groups.get(key) || { name: element.tags.name || '', distance: Infinity, ways: [] };
    const labelEligible = !['service', 'cycleway', 'path', 'footway', 'bridleway', 'track', 'steps'].includes(element.tags.highway);
    if (labelEligible) for (let i = 1; i < points.length; i++) {
      const nearest = nearestPoint({ x: 0, y: 0 }, points[i - 1], points[i]);
      group.distance = Math.min(group.distance, Math.hypot(nearest.x, nearest.y));
    }
    group.ways.push({ id: element.id, tags: element.tags, points, minor: minorStreet(element.tags),
      extraLight: extraLightStreet(element.tags), bike: bikeFacility(element.tags), labelEligible });
    groups.set(key, group);
  }
  const allStreets = [...groups.values()].sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  const streets = allStreets.filter((street) => street.name && street.ways.some((way) => way.labelEligible)).slice(0, STREET_LABEL_TARGET);
  if (!allStreets.length) throw new Error('No named streets are available in this map extract.');
  // Fit the nearest eligible streets, not their potentially distant endpoints.
  const halfExtent = Math.max(120, (streets.at(-1)?.distance || 0) * 1.65);
  const scale = SIZE / (halfExtent * 2);
  const screen = (point) => ({ x: CENTER + point.x * scale, y: CENTER + point.y * scale });
  const streetPaths = [];
  const dividedPaths = [];
  const freewayPaths = [];
  const minorPaths = [];
  const extraLightPaths = [];
  const bikePaths = [];
  const renderedStreets = [];
  const labels = [];
  const labelDefinitions = [];
  const streetLabels = [];
  // Fit the viewport from all streets, then apply the optional visibility controls.
  const hiddenTypes = new Set(hiddenPathTypes);
  const sourceWays = allStreets.flatMap((street) => street.ways
    .filter((way) => !hiddenTypes.has(way.tags.highway)).map((way) => ({ ...way, street })));
  const acquisitionBounds = deriveRoadAcquisitionBounds(data, project);
  const sourceGroups = new Map(allStreets.map((street) => [street, []]));
  for (const way of removeTinyDeadEndNubs(sourceWays, { sourceWays,
    visibleBounds: { minX: -halfExtent, minY: -halfExtent, maxX: halfExtent, maxY: halfExtent }, acquisitionBounds })) {
    sourceGroups.get(way.street).push({ ...way, points: simplify(way.points) });
  }
  const renderGroups = new Map(allStreets.map((street) => [street, []]));
  const consolidated = allStreets.flatMap((street) => mergeDividedStreets(sourceGroups.get(street)));
  const cleanedRoads = promoteShortDividedGaps(collapseDividedTransitions(consolidated), { maxGapLength: 40 });
  for (const way of cleanedRoads) renderGroups.get(way.street).push(way);
  const roadPaths = cleanedRoads.map((way) => ({ ...way, points: way.points.map(screen) }));
  const pinBoxes = [{ x: CENTER, y: CENTER, width: 65, height: 65 }];
  const primaryStreet = streets[0];
  const primaryLabel = primaryStreet ? createStreetLabel({ name: primaryStreet.name, text: shortName(primaryStreet.name),
    rank: 1, polylines: roadPaths.filter((way) => way.street === primaryStreet && way.labelEligible), occupied: pinBoxes, size: SIZE }) : null;
  if (primaryLabel?.markup) {
    labelDefinitions.push(primaryLabel.defs);
    labels.push(primaryLabel.markup);
    streetLabels.push(primaryLabel.diagnostics);
  }
  const stopMarkers = createTransitStopMarkers(data, (point) => screen(project(point)), scale, SIZE,
    { roadPaths, occupied: primaryLabel?.diagnostics?.glyphBoxes || [] });
  let occupied = [...(primaryLabel?.occupied || pinBoxes), ...stopMarkers.occupied];
  for (const street of allStreets) {
    const labelPolylines = [];
    let streetVisible = false;
    for (const way of renderGroups.get(street)) {
      const points = way.points.map(screen);
      const visible = points.slice(1).some((point, index) => clipSegment(points[index], point));
      if (!visible) continue;
      streetVisible = true;
      const markup = `<path data-street="${escapeXml(street.name || 'Unnamed street')}" d="${roundedRailPath(points, 5)}"${way.divided ? ' data-divided="true"' : ''}/>`;
      (way.extraLight ? extraLightPaths : freewayStreet(way.tags) ? freewayPaths
        : way.minor ? minorPaths : way.divided ? dividedPaths : streetPaths).push(markup);
      if (way.bike) bikePaths.push(`<path data-bike-route="${escapeXml(street.name || 'Unnamed bike route')}" d="${roundedRailPath(points, 5)}"/>`);
      if (way.labelEligible) labelPolylines.push(points);
    }
    if (streetVisible && street.name) renderedStreets.push(street.name);
    if (!streets.includes(street) || street === primaryStreet && primaryLabel?.markup) continue;
    const label = createStreetLabel({ name: street.name, text: shortName(street.name),
      rank: streets.indexOf(street) + 1, polylines: labelPolylines, occupied, size: SIZE });
    if (label?.markup) {
      labelDefinitions.push(label.defs);
      labels.push(label.markup);
      streetLabels.push(label.diagnostics);
      occupied = label.occupied;
    }
  }
  const footprints = buildings ? (data.elements || []).filter((element) => element.tags?.building && element.geometry?.length >= 4)
    .flatMap((element) => {
      const points = element.geometry.map(project).map(screen);
      if (!points.some((point) => point.x >= 0 && point.x <= SIZE && point.y >= 0 && point.y <= SIZE)) return [];
      return [`<path d="${path(points)} Z"/>`];
    }) : [];
  const transit = renderTransit(railCatalog, { lat, lon }, halfExtent, project, screen, scale);
  const usedAgencies = [...new Set(stopMarkers.markers.flatMap((stop) => stop.agencies))];
  const logoDefinitions = usedAgencies.map((agency) => {
    const logo = stopMarkers.logos[agency];
    return `<symbol id="agency-${agency}" viewBox="${logo.viewBox}">${logo.markup}</symbol>`;
  }).join('');
  const stopsSvg = stopMarkers.markers.map((stop) => {
    const logoUses = stop.agencies.map((agency, index) => `<use href="#agency-${agency}" x="${number(stop.x - stop.width / 2 + 4 + index * 30)}" y="${number(stop.y - 15)}" width="30" height="30"/>`).join('');
    const shifted = Math.hypot(stop.x - stop.stopX, stop.y - stop.stopY) > 6;
    const modeLabel = stop.mode === 'bus+rail' ? 'bus and rail station' : stop.mode === 'rail' ? 'rail station' : 'bus stop';
    const badge = stop.mode === 'bus+rail' ? 'B+R' : stop.mode === 'rail' ? 'R' : 'B';
    return `<g data-transit-stop="${escapeXml(stop.id)}" data-mode="${stop.mode}" data-agencies="${stop.agencies.join(' ')}"><title>${escapeXml(`${stop.agencyNames.join(' / ') || 'No matching agency logo'} ${modeLabel}: ${stop.name}`)}</title>
${shifted ? `<path d="M${number(stop.stopX)},${number(stop.stopY)} L${number(stop.x)},${number(stop.y)}" fill="none" stroke="#252525" stroke-width="1.5"/><circle cx="${number(stop.stopX)}" cy="${number(stop.stopY)}" r="3" fill="#252525"/>` : ''}
<rect x="${number(stop.x - stop.width / 2)}" y="${number(stop.y - stop.height / 2)}" width="${stop.width}" height="${stop.height}" rx="7" fill="#fff" stroke="#252525" stroke-width="1.5"/>
${logoUses || `<text x="${number(stop.x)}" y="${number(stop.y + 5)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#252525">${stop.mode === 'rail' ? 'RAIL' : 'BUS'}</text>`}
<rect x="${number(stop.x + stop.width / 2 - (badge === 'B+R' ? 23 : 10))}" y="${number(stop.y + stop.height / 2 - 9)}" width="${badge === 'B+R' ? 30 : 14}" height="14" rx="7" fill="#252525"/><text x="${number(stop.x + stop.width / 2 - (badge === 'B+R' ? 8 : 3))}" y="${number(stop.y + stop.height / 2 + 1)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#fff">${badge}</text></g>`;
  }).join('');
  const boundary = administrativeBoundary?.boundary === 'administrative'
    && administrativeBoundary.verification?.contains === true
    && administrativeBoundary.center?.lat === lat && administrativeBoundary.center?.lon === lon
    ? administrativeBoundary : null;
  const context = locationContext(data.elements || [], (point) => screen(project(point)), stopMarkers.markers, boundary);
  const boundaryLabel = context.names.join(', ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-labelledby="title description">
<title id="title">Schematic of pinned location</title>
<desc id="description">North-up approximate street diagram near ${escapeXml(streets.map((street) => street.name).join(', ') || 'the pin')}. Additional visible streets are unlabeled. Rail transit: ${escapeXml(transit.lines.map((line) => `${line.network} ${line.name}`).join(', ') || 'none')}. Transit stops: ${escapeXml(stopMarkers.markers.map((stop) => `${stop.agencyNames.join('/') || 'Unknown agency'} ${stop.mode}: ${stop.name}`).join(', ') || 'none')}. The crosshair marks ${lat}, ${lon}. Not for navigation. Map data: OpenStreetMap contributors, ODbL.</desc>
<defs><clipPath id="frame"><rect width="480" height="480" rx="16"/></clipPath>${logoDefinitions}${labelDefinitions.join('')}</defs>
<g clip-path="url(#frame)">
<rect width="480" height="480" fill="#f5f5f5"/>
<g fill="#dedede" stroke="#c6c6c6" stroke-width="1.5">${footprints.join('')}</g>
<g data-layer="freeways" fill="none" stroke="#bcbcbc" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">${freewayPaths.join('')}</g>
<g data-layer="extra-light-streets" fill="none" stroke="#d6d6d6" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round">${extraLightPaths.join('')}</g>
<g data-layer="minor-streets" fill="none" stroke="#bcbcbc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${minorPaths.join('')}</g>
<g data-layer="streets" fill="none" stroke="#707070" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${streetPaths.join('')}</g>
<g data-layer="divided-streets" fill="none" stroke="#707070" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${dividedPaths.join('')}</g>
<g data-layer="bike-routes" fill="none" stroke="#218739" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${bikePaths.join('')}</g>
<g data-layer="rail-casing" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">${transit.paths.map((railPath) => railPath.replace('data-transit-line=', 'data-rail-casing=').replace(/stroke="[^"]+"/, 'stroke="#fff"')).join('')}</g>
<g data-layer="rail-lines" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${transit.paths.join('')}</g>
${stopsSvg}
<g fill="#252525" font-family="Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle" dominant-baseline="central" stroke="#f5f5f5" stroke-width="5" paint-order="stroke">${labels.join('')}</g>
<g transform="translate(240 240)" stroke="#252525" stroke-width="3"><circle r="17" fill="#ffa800" stroke="none"/><circle r="9" fill="none"/><path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25"/><circle r="2" fill="#252525" stroke="none"/></g>
<g font-family="Arial, sans-serif" fill="#252525"><rect x="10" y="10" width="35" height="34" rx="6" fill="#f5f5f5"/><text x="27" y="33" font-size="18" font-weight="700" text-anchor="middle">N ↑</text>
<rect x="0" y="452" width="480" height="28" fill="#f5f5f5"/><text data-administrative-boundary="${boundary?.osmId || ''}" x="12" y="470" font-size="11"><title>${escapeXml(boundaryLabel)}</title>${escapeXml(truncateContext(boundaryLabel))}</text><a href="https://www.openstreetmap.org/copyright"><text x="468" y="450" font-size="11" text-anchor="end">© OpenStreetMap contributors</text></a></g>
</g></svg>`;
  return { svg, streets: streets.map(({ name, distance }) => ({ name, distance })),
    renderedStreets, transitLines: transit.lines, transitStops: stopMarkers.markers,
    railJunctions: transit.junctions, railSegments: transit.segments, administrativeBoundary: boundary,
    contextLabels: context.names, intersections: context.intersections, streetLabels,
    busStopPairs: stopMarkers.pairs,
    coverageMeters: Math.round(halfExtent * 2) };
}
