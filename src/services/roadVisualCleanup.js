const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length = (points) => points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
const valid = (way) => way?.tags?.highway && way.points?.length >= 2
  && way.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
const grade = (way) => ['layer', 'bridge', 'tunnel'].map((key) =>
  String(way.tags[key] || (key === 'layer' ? '0' : 'no'))).join('|');
const compatible = (a, b) => a.tags.name === b.tags.name && a.tags.highway === b.tags.highway
  && grade(a) === grade(b);
const key = (point) => `${point.x},${point.y}`;
const paths = new Set(['footway', 'path', 'cycleway', 'bridleway']);
const roads = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential']);
const protectedNode = (way, i) => {
  const tags = way.nodeTags?.[i] || way.points[i].tags || {};
  return ['turning_circle', 'turning_loop', 'mini_roundabout', 'bus_stop'].includes(tags.highway)
    || Boolean(tags.barrier || tags.entrance || tags.amenity || tags.public_transport);
};
const bounded = (value, fallback, minimum, maximum) => Number.isFinite(value)
  ? Math.max(minimum, Math.min(maximum, value)) : fallback;

function queryBounds(source) {
  try {
    const url = new URL(source);
    if (!['www.openstreetmap.org', 'api.openstreetmap.org'].includes(url.hostname)
      || !url.pathname.endsWith('/api/0.6/map')) return null;
    const value = url.searchParams.get('bbox');
    if (!value) return null;
    const parts = value.split(',');
    if (parts.length !== 4 || parts.some((part) => !part.trim())) return null;
    const [west, south, east, north] = parts.map(Number);
    return { west, south, east, north };
  } catch {
    return null;
  }
}

function projectBounds(box, project) {
  if (!box || ![box.west, box.south, box.east, box.north].every(Number.isFinite)
    || box.west >= box.east || box.south >= box.north
    || box.west < -180 || box.east > 180 || box.south < -90 || box.north > 90) return null;
  const corners = [box.west, box.east].flatMap((lon) =>
    [box.south, box.north].map((lat) => project({ lat, lon })));
  if (!corners.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  return { minX: Math.min(...corners.map((p) => p.x)), minY: Math.min(...corners.map((p) => p.y)),
    maxX: Math.max(...corners.map((p) => p.x)), maxY: Math.max(...corners.map((p) => p.y)) };
}

/**
 * Derive safety bounds from recorded acquisition evidence, never way extents.
 * project is the renderer's axis-aligned geographic-to-meter projection.
 * Saved original/additional: source URL bbox; extra: acquisition.bbox.
 * Intersect bicycle query coverage and recorded compaction square when present.
 * Live: final provenance acquisition bounds and/or coverageHalfExtentMeters.
 * Unknown, malformed or split-antimeridian coverage returns null (cleanup no-op).
 * Bounds describe query coverage, not a guarantee of complete OSM topology.
 */
export function deriveRoadAcquisitionBounds(data, project) {
  if (!data || typeof project !== 'function') return null;
  const recorded = [];
  const acquisitions = data.provenance?.acquisitions;
  const liveBounds = acquisitions?.at(-1)?.bounds;
  if (liveBounds !== undefined) {
    if (!Array.isArray(liveBounds) || liveBounds.length !== 1 || liveBounds[0]?.length !== 4) return null;
    const [south, west, north, east] = liveBounds[0];
    recorded.push(projectBounds({ south, west, north, east }, project));
  } else if (data.acquisition?.bbox) {
    recorded.push(projectBounds(data.acquisition.bbox, project));
  } else {
    const box = queryBounds(data.source);
    if (box) recorded.push(projectBounds(box, project));
  }
  const square = (center, halfExtent) => {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)
      || !Number.isFinite(halfExtent) || halfExtent <= 0) return null;
    const p = project(center);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    return { minX: p.x - halfExtent, minY: p.y - halfExtent,
      maxX: p.x + halfExtent, maxY: p.y + halfExtent };
  };
  if (data.provenance?.coverageHalfExtentMeters !== undefined) {
    recorded.push(square(data.center, data.provenance.coverageHalfExtentMeters));
  }
  // Neither geometryRadiusMeters nor full-way endpoints prove query coverage.
  if (!recorded.length || recorded.some((box) => !box)) return null;
  if (data.bicycleAcquisition) {
    const box = data.bicycleAcquisition.queryBbox || queryBounds(data.bicycleAcquisition.source);
    recorded.push(projectBounds(box, project));
  }
  if (data.compaction) {
    const { viewportHalfExtentMeters, paddingMeters, method } = data.compaction;
    if (typeof method !== 'string' || !method.includes('square viewport')
      || !Number.isFinite(viewportHalfExtentMeters) || viewportHalfExtentMeters <= 0
      || !Number.isFinite(paddingMeters) || paddingMeters < 0) return null;
    recorded.push(square(data.center, viewportHalfExtentMeters + paddingMeters));
  }
  if (recorded.some((box) => !box)) return null;
  const result = { minX: Math.max(...recorded.map((box) => box.minX)),
    minY: Math.max(...recorded.map((box) => box.minY)),
    maxX: Math.min(...recorded.map((box) => box.maxX)),
    maxY: Math.min(...recorded.map((box) => box.maxY)) };
  return result.minX < result.maxX && result.minY < result.maxY ? result : null;
}

