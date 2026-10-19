// A viewport-sized canvas in Google's overlay pane. The pane's origin moves
// independently of the viewport when panning, so both origins must be tracked.
export function createSuggestionDensityOverlay(map, maps, { opacity = 0.4, radius = 56 } = {}) {
  const overlay = new maps.OverlayView();
  let canvas = null;
  let mask = null;
  let points = [];
  const resolution = 0.5;
  const colors = [
    [30, 125, 255], [0, 195, 160], [245, 225, 40], [255, 120, 25], [230, 35, 30],
  ];
  const palette = Array.from({ length: 256 }, (_, index) => {
    const progress = index / 255 * (colors.length - 1);
    const step = Math.min(colors.length - 2, Math.floor(progress));
    const amount = progress - step;
    return colors[step].map((value, channel) => Math.round(value + (colors[step + 1][channel] - value) * amount));
  });
  overlay.onAdd = () => {
    canvas = document.createElement('canvas');
    canvas.className = 'suggestion-density-canvas';
    canvas.style.opacity = String(opacity);
    canvas.setAttribute('aria-hidden', 'true');
    mask = document.createElement('canvas');
    overlay.getPanes().overlayLayer.appendChild(canvas);
  };
  overlay.draw = () => {
    const projection = overlay.getProjection();
    if (!canvas || !mask || !projection) return;
    const width = map.getDiv().clientWidth;
    const height = map.getDiv().clientHeight;
    if (!width || !height) return;
    const origin = projection.fromLatLngToDivPixel(
      projection.fromContainerPixelToLatLng(new maps.Point(0, 0)),
    );
    if (!origin) return;
    canvas.style.left = `${origin.x}px`;
    canvas.style.top = `${origin.y}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = mask.width = Math.ceil(width * resolution);
    canvas.height = mask.height = Math.ceil(height * resolution);
    const context = canvas.getContext('2d');
    const density = mask.getContext('2d', { willReadFrequently: true });
    if (!context || !density) return;
    density.setTransform(resolution, 0, 0, resolution, 0, 0);
    for (const location of points) {
      const pixel = projection.fromLatLngToDivPixel(location);
      if (!pixel) continue;
      const x = pixel.x - origin.x;
      const y = pixel.y - origin.y;
      if (x < -radius || x > width + radius || y < -radius || y > height + radius) continue;
      const gradient = density.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, .22)');
      gradient.addColorStop(0.35, 'rgba(0, 0, 0, .15)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      density.fillStyle = gradient;
      density.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    // Accumulate neighboring suggestions before assigning colors, so density
    // blends smoothly across points rather than changing at grid boundaries.
    const image = density.getImageData(0, 0, mask.width, mask.height);
    for (let index = 0; index < image.data.length; index += 4) {
      const alpha = image.data[index + 3];
      if (!alpha) continue;
      const color = palette[Math.min(255, Math.round(alpha / 170 * 255))];
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = Math.min(255, alpha * 3);
    }
    context.putImageData(image, 0, 0);
  };
  overlay.onRemove = () => { canvas?.remove(); canvas = null; mask = null; };
  overlay.setData = (nextPoints) => { points = nextPoints; overlay.draw(); };
  overlay.setOpacity = (value) => {
    if (!Number.isFinite(value)) return;
    opacity = Math.max(0, Math.min(1, value));
    if (canvas) canvas.style.opacity = String(opacity);
  };
  overlay.setRadius = (value) => {
    if (!Number.isFinite(value)) return;
    radius = Math.max(8, Math.min(160, value));
    overlay.draw();
  };
  return overlay;
}
