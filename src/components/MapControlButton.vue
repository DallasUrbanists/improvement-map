<template>
  <button type="button" class="map-ui-button" :disabled="disabled" :aria-pressed="pressed"><slot /></button>
</template>
<script setup>
/** Shared map-surface action. Supply aria-label for icon-only content. Native attributes and listeners pass through. */
defineProps({
  /** Native disabled state; disabled controls cannot emit click. */
  disabled: Boolean,
  /** Omit for an action; pass true/false for a toggle. */
  pressed: { type: Boolean, default: undefined },
});
</script>
