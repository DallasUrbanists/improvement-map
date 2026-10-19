import { ref } from 'vue';

const STORAGE_KEY = 'map-rail-thickness';
export const DEFAULT_RAIL_THICKNESS = 4.5;
function readThickness() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value >= 1 && value <= 9 ? value : DEFAULT_RAIL_THICKNESS;
  } catch { return DEFAULT_RAIL_THICKNESS; }
}
export const railThickness = ref(readThickness());
export function setRailThickness(value) {
  const width = Number(value);
  if (!Number.isFinite(width)) return;
  railThickness.value = Math.max(1, Math.min(9, Math.round(width * 2) / 2));
  try { localStorage.setItem(STORAGE_KEY, String(railThickness.value)); } catch { /* Storage may be unavailable. */ }
}
