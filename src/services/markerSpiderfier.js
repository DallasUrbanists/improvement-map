const PAGE_SIZE = 8;

export function clusterAppearance(count) {
  // Logarithmic growth keeps large clusters useful without dominating the map.
  const volume = Math.max(0, Math.log2(Math.max(2, count)) - 1);
  const shade = Math.min(1, volume / 8);
  const fill = '#' + [255, 240, 206].map((channel, index) => Math.round(
    channel + ([158, 112, 37][index] - channel) * shade,
  ).toString(16).padStart(2, '0')).join('');
  return { diameter: Math.min(76, 32 + volume * 5), fill, text: shade > 0.55 ? '#ffffff' : '#24282b' };
}

export function spiderOffsets(count) {
  const radius = Math.max(58, count * 48 / (2 * Math.PI));
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function shouldSpiderfy(markers, map) {
  const maximumZoom = map.get('maxZoom') ?? map.mapTypes.get(map.getMapTypeId())?.maxZoom ?? 21;
  if ((map.getZoom() ?? 0) >= maximumZoom) return true;
  const positions = markers.map(marker => marker.getPosition()).filter(Boolean);
  if (positions.length < 2) return false;
  if (positions.every(position => position.equals(positions[0]))) return true;
  const projection = map.getProjection();
  if (!projection) return false;
  const points = positions.map(position => projection.fromLatLngToPoint(position));
  const scale = 2 ** maximumZoom;
  // Even at maximum zoom the entire group would fit inside one touch target.
  return Math.hypot(
    Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)),
    Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y)),
  ) * scale < 44;
}

