<template>
  <div class="row-item" :data-theme="theme" :style="colors">
    <div class="row-item__leading">
      <span v-if="symbolType === 'emoji' && emoji" class="row-item__symbol row-item__emoji" aria-hidden="true">{{ emoji }}</span>
      <i v-else-if="symbolType === 'icon' && icon" class="row-item__symbol fa-solid" :class="`fa-${icon}`" aria-hidden="true"></i>
      <input
        v-else-if="symbolType === 'checkbox'"
        class="row-item__symbol row-item__checkbox"
        type="checkbox"
        :aria-label="label"
      />
      <div class="row-item__text">
        <span class="row-item__label">{{ label }}</span>
        <span v-if="subtitle" class="row-item__subtitle">{{ subtitle }}</span>
      </div>
    </div>
    <SquareIconButton
      v-for="(button, index) in buttons"
      :key="`${button.label}-${index}`"
      class="row-item__action"
      :class="{ 'row-item__action--row': buttons.length === 1 }"
      layout="tight"
      :icon="button.icon"
      :label="button.label"
      :disabled="button.disabled"
      :theme="theme"
      :variant="button.variant || variant"
      @click="$emit('button-click', { button, index })"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import SquareIconButton from './SquareIconButton.vue';
import { buttonColors } from '../design/buttonColors.js';

/** Full-width title row with optional subtitle, symbol and square icon actions. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  label: { type: String, required: true },
  subtitle: { type: String, default: '' },
  /** Square Icon Button props; each inherits the row variant unless it sets its own. */
  buttons: { type: Array, default: () => [] },
  symbolType: {
    type: String,
    default: 'none',
    validator: (value, props) => ['none', 'emoji', 'icon', 'checkbox'].includes(value)
      && (value !== 'emoji' || Boolean(props.emoji))
      && (value !== 'icon' || Boolean(props.icon)),
  },
  /** Required when symbolType is emoji. */
  emoji: { type: String, default: '', validator: (value, props) => props.symbolType !== 'emoji' || Boolean(value) },
  /** Font Awesome solid name; required when symbolType is icon. */
  icon: { type: String, default: '', validator: (value, props) => props.symbolType !== 'icon' || Boolean(value) },
});
const colors = computed(() => {
  const palette = buttonColors[props.theme]?.[props.variant] || buttonColors.light.neutral;
  return {
    '--row-item-background': palette.background,
    '--row-item-foreground': palette.foreground,
    '--row-item-border': palette.border,
  };
});
defineEmits(['button-click']);
</script>

<style scoped>
.row-item {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 49px;
  min-height: 49px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--row-item-background);
  color: var(--row-item-foreground);
  border-bottom: 1px solid var(--row-item-border);
}
.row-item::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  z-index: 2;
  height: 1px;
  background: var(--row-item-border);
  pointer-events: none;
}
.row-item__leading {
  position: relative;
  z-index: 1;
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 12px;
  pointer-events: none;
}
.row-item__text {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
}
.row-item__label {
  min-width: 0;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-item__subtitle {
  min-width: 0;
  font-size: 10px;
  line-height: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-item__symbol {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}
.row-item__emoji { font-size: 18px; line-height: 18px; }
.row-item__checkbox {
  box-sizing: border-box;
  margin: 0;
  accent-color: currentColor;
  cursor: pointer;
  position: relative;
  z-index: 1;
  pointer-events: auto;
}
.row-item__action {
  margin: 0;
  padding: 0;
  border-top: 0;
  border-bottom: 0;
  border-right: 0;
}
.row-item__action--row {
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  bottom: auto;
  left: 0;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 49px;
  min-height: 49px;
  flex: none;
  justify-content: flex-end;
  padding-right: 14px;
  border: 0;
  border-left: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.row-item__action--row:hover:not(:disabled) { background: var(--square-hover); }
.row-item__action--row:active:not(:disabled) { background: var(--square-press); }
.row-item__action--row:focus-visible { outline-offset: -3px; }
</style>
