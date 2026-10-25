<template>
  <button
    v-if="onclick"
    type="button"
    class="pill-text pill-text--button"
    :class="[`pill-text--${size}`, `pill-text--${variant}`]"
    :style="colors"
    :data-theme="theme"
    :data-variant="variant"
    :data-size="size"
    :data-selectable="selectable"
    :data-selected="String(isSelected)"
    :aria-pressed="selectable ? isSelected : undefined"
    @click="handleClick"
  >{{ label }}</button>
  <span
    v-else
    class="pill-text"
    :class="[`pill-text--${size}`, `pill-text--${variant}`, { 'pill-text--selectable': selectable }]"
    :style="colors"
    :data-theme="theme"
    :data-variant="variant"
    :data-size="size"
    :data-selected="String(isSelected)"
    :role="selectable ? 'button' : undefined"
    :tabindex="selectable ? 0 : undefined"
    :aria-pressed="selectable ? isSelected : undefined"
    @click="selectable && handleClick($event)"
    @keydown.enter.prevent="selectable && handleClick($event)"
    @keydown.space.prevent="selectable && handleClick($event)"
  >{{ label }}</span>
</template>

<script setup>
import { computed, ref } from 'vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';
import { textColors } from '../design/textColors.js';

const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  onclick: { type: Function, default: undefined },
  size: { type: String, default: 'regular', validator: value => ['small', 'regular', 'large'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  label: { type: String, required: true },
  selectable: { type: Boolean, default: false },
  /** Optional controlled selection state for exclusive groups. */
  selected: { type: Boolean, default: undefined },
});
const emit = defineEmits(['update:selected']);
const internalSelected = ref(false);
const isSelected = computed(() => props.selected ?? internalSelected.value);
const colors = computed(() => {
  const palette = buttonColors[props.theme]?.[props.variant] || buttonColors.light.neutral;
  const border = props.variant === 'neutral'
    ? textColors.muted[props.theme]?.neutral.level1 || textColors.muted.light.neutral.level1
    : palette.background;
  const activeBackground = surfaceColors[props.theme]?.active.level1 || surfaceColors.light.active.level1;
  return {
    '--pill-text-background': palette.backgroundGradient || palette.background,
    '--pill-text-foreground': palette.foreground,
    '--pill-text-border': border,
    '--pill-text-selectable-foreground': palette.foreground,
    '--pill-text-hover': palette.hoverGradient || palette.hover,
    '--pill-text-press': palette.pressGradient || palette.press,
    '--pill-text-focus': palette.focus,
    '--pill-text-selected': activeBackground,
  };
});

function handleClick(event) {
  if (props.selectable) {
    const nextSelected = !isSelected.value;
    if (props.selected === undefined) internalSelected.value = nextSelected;
    emit('update:selected', nextSelected);
  }
  props.onclick?.(event);
}
</script>

<style scoped>
.pill-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 4px;
  padding: 4px 12px;
  border: 1px solid var(--pill-text-border);
  border-radius: 999px;
  background: var(--pill-text-background);
  color: var(--pill-text-foreground);
  font: inherit;
  font-size: 1em;
  line-height: 1.25;
  white-space: nowrap;
  vertical-align: middle;
}
.pill-text--button,
.pill-text--selectable,
.pill-text[data-selectable]:not([data-selectable="false"]) {
  cursor: pointer;
  user-select: none;
}
.pill-text--selectable,
.pill-text[data-selectable]:not([data-selectable="false"]) {
  background: transparent;
  color: var(--pill-text-selectable-foreground);
}
.pill-text--button { touch-action: manipulation; }
.pill-text--small { font-size: 0.75em; }
.pill-text--regular { font-size: 1em; }
.pill-text--large { font-size: 1.5em; }
.pill-text--button:hover,
.pill-text--selectable:hover { background: var(--pill-text-hover); }
.pill-text--button:active { background: var(--pill-text-press); }
.pill-text:focus-visible { outline: 2px solid var(--pill-text-focus); outline-offset: 2px; }
.pill-text[data-selected="true"],
.pill-text[data-selectable][data-selected="true"],
.pill-text[data-selected="true"]:hover,
.pill-text[data-selected="true"]:active {
  background: var(--pill-text-background);
  color: var(--pill-text-foreground);
}
</style>
