const ORANGE = 'DART:ORANGE';
const nodeKey = (point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`;

function distanceToSegment(stop, { geometry: [a, b] }) {
  const longitudeScale = 111195 * Math.cos(stop.lat * Math.PI / 180);
  const ax = (a.lon - stop.lon) * longitudeScale; const ay = (a.lat - stop.lat) * 111195;
  const dx = (b.lon - a.lon) * longitudeScale; const dy = (b.lat - a.lat) * 111195;
  const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Omit the nonregular Orange service branch from Pearl/Arts District to Buckner. */
export function applyRailServiceOverrides(catalog) {
  const buckner = catalog.stops.find((stop) => stop.name.trim().toUpperCase() === 'BUCKNER STATION');
  if (!buckner) return catalog;
  // Flood from Buckner through Orange's eastern branch. Shared Red/Blue edges
  // form the boundary at the downtown trunk and the regular northern service.
  const branchEdges = catalog.segments.filter((segment) => segment.keys.includes(ORANGE)
    && !segment.keys.some((key) => key === 'DART:RED' || key === 'DART:BLUE'));
  const seed = [...branchEdges].sort((a, b) => distanceToSegment(buckner, a) - distanceToSegment(buckner, b))[0];
  if (!seed || distanceToSegment(buckner, seed) > 200) return catalog;
  const nodes = new Map();
  for (const edge of branchEdges) for (const point of edge.geometry) {
    const key = nodeKey(point);
    if (!nodes.has(key)) nodes.set(key, []);
    nodes.get(key).push(edge);
  }
  const removed = new Set([seed]); const queue = [seed];
  for (let i = 0; i < queue.length; i++) for (const point of queue[i].geometry) {
    for (const edge of nodes.get(nodeKey(point)) || []) {
      if (!removed.has(edge)) { removed.add(edge); queue.push(edge); }
    }
  }
  const retainedOrange = catalog.segments.filter((edge) => edge.keys.includes(ORANGE) && !removed.has(edge));
  const stops = catalog.stops.map((stop) => {
    if (!stop.lines.includes(ORANGE)) return stop;
    const removedDistance = Math.min(...[...removed].map((edge) => distanceToSegment(stop, edge)));
    const retainedDistance = Math.min(...retainedOrange.map((edge) => distanceToSegment(stop, edge)));
    return removedDistance < 200 && removedDistance < retainedDistance
      ? { ...stop, lines: stop.lines.filter((line) => line !== ORANGE) } : stop;
  }).filter((stop) => stop.lines.length);
  return { ...catalog, stops, segments: catalog.segments.map((edge) => removed.has(edge)
    ? { ...edge, keys: edge.keys.filter((key) => key !== ORANGE) } : edge).filter((edge) => edge.keys.length) };
}
