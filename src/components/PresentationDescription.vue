<template>
  <div ref="preview" class="remote-description-preview" aria-live="polite">
    <div ref="content" class="remote-description-content">
    <h2 v-if="title">{{ title }}</h2>
      <p>{{ text }}</p>
    </div>
  </div>
</template>
<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ title: { type: String, default: '' }, text: { type: String, default: '' } });
const preview = ref(null);
const content = ref(null);
let resizeObserver = null;

function fitPreviewText() {
  if (!preview.value || !content.value) return;
  const style = getComputedStyle(preview.value);
  const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const availableWidth = preview.value.clientWidth - horizontalPadding;
  const availableHeight = preview.value.clientHeight - verticalPadding;
  if (availableWidth <= 0 || availableHeight <= 0) return;
  const scale = Math.min(1, availableWidth / content.value.scrollWidth, availableHeight / content.value.scrollHeight);
  content.value.style.setProperty('--description-preview-scale', String(scale));
}

watch(() => [props.title, props.text], () => nextTick(fitPreviewText));
onMounted(() => {
  resizeObserver = new ResizeObserver(fitPreviewText);
  resizeObserver.observe(preview.value);
  resizeObserver.observe(content.value);
  fitPreviewText();
});
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>