export function createMarkerSpiderfier(map, maps, onSelect, onCollapse = () => {}) {
  const overlay = new maps.OverlayView();
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;pointer-events:none;';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Overlapping suggestions');
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.style.cssText = 'position:absolute;overflow:visible;pointer-events:none;width:1px;height:1px;';
  const controls = document.createElement('div');
  controls.className = 'map-ui';
  controls.style.cssText = 'position:absolute;display:flex;align-items:center;transform:translateX(-50%);pointer-events:auto;white-space:nowrap;';
  let markers = [];
  let center = null;
  let page = 0;
  let nodes = [];
  let focusAfterDraw = false;
  let restoreFocus = null;
  let pageStatus;

  function button(label, text, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'map-ui-button';
    node.setAttribute('aria-label', label);
    node.textContent = text;
    node.addEventListener('click', action);
    return node;
  }

  function collapse(returnFocus = false) {
    if (!markers.length) return;
    markers = [];
    nodes = [];
    overlay.setMap(null);
    onCollapse();
    if (returnFocus && restoreFocus?.isConnected) restoreFocus.focus();
  }

  function renderPage(focus = true) {
    root.replaceChildren(lines);
    lines.replaceChildren();
    controls.replaceChildren();
    const start = page * PAGE_SIZE;
    const slice = markers.slice(start, start + PAGE_SIZE);
    const offsets = spiderOffsets(slice.length);
    nodes = slice.map((marker, index) => {
      const node = button(`${marker.getTitle() || 'Suggestion'}, ${start + index + 1} of ${markers.length}`, '', () => {
        const projection = overlay.getProjection();
        const anchor = new maps.MVCObject();
        anchor.set('position', projection.fromDivPixelToLatLng(new maps.Point(nodes[index].x, nodes[index].y)));
        anchor.set('anchorPoint', new maps.Point(0, -12));
        onSelect(marker, anchor);
      });
      node.className = 'spiderfied-suggestion';
      node.title = marker.getTitle() || 'Suggestion';
      node.addEventListener('focus', () => { node.style.outline = '2px solid #fff0ce'; });
      node.addEventListener('blur', () => { node.style.outline = ''; });
      node.addEventListener('keydown', event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % nodes.length
          : event.key === 'ArrowLeft' ? (index + nodes.length - 1) % nodes.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : null;
        if (next == null) return;
        event.preventDefault();
        nodes[next].node.focus();
      });
      node.style.cssText = 'position:absolute;width:44px;height:44px;padding:0;border:0;background:transparent;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;border-radius:50%;';
      const circle = document.createElement('span');
      circle.style.cssText = 'display:block;width:20px;height:20px;margin:auto;border-radius:50%;background:#fff0ce;box-shadow:0 3px 6px #0009;';
      node.appendChild(circle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', '#d8c394');
      line.setAttribute('stroke-width', '1.5');
      lines.appendChild(line);
      root.appendChild(node);
      return { marker, node, line, offset: offsets[index], x: 0, y: 0 };
    });
    if (markers.length > PAGE_SIZE) {
      const previous = button('Previous overlapping suggestions', '‹', () => { page--; renderPage(); });
      previous.disabled = page === 0;
      controls.appendChild(previous);
      pageStatus = document.createElement('span');
      pageStatus.setAttribute('role', 'status');
      pageStatus.style.cssText = 'font:600 12px Roboto,sans-serif;padding:0 4px;';
      pageStatus.textContent = `${start + 1}–${start + slice.length} of ${markers.length}`;
      controls.appendChild(pageStatus);
      const next = button('Next overlapping suggestions', '›', () => { page++; renderPage(); });
      next.disabled = start + PAGE_SIZE >= markers.length;
      controls.appendChild(next);
    }
    controls.appendChild(button('Collapse overlapping suggestions', '×', () => collapse(true)));
    root.appendChild(controls);
    focusAfterDraw = focus;
    overlay.draw();
  }

  overlay.onAdd = () => overlay.getPanes().floatPane.appendChild(root);
  overlay.onRemove = () => root.remove();
  overlay.draw = () => {
    const projection = overlay.getProjection();
    if (!markers.length || !projection || !root.isConnected) return;
    const origin = projection.fromLatLngToDivPixel(center);
    const screen = projection.fromLatLngToContainerPixel(center);
    if (!origin || !screen) return;
    const radius = Math.max(58, nodes.length * 48 / (2 * Math.PI));
    const clamp = (value, min, max) => max >= min ? Math.min(max, Math.max(min, value)) : (min + max) / 2;
    const cx = origin.x + clamp(screen.x, radius + 28, map.getDiv().clientWidth - radius - 28) - screen.x;
    const cy = origin.y + clamp(screen.y, radius + 100, map.getDiv().clientHeight - radius - 140) - screen.y;
    for (const entry of nodes) {
      entry.x = cx + entry.offset.x;
      entry.y = cy + entry.offset.y;
      entry.node.style.left = `${entry.x}px`;
      entry.node.style.top = `${entry.y}px`;
      const original = projection.fromLatLngToDivPixel(entry.marker.getPosition());
      for (const [key, value] of Object.entries({ x1: original.x, y1: original.y, x2: entry.x, y2: entry.y })) {
        entry.line.setAttribute(key, String(value));
      }
    }
    controls.style.left = `${cx}px`;
    controls.style.top = `${cy + radius + 28}px`;
    if (focusAfterDraw) { focusAfterDraw = false; nodes[0]?.node.focus({ preventScroll: true }); }
  };
  maps.OverlayView.preventMapHitsAndGesturesFrom(root);
  const onEscape = event => {
    if (event.key !== 'Escape' || !markers.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    collapse(true);
  };
  // Capture Escape before the workspace's tray-navigation shortcut.
  window.addEventListener('keydown', onEscape, true);
  const listeners = ['click', 'zoom_changed', 'dragstart', 'maptypeid_changed'].map(event => map.addListener(event, () => collapse()));
  return {
    expand(group, position) {
      collapse();
      markers = [...group];
      if (!markers.length) return;
      center = position;
      page = 0;
      restoreFocus = document.activeElement;
      renderPage(false);
      focusAfterDraw = true;
      overlay.setMap(map);
    },
    collapse,
    dispose() {
      collapse();
      listeners.forEach(listener => listener.remove());
      window.removeEventListener('keydown', onEscape, true);
    },
  };
}
