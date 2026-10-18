<template>
  <div class="location-summary">
    <p><i class="fa-solid fa-location-dot" aria-hidden="true"></i> {{ location?.address || 'Selected location' }}</p>
    <p v-if="coordinates" class="text-xs opacity-75">{{ coordinates }}</p>
    <button v-if="reveal && coordinates" type="button" class="map-ui-button" @click="workspace?.revealLocation(location)">
      <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> Show on map
    </button>
  </div>
</template>
<script setup>
import { computed, inject } from 'vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
const props = defineProps({ location: Object, reveal: { type: Boolean, default: true } });
const workspace = inject(mapWorkspaceKey, null);
const coordinates = computed(() => {
  const lat = props.location?.latitude;
  const lng = props.location?.longitude;
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : '';
});
</script>
