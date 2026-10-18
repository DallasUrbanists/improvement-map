const PAGE_SIZE = 8;
const TRANSITION_MS = 220;

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

export function createMarkerSpiderfier(map, maps, onSelect, onCollapse = () => {}, onExpand = () => {}, onPageChange = () => {}) {
  const overlay = new maps.OverlayView();
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;pointer-events:none;isolation:isolate;z-index:1;';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Overlapping suggestions');
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.style.cssText = 'position:absolute;overflow:visible;pointer-events:none;width:1px;height:1px;z-index:0;';
  const centerBadge = button('Collapse overlapping suggestions', '', () => collapse(true));
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
  let transitionTimer = null;
  let transitionToken = 0;
  let transitioning = false;
  let entrance = null;

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  function animate(node, keyframes, options = {}) {
    if (prefersReducedMotion() || typeof node.animate !== 'function') return;
    node.animate(keyframes, {
      duration: TRANSITION_MS,
      easing: 'cubic-bezier(.2,.75,.25,1)',
      ...options,
    });
  }

  function cancelPendingTransition() {
    if (transitionTimer != null) window.clearTimeout(transitionTimer);
    transitionTimer = null;
    transitionToken++;
    transitioning = false;
  }

  function button(label, text, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'map-ui-button';
    node.setAttribute('aria-label', label);
    node.textContent = text;
    node.addEventListener('click', action);
    return node;
  }

  function collapse(returnFocus = false, animateOut = true) {
    if (!markers.length) return;
    if (transitionTimer != null) window.clearTimeout(transitionTimer);
    transitionTimer = null;
    transitionToken++;
    transitioning = false;
    const leavingNodes = [...nodes];
    const token = ++transitionToken;
    markers = [];
    transitioning = true;
    onCollapse();
    const duration = animateOut && !prefersReducedMotion() ? TRANSITION_MS : 0;
    if (duration) {
      leavingNodes.forEach((entry, index) => {
        animate(entry.node, [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(-50%,-50%) translate(${-entry.offset.x}px,${-entry.offset.y}px) scale(.2)`, opacity: 0 },
        ], { delay: Math.min(index * 12, 72), fill: 'forwards' });
        animate(entry.line, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      });
      animate(centerBadge, [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: 'translate(-50%,-50%) scale(.45)', opacity: 0 },
      ], { duration: 160, fill: 'forwards' });
      animate(controls, [{ opacity: 1, transform: 'translateX(-50%) translateY(0)' }, { opacity: 0, transform: 'translateX(-50%) translateY(8px)' }], { duration: 150, fill: 'forwards' });
    }
    const finish = () => {
      if (token !== transitionToken) return;
      transitionTimer = null;
      nodes = [];
      transitioning = false;
      overlay.setMap(null);
      if (returnFocus && restoreFocus?.isConnected) restoreFocus.focus();
    };
    if (duration) transitionTimer = window.setTimeout(finish, duration + 20);
    else finish();
  }

  function changePage(nextPage) {
    if (transitioning || nextPage < 0 || nextPage * PAGE_SIZE >= markers.length) return;
    onPageChange();
    const direction = nextPage > page ? 1 : -1;
    const leavingNodes = [...nodes];
    const token = ++transitionToken;
    const duration = prefersReducedMotion() ? 0 : 115;
    transitioning = true;
    if (duration) {
      leavingNodes.forEach(entry => {
        animate(entry.node, [
          { transform: 'translate(-50%,-50%) translateX(0)', opacity: 1 },
          { transform: `translate(-50%,-50%) translateX(${-direction * 26}px)`, opacity: 0 },
        ], { duration, fill: 'forwards' });
        animate(entry.line, [{ opacity: 0.9 }, { opacity: 0 }], { duration, fill: 'forwards' });
      });
      animate(controls, [{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' });
    }
    const render = () => {
      if (token !== transitionToken) return;
      transitionTimer = null;
      page = nextPage;
      transitioning = false;
      entrance = direction;
      renderPage(true);
    };
    if (duration) transitionTimer = window.setTimeout(render, duration);
    else render();
  }

  function renderPage(focus = true) {
    // Reused elements may still have a filled exit animation from a prior open.
    for (const element of [centerBadge, controls, lines]) {
      element.getAnimations?.().forEach(animation => animation.cancel());
    }
    root.replaceChildren(lines, centerBadge);
    const appearance = clusterAppearance(markers.length);
    centerBadge.textContent = String(markers.length);
    centerBadge.style.cssText = `position:absolute;z-index:2;width:${appearance.diameter}px;height:${appearance.diameter}px;border:2px solid #d8c394;border-radius:50%;background:${appearance.fill};color:${appearance.text};font:700 15px Roboto,sans-serif;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;box-shadow:0 3px 6px #0009;`;
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
      node.style.cssText = 'position:absolute;z-index:1;width:44px;height:44px;padding:0;border:0;background:transparent;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;border-radius:50%;';
      const circle = document.createElement('span');
      circle.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:24px;width:max-content;height:24px;padding:0 3px;margin:auto;border-radius:50%;background:#fff0ce;color:#24282b;font:700 11px Roboto,sans-serif;box-shadow:0 3px 6px #0009;';
      circle.textContent = String(start + index + 1);
      node.appendChild(circle);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', '#d8c394');
      line.setAttribute('stroke-width', '1.5');
      lines.appendChild(line);
      root.appendChild(node);
      return { marker, node, line, offset: offsets[index], x: 0, y: 0 };
    });
    if (markers.length > PAGE_SIZE) {
      const previous = button('Previous overlapping suggestions', '‹', () => changePage(page - 1));
      previous.disabled = page === 0;
      controls.appendChild(previous);
      pageStatus = document.createElement('span');
      pageStatus.setAttribute('role', 'status');
      pageStatus.style.cssText = 'font:600 12px Roboto,sans-serif;padding:0 4px;';
      pageStatus.textContent = `${start + 1}–${start + slice.length} of ${markers.length}`;
      controls.appendChild(pageStatus);
      const next = button('Next overlapping suggestions', '›', () => changePage(page + 1));
      next.disabled = start + PAGE_SIZE >= markers.length;
      controls.appendChild(next);
    }
    controls.appendChild(button('Collapse overlapping suggestions', '×', () => collapse(true)));
    root.appendChild(controls);
    focusAfterDraw = focus;
    overlay.draw();
  }

  // InfoWindows use floatPane, which must remain above the entire spider.
  overlay.onAdd = () => overlay.getPanes().overlayMouseTarget.appendChild(root);
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
    centerBadge.style.left = `${origin.x}px`;
    centerBadge.style.top = `${origin.y}px`;
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
    if (entrance && !prefersReducedMotion()) {
      const mode = entrance;
      entrance = null;
      nodes.forEach((entry, index) => {
        const fromTransform = mode === 'center'
          ? `translate(-50%,-50%) translate(${-entry.offset.x}px,${-entry.offset.y}px) scale(.2)`
          : `translate(-50%,-50%) translateX(${mode * 26}px)`;
        animate(entry.node, [
          { transform: fromTransform, opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        ], { delay: mode === 'center' ? Math.min(index * 14, 98) : Math.min(index * 8, 56) });
        animate(entry.line, [{ opacity: 0 }, { opacity: 0.9 }], {
          delay: mode === 'center' ? Math.min(index * 14, 98) : Math.min(index * 8, 56),
          duration: 170,
        });
      });
      animate(centerBadge, [
        { transform: 'translate(-50%,-50%) scale(.55)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      ], { duration: 200 });
      animate(controls, [{ opacity: 0, transform: 'translateX(-50%) translateY(8px)' }, { opacity: 1, transform: 'translateX(-50%) translateY(0)' }], { delay: mode === 'center' ? 90 : 0, duration: 180 });
    } else {
      entrance = null;
    }
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
  const listeners = ['click', 'maptypeid_changed'].map(event => map.addListener(event, () => collapse()));
  return {
    getScreenBounds() {
      const projection = overlay.getProjection();
      if (!markers.length || !nodes.length || !projection) return null;
      const origin = projection.fromLatLngToDivPixel(center);
      const screen = projection.fromLatLngToContainerPixel(center);
      const dx = screen.x - origin.x, dy = screen.y - origin.y;
      const radius = clusterAppearance(markers.length).diameter / 2;
      const controlX = Number.parseFloat(controls.style.left) || origin.x;
      const controlY = Number.parseFloat(controls.style.top) || origin.y;
      return {
        left: Math.min(origin.x - radius, controlX - controls.offsetWidth / 2, ...nodes.map(entry => entry.x - 22)) + dx,
        right: Math.max(origin.x + radius, controlX + controls.offsetWidth / 2, ...nodes.map(entry => entry.x + 22)) + dx,
        top: Math.min(origin.y - radius, ...nodes.map(entry => entry.y - 22)) + dy,
        bottom: Math.max(controlY + controls.offsetHeight, origin.y + radius, ...nodes.map(entry => entry.y + 22)) + dy,
      };
    },
    expand(group, position) {
      cancelPendingTransition();
      overlay.setMap(null);
      nodes = [];
      root.replaceChildren(lines);
      lines.replaceChildren();
      controls.replaceChildren();
      entrance = 'center';
      markers = [...group];
      if (!markers.length) return;
      center = position;
      page = 0;
      restoreFocus = document.activeElement;
      renderPage(false);
      focusAfterDraw = true;
      overlay.setMap(map);
      onExpand();
    },
    collapse,
    dispose() {
      cancelPendingTransition();
      if (markers.length) collapse(false, false);
      else {
        nodes = [];
        overlay.setMap(null);
      }
      listeners.forEach(listener => listener.remove());
      window.removeEventListener('keydown', onEscape, true);
    },
  };
}
