import { railSegmentsInBounds } from './railGeometry.js';
import { arrangeRailJunctions, offsetPolyline } from './railRendering.js';

const nodeKey = (point) => `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`;
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const unit = (a, b) => {
  const length = distance(a, b) || 1;
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
};
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const number = (n) => n.toFixed(1);
const xy = (p) => `${number(p.x)},${number(p.y)}`;
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[c]);

function chainsFromSource(catalog, center, halfExtent, project, screen) {
  const nodes = new Map();
  const edges = [];
  // Use the catalog's six-decimal node identity; keep a deterministic original
  // coordinate for each node rather than averaging or snapping nearby tracks.
  for (const segment of railSegmentsInBounds(catalog, center, halfExtent)) {
    const keys = [...segment.keys].sort();
    const ends = segment.geometry.map((point) => {
      const id = nodeKey(point);
      if (!nodes.has(id)) nodes.set(id, { id, point: screen(project(point)), edges: [] });
      return nodes.get(id);
    });
    if (ends[0] === ends[1]) continue;
    const edge = { ends, keys, signature: keys.join('|'), visited: false };
    edges.push(edge);
    for (const node of ends) node.edges.push(edge);
  }
  const chains = [];
  const continuation = (node, signature) => node.edges.length === 2
    && node.edges.every((edge) => edge.signature === signature);
  const walk = (first, start) => {
    let edge = first; let node = start;
    const points = [node.point];
    while (edge && !edge.visited) {
      edge.visited = true;
      node = edge.ends.find((end) => end !== node);
      points.push(node.point);
      if (!continuation(node, first.signature)) break;
      edge = node.edges.find((candidate) => !candidate.visited);
    }
    let ends = [start.id, node.id];
    const last = points.at(-1);
    if (points[0].x > last.x || (points[0].x === last.x && points[0].y > last.y)) {
      points.reverse(); ends.reverse();
    }
    chains.push({ points, nodes: ends, keys: [...first.keys], signature: first.signature });
  };
  // Start at junctions and membership changes; process closed loops afterwards.
  for (const edge of edges) {
    const start = edge.ends.find((node) => !continuation(node, edge.signature));
    if (start && !edge.visited) walk(edge, start);
  }
  for (const edge of edges) if (!edge.visited) walk(edge, edge.ends[0]);
  return chains;
}

function measure(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths.at(-1) + distance(points[i - 1], points[i]));
  return lengths;
}

function consolidateVariants(chains, scale) {
  const nearPath = (point, points) => points.slice(1).some((b, i) => {
    const a = points[i]; const dx = b.x - a.x; const dy = b.y - a.y;
    const t = dx || dy ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
    return distance(point, interpolate(a, b, t)) <= 3 * scale;
  });
  const samples = (points) => points.flatMap((point, i) => i ? [interpolate(points[i - 1], point, 0.5), point] : [point]);
  const result = [];
  for (const chain of chains) {
    // Only equivalent paths between the very same graph nodes can be combined.
    // Nearby disconnected tracks and genuinely diverging branches stay separate.
    const match = result.find((other) => other.nodes[0] !== other.nodes[1]
      && other.nodes[0] === chain.nodes[0] && other.nodes[1] === chain.nodes[1]
      && samples(chain.points).every((p) => nearPath(p, other.points))
      && samples(other.points).every((p) => nearPath(p, chain.points))
      && Math.max(measure(chain.points).at(-1), measure(other.points).at(-1))
        <= Math.min(measure(chain.points).at(-1), measure(other.points).at(-1)) * 1.03);
    if (!match) { result.push(chain); continue; }
    match.keys = [...new Set([...match.keys, ...chain.keys])].sort();
    match.signature = match.keys.join('|');
    if (chain.points.length > match.points.length) match.points = chain.points;
  }
  // Membership is now continuous through former variant splits. Join those
  // sections before offsetting so a service does not reset to a centered lane.
  while (true) {
    const nodes = new Map();
    for (const chain of result) for (const end of [0, 1]) {
      const id = chain.nodes[end];
      if (!nodes.has(id)) nodes.set(id, []);
      nodes.get(id).push({ chain, end });
    }
    const pair = [...nodes.values()].find((entries) => entries.length === 2
      && entries[0].chain !== entries[1].chain && entries[0].chain.signature === entries[1].chain.signature);
    if (!pair) break;
    const [a, b] = pair;
    const first = a.end ? a.chain.points : [...a.chain.points].reverse();
    const second = b.end ? [...b.chain.points].reverse() : b.chain.points;
    a.chain.points = [...first, ...second.slice(1)];
    a.chain.nodes = [a.chain.nodes[1 - a.end], b.chain.nodes[1 - b.end]];
    const start = a.chain.points[0]; const end = a.chain.points.at(-1);
    if (start.x > end.x || (start.x === end.x && start.y > end.y)) {
      a.chain.points.reverse(); a.chain.nodes.reverse();
    }
    result.splice(result.indexOf(b.chain), 1);
  }
  return result;
}

