<template>
  <div v-if="shown" class="floating-modal-layer">
    <div v-if="blocking" class="floating-modal__backdrop" aria-hidden="true" @click="$emit('backdrop-click')" @wheel.prevent @touchmove.prevent></div>
    <section
      ref="modalElement"
      v-bind="$attrs"
      class="map-ui floating-modal"
      :class="[`floating-modal--${position}`, `floating-modal--${formFactor}`]"
      :data-theme="theme"
      :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel"
      role="dialog"
      :aria-modal="blocking ? 'true' : 'false'"
      :aria-label="label"
      :style="modalStyle"
      tabindex="-1"
      @keydown.esc.stop.prevent="close"
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
      >
        <template #actions>
          <template v-for="(button, index) in headerButtons" :key="`${button.type}-${button.label}-${index}`">
            <TextButton
              v-if="button.type === 'text'"
              v-bind="buttonProps(button)"
              layout="tight"
              :theme="theme"
              :surface-level="surfaceLevel"
              @click="$emit('header-button-click', { button, index })"
            />
            <SquareIconButton
              v-else-if="button.type === 'icon'"
              v-bind="buttonProps(button)"
              layout="tight"
              :theme="theme"
              :surface-level="surfaceLevel"
              @click="$emit('header-button-click', { button, index })"
            />
          </template>
        </template>
      </HeaderBar>
      <div ref="content" class="floating-modal__content" tabindex="0" @scroll="$emit('scroll', $event)">
        <slot />
      </div>
      <footer v-if="footerButtons.length || $slots.footer" class="floating-modal__footer" :data-theme="theme">
        <slot name="footer" />
        <div v-if="footerButtons.length" class="floating-modal__footer-actions">
        <TextButton
          v-for="(button, index) in footerButtons"
          :key="`${button.label}-${index}`"
          v-bind="buttonProps(button)"
          layout="tight"
          variant="neutral"
          :theme="theme"
          :surface-level="surfaceLevel"
          @click="$emit('footer-button-click', { button, index })"
        />
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onActivated, onDeactivated, onBeforeUnmount, ref, watch } from 'vue';
import HeaderBar from './HeaderBar.vue';
import SquareIconButton from './SquareIconButton.vue';
import TextButton from './TextButton.vue';
import { buttonColors } from '../design/buttonColors.js';

/** Floating, viewport-height modal with a fixed header and independently scrolling content. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Surface depth, where 0 is deepest and 5 is closest to the viewer. */
  surfaceLevel: { type: Number, default: 5, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  position: { type: String, default: 'center', validator: value => ['left', 'center', 'right'].includes(value) },
  /** Tall preserves space above the panel; full fills the viewport with an 8px inset. */
  formFactor: { type: String, default: 'tall', validator: value => ['tall', 'full'].includes(value) },
  /** Blocks pointer interaction and traps keyboard focus outside the modal. */
  blocking: { type: Boolean, default: false },
  label: { type: String, default: 'Floating Modal' },
  subtitle: { type: String, default: '' },
  seamlessButtonEdge: { type: Boolean, default: false },
  /** Tight Text Button or Square Icon Button props, in display order. */
  headerButtons: { type: Array, default: () => [] },
  /** Tight, neutral Text Button props, in display order. */
  footerButtons: { type: Array, default: () => [] },
});
defineOptions({ inheritAttrs: false });
const open = defineModel('open', { type: Boolean, default: false });
const emit = defineEmits(['close', 'scroll', 'header-button-click', 'footer-button-click', 'backdrop-click']);
const modalElement = ref(null);
const content = ref(null);
const active = ref(true);
const shown = computed(() => open.value && active.value);
let restoreFocusElement = null;
let activeTrapCleanup = null;
let focusVersion = 0;
onActivated(() => { active.value = true; });
onDeactivated(() => { active.value = false; });
defineExpose({ content, element: modalElement });

const modalStyle = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 5] || buttonColors.light.neutralByLevel[5];
  return {
    '--floating-modal-surface': props.surfaceLevel === null ? 'transparent' : palette.background,
    '--floating-modal-border': palette.border,
    '--floating-modal-foreground': palette.foreground,
  };
});

function close() {
  open.value = false;
  emit('close');
}

function buttonProps(button) {
  const { type, ...componentProps } = button;
  return componentProps;
}

function focusableElements() {
  return [...(modalElement.value?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])]
    .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length);
}

function releaseFocusTrap() {
  activeTrapCleanup?.();
  activeTrapCleanup = null;
}

function ownsFocus() {
  if (document.querySelector('dialog:modal')) return false;
  return [...document.querySelectorAll('.floating-modal[aria-modal="true"]')].filter(element => !element.closest('[inert]') && element.getClientRects().length).at(-1) === modalElement.value;
}

watch([shown, () => props.blocking], async ([isOpen, isBlocking], previousValues = [false, false]) => {
  const version = ++focusVersion;
  const [wasOpen, wasBlocking] = previousValues;
  if (isOpen && isBlocking && (!wasOpen || !wasBlocking)) {
    restoreFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    const modal = modalElement.value;
    if (!modal || version !== focusVersion) return;

    const onKeydown = event => {
      if (event.key !== 'Tab' || !ownsFocus()) return;
      const focusable = focusableElements();
      if (!focusable.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!modal.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = event => {
      if (ownsFocus() && !modal.contains(event.target)) (focusableElements()[0] || modal).focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('focusin', onFocusIn, true);
    activeTrapCleanup = () => {
      document.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
    (focusableElements()[0] || modal).focus({ preventScroll: true });
  } else if (!isOpen || !isBlocking) {
    if (wasOpen && wasBlocking) {
      releaseFocusTrap();
      const previousFocus = restoreFocusElement;
      restoreFocusElement = null;
      await nextTick();
      if (version === focusVersion && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }
}, { flush: 'post', immediate: true });

onBeforeUnmount(() => {
  focusVersion++;
  releaseFocusTrap();
  if (restoreFocusElement?.isConnected) restoreFocusElement.focus({ preventScroll: true });
});
</script>

<style scoped>
.floating-modal-layer { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
.floating-modal__backdrop {
  position: fixed;
  z-index: 999;
  inset: 0;
  background: #00000060;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: auto;
}
.floating-modal.map-ui {
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
  color: var(--floating-modal-foreground);
  box-shadow: 0 3px 12px #00000040;
}
.floating-modal--left { left: 4px; }
.floating-modal--center { left: 50%; transform: translateX(-50%); }
.floating-modal--right { right: 4px; }
.floating-modal--full.map-ui { top: 8px; right: 8px; bottom: 8px; left: 8px; width: auto; max-width: none; margin: 0; transform: none; }
.floating-modal__header { flex: 0 0 49px; overflow: hidden; border-radius: 8px 8px 0 0; }
.floating-modal__header :deep(.header-bar__text) { flex: 1 1 auto; }
.floating-modal__header :deep(.text-button), .floating-modal__header :deep(.square-icon-button) { flex-shrink: 0; }
.floating-modal__content {
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.floating-modal__content:focus-visible { outline: 2px solid var(--floating-modal-foreground); outline-offset: -2px; }
.floating-modal__footer {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: 100%;
  border-top: 1px solid var(--floating-modal-border);
  background: var(--floating-modal-surface);
}
.floating-modal__footer-actions { display: flex; }
.floating-modal__footer :deep(.text-button) { box-sizing: border-box; width: 0; flex: 1 1 0; min-width: 0; border-top: 0; border-bottom: 0; border-radius: 0; }
.floating-modal__footer :deep(.text-button + .text-button) { border-left: 0; }
</style>
