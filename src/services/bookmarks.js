import { computed, ref } from 'vue';

export const BOOKMARKS_STORAGE_KEY = 'improvement_map_bookmarks_v1';
export const bookmarkNotice = ref('');
export const bookmarkMessage = ref('');
const empty = () => ({ version: 1, saved: {} });
function read() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : empty();
    if (value?.version !== 1 || !value.saved || typeof value.saved !== 'object' || Array.isArray(value.saved)
      || !Object.entries(value.saved).every(([id, entry]) => entry?.suggestion?.id === id
        && typeof entry.suggestion.content?.summary === 'string' && Number.isFinite(Date.parse(entry.savedAt)))) throw Error();
    bookmarkNotice.value = '';
    return value;
  } catch {
    bookmarkNotice.value = 'Bookmarks could not be read. Existing browser data has not been changed.';
    return null;
  }
}
const state = ref(read() || empty());
window.addEventListener('storage', event => {
  if (event.key === BOOKMARKS_STORAGE_KEY || event.key === null) {
    const value = read();
    if (value) state.value = value;
  }
});
export const bookmarks = computed(() => Object.values(state.value.saved).sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.suggestion.id.localeCompare(b.suggestion.id)));
export const isBookmarked = id => Object.hasOwn(state.value.saved, String(id));
function write(change, message) {
  bookmarkMessage.value = '';
  const next = read();
  if (!next) return false;
  change(next);
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    state.value = next;
    bookmarkMessage.value = message;
    return true;
  } catch {
    bookmarkNotice.value = 'Unable to save bookmarks on this device. Check browser storage and try again.';
    return false;
  }
}
export function saveBookmark(item) {
  const id = String(item.id);
  const photo = (item.content?.photos || item.photos || []).find(photo => /^https?:\/\//i.test(photo.url || ''));
  const suggestion = { id, content: { summary: item.content?.summary || item.summary || 'Public improvement', photos: photo ? [{ url: photo.url }] : [] },
    location: { address: item.location?.address || '', latitude: item.location?.latitude, longitude: item.location?.longitude },
    creationDate: item.creationDate || '', emoji: typeof item.emoji === 'string' ? item.emoji : '' };
  return write(data => { Object.defineProperty(data.saved, id, { value: { suggestion, savedAt: new Date(Object.values(data.saved).reduce((latest, entry) => Math.max(latest, Date.parse(entry.savedAt) + 1), Date.now())).toISOString() }, enumerable: true, configurable: true, writable: true }); }, 'Idea bookmarked.');
}
export const removeBookmark = id => write(data => { delete data.saved[String(id)]; }, 'Bookmark removed.');
export const toggleBookmark = item => isBookmarked(item.id) ? removeBookmark(item.id) : saveBookmark(item);

export function restoreBookmark(entry) {
  return write(data => { const id = entry.suggestion.id; if (!Object.hasOwn(data.saved, id)) Object.defineProperty(data.saved, id, { value: entry, enumerable: true, configurable: true, writable: true }); }, 'Idea restored.');
}