function inside(point, bounds, margin) {
  return bounds && [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)
    && point.x > bounds.minX + margin && point.x < bounds.maxX - margin
    && point.y > bounds.minY + margin && point.y < bounds.maxY - margin;
}

/**
 * Remove only proven tiny terminal branches, before simplification/consolidation.
 * All coordinates and bounds are projected meters: { minX, minY, maxX, maxY }.
 * sourceWays must contain original, full acquisition geometry for ALL highways,
 * including roads/paths not rendered. Missing topology or either bound is a no-op.
 * Never supply clipped geometry as sourceWays. Optional nodeTags[i] preserves
 * OSM turning-circle/entrance/barrier evidence when available.
 */
export function removeTinyDeadEndNubs(ways, {
  sourceWays,
  visibleBounds,
  acquisitionBounds,
  maxNubLength = 12,
  minHostLength = 40,
  hostLengthRatio = 6,
  boundaryMargin = 20,
} = {}) {
  if (!Array.isArray(sourceWays) || !visibleBounds || !acquisitionBounds) return ways;
  const maximum = bounded(maxNubLength, 12, 0, 18);
  const minimumHost = bounded(minHostLength, 40, 40, 1000);
  const ratio = bounded(hostLengthRatio, 6, 4, 100);
  const margin = bounded(boundaryMargin, 20, 5, 100);
  const sources = sourceWays.filter(valid);
  const byId = new Map();
  const nodes = new Map();
  for (const way of sources) {
    const id = String(way.id);
    byId.set(id, byId.has(id) ? null : way);
    way.points.forEach((point, i) => {
      const address = key(point);
      const node = nodes.get(address) || { neighbors: new Map(), occurrences: [] };
      node.occurrences.push({ way, i });
      const neighbors = node.neighbors.get(grade(way)) || new Set();
      for (const j of [i - 1, i + 1]) if (way.points[j] && distance(point, way.points[j]) > 0) {
        neighbors.add(key(way.points[j]));
      }
      node.neighbors.set(grade(way), neighbors);
      nodes.set(address, node);
    });
  }
  return ways.flatMap((way) => {
    if (!valid(way) || way.divided || way.transitionTail) return [way];
    const source = byId.get(String(way.id));
    if (!source || !compatible(source, way)
      || distance(source.points[0], way.points[0]) > 0.01
      || distance(source.points.at(-1), way.points.at(-1)) > 0.01) return [way];
    const tags = source.tags;
    const path = paths.has(tags.highway);
    if ((!path && !roads.has(tags.highway)) || tags.name && path
      || tags.service || tags.junction || tags.oneway || tags.noexit
      || tags.access || tags.barrier || tags.entrance || tags.destination
      || tags.footway === 'sidewalk' || tags.footway === 'traffic_island'
      || tags.cycleway === 'crossing') return [way];
    const cuts = [];
    for (const reverse of [false, true]) {
      const indices = source.points.map((_, i) => i);
      if (reverse) indices.reverse();
      const tip = nodes.get(key(source.points[indices[0]]));
      // Shared endpoints, even at a different grade, are not proven dead ends.
      if (tip.occurrences.length !== 1 || tip.neighbors.get(grade(source))?.size !== 1) continue;
      let traveled = 0;
      let joint = null;
      for (let k = 1; k < indices.length; k++) {
        const previous = indices[k - 1]; const i = indices[k];
        traveled += distance(source.points[previous], source.points[i]);
        if (traveled > maximum || protectedNode(source, previous)
          || !inside(source.points[previous], visibleBounds, margin)
          || !inside(source.points[previous], acquisitionBounds, margin)) break;
        const node = nodes.get(key(source.points[i]));
        const degree = node.neighbors.get(grade(source))?.size || 0;
        if (degree >= 3) { joint = { node, i }; break; }
        if (degree !== 2 || protectedNode(source, i)) break;
      }
      if (!joint || traveled <= 0 || protectedNode(source, joint.i)
        || !inside(source.points[joint.i], visibleBounds, margin)
        || !inside(source.points[joint.i], acquisitionBounds, margin)) continue;
      const whole = joint.i === indices.at(-1);
      // A crossing can contain a dangling overshoot, but its true connection survives.
      if (tags.footway === 'crossing' || tags.crossing) {
        const retainedEnd = nodes.get(key(source.points[indices.at(-1)]));
        if (whole || !retainedEnd.occurrences.some((entry) => entry.way !== source
          && grade(entry.way) === grade(source))) continue;
      }
      if (!path && (whole || !tags.name)) continue;
      const host = joint.node.occurrences.find(({ way: other, i }) => {
        if (other === source || grade(other) !== grade(source) || i === 0 || i === other.points.length - 1
          || length(other.points) < Math.max(minimumHost, traveled * ratio)) return false;
        if (path) return paths.has(other.tags.highway) || roads.has(other.tags.highway);
        if (!compatible(source, other) || other.tags.oneway) return false;
        const tipPoint = source.points[indices[0]]; const jointPoint = source.points[joint.i];
        const dx = tipPoint.x - jointPoint.x; const dy = tipPoint.y - jointPoint.y;
        return [other.points[i - 1], other.points[i + 1]].every((point) =>
          Math.abs((point.x - jointPoint.x) * dx + (point.y - jointPoint.y) * dy)
          / (distance(point, jointPoint) * distance(tipPoint, jointPoint) || 1) >= Math.cos(15 * Math.PI / 180));
      });
      if (host) cuts.push({ reverse, i: joint.i });
    }
    if (!cuts.length) return [way];
    const start = cuts.find((cut) => !cut.reverse)?.i ?? 0;
    const end = cuts.find((cut) => cut.reverse)?.i ?? source.points.length - 1;
    if (start >= end) return [];
    const points = source.points.slice(start, end + 1);
    return [{ ...way, points, ...(way.nodeTags ? { nodeTags: way.nodeTags.slice(start, end + 1) } : {}) }];
  });
}