function sample(points, lengths, at) {
  const i = Math.max(1, lengths.findIndex((length) => length >= at));
  const span = lengths[i] - lengths[i - 1];
  return { point: interpolate(points[i - 1], points[i], span ? (at - lengths[i - 1]) / span : 0),
    tangent: unit(points[i - 1], points[i]) };
}

function cubic(a, b, c, d) {
  return Array.from({ length: 24 }, (_, i) => {
    const t = (i + 1) / 24; const u = 1 - t;
    return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
      y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
  });
}

function connectLane(points, anchors) {
  const lengths = measure(points); const total = lengths.at(-1);
  const changes = anchors.map((anchor, end) => anchor && distance(anchor.point, end ? points.at(-1) : points[0]) > 0.001);
  // Adjust only a short arc at each end. Dense source vertices farther along the
  // route are retained verbatim, including bends inside the original geometry.
  const transition = Math.min(24, total / 4);
  const startAt = changes[0] ? transition : 0;
  const endAt = total - (changes[1] ? transition : 0);
  const first = sample(points, lengths, startAt);
  const last = sample(points, lengths, endAt);
  const core = [first.point, ...points.filter((_, i) => lengths[i] > startAt && lengths[i] < endAt), last.point];
  const result = [];
  let markup;
  const control = (p, tangent, amount) => ({ x: p.x + tangent.x * amount, y: p.y + tangent.y * amount });
  if (changes[0]) {
    const a = anchors[0].point;
    const b = control(a, anchors[0].tangent, transition / 3);
    const c = control(first.point, first.tangent, -transition / 3);
    markup = `M${xy(a)} C${xy(b)} ${xy(c)} ${xy(first.point)}`;
    result.push(a, ...cubic(a, b, c, first.point));
  } else { markup = `M${xy(first.point)}`; result.push(first.point); }
  for (const point of core.slice(1)) { markup += ` L${xy(point)}`; result.push(point); }
  if (changes[1]) {
    const d = anchors[1].point;
    const b = control(last.point, last.tangent, transition / 3);
    const c = control(d, anchors[1].tangent, transition / 3);
    markup += ` C${xy(b)} ${xy(c)} ${xy(d)}`;
    result.push(...cubic(last.point, b, c, d));
  }
  return { path: markup, points: result };
}

