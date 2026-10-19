export const DEFAULT_SUBMISSION_EMOJI = '💡';

export function submissionEmoji(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_SUBMISSION_EMOJI;
}

function escapeXmlText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function createEmojiMarkerSvg(value, { pulse = false, pulseSpeed = 1, pulseScale = 1.5, bobAngle = 0, bobSpeed = 1, pulseEasing = 'ease-in-out', bobEasing = 'ease-in-out', canvasSize = 80 } = {}) {
  const emoji = escapeXmlText(submissionEmoji(value));
  const speed = Math.min(2, Math.max(.5, Number(pulseSpeed) || 1));
  const duration = 1.5 / speed;
  const rotationalDuration = 1.5 / Math.min(2, Math.max(.5, Number(bobSpeed) || 1));
  const scale = Math.min(2, Math.max(1, Number(pulseScale) || 1.5));
  const angle = Math.min(12, Math.max(0, Number(bobAngle) || 0));
  const easingOptions = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];
  const pulseTiming = easingOptions.includes(pulseEasing) ? pulseEasing : 'ease-in-out';
  const bobTiming = easingOptions.includes(bobEasing) ? bobEasing : 'ease-in-out';
  const size = Math.min(128, Math.max(80, Number(canvasSize) || 80));
  const center = size / 2;
  const pulseClass = pulse ? ' pulsing' : '';
  const bobClass = pulse && angle > 0 ? ' bobbing' : '';
  const style = `<style>.appear{transform-box:fill-box;transform-origin:center;animation:appear 450ms ease-out both}.pulse{transform-box:fill-box;transform-origin:center}.pulse.pulsing{animation:pulse ${duration}s ${pulseTiming} 450ms infinite}.bob{transform-box:fill-box;transform-origin:center}.bob.bobbing{animation:bob ${rotationalDuration}s ${bobTiming} 450ms infinite}@keyframes appear{0%{transform:scale(.06)}55%{transform:scale(1.55)}78%{transform:scale(.78)}90%{transform:scale(1.12)}100%{transform:scale(1)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(${scale})}}@keyframes bob{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-${angle}deg)}75%{transform:rotate(${angle}deg)}}@media(prefers-reduced-motion:reduce){.appear,.pulse,.bob{animation:none!important}}</style>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${style}<g class="appear"><g class="pulse${pulseClass}"><g class="bob${bobClass}"><text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" font-size="38" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" style="filter:drop-shadow(0 2px 2px #0009)">${emoji}</text></g></g></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
