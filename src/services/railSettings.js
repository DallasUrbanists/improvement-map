import { ref } from 'vue';

const STORAGE_KEY = 'map-rail-thickness';
const VISIBILITY_STORAGE_KEY = 'map-rail-visible';
export const DEFAULT_RAIL_THICKNESS = 2;
function readVisibility() {
  try { return localStorage.getItem(VISIBILITY_STORAGE_KEY) !== 'false'; } catch { return true; }
}
export const railVisible = ref(readVisibility());
export function setRailVisible(value) {
  railVisible.value = Boolean(value);
  try { localStorage.setItem(VISIBILITY_STORAGE_KEY, String(railVisible.value)); } catch { /* Storage may be unavailable. */ }
}
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
