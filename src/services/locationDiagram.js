import { createTransitStopMarkers } from './transitStops.js';
import { railSegmentsInBounds } from './railGeometry.js';
import { minorStreet, extraLightStreet, freewayStreet, bikeFacility, locationContext, truncateContext } from './diagramContext.js';
import { createStreetLabel } from './streetLabels.js';
import { applyRailJunctionFixtures } from './railJunctionFixtures.js';
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

function offsetPolyline(points, offset) {
  const normals = points.slice(1).map((point, index) => {
    const dx = point.x - points[index].x;
    const dy = point.y - points[index].y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
  return points.map((point, index) => {
    const before = normals[Math.max(0, index - 1)];
    const after = normals[Math.min(index, normals.length - 1)];
    const sum = { x: before.x + after.x, y: before.y + after.y };
    const length = Math.hypot(sum.x, sum.y);
    const normal = length > 0.01 ? { x: sum.x / length, y: sum.y / length } : after;
    const projection = normal.x * after.x + normal.y * after.y;
    const distance = offset / Math.max(1 / 3, projection);
    return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
  });
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

function arrangeRailJunctions(chains, scale) {
  const junctions = [];
  const endpoint = (chain, end) => end ? chain.points.at(-1) : chain.points[0];
  const tangent = (chain, end) => {
    const point = endpoint(chain, end);
    const neighbor = end ? chain.points.at(-2) : chain.points[1];
    const dx = end ? point.x - neighbor.x : neighbor.x - point.x;
    const dy = end ? point.y - neighbor.y : neighbor.y - point.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  };
  for (const trunk of [...chains].sort((a, b) => b.keys.length - a.keys.length)) {
    for (const trunkEnd of [false, true]) {
      const point = endpoint(trunk, trunkEnd);
      const direction = tangent(trunk, trunkEnd);
      const normal = { x: -direction.y, y: direction.x };
      const branches = chains.filter((branch) => branch !== trunk && branch.keys.length < trunk.keys.length
        && branch.keys.every((key) => trunk.keys.includes(key))).flatMap((branch) => {
        const distances = [false, true].map((end) => ({ end, distance: Math.hypot(endpoint(branch, end).x - point.x, endpoint(branch, end).y - point.y) }));
        const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
        if (nearest.distance > 35 * scale) return [];
        const neighbor = nearest.end ? branch.points.at(-2) : branch.points[1];
        return [{ chain: branch, end: nearest.end, side: (neighbor.x - point.x) * normal.x + (neighbor.y - point.y) * normal.y }];
      }).sort((a, b) => a.side - b.side || a.chain.signature.localeCompare(b.chain.signature));
      if (branches.length < 2) continue;
      const services = branches.flatMap((branch) => branch.chain.keys);
      if (new Set(services).size !== services.length || services.length !== trunk.keys.length) continue;
      trunk.keys = branches.flatMap((branch) => [...branch.chain.keys].sort());
      for (const branch of branches) {
        const branchDirection = tangent(branch.chain, branch.end);
        const sameOrientation = branchDirection.x * direction.x + branchDirection.y * direction.y >= 0;
        branch.chain.keys = trunk.keys.filter((key) => branch.chain.keys.includes(key));
        if (!sameOrientation) branch.chain.keys.reverse();
      }
      junctions.push({ trunk, trunkEnd, branches });
    }
  }
  return junctions;
}

function renderTransit(catalog, center, halfExtent, project, screen, scale) {
  const lines = new Map((catalog?.lines || []).map((line) => [line.id, line]));
  const corridors = [];
  for (const way of railSegmentsInBounds(catalog, center, halfExtent + 20 / scale)) {
    const keys = way.keys;
    const signature = keys.join('|');
    const geometry = way.geometry.map(project);
    if (geometry[0].x > geometry.at(-1).x || (geometry[0].x === geometry.at(-1).x && geometry[0].y > geometry.at(-1).y)) geometry.reverse();
    const points = simplify(geometry, 1).map(screen);
    for (let i = 1; i < points.length; i++) {
      const clipped = clipSegment(points[i - 1], points[i], -20);
      if (!clipped) continue;
      let [a, b] = clipped;
      if (a.x > b.x || (a.x === b.x && a.y > b.y)) [a, b] = [b, a];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 0.1) continue;
      const ux = (b.x - a.x) / length;
      const uy = (b.y - a.y) / length;
      // Group local shape variants spatially; lane membership is resolved per interval below.
      const match = corridors.find((corridor) => {
        if (corridor.ux * ux + corridor.uy * uy < Math.cos(10 * Math.PI / 180)) return false;
        const normalA = -corridor.uy * a.x + corridor.ux * a.y;
        const normalB = -corridor.uy * b.x + corridor.ux * b.y;
        const ta = corridor.ux * a.x + corridor.uy * a.y;
        const tb = corridor.ux * b.x + corridor.uy * b.y;
        return Math.max(Math.abs(normalA - corridor.normal), Math.abs(normalB - corridor.normal)) <= 10 * scale
          && Math.min(ta, tb) <= corridor.end + 3 * scale && Math.max(ta, tb) >= corridor.start - 3 * scale;
      });
      if (match) {
        const normal = (-match.uy * (a.x + b.x) + match.ux * (a.y + b.y)) / 2;
        match.normal = (match.normal * match.weight + normal * length) / (match.weight + length);
        match.weight += length;
        const ta = match.ux * a.x + match.uy * a.y;
        const tb = match.ux * b.x + match.uy * b.y;
        match.start = Math.min(match.start, ta, tb);
        match.end = Math.max(match.end, ta, tb);
        match.intervals.push({ start: Math.min(ta, tb), end: Math.max(ta, tb), keys });
      } else {
        const start = ux * a.x + uy * a.y;
        const end = ux * b.x + uy * b.y;
        corridors.push({ signature, keys, ux, uy, normal: -uy * a.x + ux * a.y,
          start, end, weight: length, intervals: [{ start, end, keys }] });
      }
    }
  }
  // Split overlapping route variants at membership changes before assigning lanes.
  const sharedCorridors = corridors.flatMap((corridor) => {
    const boundaries = [...new Set(corridor.intervals.flatMap((interval) => [interval.start, interval.end]))].sort((a, b) => a - b);
    const fragments = [];
    for (let i = 1; i < boundaries.length; i++) {
      const start = boundaries[i - 1];
      const end = boundaries[i];
      if (end - start < 0.1) continue;
      const middle = (start + end) / 2;
      const keys = [...new Set(corridor.intervals.filter((interval) => middle >= interval.start && middle <= interval.end)
        .flatMap((interval) => interval.keys))].sort();
      if (!keys.length) continue;
      const signature = keys.join('|');
      const previous = fragments.at(-1);
      if (previous?.signature === signature && start - previous.end < 1) previous.end = end;
      else fragments.push({ ...corridor, keys, signature, start, end });
    }
    return fragments;
  });
  const chains = sharedCorridors.map((corridor) => ({
    signature: corridor.signature, keys: corridor.keys,
    points: [corridor.start, corridor.end].map((t) => ({
      x: corridor.ux * t - corridor.uy * corridor.normal,
      y: corridor.uy * t + corridor.ux * corridor.normal,
    })),
  }));
  // Join bends before offsetting so each service stays continuous through corners.
  for (let i = 0; i < chains.length; i++) {
    let joined = true;
    while (joined) {
      joined = false;
      for (let j = i + 1; j < chains.length; j++) {
        if (chains[i].signature !== chains[j].signature) continue;
        const a = chains[i].points;
        const b = chains[j].points;
        const choices = [[false, false], [false, true], [true, false], [true, true]]
          .map(([reverseA, reverseB]) => {
            const end = reverseA ? a[0] : a.at(-1);
            const start = reverseB ? b.at(-1) : b[0];
            return { reverseA, reverseB, distance: Math.hypot(end.x - start.x, end.y - start.y) };
          }).sort((first, second) => first.distance - second.distance);
        const choice = choices[0];
        if (choice.distance > 25 * scale) continue;
        const first = choice.reverseA ? [...a].reverse() : a;
        const second = choice.reverseB ? [...b].reverse() : b;
        const end = first.at(-1);
        const start = second[0];
        const joint = { x: (end.x + start.x) / 2, y: (end.y + start.y) / 2 };
        chains[i].points = [...first.slice(0, -1), joint, ...second.slice(1)];
        chains.splice(j, 1);
        joined = true;
        break;
      }
    }
  }
  for (const chain of chains) {
    chain.points = simplify(chain.points, 10 * scale);
    const first = chain.points[0];
    const last = chain.points.at(-1);
    if (first.x > last.x || (first.x === last.x && first.y > last.y)) chain.points.reverse();
  }
  for (let i = chains.length - 1; i >= 0; i--) {
    const candidate = chains[i];
    const length = (points) => points.slice(1).reduce((sum, point, index) =>
      sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
    const samples = candidate.points.flatMap((point, index) => index ? [point, {
      x: (point.x + candidate.points[index - 1].x) / 2,
      y: (point.y + candidate.points[index - 1].y) / 2,
    }] : [point]);
    const duplicate = chains.some((other) => other !== candidate && length(other.points) > length(candidate.points) * 1.2
      && candidate.keys.every((key) => other.keys.includes(key))
      && samples.every((point) => other.points.slice(1).some((end, index) => {
        const nearest = nearestPoint(point, other.points[index], end);
        return Math.hypot(nearest.x - point.x, nearest.y - point.y) < 15 * scale;
      })));
    if (duplicate) chains.splice(i, 1);
  }
  const junctions = arrangeRailJunctions(chains, scale);
  const lanes = new Map(chains.map((chain) => [chain, new Map(chain.keys.map((key, i) =>
    [key, offsetPolyline(chain.points, (i - (chain.keys.length - 1) / 2) * 5.5)]))]));
  for (const junction of junctions) {
    const trunkLanes = lanes.get(junction.trunk);
    for (const branch of junction.branches) {
      for (const key of branch.chain.keys) {
        const trunkPoints = trunkLanes.get(key);
        const join = junction.trunkEnd ? trunkPoints.at(-1) : trunkPoints[0];
        const neighbor = junction.trunkEnd ? trunkPoints.at(-2) : trunkPoints[1];
        const dx = join.x - neighbor.x;
        const dy = join.y - neighbor.y;
        const length = Math.hypot(dx, dy) || 1;
        const approach = { x: join.x + dx / length * 12, y: join.y + dy / length * 12 };
        const points = lanes.get(branch.chain).get(key);
        if (branch.end) points.splice(points.length - 1, 1, approach, { ...join });
        else points.splice(0, 1, { ...join }, approach);
      }
    }
  }
  const finalLanes = applyRailJunctionFixtures(lanes, center);
  const paths = [];
  const visible = new Set();
  const segments = [];
  for (const chain of chains) {
    for (const [key, points] of finalLanes.get(chain)) {
      if (!points.some((point, index) => index && clipSegment(points[index - 1], point))) continue;
      visible.add(key);
      const line = lines.get(key);
      paths.push(`<path data-transit-line="${escapeXml(key)}" d="${roundedRailPath(points)}" stroke="${line.color}"/>`);
      segments.push({ line: key, points });
    }
  }
  return { paths, segments, junctions: junctions.map(({ trunk, branches }) => ({
    trunkOrder: trunk.keys, branchOrders: branches.map((branch) => branch.chain.keys),
  })), lines: [...visible].sort().map((key) => lines.get(key)) };
}

const number = (value) => value.toFixed(1);
const path = (points) => points.map((point, i) => `${i ? 'L' : 'M'}${number(point.x)},${number(point.y)}`).join(' ');
const shortName = (name) => name.replace(/\bNorth\b/g, 'N').replace(/\bSouth\b/g, 'S')
  .replace(/\bStreet\b/g, 'St').replace(/\bAvenue\b/g, 'Ave').replace(/\bBoulevard\b/g, 'Blvd')
  .replace(/\bParkway\b/g, 'Pkwy').replace(/\bDrive\b/g, 'Dr').replace(/\bCircle\b/g, 'Cir')
  .replace(/\bLane\b/g, 'Ln').replace(/\bRoad\b/g, 'Rd');

export function generateLocationDiagram(data, { lat, lon, buildings = true, administrativeBoundary = null, railCatalog = null }) {
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
  const sourceWays = allStreets.flatMap((street) => street.ways.map((way) => ({ ...way, street })));
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
