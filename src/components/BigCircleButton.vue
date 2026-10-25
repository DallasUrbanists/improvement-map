<template>
  <MapControlButton class="big-circle-button" :style="colors" :data-theme="theme" :data-variant="variant"
    :disabled="disabled" :aria-label="label" :title="label">
    <i class="fa-solid" :class="`fa-${icon}`" aria-hidden="true"></i>
    <span class="big-circle-button__label">{{ label }}</span>
  </MapControlButton>
</template>
<script setup>
import { computed } from 'vue';
import MapControlButton from './MapControlButton.vue';
import { buttonColors } from '../design/buttonColors.js';

/** A round icon-and-label action. Native listeners pass through. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  icon: { type: String, default: 'list-ul' },
  disabled: Boolean,
  /** Visible button label, accessible name and native hover tooltip. */
  label: { type: String, required: true },
});
const colors = computed(() => {
  const theme = buttonColors[props.theme] || buttonColors.light;
  const palette = props.disabled ? theme.disabled[props.variant] : theme[props.variant];
  return Object.fromEntries(Object.entries({ ...palette, background: palette.backgroundGradient || palette.background, hover: palette.hoverGradient || palette.hover, press: palette.pressGradient || palette.press }).map(([key, value]) => [`--circle-${key}`, value]));
});
</script>
<style scoped>
.big-circle-button {
  width: 72px; height: 72px; min-width: 72px; min-height: 72px;
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  margin: 4px; padding: 0; flex: 0 0 72px; aspect-ratio: 1;
  border: 1px solid var(--circle-border); border-radius: 50%;
  background: var(--circle-background); color: var(--circle-foreground);
  box-shadow: 0 3px 12px #00000040; font-size: 18px; line-height: 1;
  touch-action: manipulation;
}
.big-circle-button__label { font-size: 12px; font-weight: 500; line-height: 14px; }
.big-circle-button.map-ui-button:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--circle-hover); color: var(--circle-foreground); }
.big-circle-button:active:not(:disabled) { background: var(--circle-press); color: var(--circle-foreground); box-shadow: inset 0 2px 4px #00000030; }
.big-circle-button:focus-visible { outline: 2px solid var(--circle-focus); outline-offset: -4px; }
.big-circle-button:disabled { opacity: 1; cursor: default; }
</style>
