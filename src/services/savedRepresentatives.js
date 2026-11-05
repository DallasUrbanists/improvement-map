import { ref } from 'vue';

export const REPRESENTATIVES_STORAGE_KEY = 'improvement_map_representatives_v1';
export const representativeNotice = ref('');
export const representativeMessage = ref('');
const empty = () => ({ version: 1, saved: {} });
function read() {
  try {
    const raw = localStorage.getItem(REPRESENTATIVES_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : empty();
    if (value?.version !== 1 || !value.saved || typeof value.saved !== 'object' || Array.isArray(value.saved)
      || !Object.entries(value.saved).every(([id, entry]) => String(entry?.representative?.id) === id
        && typeof entry?.representative?.name === 'string' && typeof entry.suggestionId === 'string'
        && Number.isFinite(Date.parse(entry.savedAt)))) throw Error();
    representativeNotice.value = '';
    return value;
  } catch {
    representativeNotice.value = 'Saved representatives could not be read. Existing browser data has not been changed.';
    return null;
  }
}
const state = ref(read() || empty());
window.addEventListener('storage', event => {
  if (event.key === REPRESENTATIVES_STORAGE_KEY || event.key === null) {
    const value = read();
    if (value) state.value = value;
  }
});
export const isRepresentativeSaved = id => Object.hasOwn(state.value.saved, String(id));
export function toggleRepresentative(representative, suggestionId) {
  const next = read();
  representativeMessage.value = '';
  if (!next) return false;
  const id = String(representative.id);
  const removing = Object.hasOwn(next.saved, id);
  if (removing) delete next.saved[id];
  else Object.defineProperty(next.saved, id, {
    value: { representative, suggestionId: String(suggestionId), savedAt: new Date().toISOString() },
    enumerable: true, configurable: true, writable: true,
  });
  try {
    localStorage.setItem(REPRESENTATIVES_STORAGE_KEY, JSON.stringify(next));
    state.value = next;
    representativeMessage.value = removing ? 'Representative removed from saved.' : 'Representative saved.';
    return true;
  } catch {
    representativeNotice.value = 'Unable to save representatives on this device. Check browser storage and try again.';
    return false;
  }
}
