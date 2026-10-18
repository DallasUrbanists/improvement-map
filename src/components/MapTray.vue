<template>
  <TrayTransition :animate="animate">
    <section v-if="open" ref="tray" class="map-ui map-tray" role="region" :aria-label="title" tabindex="-1">
      <header class="map-tray-header">
        <div class="map-tray-heading"><slot name="header"><h1>{{ title }}</h1></slot></div>
        <button type="button" class="map-ui-button map-tray-close" :aria-label="`Close ${title}`" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      <div ref="content" class="map-tray-content" :class="{ 'map-tray-content-fixed': !scrollable }" @scroll="$emit('scroll', $event)">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="map-tray-footer"><slot name="footer" /></footer>
    </section>
  </TrayTransition>
</template>

<script setup>
import { ref, h, Transition } from 'vue';
const props = defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, required: true },
  scrollable: { type: Boolean, default: true },
  animate: { type: Boolean, default: true },
});
defineEmits(['close', 'scroll']);
const tray = ref(null);
const content = ref(null);
// Submit supplies the transition around keyed steps. Render its tray directly
// so an inner Transition cannot replace the parent's enter/leave hooks.
function TrayTransition(props, { slots }) {
  return props.animate
    ? h(Transition, { name: 'map-tray', appear: true, onAfterEnter: focusTray }, slots)
    : slots.default?.()[0];
}
TrayTransition.props = { animate: Boolean };
function focusTray() {
  // Preserve intentional focus in search/menu during the opening transition.
  if (!tray.value?.contains(document.activeElement)
    && !document.activeElement?.closest('.map-search-overlay, [role="menu"]')) tray.value?.focus({ preventScroll: true });
}
defineExpose({ content, element: tray });
</script>
