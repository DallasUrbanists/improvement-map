<template>
  <div class="map-search-overlay absolute z-30"
    :data-suggestions-open="hasSuggestions">
    <slot />
  </div>
</template>

<script setup>
defineProps({ hasSuggestions: { type: Boolean, default: false } });
</script>
