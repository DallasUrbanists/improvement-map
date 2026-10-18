const FONT_SIZE = 18;
const HALO = 5;
const number = (value) => value.toFixed(1);
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const rounded = (point) => ({ x: Number(number(point.x)), y: Number(number(point.y)) });

// Keep the command coordinates identical to roundedRailPath(points, 5), including its precision.
function commandsFor(points, radius) {
  const commands = [{ type: 'M', end: rounded(points[0]) }];
  if (radius === 0) return [...commands, ...points.slice(1).map((point) => ({ type: 'L', end: rounded(point) }))];
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1]; const corner = points[i]; const after = points[i + 1];
    const incoming = distance(before, corner); const outgoing = distance(corner, after);
    if (incoming < 0.1 || outgoing < 0.1) continue;
    const trim = Math.min(radius, incoming * 0.4, outgoing * 0.4);
    commands.push({ type: 'L', end: rounded(interpolate(corner, before, trim / incoming)) },
      { type: 'Q', control: rounded(corner), end: rounded(interpolate(corner, after, trim / outgoing)) });
  }
  commands.push({ type: 'L', end: rounded(points.at(-1)) });
  return commands;
}

function pathData(commands) {
  return commands.map(({ type, control, end }) => `${type}${control ? `${number(control.x)},${number(control.y)} ` : ''}${number(end.x)},${number(end.y)}`).join(' ');
}

/** Matches the renderer's roundedRailPath(points, 5) without importing the renderer. */
export function roundedStreetLabelPath(points, radius = 5) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(validPoint)) return '';
  return pathData(commandsFor(points, radius));
}

function validPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function reverseCommands(commands) {
  const reversed = [{ type: 'M', end: commands.at(-1).end }];
  for (let i = commands.length - 1; i > 0; i--) {
    reversed.push({ type: commands[i].type, control: commands[i].control, end: commands[i - 1].end });
  }
  return reversed;
}

function samplesFor(commands) {
  const samples = [{ ...commands[0].end, offset: 0 }];
  let previous = commands[0].end;
  for (const command of commands.slice(1)) {
    const start = previous;
    const length = command.control ? distance(start, command.control) + distance(command.control, command.end) : distance(start, command.end);
    const steps = Math.max(1, Math.ceil(length / (command.control ? 0.25 : 2)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = command.control ? interpolate(interpolate(start, command.control, t), interpolate(command.control, command.end, t), t)
        : interpolate(start, command.end, t);
      const last = samples.at(-1);
      const step = distance(last, point);
      if (step > 0.00001) samples.push({ ...point, offset: last.offset + step });
    }
    previous = command.end;
  }
  return samples;
}

function atOffset(samples, offset) {
  let low = 0; let high = samples.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (samples[middle].offset <= offset) low = middle;
    else high = middle;
  }
  const a = samples[low]; const b = samples[high];
  const t = Math.max(0, Math.min(1, (offset - a.offset) / (b.offset - a.offset)));
  const point = interpolate(a, b, t);
  return { ...point, angle: Math.atan2(b.y - a.y, b.x - a.x), offset };
}

