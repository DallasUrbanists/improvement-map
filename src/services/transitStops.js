import agencyLogos from '../data/transitAgencyLogos.js';

const RAIL_MODES = ['light_rail', 'tram', 'subway', 'train'];
const AGENCY_PATTERNS = [
  ['amtrak', /\bAmtrak\b|National Railroad Passenger Corporation/i],
  ['flixbus', /\bFlix\s*Bus\b/i],
  ['greyhound', /\bGreyhound\b/i],
  ['redcoach', /\bRed\s*Coach\b/i],
  ['star-transit', /\bSTAR\s+Transit\b/i],
  ['vonlane', /\bVonlane\b/i],
  ['tre', /\bTRE\b|Trinity Railway Express/i],
  ['dcta', /\bDCTA\b|Denton County Transportation Authority/i],
  ['m-line', /\bMATA\b|McKinney Avenue Transit|M[- ]Line/i],
  ['trinity-metro', /Trinity Metro|Fort Worth Transportation Authority|\bFWTA\b/i],
  ['dart', /\bDART\b|Dallas Area Rapid Transit/i],
];
const AGENCY_NAMES = { amtrak: 'Amtrak', dart: 'DART', dcta: 'DCTA', flixbus: 'FlixBus', greyhound: 'Greyhound',
  'm-line': 'M-Line Trolley', redcoach: 'RedCoach', 'star-transit': 'STAR Transit', tre: 'TRE',
  'trinity-metro': 'Trinity Metro', vonlane: 'Vonlane' };

function agenciesFrom(tags) {
  const identity = [tags?.network, tags?.operator, tags?.brand].filter(Boolean).join(' ');
  return AGENCY_PATTERNS.filter(([, pattern]) => pattern.test(identity)).map(([key]) => key);
}

function isRailStop(tags, routes = []) {
  if (!tags.railway && (tags.highway === 'bus_stop' || tags.bus === 'yes')) return false;
  return ['station', 'halt', 'tram_stop', 'stop', 'platform'].includes(tags.railway)
    || ['train', 'light_rail', 'tram', 'subway'].some((mode) => tags[mode] === 'yes')
    || routes.some((route) => RAIL_MODES.includes(route.route));
}

function stationIdentity(name = '') {
  return name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/\bstation\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function streetIdentity(name = '') {
  const aliases = { street: 'st', avenue: 'ave', boulevard: 'blvd', road: 'rd', drive: 'dr',
    lane: 'ln', parkway: 'pkwy', highway: 'hwy', north: 'n', south: 's', east: 'e', west: 'w' };
  return (typeof name === 'string' ? name : '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).map((word) => aliases[word] || word).join(' ');
}

function sameStreet(a, b) {
  const suffix = /\s+(?:st|ave|blvd|rd|dr|ln|pkwy|hwy)$/;
  return a === b || (!(suffix.test(a) && suffix.test(b)) && a.replace(suffix, '') === b.replace(suffix, ''));
}

function busIdentity(name = '', tags = {}) {
  const parts = name.split(/\s*(?:@|\bat\b|&)\s*/i);
  if (parts.length !== 2 || !parts[0].trim()) return null;
  let cross = parts[1].trim();
  const directions = new Set();
  const direction = /^(n|s|e|w)(?:b|orth|outh|ast|est)?(?:bound)?$/i;
  // Only consume terminal qualifiers, never directional prefixes in street names.
  const suffix = /(?:\s*[-–—]\s*|\s+|\s*\(\s*)(NB|SB|EB|WB|N|S|E|W|north(?:bound)?|south(?:bound)?|east(?:bound)?|west(?:bound)?|NS|FS|MB|near[ -]?side|far[ -]?side|mid[ -]?block|platform(?:\s+[a-z0-9]+)?|bay\s+[a-z0-9]+)\s*\)?$/i;
  let match;
  while ((match = cross.match(suffix))) {
    const remainder = cross.slice(0, match.index).trim();
    if (!streetIdentity(remainder)) break;
    if (direction.test(match[1])) {
      const delimited = /[-–—(]/.test(match[0]);
      // A second cardinal, or an unqualified trailing street letter, belongs to the cross street.
      if (directions.size || (!delimited && !/^(?:[NSEW]B|.*bound)$/i.test(match[1]))) break;
      directions.add(match[1][0].toLowerCase());
    }
    cross = remainder;
  }
  for (const value of [tags.direction, tags['bus:direction']]) {
    if (value && direction.test(value)) directions.add(value[0].toLowerCase());
  }
  const main = streetIdentity(parts[0]);
  const crossing = streetIdentity(cross);
  return main && crossing ? { main, cross: crossing, directions,
    name: `${parts[0].trim()} @ ${cross}` } : null;
}

function roadProjection(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length ** 2));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y),
    side: ((point.x - start.x) * dy - (point.y - start.y) * dx) / length };
}

