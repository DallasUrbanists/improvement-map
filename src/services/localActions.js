import { computed, ref } from 'vue';

export const ACTIONS_STORAGE_KEY = 'improvement_map_actions_v1';
export const storageNotice = ref('');
const empty = () => ({ version: 1, saved: {}, hidden: {}, generated: {} });
let readable = true;
const validAction = action => action && typeof action.key === 'string' && typeof action.summary === 'string'
  && ['instructions', 'reason', 'sourceUrl'].every(field => typeof action[field] === 'string');
function read() {
  readable = true;
  try {
    const raw = localStorage.getItem(ACTIONS_STORAGE_KEY);
    if (!raw) return empty();
    const value = JSON.parse(raw);
    if (value.version !== 1 || !['saved', 'hidden', 'generated'].every(k => value[k] && typeof value[k] === 'object' && !Array.isArray(value[k]))) throw Error();
    if (!Object.values(value.saved).every(x => validAction(x?.action) && typeof x.suggestionId === 'string'
      && typeof x.suggestionSummary === 'string' && typeof x.savedAt === 'string' && Number.isFinite(Date.parse(x.savedAt)))
      || !Object.values(value.hidden).every(x => x === true)
      || !Object.values(value.generated).every(x => typeof x.fingerprint === 'string' && Array.isArray(x.actions) && x.actions.every(validAction))) throw Error();
    return value;
  } catch {
    readable = false;
    storageNotice.value = 'Saved action data could not be read. Existing browser data has not been changed.';
    return empty();
  }
}
const state = ref(read());
window.addEventListener('storage', event => {
  if (event.key === ACTIONS_STORAGE_KEY || event.key === null) state.value = read();
});
function write(change) {
  const next = read();
  if (!readable) return false;
  change(next);
  try {
    localStorage.setItem(ACTIONS_STORAGE_KEY, JSON.stringify(next));
    state.value = next;
    storageNotice.value = '';
    return true;
  } catch {
    storageNotice.value = 'Unable to save on this device. Check browser storage and try again.';
    return false;
  }
}
export const savedActions = computed(() => Object.values(state.value.saved).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
export const isSaved = key => !!state.value.saved[key];
export const isHidden = key => !!state.value.hidden[key];
export function saveAction(action, suggestion) {
  return write(data => { data.saved[action.key] = { action, suggestionId: String(suggestion.id), suggestionSummary: suggestion.content?.summary || suggestion.summary || 'Suggestion', savedAt: new Date().toISOString() }; });
}
export const removeAction = key => write(data => { delete data.saved[key]; });
export const setHidden = (key, hidden) => write(data => { if (hidden) data.hidden[key] = true; else delete data.hidden[key]; });
export const cachedActions = (id, fingerprint) => {
  const entry = state.value.generated[String(id)];
  return entry?.fingerprint === fingerprint ? entry.actions : null;
};
export const cacheActions = (id, fingerprint, actions) => write(data => { data.generated[String(id)] = { fingerprint, actions }; });

export function recommendationInput(suggestion) {
  const text = [suggestion.content?.summary || suggestion.summary, suggestion.content?.details].filter(Boolean).join('\n\n').slice(0, 10000);
  const { latitude, longitude } = suggestion.location || {};
  return { text, ...(Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : {}) };
}
export function normalizeActions(items, suggestionId, catalog = false) {
  const seen = new Set();
  return items.filter(a => a && a.id != null && typeof a.summary === 'string').map(a => {
    const catalogId = catalog ? String(a.id) : a.recommendableId;
    return { id: String(a.id), catalogId, key: JSON.stringify([String(suggestionId), catalogId ? 'catalog' : 'attached', String(catalogId || a.id)]), summary: a.summary,
      instructions: a.instructions || '', reason: catalog ? a.why || '' : a.reason || '', sourceUrl: a.sourceUrl || '',
      expirationDate: a.expirationDate || null, status: catalog ? null : a.status || null };
  }).filter(a => { if (seen.has(a.key)) return false; seen.add(a.key); return true; });
}

export function restoreAction(entry) {
  return write(data => { if (!Object.hasOwn(data.saved, entry.action.key)) data.saved[entry.action.key] = entry; });
}
