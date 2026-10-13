const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const direction = (tags) => ['yes', '1', 'true'].includes(tags.oneway) ? 1 : tags.oneway === '-1' ? -1 : null;
const compatible = (a, b) => a.tags.name === b.tags.name && a.tags.highway === b.tags.highway
  && (a.tags.layer || '0') === (b.tags.layer || '0')
  && (a.tags.bridge || 'no') === (b.tags.bridge || 'no')
  && (a.tags.tunnel || 'no') === (b.tags.tunnel || 'no');

function subtract(start, end, used) {
  let intervals = [[start, end]];
  for (const [low, high] of used) intervals = intervals.flatMap(([a, b]) => {
    if (high <= a || low >= b) return [[a, b]];
    return [[a, Math.min(b, low)], [Math.max(a, high), b]].filter(([x, y]) => y - x > 0.01);
  });
  return intervals;
}

function join(fragments, tolerance) {
  const chains = fragments.map((fragment) => ({ ...fragment, points: [...fragment.points] }));
  for (let i = 0; i < chains.length; i++) {
    let changed = true;
    while (changed) {
      changed = false;
      const a = chains[i];
      for (let j = i + 1; j < chains.length; j++) {
        const b = chains[j];
        if (a.divided !== b.divided || a.bike !== b.bike || a.minor !== b.minor
          || !compatible(a, b) || (!a.divided && a.id !== b.id)) continue;
        const choices = [[false, false], [false, true], [true, false], [true, true]]
          .map(([ra, rb]) => ({ ra, rb, gap: distance(ra ? a.points[0] : a.points.at(-1), rb ? b.points.at(-1) : b.points[0]) }))
          .sort((x, y) => x.gap - y.gap);
        const choice = choices[0];
        if (choice.gap > tolerance) continue;
        const first = choice.ra ? [...a.points].reverse() : a.points;
        const second = choice.rb ? [...b.points].reverse() : b.points;
        const joint = interpolate(first.at(-1), second[0], 0.5);
        a.points = [...first.slice(0, -1), joint, ...second.slice(1)];
        chains.splice(j, 1);
        changed = true;
        break;
      }
    }
  }
  for (const chain of chains) {
    const first = chain.points[0]; const last = chain.points.at(-1);
    if (first.x > last.x || (first.x === last.x && first.y > last.y)) chain.points.reverse();
  }
  return chains;
}

export function mergeDividedStreets(ways) {
  const segments = [];
  for (const way of ways) {
    if (way.minor || !way.tags?.name || way.tags.junction === 'roundabout'
      || ['no', '0', 'false'].includes(way.tags.oneway) || way.tags.highway.endsWith('_link')) continue;
    for (let i = 1; i < way.points.length; i++) {
      let a = way.points[i - 1]; let b = way.points[i];
      const reversed = a.x > b.x || (a.x === b.x && a.y > b.y);
      if (reversed) [a, b] = [b, a];
      const length = distance(a, b);
      if (length < 0.1) continue;
      segments.push({ way, index: i, a, b, length, ux: (b.x - a.x) / length, uy: (b.y - a.y) / length,
        heading: direction(way.tags) === null ? null : direction(way.tags) * (reversed ? -1 : 1), used: [] });
    }
  }
  segments.sort((a, b) => a.a.x - b.a.x || a.a.y - b.a.y || a.b.x - b.b.x || a.b.y - b.b.y || String(a.way.id).localeCompare(String(b.way.id)));
  const candidates = [];
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const a = segments[i]; const b = segments[j];
    if (a.way === b.way || !compatible(a.way, b.way)
      || (a.heading !== null && b.heading !== null && a.heading === b.heading)) continue;
    const dot = a.ux * b.ux + a.uy * b.uy;
    if (dot < Math.cos(12 * Math.PI / 180)) continue;
    const startB = (b.a.x - a.a.x) * a.ux + (b.a.y - a.a.y) * a.uy;
    const endB = (b.b.x - a.a.x) * a.ux + (b.b.y - a.a.y) * a.uy;
    const low = Math.max(0, startB); const high = Math.min(a.length, endB);
    if (high - low < 8) continue;
    const atB = (t) => interpolate(b.a, b.b, (t - startB) / (endB - startB));
    const gaps = [low, high].map((t) => distance(interpolate(a.a, a.b, t / a.length), atB(t)));
    const separation = (gaps[0] + gaps[1]) / 2;
    if (separation < 3 || Math.max(...gaps) > 30 || Math.abs(gaps[0] - gaps[1]) > 8) continue;
    candidates.push({ a, b, low, high, startB, endB, atB, separation });
  }
  candidates.sort((a, b) => a.separation - b.separation || b.high - b.low - (a.high - a.low));
  const merged = [];
  const joins = [];
  const touched = new Set();
  for (const candidate of candidates) {
    const { a, b, low, high, startB, endB, atB } = candidate;
    const occupied = [...a.used, ...b.used.map(([x, y]) => [startB + x / b.length * (endB - startB), startB + y / b.length * (endB - startB)])];
    for (const [start, end] of subtract(low, high, occupied)) {
      if (end - start < 2) continue;
      a.used.push([start, end]);
      b.used.push([(start - startB) / (endB - startB) * b.length, (end - startB) / (endB - startB) * b.length]);
      touched.add(a.way); touched.add(b.way);
      const points = [start, end].map((t) => {
        const first = interpolate(a.a, a.b, t / a.length); const second = atB(t);
        const center = interpolate(first, second, 0.5);
        joins.push({ way: a.way, original: first, center }, { way: b.way, original: second, center });
        return center;
      });
      merged.push({ ...a.way, divided: true, bike: a.way.bike || b.way.bike, points });
    }
  }
  if (!merged.length) return ways;
  const remainder = [];
  for (const way of ways) {
    if (!touched.has(way)) { remainder.push(way); continue; }
    for (const segment of segments.filter((segment) => segment.way === way)) {
      for (const [start, end] of subtract(0, segment.length, segment.used)) {
        if (end - start < 0.5) continue;
        remainder.push({ ...way, transitionTail: true, points: [start, end].map((t) => {
          const point = interpolate(segment.a, segment.b, t / segment.length);
          return joins.find((entry) => entry.way === way && distance(entry.original, point) < 0.1)?.center || point;
        }) });
      }
    }
  }
  // Join local median estimates before corner rounding; never merge unrelated road classes or levels.
  return [...join(merged, 4), ...join(remainder, 0.1)];
}

