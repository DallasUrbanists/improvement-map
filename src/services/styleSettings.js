import { ref } from 'vue';

const ICON_SIZE_KEY = 'map-suggestion-icon-size';
const MAP_STYLE_KEY = 'improvement-map-style';
function readNumber(key, fallback, min, max, step) {
  try {
    const value = Number(localStorage.getItem(key));
    if (!Number.isFinite(value) || value < min || value > max) return fallback;
    return Math.round(value / step) * step;
  } catch { return fallback; }
}
function readMapStyle() {
  try {
    const saved = localStorage.getItem(MAP_STYLE_KEY);
    if (saved === 'streets' || saved === 'satellite') return saved;
    const legacyView = JSON.parse(localStorage.getItem('improvement_map_view') || 'null');
    return legacyView?.mapType === 'hybrid' || legacyView?.mapType === 'satellite'
      || localStorage.getItem('improvement_map_browse_tab') === 'satellite' ? 'satellite' : 'streets';
  } catch { return 'streets'; }
}
export const suggestionIconSize = ref(readNumber(ICON_SIZE_KEY, 100, 50, 150, 5));
export const selectedMapStyle = ref(readMapStyle());
export function setSuggestionIconSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return;
  suggestionIconSize.value = Math.max(50, Math.min(150, Math.round(size / 5) * 5));
  try { localStorage.setItem(ICON_SIZE_KEY, String(suggestionIconSize.value)); } catch { /* Storage may be unavailable. */ }
}
export function setSelectedMapStyle(value) {
  if (value !== 'streets' && value !== 'satellite') return;
  selectedMapStyle.value = value;
  try { localStorage.setItem(MAP_STYLE_KEY, value); } catch { /* Storage may be unavailable. */ }
}
