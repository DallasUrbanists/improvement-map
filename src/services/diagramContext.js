export const freewayStreet = (tags) => tags.highway === 'motorway'
  || ['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'].includes(tags.highway)
    && (tags.expressway === 'yes' || /\b(?:Expressway|Expy)\b/i.test(tags.name || ''));

export const extraLightStreet = (tags) => tags.highway === 'service' && tags.service === 'parking_aisle'
  || /^(motorway|trunk|primary|secondary|tertiary)_link$/.test(tags.highway);

export const minorStreet = (tags) => extraLightStreet(tags)
  || ['service', 'track', 'path', 'footway', 'bridleway', 'pedestrian', 'steps', 'cycleway'].includes(tags.highway);

export function bikeFacility(tags) {
  if (tags.bicycle === 'no' || tags.access === 'no' || tags.access === 'private') return false;
  if (tags.highway === 'cycleway' || (['path', 'footway', 'bridleway', 'pedestrian', 'track'].includes(tags.highway)
    && ['yes', 'designated', 'official'].includes(tags.bicycle))) return true;
  return ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both'].some((key) => {
    if (['track', 'opposite_track'].includes(tags[key])) return true;
    if (tags[key] !== 'lane') return false;
    const side = key.split(':')[1];
    const separationKeys = [`${key}:separation`, 'cycleway:separation',
      ...(!side || side === 'both' ? ['cycleway:separation:left', 'cycleway:separation:right'] : [`cycleway:separation:${side}`])];
    return separationKeys.some((separation) =>
      /^(kerb|curb|bollard|bollards|barrier|planter|planters|planter_strip|guard_rail|fence|jersey_barrier|parking_lane|vertical_panel|verge|grass_verge|hedge)$/.test(tags[separation] || ''));
  });
}

const abbreviate = (name) => name.replace(/\bNorth\b/g, 'N').replace(/\bSouth\b/g, 'S')
  .replace(/\bStreet\b/g, 'St').replace(/\bAvenue\b/g, 'Ave').replace(/\bBoulevard\b/g, 'Blvd')
  .replace(/\bDrive\b/g, 'Dr').replace(/\bRoad\b/g, 'Rd').replace(/\bLane\b/g, 'Ln');

const intersectionStreet = (name) => abbreviate(name).replace(
  /\s+(?:St|Ave|Blvd|Dr|Rd|Ln|Street|Avenue|Boulevard|Drive|Road|Lane|Way|Court|Ct|Circle|Cir|Parkway|Pkwy|Place|Pl|Terrace|Ter|Trail|Trl|Highway|Hwy|Freeway|Fwy|Expressway|Expy)\.?(?=\s+(?:Extension|Ext|North|South|East|West|N|S|E|W)$|$)/i, '');

const stateCodes = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT',
  Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI',
  Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
};

const administrativeName = (area) => Number(area.adminLevel) === 4 ? stateCodes[area.name] || area.name
  : Number(area.adminLevel) === 2 && area.name === 'United States' ? 'USA' : area.name;

