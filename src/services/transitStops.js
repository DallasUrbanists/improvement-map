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

function mergeStationGroups(groups, scale) {
  const result = [...groups].sort((a, b) => b.agencies.size - a.agencies.size
    || b.priority - a.priority || a.id.localeCompare(b.id));
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const a = result[i];
      const b = result[j];
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
      a.mode = a.modes.size > 1 ? 'bus+rail' : [...a.modes][0];
      result.splice(j--, 1);
    }
  }
  return result;
}

export function createTransitStopMarkers(data, screenPoint, scale, size = 480) {
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
    const group = groups.find((item) => item.mode === mode && (
      (area && item.area === area.id)
      || (name && name === item.name && Math.hypot(item.x - point.x, item.y - point.y) < (rail ? 80 : 5) * scale)));
    // Station nodes are more representative than stop positions along individual tracks.
    const priority = ['station', 'halt', 'tram_stop'].includes(tags.railway) ? 3
      : stop.type === 'way' ? 2 : 1;
    if (group) {
      if (priority >= group.priority || !group.agencies.size) agencySet.forEach((agency) => group.agencies.add(agency));
      group.ids.push(key);
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
        x: point.x, y: point.y, points: [point], priority });
    }
  }
  const markers = [];
  const occupied = [{ x: size / 2, y: size / 2, width: 66, height: 66 }];
  const visibleGroups = groups.filter((group) => group.x >= 0 && group.x <= size && group.y >= 0 && group.y <= size);
  const merged = mergeStationGroups(visibleGroups, scale);
  for (const group of merged.sort((a, b) => (a.mode === b.mode ? a.id.localeCompare(b.id) : a.modes.has('rail') ? -1 : 1))) {
    if (group.x < 0 || group.x > size || group.y < 0 || group.y > size) continue;
    const agencies = [...group.agencies].sort();
    const width = Math.max(1, agencies.length) * 30 + 8;
    const height = 38;
    let placement = null;
    // Keep badges near their actual point; a leader indicates any displacement.
    for (const [dx, dy] of [[0, 0], [-40, 0], [40, 0], [0, -40], [0, 40], [-40, -40], [40, 40], [-65, 0], [65, 0]]) {
      const x = Math.max(width / 2 + 4, Math.min(size - width / 2 - 4, group.x + dx));
      const y = Math.max(height / 2 + 46, Math.min(size - height / 2 - 32, group.y + dy));
      if (!occupied.some((box) => Math.abs(x - box.x) < (width + box.width) / 2 + 3
        && Math.abs(y - box.y) < (height + box.height) / 2 + 3)) {
        placement = { x, y }; break;
      }
    }
    if (!placement) placement = {
      x: Math.max(width / 2 + 4, Math.min(size - width / 2 - 4, group.x)),
      y: Math.max(height / 2 + 46, Math.min(size - height / 2 - 32, group.y)),
    };
    occupied.push({ ...placement, width, height });
    markers.push({ id: group.id, name: group.name || (group.mode === 'rail' ? 'Rail station' : 'Bus stop'),
      mode: group.mode, agencies, agencyNames: agencies.map((agency) => AGENCY_NAMES[agency]),
      x: placement.x, y: placement.y, stopX: group.x, stopY: group.y, width, height });
  }
  return { markers, occupied: occupied.slice(1), logos: agencyLogos };
}
