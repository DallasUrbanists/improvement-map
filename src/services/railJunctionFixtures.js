const WEST_END = { lat: 32.780017580621774, lon: -96.80887918446064 };
const TRUNK_KEYS = ['DART:GREEN', 'DART:ORANGE', 'DART:BLUE', 'DART:RED'];
const BRANCH_KEYS = [TRUNK_KEYS.slice(0, 2), TRUNK_KEYS.slice(2)];
// Saved location-2 adjustment: use the local approach geometry, not old viewport coordinates.
const ADJUSTMENT = { fraction: 0.7, maximum: 72, step: 1 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const sameKeys = (a, b) => a.length === b.length && a.every((key) => b.includes(key));
const valid = (points) => Array.isArray(points) && points.length >= 2
  && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

function smoothApproach(points, end, transition) {
  const oriented = end ? points : [...points].reverse();
  const join = oriented.at(-1);
  const approach = oriented.at(-2);
  const from = oriented.at(-3);
  const approachLength = distance(approach, join);
  const length = distance(from, approach);
  const direction = { x: (join.x - approach.x) / approachLength, y: (join.y - approach.y) / approachLength };
  const tangent = { x: (approach.x - from.x) / length, y: (approach.y - from.y) / length };
  const start = { x: approach.x - tangent.x * transition, y: approach.y - tangent.y * transition };
  const handle = transition / 3;
  const first = { x: start.x + tangent.x * handle, y: start.y + tangent.y * handle };
  const second = { x: approach.x - direction.x * handle, y: approach.y - direction.y * handle };
  const curve = [start];
  const steps = Math.max(24, Math.ceil(transition / ADJUSTMENT.step));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    curve.push({ x: u ** 3 * start.x + 3 * u ** 2 * t * first.x + 3 * u * t ** 2 * second.x + t ** 3 * approach.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * first.y + 3 * u * t ** 2 * second.y + t ** 3 * approach.y });
  }
  // Exact existing approach and shared endpoint retain the trunk tangent after SVG rounding.
  const result = [...oriented.slice(0, -2), ...curve, approach, join];
  return end ? result : result.reverse();
}

/**
 * Return adjusted final lane points for location 2 only; never mutate input.
 * Call AFTER junction endpoint splicing, BEFORE roundedRailPath(points, 12).
 * lanes: Map<chain, Map<serviceKey, Array<{x: number, y: number}>>>.
 * center: the diagram's geographic {lat, lon}, not a screen-space point.
 * Membership and exact shared endpoints identify the junction at any viewport;
 * either branch direction/order is retained. Transition length uses the shorter
 * local lane segment (capped in pixels), leaving every upstream vertex intact.
 * Apply once to final spliced lanes. Unknown geography/topology fails closed.
 */
export function applyRailJunctionFixtures(lanes, center) {
  if (!center || Math.abs(center.lat - WEST_END.lat) > 1e-7
    || Math.abs(center.lon - WEST_END.lon) > 1e-7
    || !Number.isFinite(center.lat) || !Number.isFinite(center.lon)) return lanes;
  const trunks = [...lanes].filter(([, services]) => sameKeys([...services.keys()], TRUNK_KEYS));
  if (trunks.length !== 1) return lanes;
  const [trunk, trunkLanes] = trunks[0];
  if (![...trunkLanes.values()].every(valid)) return lanes;
  const updates = [];
  let sharedTrunkEnd;
  for (const keys of BRANCH_KEYS) {
    const candidates = [...lanes].filter(([chain, services]) => chain !== trunk
      && sameKeys([...services.keys()], keys));
    const matches = [];
    for (const [chain, services] of candidates) {
      if (![...services.values()].every(valid)) continue;
      for (const end of [false, true]) {
        for (const trunkEnd of [false, true]) {
          const endpoint = (points, atEnd) => atEnd ? points.at(-1) : points[0];
          const matched = keys.every((key) => {
            const points = services.get(key);
            const trunkPoints = trunkLanes.get(key);
            const join = endpoint(points, end);
            const approach = end ? points.at(-2) : points[1];
            const neighbor = trunkEnd ? trunkPoints.at(-2) : trunkPoints[1];
            if (points.length < 3 || !samePoint(join, endpoint(trunkPoints, trunkEnd))
              || distance(join, approach) < 0.1) return false;
            const a = { x: approach.x - join.x, y: approach.y - join.y };
            const b = { x: join.x - neighbor.x, y: join.y - neighbor.y };
            const length = distance(join, neighbor);
            return length > 0 && Math.abs(a.x * b.y - a.y * b.x) / length < 1e-6
              && a.x * b.x + a.y * b.y > 0;
          });
          if (matched) matches.push({ chain, services, end, trunkEnd });
        }
      }
    }
    if (matches.length !== 1) return lanes;
    const { chain, services, end, trunkEnd } = matches[0];
    if (sharedTrunkEnd !== undefined && trunkEnd !== sharedTrunkEnd) return lanes;
    sharedTrunkEnd = trunkEnd;
    const available = [...services.values()].map((points) => end
      ? distance(points.at(-3), points.at(-2)) : distance(points[1], points[2]));
    const transition = Math.min(ADJUSTMENT.maximum, ...available.map((length) => length * ADJUSTMENT.fraction));
    if (transition < 2) return lanes;
    const adjusted = new Map(services);
    for (const [key, points] of services) adjusted.set(key, smoothApproach(points, end, transition));
    updates.push([chain, adjusted]);
  }
  const result = new Map(lanes);
  for (const [chain, services] of updates) result.set(chain, services);
  return result;
}
