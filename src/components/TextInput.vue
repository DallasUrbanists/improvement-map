<template>
  <input
    class="text-input"
    :class="{ 'text-input--with-icon': icon }"
    type="text"
    :data-theme="theme"
    :data-layout="layout"
    :placeholder="placeholder || undefined"
    :aria-label="placeholder || undefined"
    :value="modelValue"
    :readonly="readonly"
    :style="inputStyle"
    @input="$emit('update:modelValue', $event.target.value)"
    @focus="$emit('focus', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import barsIcon from '@fortawesome/fontawesome-free/svgs/solid/bars.svg?raw';
import layerGroupIcon from '@fortawesome/fontawesome-free/svgs/solid/layer-group.svg?raw';
import plusIcon from '@fortawesome/fontawesome-free/svgs/solid/plus.svg?raw';
import xmarkIcon from '@fortawesome/fontawesome-free/svgs/solid/xmark.svg?raw';
import magnifyingGlassIcon from '@fortawesome/fontawesome-free/svgs/solid/magnifying-glass.svg?raw';
import locationCrosshairsIcon from '@fortawesome/fontawesome-free/svgs/solid/location-crosshairs.svg?raw';
import bookmarkIcon from '@fortawesome/fontawesome-free/svgs/solid/bookmark.svg?raw';
import arrowLeftIcon from '@fortawesome/fontawesome-free/svgs/solid/arrow-left.svg?raw';
import arrowRightIcon from '@fortawesome/fontawesome-free/svgs/solid/arrow-right.svg?raw';
import { buttonColors } from '../design/buttonColors.js';

const icons = {
  bars: barsIcon,
  'layer-group': layerGroupIcon,
  plus: plusIcon,
  xmark: xmarkIcon,
  'magnifying-glass': magnifyingGlassIcon,
  'location-crosshairs': locationCrosshairsIcon,
  bookmark: bookmarkIcon,
  'arrow-left': arrowLeftIcon,
  'arrow-right': arrowRightIcon,
};

/** Raw full-width text input using the shared Text Button surface treatments. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Optional empty-state hint and accessible name. */
  placeholder: { type: String, default: '' },
  /** Optional Font Awesome solid icon embedded as a decorative input background. */
  icon: { type: String, default: '' },
  /** Current editable value. */
  modelValue: { type: String, default: undefined },
  /** Prevents editing while retaining the value for viewing. */
  readonly: { type: Boolean, default: false },
  /** Floating uses a 4px margin, 8px radius and shadow; tight removes them. */
  layout: { type: String, default: 'floating', validator: value => ['floating', 'tight'].includes(value) },
});
defineEmits(['update:modelValue', 'focus']);

const colors = computed(() => buttonColors[props.theme]?.neutral || buttonColors.light.neutral);
const inputStyle = computed(() => {
  const svg = icons[props.icon];
  const iconImage = svg
    ? `url("data:image/svg+xml,${encodeURIComponent(svg.replace('<svg ', `<svg fill="${colors.value.foreground}" `))}")`
    : 'none';
  return {
    '--text-input-background': colors.value.background,
    '--text-input-foreground': colors.value.foreground,
    '--text-input-border': colors.value.border,
    '--text-input-hover': colors.value.hover,
    '--text-input-press': colors.value.press,
    '--text-input-focus': colors.value.focus,
    backgroundImage: iconImage,
  };
});
</script>

<style scoped>
.text-input {
  box-sizing: border-box;
  width: calc(100% - 8px);
  height: 48px;
  min-height: 48px;
  margin: 4px;
  padding: 0 12px;
  border: 1px solid var(--text-input-border);
  border-radius: 8px;
  background-color: var(--text-input-background) !important;
  background-position: 12px center;
  background-repeat: no-repeat;
  background-size: auto 18px;
  color: var(--text-input-foreground) !important;
  box-shadow: 0 3px 12px #00000040 !important;
  font-family: Roboto, Arial, sans-serif !important;
  font-size: 16px;
  line-height: 1;
  touch-action: manipulation;
}
.text-input::placeholder { color: var(--text-input-foreground); opacity: .65; }
.text-input:hover { background-color: var(--text-input-hover) !important; }
.text-input:active { background-color: var(--text-input-press) !important; box-shadow: inset 0 2px 4px #00000030 !important; }
.text-input:focus-visible { outline: 2px solid var(--text-input-focus); outline-offset: -4px; }
.text-input--with-icon { padding-left: 40px; }
.text-input[data-layout="tight"] {
  width: 100%;
  margin: 0;
  border-radius: 0;
  box-shadow: none !important;
}
.text-input[data-layout="tight"]:active { box-shadow: none !important; }
</style>
