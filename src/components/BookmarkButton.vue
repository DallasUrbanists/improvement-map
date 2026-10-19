<template>
  <button type="button" class="map-ui-button idea-bookmark" :aria-label="isBookmarked(item.id) ? 'Remove bookmark' : 'Bookmark idea'"
    :data-tooltip="isBookmarked(item.id) ? 'Remove bookmark' : 'Bookmark idea'" :aria-pressed="isBookmarked(item.id)" :disabled="disabled" @click="toggle">
    <i :class="[isBookmarked(item.id) ? 'fa-solid' : 'fa-regular', 'fa-bookmark']" aria-hidden="true"></i>
  </button>
</template>
<script setup>
import { isBookmarked, toggleBookmark, bookmarks } from '../services/bookmarks';
const props = defineProps({ item: { type: Object, required: true }, disabled: Boolean });
const emit = defineEmits(['changed']);
function toggle(event) {
  const previous = bookmarks.value.find(entry => entry.suggestion.id === String(props.item.id));
  if (toggleBookmark(props.item)) emit('changed', event.currentTarget, previous);
}
</script>
