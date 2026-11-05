export function rgb(hex) {
  return hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
}

export function luminance(hex) {
  return rgb(hex).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function hsl(hex) {
  const [red, green, blue] = rgb(hex);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === red ? ((green - blue) / delta + (green < blue ? 6 : 0))
    : max === green ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  const segment = Math.floor(hue / 60);
  const values = segment === 0 ? [chroma, x, 0]
    : segment === 1 ? [x, chroma, 0]
      : segment === 2 ? [0, chroma, x]
        : segment === 3 ? [0, x, chroma]
          : segment === 4 ? [x, 0, chroma]
            : [chroma, 0, x];
  return values.map(channel => Math.round((channel + m) * 255));
}

const toHex = channels => `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;

export function colorAtHueSaturationLuminance(hue, targetLuminance, saturation) {
  const target = Math.max(0, Math.min(1, targetLuminance));
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const middle = (low + high) / 2;
    if (luminance(toHex(hslRgb(hue, saturation, middle))) < target) low = middle;
    else high = middle;
  }
  return toHex(hslRgb(hue, saturation, (low + high) / 2));
}

export function colorAtLuminance(reference, targetLuminance, saturation) {
  const [hue, referenceSaturation] = hsl(reference);
  return colorAtHueSaturationLuminance(hue, targetLuminance, saturation ?? referenceSaturation);
}

export function colorWithHueSaturation(reference, targetLuminance, saturation) {
  return colorAtLuminance(reference, targetLuminance, saturation);
}

export function mutedTextForSurface(theme, surface, minimumContrast = 4.5, minimumGray = 0) {
  const values = theme === 'light'
    ? Array.from({ length: 256 }, (_, index) => 255 - index)
    : Array.from({ length: 256 - minimumGray }, (_, index) => minimumGray + index);
  const value = values.find(channel => contrastRatio(surface, `#${channel.toString(16).padStart(2, '0').repeat(3)}`) >= minimumContrast);
  return `#${value.toString(16).padStart(2, '0').repeat(3)}`;
}