const eligibleRoad = (way) => valid(way) && !way.minor && !way.extraLight && way.tags.name
  && roads.has(way.tags.highway) && !way.tags.junction;
const alignment = Math.cos(25 * Math.PI / 180);
function aligned(a, b, dx, dy) {
  return ((b.x - a.x) * dx + (b.y - a.y) * dy)
    / (distance(a, b) * Math.hypot(dx, dy) || 1) >= alignment;
}

/**
 * After mergeDividedStreets AND global collapseDividedTransitions, promote only
 * short same-name/class/grade chains bracketed by distinct aligned divided ways.
 * Geometry is never moved or joined: divided:true selects the existing big-road
 * stroke. Bike, street ownership, tags and other metadata remain on each way.
 */
export function promoteShortDividedGaps(ways, { maxGapLength = 40 } = {}) {
  const maximum = bounded(maxGapLength, 40, 0, 40);
  const medians = ways.filter((way) => eligibleRoad(way) && way.divided);
  const narrow = ways.filter((way) => eligibleRoad(way) && !way.divided && length(way.points) <= maximum);
  const visited = new Set();
  const promoted = new Set();
  const touches = (a, b) => distance(a, b) <= 0.01;
  const ends = (way) => [way.points[0], way.points.at(-1)];
  for (const seed of narrow) {
    if (visited.has(seed)) continue;
    const chain = [{ way: seed, points: seed.points }];
    visited.add(seed);
    let ambiguous = false;
    for (const front of [true, false]) {
      while (true) {
        const point = front ? chain[0].points[0] : chain.at(-1).points.at(-1);
        const adjacent = narrow.filter((way) => !chain.some((entry) => entry.way === way)
          && compatible(seed, way) && ends(way).some((end) => touches(point, end)));
        if (!adjacent.length) break;
        if (adjacent.length !== 1 || visited.has(adjacent[0])) { ambiguous = true; break; }
        const way = adjacent[0];
        const forward = touches(point, way.points[front ? way.points.length - 1 : 0]);
        const entry = { way, points: forward ? way.points : [...way.points].reverse() };
        if (front) chain.unshift(entry); else chain.push(entry);
        visited.add(way);
      }
    }
    if (ambiguous) continue;
    const points = chain.flatMap((entry, i) => i ? entry.points.slice(1) : entry.points);
    const first = points[0]; const last = points.at(-1);
    const span = distance(first, last); const total = chain.reduce((sum, entry) => sum + length(entry.points), 0);
    if (span < 1 || total > maximum || total > span * 1.08) continue;
    // A same-road branch (including a long narrow one) is ambiguous, not a gap.
    const chainWays = new Set(chain.map((entry) => entry.way));
    if (ways.some((way) => !chainWays.has(way) && eligibleRoad(way) && !way.divided
      && compatible(seed, way) && ends(way).some((end) => points.some((point) => touches(point, end))))) continue;
    const dx = last.x - first.x; const dy = last.y - first.y;
    if (!points.slice(1).every((point, i) => distance(points[i], point) === 0 || aligned(points[i], point, dx, dy))) continue;
    const anchors = [first, last].map((point, side) => medians.flatMap((way) => {
      if (!compatible(seed, way)) return [];
      return ends(way).flatMap((end, endIndex) => {
        if (!touches(point, end)) return [];
        const neighbor = way.points[endIndex === 0 ? 1 : way.points.length - 2];
        return (side === 0 ? aligned(neighbor, end, dx, dy) : aligned(end, neighbor, dx, dy)) ? [way] : [];
      });
    }));
    if (anchors[0].length !== 1 || anchors[1].length !== 1 || anchors[0][0] === anchors[1][0]) continue;
    for (const entry of chain) promoted.add(entry.way);
  }
  return ways.map((way) => promoted.has(way) ? { ...way, divided: true } : way);
}
