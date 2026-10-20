<template>
  <div class="map-search-overlay absolute top-3 left-3 right-3 z-30"
    :data-suggestions-open="hasSuggestions">
    <slot />
  </div>
</template>

<script setup>
defineProps({ hasSuggestions: { type: Boolean, default: false } });
</script>
