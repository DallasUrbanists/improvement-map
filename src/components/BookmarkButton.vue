<template>
  <button type="button" class="map-ui-button idea-bookmark" :aria-label="isBookmarked(item.id) ? 'Remove bookmark' : 'Bookmark idea'"
    :data-tooltip="isBookmarked(item.id) ? 'Remove bookmark' : 'Bookmark idea'" :aria-pressed="isBookmarked(item.id)" :disabled="disabled" @click="toggle">
    <i :class="[isBookmarked(item.id) ? 'fa-solid' : 'fa-regular', 'fa-bookmark']" aria-hidden="true"></i>
  </button>
</template>
<script setup>
import { isBookmarked, toggleBookmark } from '../services/bookmarks';
const props = defineProps({ item: { type: Object, required: true }, disabled: Boolean });
const emit = defineEmits(['changed']);
function toggle(event) {
  if (toggleBookmark(props.item)) emit('changed', event.currentTarget);
}
</script>
