import { offsetPolyline } from './railRendering.js';

const referenceCache = new WeakMap();
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const nodeKey = (p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`;
const lengths = (points) => {
  const result = [0];
  for (let i = 1; i < points.length; i++) result.push(result.at(-1) + distance(points[i - 1], points[i]));
  return result;
};

function nearest(point, points, cumulative) {
  let best;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]; const b = points[i];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1));
    const gap = distance(point, mix(a, b, t));
    if (!best || gap < best.gap - 1e-9) best = { i, t, gap, at: cumulative[i - 1] + (cumulative[i] - cumulative[i - 1]) * t };
  }
  return best;
}

// Continue the end tangents for boundary transitions outside a terminal bundle.
function corridorMatch(point, points, cumulative, extendStart, extendEnd) {
  const match = nearest(point, points, cumulative);
  const start = match.at < 1e-7 && extendStart;
  const end = match.at > cumulative.at(-1) - 1e-7 && extendEnd;
  if (!start && !end) return match;
  const i = start ? 1 : points.length - 1;
  const a = points[i - 1]; const b = points[i];
  const dx = b.x - a.x; const dy = b.y - a.y; const length = distance(a, b);
  const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (length * length);
  if ((start && t >= 0) || (end && t <= 1)) return match;
  return { i, t, at: cumulative[i - 1] + length * t, gap: distance(point, mix(a, b, t)) };
}

/** Resolve geographic anchors along a reference service, independent of view/zoom. */
export function corridorReference(catalog, corridor) {
  let cached = referenceCache.get(catalog);
  if (!cached) { cached = new Map(); referenceCache.set(catalog, cached); }
  if (cached.has(corridor)) return cached.get(corridor);
  if (corridor.sections) {
    const sections = corridor.sections.map((section) => corridorReference(catalog, section));
    if (sections.some((section) => !section)) return null;
    const points = sections.flat().filter((p, i, all) => !i || nodeKey(p) !== nodeKey(all[i - 1]));
    cached.set(corridor, points);
    return points;
  }
  const edges = catalog.segments.filter((edge) => edge.keys.includes(corridor.reference));
  if (!edges.length) return null;
  const latitude = (corridor.start[1] + corridor.end[1]) / 2;
  const longitudeScale = 111195 * Math.cos(latitude * Math.PI / 180);
  const metric = (p) => ({ x: p.lon * longitudeScale, y: p.lat * 111195 });
  const nodes = new Map();
  const addNode = (id, coordinate) => {
    if (!nodes.has(id)) nodes.set(id, { coordinate, links: [] });
  };
  const link = (a, b, weight) => { nodes.get(a).links.push({ id: b, weight }); nodes.get(b).links.push({ id: a, weight }); };
  for (const { geometry: [a, b] } of edges) {
    addNode(nodeKey(a), a); addNode(nodeKey(b), b);
    link(nodeKey(a), nodeKey(b), distance(metric(a), metric(b)));
  }
  const anchors = [corridor.start, corridor.end].map(([lon, lat], index) => {
    const point = metric({ lon, lat }); let best;
    for (const edge of edges) {
      const points = edge.geometry.map(metric); const match = nearest(point, points, lengths(points));
      if (!best || match.gap < best.match.gap) best = { edge, match };
    }
    if (best.match.gap > 250) return null;
    const [a, b] = best.edge.geometry; const t = best.match.t;
    const id = `anchor:${index}`;
    addNode(id, { lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t });
    const length = distance(metric(a), metric(b));
    link(id, nodeKey(a), length * t); link(id, nodeKey(b), length * (1 - t));
    return { id, edge: best.edge, t, length };
  });
  if (anchors.some((anchor) => !anchor)) return null;
  if (anchors[0].edge === anchors[1].edge) link(anchors[0].id, anchors[1].id,
    Math.abs(anchors[0].t - anchors[1].t) * anchors[0].length);
  const costs = new Map([[anchors[0].id, 0]]); const previous = new Map(); const pending = new Set(costs.keys());
  while (pending.size) {
    const current = [...pending].reduce((a, b) => costs.get(a) <= costs.get(b) ? a : b);
    pending.delete(current);
    if (current === anchors[1].id) break;
    for (const next of nodes.get(current).links) {
      const cost = costs.get(current) + next.weight;
      if (cost >= (costs.get(next.id) ?? Infinity)) continue;
      costs.set(next.id, cost); previous.set(next.id, current); pending.add(next.id);
    }
  }
  if (!costs.has(anchors[1].id)) return null;
  const ids = [anchors[1].id];
  while (ids[0] !== anchors[0].id) ids.unshift(previous.get(ids[0]));
  const points = ids.map((id) => nodes.get(id).coordinate)
    .filter((p, i, all) => !i || distance(metric(p), metric(all[i - 1])) > 0.001);
  cached.set(corridor, points);
  return points;
}

export function corridorBlend(pixelsPerMeter, latitude, zoom) {
  const fullMetersPerPixel = 2 * Math.PI * 6378137 * Math.cos(latitude * Math.PI / 180) / (256 * 2 ** zoom);
  const amount = smooth(Math.log2(1 / (pixelsPerMeter * fullMetersPerPixel)) + 1);
  // The diagram's meter approximation differs from Mercator by about 0.1%.
  // Stabilize the endpoint states without affecting the one-level transition.
  return amount > 1 - 1e-5 ? 1 : amount < 1e-5 ? 0 : amount;
}

const path = (points) => `M${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`;
function pointAt(points, cumulative, at) {
  const index = cumulative.findIndex((length, i) => i && length >= at);
  const i = index < 0 ? points.length - 1 : index;
  return mix(points[i - 1], points[i], clamp((at - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1)));
}

// A nearest-point blend can briefly pull inward where an approach meets a bend.
// Join the unchanged approach and fully grouped lane with matching tangents.
function smoothEntries(points, weights, padding = 0) {
  for (let i = 0; i < points.length; i++) {
    if (weights[i] <= 0 || weights[i] >= 1) continue;
    const first = i;
    while (i + 1 < points.length && weights[i + 1] > 0 && weights[i + 1] < 1) i++;
    let start = Math.max(0, first - 1); let end = Math.min(points.length - 1, i + 1);
    if (weights[start] !== 1 && weights[end] !== 1) continue;
    // At distant scales a whole geographic approach can shrink below a lane's
    // width. Include a minimum display-space run on both sides of that join.
    let before = 0; let after = 0;
    while (start > 0 && before < padding) { before += distance(points[start - 1], points[start]); start--; }
    while (end + 1 < points.length && after < padding) { after += distance(points[end], points[end + 1]); end++; }
    const a = points[start]; const d = points[end];
    const tangent = (from, to) => {
      const length = distance(from, to) || 1;
      return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    };
    const incoming = tangent(points[Math.max(0, start - 1)], a);
    const outgoing = tangent(d, points[Math.min(points.length - 1, end + 1)]);
    let reach = distance(a, d) / 3;
    // Keep the handles ordered on monotone axes instead of overshooting inward.
    for (const axis of ['x', 'y']) {
      const delta = d[axis] - a[axis];
      const sum = Math.abs(incoming[axis]) + Math.abs(outgoing[axis]);
      if (incoming[axis] * delta >= 0 && outgoing[axis] * delta >= 0 && sum) {
        reach = Math.min(reach, Math.abs(delta) / sum);
      }
    }
    const b = { x: a.x + incoming.x * reach, y: a.y + incoming.y * reach };
    const c = { x: d.x - outgoing.x * reach, y: d.y - outgoing.y * reach };
    const cumulative = lengths(points.slice(start, end + 1)); const total = cumulative.at(-1);
    if (!total) continue;
    for (let k = start + 1; k < end; k++) {
      const t = cumulative[k - start] / total; const u = 1 - t;
      points[k] = { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
        y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y };
    }
  }
}

/** Deform display lanes only; geographic source geometry and memberships stay intact. */
export function groupRailCorridors(segments, catalog, project, screen, corridors, displayPixelRatio = 1) {
  const diagnostics = [];
  if (!catalog?.segments?.length || !catalog.lines?.length) return diagnostics;
  for (const corridor of corridors) {
    if (!corridor.order.every((key) => catalog.lines.some((line) => line.id === key))) continue;
    const geographic = corridorReference(catalog, corridor);
    if (!geographic || geographic.length < 2) continue;
    const origin = geographic[Math.floor(geographic.length / 2)];
    const metricStep = { ...origin, lon: origin.lon + 10 / (111195 * Math.cos(origin.lat * Math.PI / 180)) };
    const pixelsPerMeter = distance(screen(project(origin)), screen(project(metricStep))) / 10;
    const blend = corridorBlend(pixelsPerMeter * displayPixelRatio, origin.lat, corridor.zoom);
    diagnostics.push({ id: corridor.id, blend });
    if (blend <= 1e-9) continue;
    const reference = geographic.map((point) => screen(project(point)));
    const cumulative = lengths(reference); const total = cumulative.at(-1);
    if (!total) continue;
    const taper = Math.min(40, total / 4); const gapLimit = corridor.maxGapMeters * pixelsPerMeter;
    const terminalStart = Object.values(corridor.parallelEnds || {}).some((ends) => ends.includes('start'));
    const terminalEnd = Object.values(corridor.parallelEnds || {}).some((ends) => ends.includes('end'));
    const padding = gapLimit + taper;
    const box = { left: Math.min(...reference.map((p) => p.x)) - padding,
      right: Math.max(...reference.map((p) => p.x)) + padding,
      top: Math.min(...reference.map((p) => p.y)) - padding,
      bottom: Math.max(...reference.map((p) => p.y)) + padding };
    const inBox = (a, b = a) => Math.max(a.x, b.x) >= box.left && Math.min(a.x, b.x) <= box.right
      && Math.max(a.y, b.y) >= box.top && Math.min(a.y, b.y) <= box.bottom;
    const retained = []; const shared = new Map();
    for (const segment of segments) {
      const rank = corridor.order.indexOf(segment.line);
      if (rank < 0 || corridor.fixedServices?.includes(segment.line) || !segment.points.some((p, i, all) => inBox(p, all[Math.max(0, i - 1)]))) {
        retained.push(segment); continue;
      }
      const offset = corridor.laneOffsets?.[segment.line]
        ?? (rank - (corridor.order.length - 1) / 2) * 5.5 * corridor.sign;
      const alternateGeometry = corridor.laneReferences?.[segment.line]
        ? corridorReference(catalog, corridor.laneReferences[segment.line]) : null;
      const alternate = Boolean(alternateGeometry);
      const laneReference = alternate ? alternateGeometry.map((p) => screen(project(p))) : reference;
      const laneLengths = alternate ? lengths(laneReference) : cumulative;
      const lane = offsetPolyline(laneReference, offset);
      const parallel = corridor.parallelEnds?.[segment.line] || [];
      const endWeight = (at) => smooth(Math.min(parallel.includes('start') ? Infinity : at + (terminalStart ? taper : 0),
        parallel.includes('end') ? Infinity : total - at + (terminalEnd ? taper : 0)) / taper);
      const samples = [];
      // Densify only near the corridor; long remote network sections stay cheap.
      for (let i = 0; i < segment.points.length - 1; i++) {
        const a = segment.points[i]; const b = segment.points[i + 1];
        const count = inBox(a, b) ? Math.max(1, Math.ceil(distance(a, b) / 4 - 1e-8)) : 1;
        for (let j = 0; j < count; j++) samples.push(mix(a, b, j / count));
      }
      samples.push(segment.points.at(-1));
      let changed = false;
      const matches = samples.map((point) => inBox(point) ? corridorMatch(point, reference, cumulative, terminalStart, terminalEnd) : null);
      const points = []; const full = []; const weights = [];
      const transform = (point, match) => {
        if (!match || match.gap >= gapLimit) { full.push(null); weights.push(0); return point; }
        const weight = blend * endWeight(match.at)
          * smooth((gapLimit - match.gap) / Math.min(20, gapLimit / 4));
        weights.push(weight / blend);
        full.push(weight === 1 && !alternate && !parallel.length && match.at >= 0 && match.at <= total ? match.at : null);
        if (!weight) return point;
        changed = true;
        const targetMatch = alternate ? corridorMatch(point, laneReference, laneLengths, terminalStart, terminalEnd) : match;
        const target = mix(lane[targetMatch.i - 1], lane[targetMatch.i], targetMatch.t);
        return mix(point, target, weight);
      };
      for (let i = 0; i < samples.length; i++) {
        const previous = matches[i - 1]; const match = matches[i];
        // Include intervening reference vertices in either travel direction.
        // This preserves bends instead of drawing chords across the corridor.
        if (previous && match && previous.gap < gapLimit && match.gap < gapLimit && previous.at !== match.at) {
          const stable = (n) => Math.abs(n - Math.round(n)) < 1e-8 ? Math.round(n) : n;
          const from = stable(previous.i - 1 + previous.t); const to = stable(match.i - 1 + match.t);
          const step = to > from ? 1 : -1;
          for (let k = step > 0 ? Math.floor(from) + 1 : Math.ceil(from) - 1;
            step > 0 ? k < to : k > to; k += step) {
            if (k < 0 || k >= reference.length) continue;
            const at = cumulative[k]; const fraction = (at - previous.at) / (match.at - previous.at);
            const point = mix(samples[i - 1], samples[i], fraction);
            points.push(transform(point, { i: Math.max(1, k), t: k ? 1 : 0, at, gap: previous.gap + (match.gap - previous.gap) * fraction }));
          }
        }
        points.push(transform(samples[i], match));
      }
      if (changed && corridor.smoothEntry) {
        const wideScale = corridor.entrySmoothingZoom === undefined ? 0
          : corridorBlend(pixelsPerMeter * displayPixelRatio, origin.lat, corridor.entrySmoothingZoom);
        smoothEntries(points, weights, 16 * wideScale);
      }
      if (changed) {
        const metadata = { ...segment, displayCorridors: [...(segment.displayCorridors || []), corridor.id] };
        const retain = (piece) => {
          if (piece.length > 1) retained.push({ ...metadata, points: piece, displaySourcePoints: piece, path: path(piece) });
        };
        let piece = [points[0]];
        for (let i = 1; i < points.length; i++) {
          if (full[i - 1] !== null && full[i] !== null) {
            retain(piece); piece = [points[i]];
            if (!shared.has(segment.line)) shared.set(segment.line, { metadata, lane, intervals: [] });
            shared.get(segment.line).intervals.push([Math.min(full[i - 1], full[i]), Math.max(full[i - 1], full[i])]);
          } else piece.push(points[i]);
        }
        retain(piece);
      } else retained.push(segment);
    }
    // Multiple direction shapes (especially the M-Line loop) can project onto
    // the same bundle. Emit each fully grouped service interval only once.
    for (const { metadata, lane, intervals } of shared.values()) {
      const merged = [];
      for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
        if (merged.length && interval[0] <= merged.at(-1)[1] + 1e-6) merged.at(-1)[1] = Math.max(merged.at(-1)[1], interval[1]);
        else merged.push([...interval]);
      }
      for (const [start, end] of merged) {
        if (end - start < 1e-6) continue;
        const points = [pointAt(lane, cumulative, start), ...lane.filter((_, i) => cumulative[i] > start && cumulative[i] < end),
          pointAt(lane, cumulative, end)];
        retained.push({ ...metadata, points, displaySourcePoints: points, path: path(points) });
      }
    }
    segments.splice(0, segments.length, ...retained);
  }
  return diagnostics;
}
