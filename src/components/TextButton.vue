<template>
  <MapControlButton class="text-button" :style="colors" :data-theme="theme" :data-variant="variant" :data-layout="layout" :data-active="isActive"
    :disabled="disabled" :aria-label="label" :title="label">
    <i v-if="icon" class="fa-solid" :class="`fa-${icon}`" aria-hidden="true"></i>
    <span class="text-button__label">{{ label }}</span>
  </MapControlButton>
</template>
<script setup>
import { computed } from 'vue';
import MapControlButton from './MapControlButton.vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';

/** A fit-content action with an always-visible label and optional leading icon. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Floating keeps the 4px margin and shadow; tight removes both and the corner radius. */
  layout: { type: String, default: 'floating', validator: value => ['floating', 'tight'].includes(value) },
  /** Font Awesome solid icon name; an empty string omits the icon. */
  icon: { type: String, default: '' },
  disabled: Boolean,
  isActive: { type: Boolean, default: false },
  /** Inherited neutral surface depth; omitted defaults to level 1, null means transparent. */
  surfaceLevel: { type: Number, default: undefined, validator: value => value === null || value === undefined || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Visible button label, accessible name and native hover tooltip. */
  label: { type: String, required: true },
});
const colors = computed(() => {
  const theme = buttonColors[props.theme] || buttonColors.light;
  const surfaceLevel = props.surfaceLevel === undefined ? 1 : props.surfaceLevel;
  const level = surfaceLevel ?? 1;
  const palette = props.disabled
    ? props.variant === 'neutral' ? theme.disabled.neutralByLevel[level] : theme.disabled[props.variant]
    : props.variant === 'neutral' ? theme.neutralByLevel[level] : theme[props.variant];
  const activeBackground = surfaceLevel === null ? 'transparent' : surfaceColors[props.theme]?.active[`level${level}`] || surfaceColors.light.active.level1;
  return Object.fromEntries(Object.entries({ ...palette, background: surfaceLevel === null && props.variant === 'neutral' ? 'transparent' : palette.backgroundGradient || palette.background, hover: palette.hoverGradient || palette.hover, press: palette.pressGradient || palette.press, activeBackground }).map(([key, value]) => [`--text-button-${key}`, value]));
});
</script>
<style scoped>
.text-button {
  width: fit-content; height: 48px; min-height: 48px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  margin: 4px; padding: 0 12px; flex: 0 0 auto;
  border: 1px solid var(--text-button-border); border-radius: 8px;
  background: var(--text-button-background); color: var(--text-button-foreground);
  box-shadow: 0 3px 12px #00000040; font-size: 16px; line-height: 1;
  touch-action: manipulation;
}
.text-button i { font-size: 18px; }
.text-button__label { white-space: nowrap; }
.text-button:hover:not(:disabled) { background: var(--text-button-hover); color: var(--text-button-foreground); }
.text-button.map-ui-button:hover:not(:disabled):not([aria-disabled="true"]) { background: var(--text-button-hover); color: var(--text-button-foreground); }
.text-button:active:not(:disabled) { background: var(--text-button-press); color: var(--text-button-foreground); box-shadow: inset 0 2px 4px #00000030; }
.text-button:focus-visible { outline: 2px solid var(--text-button-focus); outline-offset: -4px; }
.text-button[data-active="true"], .text-button[data-active="true"]:hover:not(:disabled), .text-button[data-active="true"]:active:not(:disabled) { background: var(--text-button-activeBackground); }
.text-button:disabled { opacity: 1; cursor: default; }
.text-button[data-layout="tight"] { margin: 0; border-radius: 0; box-shadow: none; }
.text-button[data-layout="tight"]:active:not(:disabled) { box-shadow: none; }
</style>