/** Preserve source centerlines and reconcile service lanes at shared graph nodes. */
export function renderSourceTransit(catalog, center, halfExtent, project, screen, scale, { width = 480, height = 480 } = {}) {
  const lines = new Map((catalog?.lines || []).map((line) => [line.id, line]));
  const chains = consolidateVariants(chainsFromSource(catalog, center, halfExtent + 40 / scale, project, screen), scale);
  const junctions = arrangeRailJunctions(chains, scale, true);
  const nodes = new Map();
  for (const chain of chains) for (const end of [0, 1]) {
    const id = chain.nodes[end];
    if (!nodes.has(id)) nodes.set(id, []);
    nodes.get(id).push({ chain, end });
  }
  // Carry the junction's lane order through every connected section with the
  // same services. Otherwise a small route variant could reset a trunk's order.
  const ordered = new Set();
  const direction = (chain, end) => end ? unit(chain.points.at(-2), chain.points.at(-1))
    : unit(chain.points[0], chain.points[1]);
  const seeds = [...junctions.flatMap(({ trunk, branches }) => [trunk, ...branches.map((branch) => branch.chain)]), ...chains];
  for (const seed of seeds) {
    if (ordered.has(seed)) continue;
    ordered.add(seed);
    const queue = [seed];
    for (let i = 0; i < queue.length; i++) {
      const chain = queue[i];
      for (const end of [0, 1]) for (const next of nodes.get(chain.nodes[end])) {
        if (ordered.has(next.chain) || next.chain.signature !== chain.signature) continue;
        const a = direction(chain, end); const b = direction(next.chain, next.end);
        next.chain.keys = a.x * b.x + a.y * b.y >= 0 ? [...chain.keys] : [...chain.keys].reverse();
        ordered.add(next.chain); queue.push(next.chain);
      }
    }
  }
  const lanes = new Map(chains.map((chain) => [chain, new Map(chain.keys.map((key, i) =>
    [key, offsetPolyline(chain.points, (i - (chain.keys.length - 1) / 2) * 5.5)]))]));
  const anchors = new Map(chains.map((chain) => [chain, new Map(chain.keys.map((key) => [key, [null, null]]))]));
  for (const entries of nodes.values()) {
    if (entries.length < 2) continue;
    const keys = new Set(entries.flatMap(({ chain }) => chain.keys));
    for (const key of keys) {
      const participants = entries.filter(({ chain }) => chain.keys.includes(key))
        .sort((a, b) => b.chain.keys.length - a.chain.keys.length);
      if (participants.length < 2) continue;
      const primary = participants[0];
      const reference = lanes.get(primary.chain).get(key);
      const point = primary.end ? reference.at(-1) : reference[0];
      const tangent = primary.end ? unit(reference.at(-1), reference.at(-2)) : unit(reference[0], reference[1]);
      for (const { chain, end } of participants) {
        const lane = lanes.get(chain).get(key);
        const outward = end ? unit(lane.at(-1), lane.at(-2)) : unit(lane[0], lane[1]);
        const sign = outward.x * tangent.x + outward.y * tangent.y >= 0 ? 1 : -1;
        anchors.get(chain).get(key)[end] = { point, tangent: { x: sign * tangent.x, y: sign * tangent.y } };
      }
    }
  }
  const segments = []; const paths = []; const visible = new Set();
  const intersects = (points) => points.slice(1).some((b, i) => {
    const a = points[i];
    return Math.min(a.x, b.x) <= width && Math.max(a.x, b.x) >= 0
      && Math.min(a.y, b.y) <= height && Math.max(a.y, b.y) >= 0;
  });
  for (const chain of chains) for (const [key, lane] of lanes.get(chain)) {
    if (!lines.has(key)) continue;
    const adjusted = connectLane(lane, anchors.get(chain).get(key));
    if (!intersects(adjusted.points)) continue;
    visible.add(key);
    segments.push({ line: key, points: adjusted.points, sourcePoints: chain.points });
    paths.push(`<path data-transit-line="${escapeXml(key)}" d="${adjusted.path}" stroke="${lines.get(key).color}"/>`);
  }
  return { paths, segments, lines: [...visible].sort().map((key) => lines.get(key)),
    junctions: junctions.map(({ trunk, branches }) => ({ trunkOrder: trunk.keys,
      branchOrders: branches.map((branch) => branch.chain.keys) })) };
}
