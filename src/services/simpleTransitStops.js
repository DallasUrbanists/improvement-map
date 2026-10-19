/** Individual source stops at their original positions; no clustering or displacement. */
export function createSimpleTransitStops(data, project, size = 480, railCatalog = null, height = size) {
  const routes = new Map();
  for (const route of data.transitRoutes || []) for (const member of route.members || []) {
    const key = `${member.type}:${member.ref}`;
    if (!routes.has(key)) routes.set(key, []);
    routes.get(key).push(route.tags || {});
  }
  const buses = (data.transitStops || []).filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon))
    .flatMap((stop) => {
      const { x, y } = project(stop);
      if (x < 0 || x > size || y < 0 || y > height) return [];
      const id = `${stop.type}:${stop.id}`; const tags = stop.tags || {};
      const rail = ['station', 'halt', 'tram_stop', 'stop', 'platform'].includes(tags.railway)
        || (!(tags.highway === 'bus_stop' || tags.bus === 'yes')
          && (['train', 'light_rail', 'tram', 'subway'].some((mode) => tags[mode] === 'yes')
            || (routes.get(id) || []).some((route) => ['train', 'light_rail', 'tram', 'subway'].includes(route.route))));
      if (rail) return [];
      return [{ id, name: tags.name || tags.local_ref || 'Bus stop',
        mode: 'bus', source: 'osm', x, y, stopX: x, stopY: y, radius: 7,
        agencies: [], agencyNames: [tags.network || tags.operator].filter(Boolean) }];
    });
  const lineModes = new Map((railCatalog?.lines || []).map((line) => [line.id, line.mode]));
  const rails = (railCatalog?.stops || []).filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lon))
    .flatMap((stop) => {
      const { x, y } = project(stop);
      const streetcar = Boolean(stop.lines?.length) && stop.lines.every((id) => lineModes.get(id) === 'streetcar');
      return x < 0 || x > size || y < 0 || y > height ? [] : [{ ...stop, source: 'geojson', mode: 'rail',
        x, y, stopX: x, stopY: y, streetcar, labelRequired: !streetcar, radius: streetcar ? 7 : 10.5,
        agencies: [], agencyNames: stop.networks || [] }];
    });
  return [...buses, ...rails];
}

/** Snap catalog stations to their own route's un-offset source centerline. */
export function snapRailStopsToPaths(stops, segments, size = 480, height = size) {
  return stops.flatMap((stop) => {
    if (stop.mode !== 'rail') return [stop];
    let best;
    for (const segment of segments.filter((segment) => stop.lines?.includes(segment.line))) {
      const points = segment.displaySourcePoints || segment.sourcePoints || segment.points;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]; const b = points[i]; const dx = b.x - a.x; const dy = b.y - a.y;
        const t = dx || dy ? Math.max(0, Math.min(1, ((stop.x - a.x) * dx + (stop.y - a.y) * dy) / (dx * dx + dy * dy))) : 0;
        const x = a.x + t * dx; const y = a.y + t * dy;
        const distance = Math.hypot(x - stop.x, y - stop.y);
        if (!best || distance < best.distance) best = { x, y, distance };
      }
    }
    if (!best || best.x < 0 || best.x > size || best.y < 0 || best.y > height) return [];
    return [{ ...stop, sourceX: stop.x, sourceY: stop.y, x: best.x, y: best.y, stopX: best.x, stopY: best.y }];
  });
}

const expand = (box, padding) => ({ ...box, width: box.width + padding * 2, height: box.height + padding * 2 });
const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2
  && Math.abs(a.y - b.y) < (a.height + b.height) / 2;
/** Connect directly to the label center; other elements may cover the leader. */
function routeLeader(stop, box) {
  const to = { x: box.x, y: box.y };
  const dx = to.x - stop.x; const dy = to.y - stop.y; const length = Math.hypot(dx, dy) || 1;
  const from = { x: stop.x + dx / length * stop.radius, y: stop.y + dy / length * stop.radius };
  return [from, to];
}

/** Prefer short leaders and clear text, allowing text overlaps in crowded areas. */
export function placeRailStopLabels(stops, occupied = [], size = 480, canvasHeight = size) {
  const boxes = [...occupied]; const labels = [];
  const markers = stops.map((stop) => ({ x: stop.x, y: stop.y, width: stop.radius * 2 + 6, height: stop.radius * 2 + 6 }));
  for (const stop of stops.filter((stop) => stop.mode === 'rail' && stop.labelRequired !== false)) {
    const name = stop.name.trim().toUpperCase();
    // This duplicate source station keeps its icon but does not need a second name.
    if (name === 'TRINITY MILLS RAIL STATION') continue;
    const lines = []; let line = '';
    for (const word of name.replace(/\bDOWNTOWN\b/g, 'DT').split(/\s+/)) {
      if (line && `${line} ${word}`.length > 30) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    let placed;
    for (const fontSize of [12, 11, 10]) {
      const width = Math.max(...lines.map((text) => [...text].reduce((sum, char) => sum
        + (/[MW@]/.test(char) ? 1 : /[ilIt .,:;!]/.test(char) ? 0.4 : 0.82) * fontSize, 0))) + 10;
      const lineHeight = fontSize * 1.25; const height = lines.length * lineHeight + 8;
      const candidates = [];
      const add = (x, y) => {
        // Pull nearby placements inside the frame instead of clipping their text or halo.
        const left = 12 + width / 2; const right = size - 12 - width / 2;
        const top = 12 + height / 2; const bottom = canvasHeight - 24 - height / 2;
        if (left > right || top > bottom) return;
        x = Math.max(left, Math.min(x, right));
        y = Math.max(top, Math.min(y, bottom));
        const box = { x, y, width, height };
        if (markers.some((other) => overlaps(expand(box, 3), other))) return;
        const leaderPoints = routeLeader(stop, box);
        const length = Math.hypot(leaderPoints[1].x - leaderPoints[0].x, leaderPoints[1].y - leaderPoints[0].y);
        const overlapPenalty = boxes.reduce((sum, other) => {
          const padded = expand(other, 3);
          const width = Math.min(x + box.width / 2, padded.x + padded.width / 2)
            - Math.max(x - box.width / 2, padded.x - padded.width / 2);
          const height = Math.min(y + box.height / 2, padded.y + padded.height / 2)
            - Math.max(y - box.height / 2, padded.y - padded.height / 2);
          return sum + (width > 0 && height > 0 ? 12 + width * height / box.height * 2 : 0);
        }, 0);
        candidates.push({ ...box, score: length + overlapPenalty });
      };
      for (const gap of [stop.radius + 6, stop.radius + 12, 32, 48, 72]) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
        add(stop.x + dx * (gap + width / 2), stop.y + dy * (gap + height / 2));
      }
      // Search the remaining canvas as well as the preferred nearby positions.
      for (let y = height / 2 + 12; y < canvasHeight - height / 2 - 22; y += 32)
        for (let x = width / 2 + 8; x < size - width / 2 - 8; x += 32) add(x, y);
      candidates.sort((a, b) => a.score - b.score);
      if (candidates.length) {
        const box = candidates[0];
        const leaderPoints = routeLeader(stop, box);
        placed = { ...box, lines, fontSize, lineHeight, stopId: stop.id, leaderPoints, from: leaderPoints[0], to: leaderPoints.at(-1) };
      }
      if (placed) break;
    }
    // Keep the icon without a label when no clear text position is available.
    if (placed) { labels.push(placed); boxes.push(expand(placed, 3)); }
  }
  return labels;
}
