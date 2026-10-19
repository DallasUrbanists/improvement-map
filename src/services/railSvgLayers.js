// Paint complete casing passes before their corresponding color passes. Streetcars
// are a lower deck; the Carrollton Green Line bridge is a local upper deck.
export function railSvgLayers(transit) {
  const streetcars = new Set(transit.lines.filter((line) => line.mode === 'streetcar').map((line) => line.id));
  const decks = [[], []];
  transit.paths.forEach((path, i) => decks[streetcars.has(transit.segments[i].line) ? 0 : 1].push(path));
  const paint = (paths, name) => {
    const casing = paths.map((path) => path.replace('data-transit-line=', 'data-rail-casing=')
      .replace(/stroke="[^"]+"/, 'stroke="#fff"')).join('');
    return `<g data-layer="${name}-casing" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">${casing}</g>`
      + `<g data-layer="${name}-lines" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g>`;
  };
  return paint(decks[0], 'streetcar') + paint(decks[1], 'rail') + `<g data-layer="rail-bridge-lines" fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${(transit.overpasses || []).join('')}</g>`;
}

/** Local bridge deck; clip the displayed Green lane, including any display offsets. */
export function carrolltonBridgePaths(segments, center, color) {
  const radius = 13;
  const clip = (a, b) => {
    const dx = b.x - a.x; const dy = b.y - a.y;
    let lo = 0; let hi = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [a.x - center.x + radius, center.x + radius - a.x,
      a.y - center.y + radius, center.y + radius - a.y];
    for (let i = 0; i < 4; i++) {
      if (!p[i]) { if (q[i] < 0) return null; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      if (lo > hi) return null;
    }
    return [{ x: a.x + lo * dx, y: a.y + lo * dy }, { x: a.x + hi * dx, y: a.y + hi * dy }];
  };
  const paths = [];
  for (const segment of segments.filter((s) => s.line === 'DART:GREEN')) {
    let piece = [];
    const flush = () => {
      if (piece.length > 1) paths.push(`<path data-transit-line="DART:GREEN" d="M${piece.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}" stroke="${color}"/>`);
      piece = [];
    };
    for (let i = 1; i < segment.points.length; i++) {
      const pair = clip(segment.points[i - 1], segment.points[i]);
      if (!pair) { flush(); continue; }
      if (!piece.length) piece.push(pair[0]);
      piece.push(pair[1]);
    }
    flush();
  }
  return paths;
}
