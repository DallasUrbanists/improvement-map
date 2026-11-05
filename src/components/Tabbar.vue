<template>
  <div class="tabbar" :data-button-type="buttonType" :data-theme="theme" :data-variant="variant" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :style="colors">
    <component
      :is="buttonType === 'text' ? TextButton : SquareIconButton"
      v-for="(button, index) in buttons"
      :key="`${button.label}-${index}`"
      :theme="theme"
      :variant="variant"
      :layout="'tight'"
      :icon="button.icon || ''"
      :label="button.label"
      :disabled="button.disabled"
      :is-active="false"
      :data-tabbar-selected="selectedIndex === index"
      :surface-level="surfaceLevel"
      :id="button.id"
      :role="button.role"
      :aria-selected="button.role === 'tab' ? String(selectedIndex === index) : undefined"
      :aria-controls="button.controls"
      :tabindex="button.role === 'tab' ? (selectedIndex === index ? 0 : -1) : undefined"
      @click="selectButton(button, index)"
    />
  </div>
</template>

<script setup>
import SquareIconButton from './SquareIconButton.vue';
import TextButton from './TextButton.vue';
import { computed } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** A full-width row that composes shared icon or text buttons for tab navigation. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Each entry accepts icon, label and optional disabled. */
  buttons: { type: Array, default: () => [] },
  /** Neutral surface level used for the regular button colors. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Story-level composition choice; consumers normally choose a story. */
  buttonType: { type: String, default: 'icon', validator: value => ['icon', 'text'].includes(value) },
});
const selectedIndex = defineModel('selectedIndex', { type: Number, default: 0 });
const colors = computed(() => {
  const theme = buttonColors[props.theme] || buttonColors.light;
  const palette = props.variant === 'neutral'
    ? theme.neutralByLevel[props.surfaceLevel ?? 1]
    : theme[props.variant];
  return {
    '--tabbar-background': palette.background,
    '--tabbar-dim-background': `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), ${palette.background}`,
    '--tabbar-border': palette.border,
    '--tabbar-button-background': palette.backgroundGradient || palette.background,
    '--tabbar-button-hover': palette.hoverGradient || palette.hover,
    '--tabbar-button-press': palette.pressGradient || palette.press,
    '--tabbar-button-foreground': palette.foreground,
    '--tabbar-button-border': palette.border,
    '--tabbar-inactive-foreground': '#ffffff',
  };
});
const emit = defineEmits(['button-click']);
function selectButton(button, index) {
  if (button.disabled) return;
  selectedIndex.value = index;
  emit('button-click', { button, index });
}
</script>

<style scoped>
.tabbar {
  box-sizing: border-box;
  width: 100%;
  min-height: 49px;
  display: flex;
  align-items: center;
  background-color: var(--tabbar-background);
  border-bottom: 0;
  position: relative;
  isolation: isolate;
}
.tabbar::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: var(--tabbar-background);
  content: '';
  filter: brightness(0.5);
}
.tabbar :deep(.map-ui-button) {
  border-left: 1px solid var(--tabbar-border);
  border-right: 0;
  border-top: 0;
  border-bottom: 0;
}
.tabbar :deep(.map-ui-button) {
  border-bottom: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
.tabbar :deep(.map-ui-button:not(:disabled)) {
  background: var(--tabbar-button-background);
  color: var(--tabbar-button-foreground);
  border-left-color: var(--tabbar-button-border);
}
.tabbar :deep(.map-ui-button:not(:disabled):hover) { background: var(--tabbar-button-hover); }
.tabbar :deep(.map-ui-button:not(:disabled):active) { background: var(--tabbar-button-press); }
.tabbar :deep(.map-ui-button[data-tabbar-selected="false"]:not(:disabled)),
.tabbar :deep(.map-ui-button[data-tabbar-selected="false"]:not(:disabled):hover),
.tabbar :deep(.map-ui-button[data-tabbar-selected="false"]:not(:disabled):active) {
  background: var(--tabbar-dim-background, var(--tabbar-background));
  color: var(--tabbar-inactive-foreground);
}
.tabbar :deep(.map-ui-button:first-child) { border-left: 0; }
.tabbar :deep(.map-ui-button[data-tabbar-selected="true"]),
.tabbar :deep(.map-ui-button[data-tabbar-selected="true"] + .map-ui-button) { border-left: 0; }
</style>
