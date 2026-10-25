<template>
  <MapControlButton class="square-icon-button" :style="colors" :data-theme="theme" :data-variant="variant" :data-layout="layout" :data-active="isActive"
    :disabled="disabled" :aria-label="label" :title="label">
    <span v-if="icon === 'arrow-left-edge'" class="square-icon-button__custom-icon" aria-hidden="true"></span>
    <i v-else :class="[icon === 'bookmark' && !isActive ? 'fa-regular' : 'fa-solid', `fa-${icon}`]" aria-hidden="true"></i>
  </MapControlButton>
</template>
<script setup>
import { computed } from 'vue';
import MapControlButton from './MapControlButton.vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';
/** An icon-only action with its own square surface. Native listeners pass through. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Floating keeps the 4px margin and shadow; tight removes both. */
  layout: { type: String, default: 'floating', validator: value => ['floating', 'tight'].includes(value) },
  icon: { type: String, default: 'bars' },
  disabled: Boolean,
  isActive: { type: Boolean, default: false },
  /** Inherited neutral surface depth; omitted defaults to level 1, null means transparent. */
  surfaceLevel: { type: Number, default: undefined, validator: value => value === null || value === undefined || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Accessible name and native hover tooltip; never rendered as button text. */
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
  return Object.fromEntries(Object.entries({ ...palette, background: surfaceLevel === null && props.variant === 'neutral' ? 'transparent' : palette.backgroundGradient || palette.background, hover: palette.hoverGradient || palette.hover, press: palette.pressGradient || palette.press, activeBackground }).map(([key, value]) => [`--square-${key}`, value]));
});
</script>
<style scoped>
.square-icon-button {
  width: 48px; height: 48px; min-width: 48px; min-height: 48px;
  display: inline-flex; align-items: center; justify-content: center;
  margin: 4px; padding: 0; flex: 0 0 48px; aspect-ratio: 1;
  border: 1px solid var(--square-border); border-radius: 8px;
  background: var(--square-background); color: var(--square-foreground);
  box-shadow: 0 3px 12px #00000040; font-size: 20px; line-height: 1;
  touch-action: manipulation;
}
.square-icon-button__custom-icon { width: 1em; height: 1em; background: currentColor; mask: url('/icons/arrow-left-edge.svg') center / contain no-repeat; -webkit-mask: url('/icons/arrow-left-edge.svg') center / contain no-repeat; }
.square-icon-button.map-ui-button:not([data-active="true"]):hover:not(:disabled):not([aria-disabled="true"]) { background: var(--square-hover); color: var(--square-foreground); }
.square-icon-button:active:not(:disabled) { background: var(--square-press); color: var(--square-foreground); box-shadow: inset 0 2px 4px #00000030; }
.square-icon-button:focus-visible { outline: 2px solid var(--square-focus); outline-offset: -4px; }
.square-icon-button.map-ui-button[data-active="true"], .square-icon-button.map-ui-button[data-active="true"]:hover:not(:disabled):not([aria-disabled="true"]), .square-icon-button.map-ui-button[data-active="true"]:active:not(:disabled) { background: var(--square-activeBackground); }
.square-icon-button:disabled { opacity: 1; cursor: default; }
.square-icon-button[data-layout="tight"] { margin: 0; border-radius: 0; box-shadow: none; }
.square-icon-button[data-layout="tight"]:active:not(:disabled) { box-shadow: none; }
</style>
