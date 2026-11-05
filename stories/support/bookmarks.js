import { computed, ref } from 'vue';
// Storybook-only alias: no access to the application's localStorage keys.
const saved = ref([]);
export const bookmarks = computed(() => saved.value);
export const bookmarkNotice = ref('');
export const bookmarkMessage = ref('');
export const isBookmarked = id => saved.value.some(entry => String(entry.suggestion.id) === String(id));
export function toggleBookmark(item) {
  saved.value = isBookmarked(item.id) ? saved.value.filter(entry => String(entry.suggestion.id) !== String(item.id))
    : [...saved.value, { suggestion: item, savedAt: '2026-10-01T12:00:00Z' }];
  bookmarkMessage.value = isBookmarked(item.id) ? 'Idea bookmarked.' : 'Bookmark removed.';
  return true;
}
export function resetBookmarks() { saved.value = []; bookmarkNotice.value = bookmarkMessage.value = ''; }
