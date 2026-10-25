<template>
  <Teleport to="body">
    <TransitionGroup appear class="toast-notification-stack" name="toast-slide" tag="div" aria-live="polite">
      <div v-for="toast in visibleToasts" :key="toast.id" class="toast-notification" role="status" :data-theme="theme" :style="colors"
        @pointerdown="startSwipe(toast.id, $event)" @pointerup="endSwipe(toast.id, $event)" @pointercancel="cancelSwipe">
        <span class="toast-notification__message">{{ toast.message }}</span>
        <div class="toast-notification__actions">
          <template v-for="(button, index) in toast.buttons" :key="`${button.label}-${index}`">
            <a v-if="button.href" class="toast-notification__link" :href="button.href" @click="button.onClick?.($event)">{{ button.label }}</a>
            <button v-else type="button" class="toast-notification__link" @click="button.onClick?.($event); $emit('action', { toast, button, index })">{{ button.label }}</button>
          </template>
          <button type="button" class="toast-notification__link toast-notification__dismiss" :aria-label="`Dismiss ${toast.message}`" @click="dismiss(toast.id)">Dismiss</button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** Fixed, swipe-dismissible level-5 notifications. Extra buttons are links or callback actions. */
const props = defineProps({
  message: { type: String, default: '' },
  autoDismissSeconds: { type: Number, default: null, validator: value => value === null || (Number.isInteger(value) && value >= 0) },
  buttons: { type: Array, default: () => [] },
  /** Optional collection for stacked notifications; each item may override message, buttons and autoDismissSeconds. */
  notifications: { type: Array, default: null },
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
});
const emit = defineEmits(['dismiss', 'action']);
const dismissed = ref(new Set());
const timers = new Map();
const swipes = new Map();
const entries = computed(() => props.notifications?.length
  ? props.notifications.map((item, index) => ({ id: item.id ?? `toast-${index}`, message: item.message ?? '', buttons: item.buttons ?? [], autoDismissSeconds: item.autoDismissSeconds ?? props.autoDismissSeconds }))
  : (props.message ? [{ id: 'toast', message: props.message, buttons: props.buttons, autoDismissSeconds: props.autoDismissSeconds }] : []));
const visibleToasts = computed(() => entries.value.filter(toast => !dismissed.value.has(toast.id)));
const colors = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[5] || buttonColors.light.neutralByLevel[5];
  return { '--toast-background': palette.background, '--toast-foreground': palette.foreground, '--toast-border': palette.border, '--toast-focus': palette.focus };
});
watch(() => entries.value.map(toast => [toast.id, toast.message, toast.autoDismissSeconds]), () => {
  dismissed.value = new Set();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  for (const toast of entries.value) {
    if (Number.isInteger(toast.autoDismissSeconds) && toast.autoDismissSeconds >= 0) {
      timers.set(toast.id, setTimeout(() => dismiss(toast.id), toast.autoDismissSeconds * 1000));
    }
  }
}, { immediate: true });
function dismiss(id) {
  if (dismissed.value.has(id)) return;
  dismissed.value = new Set(dismissed.value).add(id);
  clearTimeout(timers.get(id)); timers.delete(id);
  emit('dismiss', entries.value.find(toast => toast.id === id));
}
function startSwipe(id, event) { swipes.set(id, { x: event.clientX, y: event.clientY }); }
function endSwipe(id, event) {
  const start = swipes.get(id); swipes.delete(id);
  if (start && Math.max(Math.abs(event.clientX - start.x), Math.abs(event.clientY - start.y)) >= 48) dismiss(id);
}
function cancelSwipe() { swipes.clear(); }
onBeforeUnmount(() => { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); });
</script>

<style scoped>
.toast-notification-stack {
  position: fixed;
  z-index: 10000;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.toast-notification {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px;
  background: var(--toast-background);
  color: var(--toast-foreground);
  border: 1px solid var(--toast-border);
  border-radius: 8px;
  box-shadow: 0 3px 12px #00000040;
  font-size: 1rem;
  font-weight: 400;
  text-align: left;
  touch-action: none;
  pointer-events: auto;
}
.toast-notification__message { min-width: 0; overflow-wrap: anywhere; }
.toast-notification__actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex: 0 0 auto; }
.toast-notification__link { padding: 0; color: inherit; font: inherit; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; white-space: nowrap; }
.toast-notification__link:focus-visible { outline: 2px solid var(--toast-focus); outline-offset: 3px; }
.toast-slide-enter-active, .toast-slide-appear-active, .toast-slide-leave-active, .toast-slide-move { transition: transform 180ms ease, opacity 180ms ease; }
.toast-slide-enter-from, .toast-slide-appear-from, .toast-slide-leave-to { opacity: 0; transform: translateY(-110%); }
.toast-slide-leave-active { position: absolute; left: 0; right: 0; }
@media (prefers-reduced-motion: reduce) { .toast-slide-enter-active, .toast-slide-appear-active, .toast-slide-leave-active, .toast-slide-move { transition-duration: 1ms; } }
</style>
