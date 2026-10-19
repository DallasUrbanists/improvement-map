<template>
  <Teleport to="body">
    <dialog ref="dialog" class="map-ui detail-sheet" :aria-labelledby="titleId" @cancel.prevent="close" @keydown.esc.stop.prevent="close" @click="backdrop" @close="closed">
      <header class="map-tray-header">
        <div class="map-tray-heading"><h2 :id="titleId">{{ title }}</h2></div>
        <button type="button" class="map-ui-button map-tray-close" :aria-label="`Close ${title}`" autofocus @click="close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <div class="detail-sheet-content"><slot v-if="modelValue" /></div>
      <footer v-if="$slots.footer" class="detail-sheet-footer"><slot name="footer" /></footer>
    </dialog>
  </Teleport>
</template>
<script setup>
import { ref, watch, nextTick, useId, onBeforeUnmount } from 'vue';
const props = defineProps({ modelValue: Boolean, title: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const dialog = ref(null), titleId = useId();
let opener;
watch(() => props.modelValue, async value => {
  if (value) {
    opener = document.activeElement;
    await nextTick();
    if (props.modelValue && dialog.value && !dialog.value.open) dialog.value.showModal();
  } else dialog.value?.close();
}, { immediate: true });
function close() { emit('update:modelValue', false); }
function closed() { close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); }
function backdrop(event) {
  if (event.target !== dialog.value) return;
  const r = dialog.value.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
}
onBeforeUnmount(() => dialog.value?.close());
</script>