function pairBusGroups(groups, scale, roadPaths = []) {
  const candidates = [];
  const ordered = [...groups].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    if (a.mode !== 'bus' || !a.busIdentity) continue;
    for (let j = i + 1; j < ordered.length; j++) {
      const b = ordered[j];
      if (b.mode !== 'bus' || !b.busIdentity || !sameStreet(a.busIdentity.main, b.busIdentity.main)
        || !sameStreet(a.busIdentity.cross, b.busIdentity.cross)) continue;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) / scale;
      if (distance < 2 || distance > 80) continue;
      const sharedAgency = [...a.agencies].some((agency) => b.agencies.has(agency));
      if (a.agencies.size && b.agencies.size && !sharedAgency) continue;
      if (!sharedAgency && a.agencyEvidence.size && b.agencyEvidence.size
        && ![...a.agencyEvidence].some((identity) => b.agencyEvidence.has(identity))) continue;
      const opposites = { n: 's', s: 'n', e: 'w', w: 'e' };
      const explicit = [...a.busIdentity.directions].some((dir) => b.busIdentity.directions.has(opposites[dir]));
      const sameDirection = a.busIdentity.directions.size && b.busIdentity.directions.size && !explicit;
      if (sameDirection) continue;
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let road = null;
      for (const path of roadPaths) {
        if (!path.tags?.highway || !sameStreet(streetIdentity(path.tags.name), a.busIdentity.main)
          || !sameStreet(streetIdentity(path.tags.name), b.busIdentity.main)) continue;
        for (let k = 1; k < (path.points?.length || 0); k++) {
          const start = path.points[k - 1];
          const end = path.points[k];
          if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) continue;
          const projection = roadProjection(midpoint, start, end);
          const first = roadProjection(a, start, end);
          const second = roadProjection(b, start, end);
          if (!projection || projection.distance > 20 * scale
            || first.distance > 25 * scale || second.distance > 25 * scale) continue;
          if (!road || projection.distance < road.projection.distance) {
            road = { projection, first, second, name: path.tags.name };
          }
        }
      }
      const oppositeSides = road && road.first.side * road.second.side < 0
        && Math.min(Math.abs(road.first.side), Math.abs(road.second.side)) >= scale;
      const sameSide = road && road.first.side * road.second.side > 0
        && Math.min(Math.abs(road.first.side), Math.abs(road.second.side)) >= scale;
      if (sameSide || (!explicit && !oppositeSides)) continue;
      // Supplied rendered roads must support a shared named centerline; do not snap to another street.
      if (roadPaths.length && !road) continue;
      candidates.push({ a, b, distance, midpoint, road,
        evidence: explicit ? 'opposite-directions' : 'opposite-sides' });
    }
  }
  const used = new Set();
  const pairs = [];
  const pairedGroups = [];
  candidates.sort((a, b) => a.distance - b.distance
    || [...a.a.ids, ...a.b.ids].sort().join('|').localeCompare([...b.a.ids, ...b.b.ids].sort().join('|')));
  for (const candidate of candidates) {
    const { a, b, midpoint, road, evidence } = candidate;
    if (used.has(a) || used.has(b)) continue;
    used.add(a); used.add(b);
    const ids = [...a.ids, ...b.ids].sort();
    const position = road?.projection || midpoint;
    const id = `bus-pair:${ids.join('|')}`;
    pairs.push({ id, stopIds: ids, evidence, midpoint, projected: !!road,
      roadName: road?.name || null, stopX: position.x, stopY: position.y,
      originalPositions: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] });
    pairedGroups.push({ ...a, id, ids, name: a.busIdentity.name,
      x: position.x, y: position.y, points: [position],
      agencies: new Set([...a.agencies, ...b.agencies]), areas: new Set([...a.areas, ...b.areas]),
      names: new Set([...a.names, ...b.names]), pairedStopIds: ids });
  }
  return { groups: [...groups.filter((group) => !used.has(group)), ...pairedGroups], pairs };
}