export function locationContext(elements, project, stops, boundary, size = 480) {
  const center = size / 2;
  const visible = (p) => p.x >= 0 && p.x <= size && p.y >= 0 && p.y <= size;
  const distance = (p) => Math.hypot(p.x - center, p.y - center);
  const ways = elements.filter((way) => way.tags?.highway && way.tags.name && way.geometry?.length >= 2
    && !['cycleway', 'path', 'footway', 'steps', 'track'].includes(way.tags.highway))
    .map((way) => ({ ...way, points: way.geometry.map(project) }));
  const intersections = [];
  for (let i = 0; i < ways.length; i++) for (let j = i + 1; j < ways.length; j++) {
    const a = ways[i]; const b = ways[j];
    if (a.tags.name === b.tags.name || (a.tags.layer || '0') !== (b.tags.layer || '0')
      || (a.tags.bridge || 'no') !== (b.tags.bridge || 'no') || (a.tags.tunnel || 'no') !== (b.tags.tunnel || 'no')) continue;
    for (let ai = 1; ai < a.points.length; ai++) for (let bi = 1; bi < b.points.length; bi++) {
      const p = a.points[ai - 1]; const q = b.points[bi - 1];
      const r = { x: a.points[ai].x - p.x, y: a.points[ai].y - p.y };
      const s = { x: b.points[bi].x - q.x, y: b.points[bi].y - q.y };
      const cross = r.x * s.y - r.y * s.x;
      if (Math.abs(cross) < 1e-8) continue;
      const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / cross;
      const u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / cross;
      if (t < -1e-6 || t > 1.000001 || u < -1e-6 || u > 1.000001) continue;
      const point = { x: p.x + t * r.x, y: p.y + t * r.y };
      if (!visible(point)) continue;
      if (!a.points.some((vertex) => Math.hypot(vertex.x - point.x, vertex.y - point.y) < 0.01)
        || !b.points.some((vertex) => Math.hypot(vertex.x - point.x, vertex.y - point.y) < 0.01)) continue;
      // A two-arm bend/name change is not a street intersection.
      if ((t < 1e-6 || t > 0.999999) && (u < 1e-6 || u > 0.999999)) {
        if (Math.abs(r.x * s.x + r.y * s.y) / (Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y)) > 0.97) continue;
        const arms = [];
        for (const way of ways.filter((way) => (way.tags.layer || '0') === (a.tags.layer || '0')
          && (way.tags.bridge || 'no') === (a.tags.bridge || 'no') && (way.tags.tunnel || 'no') === (a.tags.tunnel || 'no'))) {
          for (let k = 0; k < way.points.length; k++) {
            if (Math.hypot(way.points[k].x - point.x, way.points[k].y - point.y) > 0.1) continue;
            for (const neighbor of [way.points[k - 1], way.points[k + 1]].filter(Boolean)) {
              const dx = neighbor.x - point.x; const dy = neighbor.y - point.y;
              const length = Math.hypot(dx, dy);
              if (length < 0.1) continue;
              const arm = { x: dx / length, y: dy / length };
              if (!arms.some((other) => arm.x * other.x + arm.y * other.y > 0.98)) arms.push(arm);
            }
          }
        }
        if (arms.length < 3) continue;
      }
      intersections.push({ ...point, name: `${intersectionStreet(a.tags.name)} & ${intersectionStreet(b.tags.name)}` });
    }
  }
  intersections.sort((a, b) => distance(a) - distance(b) || a.name.localeCompare(b.name));
  const stopName = (stop) => {
    const agencies = stop.agencyNames.join(' / ');
    const name = stop.mode !== 'bus' && !/station|transit center|rail stop/i.test(stop.name) ? `${stop.name} Station` : stop.name;
    return agencies && !name.toLowerCase().includes(agencies.toLowerCase()) ? `${agencies} ${name}` : name;
  };
  const nearestStops = stops.map((stop) => ({ ...stop, x: stop.stopX, y: stop.stopY }))
    .filter(visible).sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id));
  const intersection = intersections[0]; const stop = nearestStops[0];
  const names = [];
  if (intersection && (!stop || distance(intersection) <= distance(stop))) {
    names.push(intersection.name);
    const station = nearestStops.find((entry) => entry.mode !== 'bus');
    if (station) names.push(stopName(station));
  } else if (stop) names.push(stopName(stop));
  else {
    const candidates = ways.flatMap((way) => way.points.slice(1).map((end, i) => {
      const start = way.points[i]; const dx = end.x - start.x; const dy = end.y - start.y;
      const t = Math.max(0, Math.min(1, ((center - start.x) * dx + (center - start.y) * dy) / (dx * dx + dy * dy || 1)));
      return { name: abbreviate(way.tags.name), x: start.x + t * dx, y: start.y + t * dy };
    })).filter(visible).sort((a, b) => distance(a) - distance(b));
    if (candidates[0]) names.push(candidates[0].name);
  }
  const areas = boundary ? [boundary, ...(boundary.verification.containingAdministrativeAreas || [])]
    .sort((a, b) => b.adminLevel - a.adminLevel || (a.areaSquareMeters || a.verification?.areaSquareMeters || Infinity)
      - (b.areaSquareMeters || b.verification?.areaSquareMeters || Infinity)) : [];
  names.push(...areas.map(administrativeName));
  if (!boundary) names.push('Administrative area unavailable');
  return { names: [...new Set(names.filter(Boolean))], intersections };
}

export function truncateContext(text, maximumWidth = 450, fontSize = 11) {
  const width = (value) => [...value].reduce((sum, char) => sum + (/[ilI.,' :]/.test(char) ? 0.3 : /[MW@&]/.test(char) ? 0.85 : 0.58) * fontSize, 0);
  if (width(text) <= maximumWidth) return text;
  let clipped = text;
  while (clipped && width(`${clipped}…`) > maximumWidth) clipped = clipped.slice(0, -1);
  return `${clipped.trimEnd()}…`;
}

export function labelOverlaps(x, y, width, height, angle, box) {
  const c = Math.cos(angle); const s = Math.sin(angle);
  const dx = box.x - x; const dy = box.y - y;
  return Math.abs(dx) < (Math.abs(c) * width + Math.abs(s) * height + box.width) / 2
    && Math.abs(dy) < (Math.abs(s) * width + Math.abs(c) * height + box.height) / 2
    && Math.abs(dx * c + dy * s) < (width + Math.abs(c) * box.width + Math.abs(s) * box.height) / 2
    && Math.abs(-dx * s + dy * c) < (height + Math.abs(s) * box.width + Math.abs(c) * box.height) / 2;
}
