<template>
  <div ref="root" class="map-search-overlay absolute top-3 left-3 right-3 z-30"
    :data-suggestions-open="expanded && hasSuggestions" @focusout="onFocusOut" @keydown.esc="onEscape">
    <div class="map-search-shell" :class="{ 'is-expanded': expanded }">
      <button type="button" class="map-ui map-search-launch" :aria-hidden="expanded" :tabindex="expanded ? -1 : 0"
        aria-label="Search address or neighborhood" :aria-expanded="expanded" @click="openSearch">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      </button>
      <div class="map-search-content" :inert="!expanded" :aria-hidden="!expanded" @focusin="open = true">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref } from 'vue';
const props = defineProps({
  query: { type: String, default: '' },
  hasSuggestions: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
});
const root = ref(null);
const open = ref(false);
const expanded = computed(() => props.readOnly || open.value || Boolean(props.query.trim()));
let blurFrame;
async function openSearch() {
  open.value = true;
  await nextTick();
  root.value?.querySelector('input')?.focus();
}
function onFocusOut() {
  cancelAnimationFrame(blurFrame);
  blurFrame = requestAnimationFrame(() => {
    if (!root.value?.contains(document.activeElement)) open.value = false;
  });
}
function onEscape(event) {
  if (props.query.trim()) return;
  event.target.blur();
  open.value = false;
}
onDeactivated(() => { open.value = false; });
onBeforeUnmount(() => cancelAnimationFrame(blurFrame));
</script>
