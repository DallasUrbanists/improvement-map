import { railSegmentsInBounds } from './railGeometry.js';
import { applyRailJunctionFixtures } from './railJunctionFixtures.js';

const SIZE = 480;
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

export function offsetPolyline(points, offset) {
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

export function arrangeRailJunctions(chains, scale, sharedNodesOnly = false) {
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
        const distances = [false, true].filter((end) => !sharedNodesOnly
          || branch.nodes[Number(end)] === trunk.nodes[Number(trunkEnd)])
          .map((end) => ({ end, distance: Math.hypot(endpoint(branch, end).x - point.x, endpoint(branch, end).y - point.y) }));
        if (!distances.length) return [];
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

export function renderTransit(catalog, center, halfExtent, project, screen, scale) {
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