function mergeStationGroups(groups, scale) {
  const result = [...groups].sort((a, b) => b.agencies.size - a.agencies.size
    || b.priority - a.priority || a.id.localeCompare(b.id));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
      if (a.mode === 'bus' && b.mode === 'bus') continue;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) / scale;
      const sameArea = [...a.areas].some((area) => b.areas.has(area));
      const sameName = [...a.names].some((name) => name && b.names.has(name));
      const duplicateRail = a.modes.has('rail') && b.modes.has('rail') && distance < 30
        && [...b.agencies].some((agency) => a.agencies.has(agency));
      if (!(sameArea || (sameName && distance < 80) || duplicateRail)) continue;
      b.agencies.forEach((agency) => a.agencies.add(agency));
      b.modes.forEach((mode) => a.modes.add(mode));
      b.areas.forEach((area) => a.areas.add(area));
      b.names.forEach((name) => a.names.add(name));
      a.ids.push(...b.ids);
      if (b.pairedStopIds) a.pairedStopIds = [...(a.pairedStopIds || []), ...b.pairedStopIds];
      a.mode = a.modes.size > 1 ? 'bus+rail' : [...a.modes][0];
      result.splice(j--, 1);
    }
  }
  return result;
}

export function createTransitStopMarkers(data, screenPoint, scale, size = 480, { roadPaths = [], occupied: protectedBoxes = [] } = {}) {
  const routeMemberships = new Map();
  for (const route of data.transitRoutes || []) {
    for (const member of route.members || []) {
      const key = `${member.type || 'way'}:${member.ref}`;
      const routes = routeMemberships.get(key) || [];
      routes.push(route.tags);
      routeMemberships.set(key, routes);
    }
  }
  const areas = new Map();
  for (const area of data.stopAreas || []) {
    const agencySets = { rail: new Set(), bus: new Set() };
    for (const member of area.members || []) {
      const key = `${member.type}:${member.ref}`;
      const routes = routeMemberships.get(key) || [];
      const stop = (data.transitStops || []).find((item) => `${item.type}:${item.id}` === key);
      const mode = isRailStop(stop?.tags || {}, routes) ? 'rail' : 'bus';
      agenciesFrom(stop?.tags).forEach((agency) => agencySets[mode].add(agency));
      for (const route of routes) {
        const routeMode = RAIL_MODES.includes(route.route) ? 'rail' : 'bus';
        agenciesFrom(route).forEach((agency) => agencySets[routeMode].add(agency));
      }
    }
    for (const member of area.members || []) {
      areas.set(`${member.type}:${member.ref}`, { id: area.id, tags: area.tags,
        agencies: { rail: [...agencySets.rail], bus: [...agencySets.bus] } });
    }
  }
  const groups = [];
  for (const stop of data.transitStops || []) {
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) continue;
    const key = `${stop.type}:${stop.id}`;
    const routes = routeMemberships.get(key) || [];
    const area = areas.get(key);
    const tags = stop.tags || {};
    const rail = isRailStop(tags, routes);
    const mode = rail ? 'rail' : 'bus';
    const agencySet = new Set(agenciesFrom(tags));
    if (!agencySet.size) routes.filter((route) => RAIL_MODES.includes(route.route) === rail)
      .flatMap(agenciesFrom).forEach((agency) => agencySet.add(agency));
    if (!agencySet.size) [...(area?.agencies[mode] || []), ...agenciesFrom(area?.tags)]
      .forEach((agency) => agencySet.add(agency));
    const point = screenPoint(stop);
    const name = tags.name || area?.tags.name || '';
    const identity = rail ? null : busIdentity(name, tags);
    const evidenceFrom = (source) => [source?.network, source?.operator, source?.brand].filter(Boolean).map(streetIdentity);
    let evidence = evidenceFrom(tags);
    if (!evidence.length) evidence = routes.filter((route) => RAIL_MODES.includes(route.route) === rail).flatMap(evidenceFrom);
    if (!evidence.length) evidence = evidenceFrom(area?.tags);
    const group = groups.find((item) => item.mode === mode && !identity && !item.busIdentity && (
      (area && item.area === area.id)
      || (rail && name && name === item.name && Math.hypot(item.x - point.x, item.y - point.y) < 80 * scale)));
    // Station nodes are more representative than stop positions along individual tracks.
    const priority = ['station', 'halt', 'tram_stop'].includes(tags.railway) ? 3
      : stop.type === 'way' ? 2 : 1;
    if (group) {
      if (priority >= group.priority || !group.agencies.size) agencySet.forEach((agency) => group.agencies.add(agency));
      group.ids.push(key);
      evidence.forEach((value) => group.agencyEvidence.add(value));
      if (area) group.areas.add(area.id);
      group.names.add(stationIdentity(name));
      group.names.add(stationIdentity(area?.tags.name));
      if (priority > group.priority) {
        if (agencySet.size) group.agencies = agencySet;
        group.x = point.x; group.y = point.y; group.priority = priority; group.points = [point];
      } else if (priority === group.priority) {
        group.points.push(point);
        group.x = group.points.reduce((sum, entry) => sum + entry.x, 0) / group.points.length;
        group.y = group.points.reduce((sum, entry) => sum + entry.y, 0) / group.points.length;
      }
    } else {
      groups.push({ id: key, ids: [key], area: area?.id, areas: new Set(area ? [area.id] : []),
        names: new Set([stationIdentity(name), stationIdentity(area?.tags.name)]),
        modes: new Set([mode]), mode, name, agencies: agencySet,
        busIdentity: identity, agencyEvidence: new Set(evidence),
        x: point.x, y: point.y, points: [point], priority });
    }
  }
  const markers = [];
  const occupied = [{ x: size / 2, y: size / 2, width: 66, height: 66 }, ...protectedBoxes];
  const protectedCount = occupied.length;
  const badgeOffsets = [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40], [-40, -40], [40, 40], [-65, 0], [65, 0]];
  const extraOffsets = [];
  for (let dx = -100; dx <= 100; dx += 10) {
    for (let dy = -100; dy <= 100; dy += 10) {
      if (dx * dx + dy * dy <= 100 ** 2) extraOffsets.push([dx, dy]);
    }
  }
  extraOffsets.sort(([ax, ay], [bx, by]) => ax * ax + ay * ay - bx * bx - by * by || ay - by || ax - bx);
  badgeOffsets.push(...extraOffsets);
  // Leave clearance above the copyright baseline and administrative footer.
  const badgeBottom = size - 48;
  const visibleGroups = groups.filter((group) => group.x >= 0 && group.x <= size && group.y >= 0 && group.y <= size);
  const paired = pairBusGroups(visibleGroups, scale, roadPaths);
  const merged = mergeStationGroups(paired.groups, scale);
  for (const group of merged.sort((a, b) => (a.mode === b.mode ? a.id.localeCompare(b.id) : a.modes.has('rail') ? -1 : 1))) {
    if (group.x < 0 || group.x > size || group.y < 0 || group.y > size) continue;
    const agencies = [...group.agencies].sort();
    const width = Math.max(1, agencies.length) * 30 + 8;
    const height = 38;
    let placement = null;
    // Keep badges near their actual point; a leader indicates any displacement.
    for (const [dx, dy] of badgeOffsets) {
      const x = Math.max(width / 2 + 4, Math.min(size - width / 2 - 4, group.x + dx));
      const y = Math.max(height / 2 + 46, Math.min(badgeBottom - height / 2, group.y + dy));
      if (!occupied.some((box) => Math.abs(x - box.x) < (width + box.width) / 2 + 3
        && Math.abs(y - box.y) < (height + box.height) / 2 + 3)) {
        placement = { x, y }; break;
      }
    }
    if (!placement) placement = {
      x: Math.max(width / 2 + 4, Math.min(size - width / 2 - 4, group.x)),
      y: Math.max(height / 2 + 46, Math.min(badgeBottom - height / 2, group.y)),
    };
    occupied.push({ ...placement, width, height });
    markers.push({ id: group.id, name: group.name || (group.mode === 'rail' ? 'Rail station' : 'Bus stop'),
      mode: group.mode, agencies, agencyNames: agencies.map((agency) => AGENCY_NAMES[agency]),
      x: placement.x, y: placement.y, stopX: group.x, stopY: group.y, width, height,
      ...(group.pairedStopIds ? { pairedStopIds: group.pairedStopIds } : {}) });
  }
  return { markers, occupied: occupied.slice(protectedCount), logos: agencyLogos, pairs: paired.pairs };
}