function centerMedianGaps(ways) {
  const moves = [];
  const patches = new Map();
  for (const connector of ways.filter((way) => !way.divided && !way.minor && !way.bike && way.tags.junction !== 'roundabout')) {
    const first = connector.points[0]; const last = connector.points.at(-1);
    const span = distance(first, last);
    const length = connector.points.slice(1).reduce((sum, point, i) => sum + distance(connector.points[i], point), 0);
    if (span < 3 || span > 40 || length > 45) continue;
    const dx = last.x - first.x; const dy = last.y - first.y;
    const endpoints = ways.filter((way) => way.divided && compatible(connector, way)).flatMap((way) =>
      [0, way.points.length - 1].flatMap((index) => {
        const point = way.points[index]; const neighbor = way.points[index === 0 ? 1 : index - 1];
        const tx = point.x - neighbor.x; const ty = point.y - neighbor.y;
        return Math.abs(tx * dx + ty * dy) / (Math.hypot(tx, ty) * span || 1) >= Math.cos(25 * Math.PI / 180)
          ? [{ way, point }] : [];
      }));
    const nearest = (point) => endpoints.map((end) => ({ ...end, gap: distance(point, end.point) }))
      .filter((end) => end.gap <= 15).sort((a, b) => a.gap - b.gap)[0];
    const a = nearest(first); const b = nearest(last);
    if (!a || !b || a.way === b.way || distance(a.point, b.point) > 45) continue;
    const ax = b.point.x - a.point.x; const ay = b.point.y - a.point.y;
    const squared = ax * ax + ay * ay;
    if (!squared) continue;
    const project = (point) => interpolate(a.point, b.point, Math.max(0, Math.min(1,
      ((point.x - a.point.x) * ax + (point.y - a.point.y) * ay) / squared)));
    moves.push({ original: first, center: a.point, grade: connector }, { original: last, center: b.point, grade: connector });
    patches.set(connector, [a.point, b.point]);
    for (const tail of ways.filter((way) => way.transitionTail && !way.minor && !way.divided)) {
      for (const [source, target] of [[first, tail.points.at(-1)], [last, tail.points.at(-1)],
        [first, tail.points[0]], [last, tail.points[0]]]) {
        const opposite = target === tail.points[0] ? tail.points.at(-1) : tail.points[0];
        if (distance(opposite, source) > 0.1) continue;
        if (!ways.some((way) => way.divided && compatible(tail, way)
          && [way.points[0], way.points.at(-1)].some((point) => distance(point, target) < 0.1))) continue;
        const center = project(target);
        if (distance(target, center) <= 15) moves.push({ original: target, center, grade: connector });
      }
    }
  }
  return ways.map((way) => ({ ...way, points: patches.get(way) || (way.minor ? way.points : way.points.map((point) =>
    moves.find((move) => ['layer', 'bridge', 'tunnel'].every((key) =>
      (way.tags[key] || (key === 'layer' ? '0' : 'no')) === (move.grade.tags[key] || (key === 'layer' ? '0' : 'no')))
      && distance(point, move.original) < 0.1)?.center || point)) }));
}

