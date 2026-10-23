<template>
  <TrayTransition :animate="animate">
    <section v-if="open" ref="tray" class="map-ui map-tray" role="region" :aria-label="title" :aria-busy="contentDisabled" tabindex="-1">
      <slot name="handle" />
      <header class="map-tray-header">
        <div class="map-tray-heading"><slot name="header"><h1>{{ title }}</h1></slot></div>
        <slot name="header-actions" />
        <MapControlButton class="map-tray-close" data-tooltip="Close" :aria-label="`Close ${title}`" :disabled="closeDisabled" @click="$emit('close')">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </MapControlButton>
      </header>
      <div v-if="$slots.controls" class="map-tray-controls"><slot name="controls" /></div>
      <div ref="content" class="map-tray-content" :class="{ 'map-tray-content-fixed': !scrollable }" :tabindex="scrollable && !contentDisabled ? 0 : undefined" :inert="contentDisabled" @scroll="$emit('scroll', $event)">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="map-tray-footer"><slot name="footer" /></footer>
    </section>
  </TrayTransition>
</template>

<script setup>
import { ref, h, Transition } from 'vue';
import MapControlButton from './MapControlButton.vue';
const props = defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, required: true },
  scrollable: { type: Boolean, default: true },
  animate: { type: Boolean, default: true },
  closeDisabled: { type: Boolean, default: false },
  contentDisabled: { type: Boolean, default: false },
});
defineEmits(['close', 'scroll']);
const tray = ref(null);
const content = ref(null);
// Submit supplies the transition around keyed steps. Render its tray directly
// so an inner Transition cannot replace the parent's enter/leave hooks.
function TrayTransition(props, { slots }) {
  return props.animate
    ? h(Transition, { name: 'map-tray', appear: true, onAfterEnter: focusTray, onBeforeLeave: hideLeavingTray }, slots)
    : slots.default?.()[0];
}
TrayTransition.props = { animate: Boolean };
function hideLeavingTray(element) {
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}
function focusTray() {
  if (tray.value) { tray.value.inert = false; tray.value.removeAttribute('aria-hidden'); }
  // Preserve intentional focus in search/menu during the opening transition.
  if (!tray.value?.contains(document.activeElement)
    && !document.activeElement?.closest('.map-search-overlay, [role="menu"]')) tray.value?.focus({ preventScroll: true });
}
defineExpose({ content, element: tray });
</script>
