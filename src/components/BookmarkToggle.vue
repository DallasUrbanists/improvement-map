<template>
  <MapControlButton class="idea-bookmark" :aria-label="bookmarked ? 'Remove bookmark' : 'Bookmark idea'"
    :data-tooltip="bookmarked ? 'Remove bookmark' : 'Bookmark idea'" :pressed="bookmarked" :disabled="disabled" @click="$emit('toggle', $event)">
    <i :class="[bookmarked ? 'fa-solid' : 'fa-regular', 'fa-bookmark']" aria-hidden="true"></i>
  </MapControlButton>
</template>
<script setup>
import MapControlButton from './MapControlButton.vue';
/** Stateless bookmark presentation. Persistence belongs to BookmarkButton. */
defineProps({ bookmarked: Boolean, disabled: Boolean });
/** Emits the native MouseEvent; the consumer decides whether the state changes. */
defineEmits(['toggle']);
</script>
