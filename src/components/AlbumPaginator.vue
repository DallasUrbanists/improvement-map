<template>
  <div class="album-paginator" role="group" :aria-label="label">
    <button type="button" class="map-ui map-ui-button paginator-step" :class="buttonClass" :disabled="index <= 0" :aria-label="`Previous ${itemLabel}`" @click="$emit('previous')"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span>Previous</span></button>
    <span class="paginator-count" aria-live="polite">{{ total > 0 ? `${index + 1} / ${total}` : '0 / 0' }}</span>
    <button type="button" class="map-ui map-ui-button paginator-step" :class="buttonClass" :disabled="index >= total - 1 || total === 0" :aria-label="`Next ${itemLabel}`" @click="$emit('next')"><span>Next</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
  </div>
</template>
<script setup>
defineProps({
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  label: { type: String, required: true },
  itemLabel: { type: String, default: 'item' },
  buttonClass: { type: String, default: '' },
});
defineEmits(['previous', 'next']);
</script>
<style scoped>
.album-paginator { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: .45rem; padding-top: .65rem; border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
.paginator-step { min-height: 44px; min-width: 44px; padding-inline: .55rem; }
.paginator-step:first-child { justify-self: start; }
.paginator-step:last-child { justify-self: end; }
.paginator-step:disabled { opacity: .45; cursor: not-allowed; }
.paginator-count { min-width: 3.2rem; text-align: center; font-variant-numeric: tabular-nums; }
</style>
