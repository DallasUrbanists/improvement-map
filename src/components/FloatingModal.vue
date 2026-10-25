<template>
  <section
    v-if="open"
    class="floating-modal"
    :class="`floating-modal--${position}`"
    :data-theme="theme"
    :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel"
    role="dialog"
    aria-modal="true"
    :aria-label="label"
    :style="modalStyle"
  >
    <HeaderBar
      class="floating-modal__header"
      :theme="theme"
      variant="neutral"
      :surface-level="surfaceLevel"
      :label="label"
      :subtitle="subtitle"
      :seamless-button-edge="seamlessButtonEdge"
      :buttons="[{ icon: 'xmark', label: 'Close' }]"
      @button-click="close"
    />
    <div class="floating-modal__content" @scroll="$emit('scroll', $event)">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import HeaderBar from './HeaderBar.vue';
import { buttonColors } from '../design/buttonColors.js';

/** Floating, viewport-height modal with a fixed header and independently scrolling content. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Surface depth, where 0 is deepest and 5 is closest to the viewer. */
  surfaceLevel: { type: Number, default: 5, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  position: { type: String, default: 'center', validator: value => ['left', 'center', 'right'].includes(value) },
  label: { type: String, default: 'Floating Modal' },
  subtitle: { type: String, default: '' },
  seamlessButtonEdge: { type: Boolean, default: false },
});
const open = defineModel('open', { type: Boolean, default: false });
const emit = defineEmits(['close', 'scroll']);

const modalStyle = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 5] || buttonColors.light.neutralByLevel[5];
  return {
    '--floating-modal-surface': props.surfaceLevel === null ? 'transparent' : palette.background,
    '--floating-modal-border': palette.border,
  };
});

function close() {
  open.value = false;
  emit('close');
}
</script>

<style scoped>
.floating-modal {
  --margins: 8px;
  position: fixed;
  z-index: 1000;
  pointer-events: auto;
  top: 64px;
  bottom: var(--margins);
  margin-left: auto;
  margin-right: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: calc(100% - var(--margins) * 2);
  max-width: 1024px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--floating-modal-border);
  background: var(--floating-modal-surface);
  box-shadow: 0 3px 12px #00000040;
}
.floating-modal--left { left: 4px; }
.floating-modal--center { left: 50%; transform: translateX(-50%); }
.floating-modal--right { right: 4px; }
.floating-modal__header { flex: 0 0 49px; overflow: hidden; border-radius: 8px 8px 0 0; }
.floating-modal__content {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
