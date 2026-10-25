<template>
  <div class="menu-item" :data-theme="theme" :style="colors">
    <a class="menu-item__link text-button" :style="{ paddingRight: `${buttons.length * 48}px` }" :href="href" :data-theme="theme" data-variant="neutral" data-layout="tight" :title="label" @click="$emit('link-click', $event)">
      <span class="menu-item__leading">
        <span v-if="symbolType === 'emoji' && emoji" class="menu-item__symbol menu-item__emoji" aria-hidden="true">{{ emoji }}</span>
        <i v-else-if="symbolType === 'icon' && icon" class="menu-item__symbol fa-solid" :class="`fa-${icon}`" aria-hidden="true"></i>
        <span v-else-if="symbolType === 'checkbox'" class="menu-item__symbol menu-item__checkbox-placeholder" aria-hidden="true"></span>
        <span class="menu-item__text">
          <span class="menu-item__label">{{ label }}</span>
          <span v-if="subtitle" class="menu-item__subtitle">{{ subtitle }}</span>
        </span>
      </span>
    </a>
    <input v-if="symbolType === 'checkbox'" class="menu-item__checkbox" type="checkbox" :aria-label="label" @click.stop />
    <SquareIconButton
      v-for="(button, index) in buttons"
      :key="index"
      class="menu-item__action"
      layout="tight"
      :icon="button.icon"
      :label="button.label"
      :disabled="button.disabled"
      :theme="theme"
      :variant="button.variant || variant"
      @click="$emit('button-click', { button, index, event: $event })"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import SquareIconButton from './SquareIconButton.vue';
import { buttonColors } from '../design/buttonColors.js';

/** Link row with Row Item content and independent trailing icon actions. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  label: { type: String, required: true },
  subtitle: { type: String, default: '' },
  href: { type: String, default: '#' },
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
  const palette = buttonColors[props.theme]?.neutral || buttonColors.light.neutral;
  const actionPalette = buttonColors[props.theme]?.[props.variant] || buttonColors.light.neutral;
  return {
    '--text-button-background': palette.backgroundGradient || palette.background,
    '--text-button-foreground': palette.foreground,
    '--text-button-border': palette.border,
    '--text-button-hover': palette.hoverGradient || palette.hover,
    '--text-button-press': palette.pressGradient || palette.press,
    '--text-button-focus': palette.focus,
    '--menu-item-action-hover': actionPalette.hover,
    '--menu-item-action-press': actionPalette.press,
  };
});
defineEmits(['button-click', 'link-click']);
</script>

<style scoped>
.menu-item {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  min-height: 49px;
  color: var(--text-button-foreground);
}
.menu-item__link {
  position: absolute;
  z-index: 0;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--text-button-border);
  border-radius: 0;
  background: var(--text-button-background);
  color: var(--text-button-foreground);
  box-shadow: none;
  font-size: 16px;
  line-height: 1;
  text-decoration: none;
  touch-action: manipulation;
}
.menu-item__link:hover { background: var(--text-button-hover); color: var(--text-button-foreground); }
.menu-item__link:active { background: var(--text-button-press); }
.menu-item__link:focus-visible { z-index: 1; outline: 2px solid var(--text-button-focus); outline-offset: -3px; }
.menu-item__leading {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 0 12px;
}
.menu-item__text { display: flex; flex: 1 1 auto; min-width: 0; flex-direction: column; align-items: flex-start; }
.menu-item__label { min-width: 0; max-width: 100%; overflow: hidden; font-weight: 600; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.menu-item__subtitle { min-width: 0; max-width: 100%; overflow: hidden; font-size: 10px; line-height: 12px; text-overflow: ellipsis; white-space: nowrap; }
.menu-item__symbol { position: relative; z-index: 2; display: inline-flex; flex: 0 0 18px; align-items: center; justify-content: center; width: 18px; height: 18px; color: inherit; }
.menu-item__emoji { font-size: 18px; line-height: 18px; }
.menu-item__checkbox { position: absolute; z-index: 3; top: 50%; left: 12px; box-sizing: border-box; width: 18px; height: 18px; margin: 0; transform: translateY(-50%); accent-color: currentColor; cursor: pointer; }
.menu-item__action { position: relative; z-index: 2; flex: 0 0 48px; margin: 0; padding: 0; border-top: 0; border-bottom: 0; border-right: 0; }
.menu-item__action:hover:not(:disabled) { background: var(--menu-item-action-hover); }
.menu-item__action:active:not(:disabled) { background: var(--menu-item-action-press); }
</style>