export function collapseDividedTransitions(input) {
  const ways = centerMedianGaps(input);
  const length = (way) => way.points.slice(1).reduce((sum, point, i) => sum + distance(way.points[i], point), 0);
  const sameGrade = (a, b) => ['layer', 'bridge', 'tunnel'].every((key) =>
    (a.tags[key] || (key === 'layer' ? '0' : 'no')) === (b.tags[key] || (key === 'layer' ? '0' : 'no')));
  const eligible = (way) => !way.minor && !way.divided && way.tags.junction !== 'roundabout'
    && !way.tags.highway.endsWith('_link');
  const tails = ways.filter((way) => way.transitionTail && eligible(way) && length(way) <= 40);
  const removed = new Set();
  const processed = new Set();
  const replacements = [];
  for (let i = 0; i < tails.length; i++) for (let j = i + 1; j < tails.length; j++) {
    const a = tails[i]; const b = tails[j];
    if (removed.has(a) || removed.has(b) || processed.has(a) || processed.has(b) || !compatible(a, b)) continue;
    let fan = null;
    let tipFan = null;
    for (const ai of [0, a.points.length - 1]) for (const bi of [0, b.points.length - 1]) {
      const tip = a.points[ai];
      if (distance(tip, b.points[bi]) > 0.1) continue;
      const left = a.points[ai === 0 ? a.points.length - 1 : 0];
      const right = b.points[bi === 0 ? b.points.length - 1 : 0];
      const spread = distance(left, right);
      const first = distance(tip, left); const second = distance(tip, right);
      if (spread < 3 || spread > 40 || Math.min(first, second) < 1) continue;
      const medians = ways.filter((way) => way.divided && compatible(a, way));
      const atMedian = (point) => medians.some((way) => [0, way.points.length - 1].some((index) => {
        const end = way.points[index]; const neighbor = way.points[index === 0 ? 1 : index - 1];
        const dx = end.x - neighbor.x; const dy = end.y - neighbor.y;
        return distance(point, end) < 4 && Math.abs(dx * (right.x - left.x) + dy * (right.y - left.y))
          / (Math.hypot(dx, dy) * spread || 1) >= Math.cos(25 * Math.PI / 180);
      }));
      if (atMedian(left) && atMedian(right)) {
        const dx = right.x - left.x; const dy = right.y - left.y;
        const t = ((tip.x - left.x) * dx + (tip.y - left.y) * dy) / (spread * spread);
        const center = interpolate(left, right, t);
        if (t > 0 && t < 1 && distance(tip, center) <= 15) tipFan = { tip, center };
        continue;
      }
      if (spread > 30) continue;
      if (((left.x - tip.x) * (right.x - tip.x) + (left.y - tip.y) * (right.y - tip.y)) / (first * second) < 0) continue;
      if (!ways.some((way) => way.divided && compatible(a, way)
        && [way.points[0], way.points.at(-1)].some((point) => distance(point, tip) < 4))) continue;
      const base = ways.find((way) => way !== a && way !== b && !removed.has(way) && eligible(way)
        && !way.bike && sameGrade(a, way) && length(way) <= 45
        && ((distance(way.points[0], left) < 0.1 && distance(way.points.at(-1), right) < 0.1)
          || (distance(way.points[0], right) < 0.1 && distance(way.points.at(-1), left) < 0.1)));
      if (base) fan = { tip, left, right, base };
    }
    if (tipFan) {
      replacements.push({ originals: [tipFan.tip], center: tipFan.center, anchor: null, grade: a });
      processed.add(a); processed.add(b);
      continue;
    }
    if (!fan) continue;
    const midpoint = interpolate(fan.left, fan.right, 0.5);
    let center = midpoint;
    let closest = 20;
    // A crossing divided road may have an intersection-sized gap in its median.
    for (const median of ways.filter((way) => way.divided && compatible(fan.base, way))) {
      for (let k = 1; k < median.points.length; k++) {
        const start = median.points[k - 1]; const end = median.points[k];
        const dx = end.x - start.x; const dy = end.y - start.y;
        const squared = dx * dx + dy * dy;
        if (!squared) continue;
        const extension = 30 / Math.sqrt(squared);
        const t = Math.max(k === 1 ? -extension : 0, Math.min(k === median.points.length - 1 ? 1 + extension : 1,
          ((midpoint.x - start.x) * dx + (midpoint.y - start.y) * dy) / squared));
        const projected = interpolate(start, end, t);
        const gap = distance(projected, midpoint);
        if (gap < closest) { closest = gap; center = projected; }
      }
    }
    removed.add(b); removed.add(fan.base); processed.add(a);
    replacements.push({ originals: [fan.left, fan.right], center, anchor: a, grade: a, tip: fan.tip, bike: a.bike || b.bike });
  }
  return ways.filter((way) => !removed.has(way)).map((way) => {
    const fan = replacements.find((entry) => entry.anchor === way);
    if (fan) return { ...way, bike: fan.bike, points: [fan.tip, fan.center] };
    const points = way.minor ? way.points : way.points.map((point) => replacements.find((entry) => sameGrade(way, entry.grade)
      && entry.originals.some((original) => distance(original, point) < 0.1))?.center || point);
    return { ...way, points };
  }).filter((way) => length(way) > 0.1);
}
