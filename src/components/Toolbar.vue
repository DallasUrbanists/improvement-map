<template>
  <div class="toolbar" :data-button-type="buttonType" :data-theme="theme" :data-variant="variant" :style="colors">
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
      :is-active="button.isActive || false"
      :surface-level="surfaceLevel"
      :id="button.id"
      :role="button.role"
      :aria-selected="button.role === 'tab' ? String(Boolean(button.isActive)) : undefined"
      :aria-controls="button.controls"
      :tabindex="button.role === 'tab' ? (button.isActive ? 0 : -1) : undefined"
      @click="$emit('button-click', { button, index })"
    />
  </div>
</template>

<script setup>
import SquareIconButton from './SquareIconButton.vue';
import TextButton from './TextButton.vue';
import { computed } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** A full-width row that composes shared icon or text buttons. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Each entry accepts icon, label and optional disabled. */
  buttons: { type: Array, default: () => [] },
  /** Surface depth forwarded to buttons that use their active surface state. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Story-level composition choice; consumers normally choose a story. */
  buttonType: { type: String, default: 'icon', validator: value => ['icon', 'text'].includes(value) },
});
const colors = computed(() => {
  const palette = buttonColors[props.theme]?.[props.variant] || buttonColors.light.neutral;
  return {
    '--toolbar-background': palette.background,
    '--toolbar-border': palette.border,
  };
});
defineEmits(['button-click']);
</script>

<style scoped>
.toolbar {
  box-sizing: border-box;
  width: 100%;
  min-height: 49px;
  display: flex;
  align-items: center;
  background-color: var(--toolbar-background);
  border-bottom: 1px solid var(--toolbar-border);
}
.toolbar :deep(.map-ui-button) {
  border-left: 1px solid var(--toolbar-border);
  border-right: 0;
  border-top: 0;
  border-bottom: 0;
}
.toolbar :deep(.map-ui-button:first-child) { border-left: 0; }
</style>