function joinedPaths(polylines, radius) {
  const paths = polylines.flatMap((polyline, index) => {
    if (polyline?.labelEligible === false) return [];
    const points = Array.isArray(polyline) ? polyline : polyline?.points;
    if (!Array.isArray(points) || points.length < 2 || !points.every(validPoint)) return [];
    return [{ commands: commandsFor(points, radius), index }];
  });
  const result = [];
  const seen = new Set();
  for (const path of paths) {
    let commands = path.commands;
    const used = new Set([path.index]);
    // Join only touching rendered endpoints, preserving every existing L/Q segment.
    for (let side = 0; side < 2; side++) {
      if (side) commands = reverseCommands(commands);
      while (true) {
        const end = commands.at(-1).end;
        const previous = commands.at(-1).control || commands.at(-2).end;
        const heading = Math.atan2(end.y - previous.y, end.x - previous.x);
        const choices = paths.filter((candidate) => !used.has(candidate.index)).flatMap((candidate) => {
          return [candidate.commands, reverseCommands(candidate.commands)].flatMap((next) => {
            if (distance(end, next[0].end) > 0.15) return [];
            const point = next[1].control || next[1].end;
            const angle = Math.atan2(point.y - end.y, point.x - end.x);
            const turn = Math.abs(Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading)));
            return turn < Math.PI / 3 ? [{ next, turn, index: candidate.index }] : [];
          });
        }).sort((a, b) => a.turn - b.turn || a.index - b.index);
        if (!choices.length) break;
        const choice = choices[0];
        commands = [...commands, ...choice.next.slice(1)];
        used.add(choice.index);
      }
    }
    commands = reverseCommands(commands);
    const key = [...used].sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ commands, pathIndex: path.index, pathIndices: [...used] });
  }
  return result;
}

function textWidth(text) {
  // Arial Bold advances; SVG textLength makes the resulting total deterministic across systems.
  return [...text].reduce((sum, char) => sum + (/[ ilI.,'!:;]/.test(char) ? 5
    : /[MW@%]/.test(char) ? 16 : /[mw]/.test(char) ? 14 : /[A-Z&]/.test(char) ? 12 : 10), 0);
}

function bounds(points) {
  const left = Math.min(...points.map((point) => point.x)); const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y)); const bottom = Math.max(...points.map((point) => point.y));
  return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
}

function boxLimits(box) {
  return { left: box.x - box.width / 2, right: box.x + box.width / 2,
    top: box.y - box.height / 2, bottom: box.y + box.height / 2 };
}

function overlaps(a, b) {
  const x = boxLimits(a); const y = boxLimits(b);
  return x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
}

function contained(box, frame) {
  const limit = boxLimits(box);
  return limit.left >= frame.left && limit.right <= frame.right && limit.top >= frame.top && limit.bottom <= frame.bottom;
}

function visibleFraction(box, frame) {
  const limit = boxLimits(box);
  return Math.max(0, Math.min(limit.right, frame.right) - Math.max(limit.left, frame.left))
    * Math.max(0, Math.min(limit.bottom, frame.bottom) - Math.max(limit.top, frame.top)) / (box.width * box.height);
}

function envelope(anchor, fontSize = FONT_SIZE) {
  const c = Math.cos(anchor.angle); const s = Math.sin(anchor.angle);
  const scale = fontSize / FONT_SIZE;
  const extent = 10.5 * scale + HALO / 2;
  // Cover a full maximum-width glyph at every baseline sample, ascenders, descenders and halo.
  return bounds([-extent, extent].flatMap((x) => [-15.5 * scale - HALO / 2, 10.5 * scale + HALO / 2].map((y) => ({
    x: anchor.x + x * c - y * s, y: anchor.y + x * s + y * c,
  }))));
}

function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return (result >>> 0).toString(36);
}

/**
 * Pure placement of one ranked street. Supply already consolidated projected polylines, not raw OSM ways.
 * `polylines` accepts point arrays or { points, labelEligible }; rank is 1-based (index is 0-based).
 * Occupied rectangles use CENTER x/y and width/height, as in the renderer/transit badge service.
 * `text` is the display abbreviation; `name` is retained in the accessible title. No abbreviation is done here.
 * `haloColor` defaults to the map background gray (#f5f5f5); only 3/6-digit hex colors are accepted.
 * Rank 1 must fit all margins; it retries at 17/16/15/14px only when no clear 18px span exists.
 * Other ranks stay at 18px and may clip but keep at least minVisible of the halo envelope in the canvas.
 * Touching path fragments are joined without changing their rendered curves; disconnected fragments never bridge.
 * Concatenate defs inside the SVG's <defs>, markup inside its body, and pass returned occupied to the next rank.
 * Diagnostics include supportingPaths (input points and rounded d), pathPoints (dense rounded samples),
 * anchors (on-road baseline samples every <=3px, with angle and arc offset), conservative glyphBoxes,
 * rank/text, fullyInFrame, clipped, and visibleFraction. They are geometry estimates, not DOM font measurements.
 */
