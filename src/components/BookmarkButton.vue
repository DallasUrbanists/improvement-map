<template>
  <BookmarkToggle :bookmarked="isBookmarked(item.id)" :disabled="disabled" @toggle="toggle" />
</template>
<script setup>
import { isBookmarked, toggleBookmark, bookmarks } from '../services/bookmarks';
import BookmarkToggle from './BookmarkToggle.vue';
const props = defineProps({ item: { type: Object, required: true }, disabled: Boolean });
const emit = defineEmits(['changed']);
function toggle(event) {
  const previous = bookmarks.value.find(entry => entry.suggestion.id === String(props.item.id));
  if (toggleBookmark(props.item)) emit('changed', event.currentTarget, previous);
}
</script>
