<template>
  <header class="header-bar" :data-theme="theme" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :style="colors">
    <div class="header-bar__text">
      <span class="header-bar__label">{{ label }}</span>
      <span v-if="subtitle" class="header-bar__subtitle">{{ subtitle }}</span>
    </div>
    <SquareIconButton
      v-for="(button, index) in buttons"
      :key="`${button.label}-${index}`"
      :class="['header-bar__close', { 'header-bar__close--seamless-edge': seamlessButtonEdge && index === 0 }]"
      layout="tight"
      :icon="button.icon"
      :label="button.label"
      :disabled="button.disabled"
      :theme="theme"
      :surface-level="surfaceLevel"
      :variant="button.variant || variant"
      @click="$emit('button-click', { button, index })"
    />
  </header>
</template>

<script setup>
import SquareIconButton from './SquareIconButton.vue';
import { computed } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** Full-width title bar with optional subtitle and zero or more square icon actions. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  label: { type: String, required: true },
  subtitle: { type: String, default: '' },
  /** Square Icon Button props; each inherits the bar variant unless it sets its own. */
  buttons: { type: Array, default: () => [] },
  /** Removes the left border from the left-most button. */
  seamlessButtonEdge: { type: Boolean, default: false },
  /** Neutral surface level used when variant is neutral. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
});
const colors = computed(() => {
  const theme = buttonColors[props.theme] || buttonColors.light;
  const palette = props.variant === 'neutral'
    ? theme.neutralByLevel[props.surfaceLevel ?? 1]
    : theme[props.variant];
  return {
    '--header-bar-background': props.surfaceLevel === null && props.variant === 'neutral' ? 'transparent' : palette.background,
    '--header-bar-foreground': palette.foreground,
    '--header-bar-border': palette.border,
  };
});
defineEmits(['button-click']);
</script>

<style scoped>
.header-bar {
  box-sizing: border-box;
  width: 100%;
  height: 49px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0px;
  background-color: var(--header-bar-background);
  color: var(--header-bar-foreground);
  border-bottom: 1px solid var(--header-bar-border);
  min-height: 49px;
}
.header-bar__label {
  min-width: 0; font-weight: 700; text-align: left;
  line-height: 18px;
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-bar__text {
  min-width: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  padding-left: 12px;
}
.header-bar__subtitle {
  min-width: 0;
  font-size: 10px;
  line-height: 12px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-bar__close {
  margin: 0;
  padding: 0;
  border-top: 0;
  border-bottom: 0;
  border-right: 0;
}
.header-bar :deep(.header-bar__close--seamless-edge) { border-left: 0; }
</style>