export function createStreetLabel({ name, text = name, rank, index = 0, polylines = [], occupied = [],
  size = 480, height = size, margins = {}, minVisible = 0.65, requireFull = false, allowPrimaryClipping = false, radius = 5, haloColor = '#f5f5f5', inheritPaint = false, id } = {}) {
  rank ??= index + 1;
  const previousOccupied = Array.isArray(occupied) ? occupied : [];
  const failure = (reason) => ({ defs: '', markup: '', occupied: [...previousOccupied], anchors: [],
    diagnostics: { placed: false, reason, rank, name, text, anchors: [] } });
  if (typeof name !== 'string' || typeof text !== 'string' || !text.trim() || !name.trim()
    || !/^[\x20-\x7e]+$/.test(text) || text.length > 100) return failure('unsupported-name');
  if (typeof haloColor !== 'string' || !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(haloColor)
    || !Array.isArray(polylines) || !Array.isArray(occupied) || !margins || typeof margins !== 'object'
    || !Number.isInteger(rank) || rank < 1 || rank > 4 || !Number.isFinite(size) || size < 80
    || !Number.isFinite(height) || height < 80
    || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(minVisible) || minVisible <= 0.5 || minVisible > 1) return failure('invalid-options');
  const margin = { left: 12, right: 12, top: 35, bottom: 54, ...margins };
  if (Object.values(margin).some((value) => !Number.isFinite(value) || value < 0)) return failure('invalid-options');
  const frame = { left: margin.left, right: size - margin.right, top: margin.top, bottom: height - margin.bottom };
  if (frame.left >= frame.right || frame.top >= frame.bottom) return failure('invalid-options');
  const canvas = { left: 0, right: size, top: 0, bottom: height };
  const obstacles = occupied.filter((box) => box && [box.x, box.y, box.width, box.height].every(Number.isFinite));
  const paths = joinedPaths(polylines, radius).map((path) => ({ ...path, samples: samplesFor(path.commands) }));
  let best = null; let supportedPaths = 0;
  for (const fontSize of (rank === 1 || requireFull || allowPrimaryClipping ? [18, 17, 16, 15, 14] : [FONT_SIZE])) {
    const width = textWidth(text) * fontSize / FONT_SIZE;
    for (const { pathIndex, pathIndices, commands: originalCommands, samples: forward } of paths) {
      const length = forward.at(-1).offset;
      if (length < width + 4) continue;
      supportedPaths++;
      // Bound candidate work even for long OSM paths well outside the viewport.
      const offsets = new Set([2, (length - width) / 2, length - width - 2]);
      for (const sample of forward) {
        if (sample.x < -width || sample.x > size + width || sample.y < -width || sample.y > height + width) continue;
        const start = Math.round((sample.offset - width / 2) / 6) * 6;
        if (start >= 2 && start + width <= length - 2) offsets.add(start);
      }
      let reverseSamples;
      for (const originalStart of [...offsets].sort((a, b) => a - b)) {
        const mid = atOffset(forward, originalStart + width / 2);
        const reversed = mid.angle > Math.PI / 2 || mid.angle < -Math.PI / 2;
        if (reversed && !reverseSamples) reverseSamples = samplesFor(reverseCommands(originalCommands));
        const samples = reversed ? reverseSamples : forward;
        const startOffset = reversed ? length - originalStart - width : originalStart;
        const steps = Math.ceil(width / 3);
        const anchors = Array.from({ length: steps + 1 }, (_, i) => atOffset(samples, startOffset + width * i / steps));
        if (anchors.some((anchor) => Math.abs(anchor.angle) > Math.PI / 2 + 0.025)) continue;
        let turn = 0;
        for (let i = 1; i < anchors.length; i++) turn += Math.abs(anchors[i].angle - anchors[i - 1].angle);
        if (turn > Math.PI * 0.65) continue;
        const boxes = anchors.map((anchor) => envelope(anchor, fontSize));
        const full = boxes.every((box) => contained(box, frame));
        if (((rank === 1 && !allowPrimaryClipping) || requireFull) && !full) continue;
        const visible = boxes.reduce((sum, box) => sum + visibleFraction(box, canvas), 0) / boxes.length;
        if (!full && visible < minVisible) continue;
        if (boxes.some((box) => obstacles.some((obstacle) => overlaps(box, obstacle)))) continue;
        const center = anchors[Math.floor(anchors.length / 2)];
        const score = (full ? 10000 : visible * 1000) - Math.hypot(center.x - size / 2, center.y - height / 2) - turn * 15;
        if (!best || score > best.score) best = { score, full, visible, pathIndex, pathIndices, reversed, startOffset, width, fontSize,
          anchors, boxes, commands: reversed ? reverseCommands(originalCommands) : originalCommands, length, turn };
      }
    }
    // When clipping is allowed, try smaller text for a full fit before using a partial label.
    if (best && (!allowPrimaryClipping || best.full)) break;
  }
  if (!best) return failure(supportedPaths ? 'no-clear-span' : 'short-or-invalid-path');
  const { width, fontSize } = best;
  const pathId = `street-label-${hash(`${id ?? rank}:${name}:${best.pathIndex}:${pathData(best.commands)}`)}`;
  const clipId = `${pathId}-clip`;
  const d = pathData(best.commands);
  const overall = bounds(best.boxes.flatMap((box) => {
    const limit = boxLimits(box);
    return [{ x: limit.left, y: limit.top }, { x: limit.right, y: limit.bottom }];
  }));
  const pathPoints = samplesFor(best.commands);
  const anchor = atOffset(pathPoints, best.startOffset + width / 2);
  const clipped = !best.boxes.every((box) => contained(box, canvas));
  const supportingPaths = best.pathIndices.map((pathIndex) => {
    const polyline = polylines[pathIndex];
    const points = (Array.isArray(polyline) ? polyline : polyline.points).map((point) => ({ x: point.x, y: point.y }));
    return { pathIndex, points, d: roundedStreetLabelPath(points, radius) };
  });
  return {
    defs: `<path id="${pathId}" d="${d}"/><clipPath id="${clipId}"><rect x="0" y="0" width="${size}" height="${height}"/></clipPath>`,
    markup: `<g data-street-label="${escapeXml(name)}" data-label-rank="${rank}" data-label-path="${pathId}" data-label-clipped="${clipped}" data-label-fully-in-frame="${best.full}" data-label-visible="${best.visible.toFixed(3)}" data-label-text="${escapeXml(text)}" clip-path="url(#${clipId})"><title>${escapeXml(name)}</title><text font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold"${inheritPaint ? '' : ` fill="#252525" stroke="${haloColor}" stroke-width="${HALO}" stroke-linejoin="round" paint-order="stroke"`} text-anchor="start" dominant-baseline="auto" letter-spacing="0" dy="${5 * fontSize / FONT_SIZE}"><textPath href="#${pathId}" startOffset="${best.startOffset.toFixed(3)}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(text)}</textPath></text></g>`,
    occupied: [...occupied, ...best.boxes],
    anchors: best.anchors,
    diagnostics: { placed: true, rank, name, text, pathId, pathIndex: best.pathIndex, pathIndices: best.pathIndices, d,
      reversed: best.reversed, startOffset: best.startOffset, endOffset: best.startOffset + width,
      pathLength: best.length, pathPoints, supportingPaths, textLength: width, fontSize, scaled: fontSize < FONT_SIZE, anchor, anchors: best.anchors,
            bounds: overall, glyphBoxes: best.boxes, fullyInFrame: best.full, clipped,
      visibleFraction: best.visible, curvature: best.turn },
  };
}
