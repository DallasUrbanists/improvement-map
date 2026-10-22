<template>
  <div ref="frameHost" class="presentation-photo-frame" :class="{ 'is-interactive': interactive && !streetmix }"
    :style="frameStyle" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
    @pointercancel="finishPointer" @lostpointercapture="finishPointer" @wheel.prevent="onWheel"
    :aria-label="streetmix ? 'Streetmix design, fixed framing' : 'Presentation photo'">
    <img v-if="src" :key="src" :src="src" :alt="alt" class="presentation-photo-image" :class="{ 'is-animated': animateFrame }" :style="imageStyle"
      @load="onImageLoad" @error="onImageError" draggable="false" />
    <div v-if="imageFailed" class="presentation-media-error map-ui" role="status">The selected image is unavailable.</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { clampPhotoFrame, DEFAULT_PHOTO_FRAME, isStreetmixItem } from '../services/presentationState.js';

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  frame: { type: Object, default: () => ({ ...DEFAULT_PHOTO_FRAME }) },
  interactive: { type: Boolean, default: false },
  animateFrame: { type: Boolean, default: false },
  item: { type: Object, default: null },
  aspectRatio: { type: Number, default: 16 / 9 },
});
const emit = defineEmits(['frame', 'status', 'swipe']);
const frameHost = ref(null);
const bounds = ref({ width: 0, height: 0 });
const naturalSize = ref({ width: 0, height: 0 });
const imageFailed = ref(false);
const pointers = new Map();
let pinchStartDistance = 0;
let pinchStartScale = 1;
let lastMultiPointerCenter = null;
let resizeObserver;
const activePointerIds = new Set();
const streetmix = computed(() => isStreetmixItem(props.item));
const currentFrame = computed(() => streetmix.value ? { ...DEFAULT_PHOTO_FRAME } : clampPhotoFrame(props.frame));
const frameStyle = computed(() => ({ aspectRatio: String(props.aspectRatio || 16 / 9) }));
const imageStyle = computed(() => {
  const { width: boxWidth, height: boxHeight } = bounds.value;
  const { width: sourceWidth, height: sourceHeight } = naturalSize.value;
  if (!boxWidth || !boxHeight || !sourceWidth || !sourceHeight) return {};
  const contain = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * contain * currentFrame.value.scale;
  const height = sourceHeight * contain * currentFrame.value.scale;
  const left = width >= boxWidth ? -(width - boxWidth) * currentFrame.value.centerX : (boxWidth - width) / 2;
  const top = height >= boxHeight ? -(height - boxHeight) * currentFrame.value.centerY : (boxHeight - height) / 2;
  return { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` };
});

function measure() {
  if (!frameHost.value) return;
  const rect = frameHost.value.getBoundingClientRect();
  bounds.value = { width: rect.width, height: rect.height };
}
function onImageLoad(event) {
  naturalSize.value = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
  imageFailed.value = false;
  measure();
  emit('status', 'ready', null);
}
function onImageError() {
  imageFailed.value = true;
  emit('status', 'error', 'IMAGE_UNAVAILABLE');
}
function onPointerDown(event) {
  if (!props.interactive || streetmix.value || !props.src) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
  activePointerIds.add(event.pointerId);
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Gesture may have been cancelled during navigation. */ }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStartDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    pinchStartScale = currentFrame.value.scale;
    lastMultiPointerCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
}
function updateFrame(frame) {
  if (!props.interactive || streetmix.value) return;
  emit('frame', clampPhotoFrame(frame));
}
function onPointerMove(event) {
  const previous = pointers.get(event.pointerId);
  if (!previous || !props.interactive || streetmix.value) return;
  const point = { ...previous, x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, point);
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const frame = { ...currentFrame.value };
    if (pinchStartDistance) frame.scale = pinchStartScale * distance / pinchStartDistance;
    if (lastMultiPointerCenter) {
      const { width, height } = bounds.value;
      const { width: sourceWidth, height: sourceHeight } = naturalSize.value;
      const fitScale = width && height && sourceWidth && sourceHeight
        ? Math.min(width / sourceWidth, height / sourceHeight) * frame.scale : 0;
      const overflowX = Math.max(0, sourceWidth * fitScale - width);
      const overflowY = Math.max(0, sourceHeight * fitScale - height);
      if (overflowX) frame.centerX -= (center.x - lastMultiPointerCenter.x) / overflowX;
      if (overflowY) frame.centerY -= (center.y - lastMultiPointerCenter.y) / overflowY;
    }
    updateFrame(frame);
    lastMultiPointerCenter = center;
    return;
  }
}
function removePointer(event) {
  if (!pointers.has(event.pointerId)) return;
  pointers.delete(event.pointerId);
  activePointerIds.delete(event.pointerId);
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Captures can be released by the browser first. */ }
  }
  if (pointers.size < 2) {
    pinchStartDistance = 0;
    lastMultiPointerCenter = null;
  }
}
function onPointerUp(event) {
  const point = pointers.get(event.pointerId);
  if (point && pointers.size === 1 && Math.abs(event.clientX - point.startX) >= 55
    && Math.abs(event.clientX - point.startX) > Math.abs(event.clientY - point.startY)) {
    emit('swipe', event.clientX < point.startX ? 'left' : 'right');
  }
  removePointer(event);
}
function finishPointer(event) {
  removePointer(event);
}
function onWheel(event) {
  if (!props.interactive || streetmix.value || !props.src) return;
  updateFrame({ ...currentFrame.value, scale: currentFrame.value.scale * Math.exp(-event.deltaY * 0.002) });
}
watch(() => props.src, () => { imageFailed.value = false; naturalSize.value = { width: 0, height: 0 }; pointers.clear(); pinchStartDistance = 0; lastMultiPointerCenter = null; measure(); });
watch(() => props.interactive, enabled => { if (!enabled) pointers.clear(); });
onMounted(() => {
  measure();
  resizeObserver = new ResizeObserver(measure);
  if (frameHost.value) resizeObserver.observe(frameHost.value);
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  for (const id of activePointerIds) {
    try { if (frameHost.value?.hasPointerCapture(id)) frameHost.value.releasePointerCapture(id); } catch { /* Ignore a removed pointer target. */ }
  }
  activePointerIds.clear();
  pointers.clear();
});
</script>

<style scoped>
.presentation-photo-frame { position: relative; width: 100%; height: 100%; min-height: 0; display: grid; place-items: center; overflow: hidden; background: var(--presentation-bg, #f5f3ee); touch-action: pan-y; }
.presentation-photo-frame.is-interactive { touch-action: none; cursor: grab; }
.presentation-photo-image { position: absolute; max-width: none; max-height: none; object-fit: fill; user-select: none; -webkit-user-drag: none; }
.presentation-photo-image.is-animated { transition: left 320ms ease, top 320ms ease, width 320ms ease, height 320ms ease; }
.presentation-media-error { position: absolute; inset: auto 1rem 1rem; z-index: 2; padding: .75rem; text-align: center; }
</style>
