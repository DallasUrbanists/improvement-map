<template>
  <div class="tray-layer" :class="{ 'tray-layer--open': open, 'tray-layer--dragging': dragging }" :data-position="positionName" :data-scrollable="scrollable">
    <div class="tray-shell" :class="{ 'tray-shell--dragging': dragging, 'tray-shell--closed': !open }" :style="trayStyle">
      <aside ref="trayElement" class="tray" :class="panelClass" :data-theme="theme" :data-open="open" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :aria-label="label" :aria-busy="busy || undefined" :inert="!open && !dragging">
        <div ref="headElement" class="tray__head"><slot name="head" /></div>
        <div ref="contentElement" class="tray__body" @scroll="emit('scroll', $event)">
          <div ref="bodyContentElement" class="tray__body-content"><slot /></div>
        </div>
      </aside>
      <button
        v-if="showHandle"
        class="tray__handle"
        :class="handleClass"
        type="button"
        :aria-label="handleLabel || (open ? 'Close tray' : 'Open tray')"
        :aria-expanded="toggleMaximizeOnClick ? maximize : open"
        :disabled="busy"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @click="toggleFromClick"
      ><span class="tray__grip" :class="{ 'tray__grip--dark': theme === 'dark' }" aria-hidden="true"></span></button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** Full-width panel that slides up from the bottom edge. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  label: { type: String, default: 'Tray' },
  panelClass: { type: String, default: '' },
  handleClass: { type: String, default: '' },
  handleLabel: { type: String, default: '' },
  toggleMaximizeOnClick: Boolean,
  busy: Boolean,
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  canDragClose: Boolean,
  canDragOpen: Boolean,
  mediumHeight: { type: Number, default: 320 },
  maxHeight: { type: Number, default: 520 },
});
const emit = defineEmits(['scroll']);
const open = defineModel('open', { type: Boolean, default: true });
const maximize = defineModel('maximize', { type: Boolean, default: false });
const surface = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 1] || buttonColors.light.neutralByLevel[1];
  return props.surfaceLevel === null ? { ...palette, background: 'transparent' } : palette;
});
const trayElement = ref(null);
const contentElement = ref(null);
const bodyContentElement = ref(null);
const headElement = ref(null);
const naturalHeight = ref(0);
const scrollable = ref(false);
const viewportHeight = ref(typeof window === 'undefined' ? props.maxHeight : window.innerHeight);
const effectiveMaxHeight = computed(() => Math.min(props.maxHeight, viewportHeight.value));
const dragging = ref(false);
const dragOffset = ref(null);
let dragStart = null;
let suppressNextClick = false;
const travel = () => Math.max(1, trayElement.value?.offsetHeight || props.maxHeight);
const mediumOffset = () => scrollable.value ? Math.max(0, travel() - Math.min(props.mediumHeight, travel())) : 0;
const stateRank = () => !open.value ? 0 : maximize.value ? 2 : 1;
const offsetForRank = rank => rank === 0 ? travel() : rank === 1 ? mediumOffset() : 0;
const positionName = computed(() => !open.value ? 'closed' : maximize.value ? 'max' : 'medium');
const showHandle = computed(() => !open.value
  ? props.canDragOpen
  : props.canDragClose || (!maximize.value && props.canDragOpen));
const maxAllowed = computed(() => scrollable.value);
const trayStyle = computed(() => {
  return {
    '--tray-max-height': `${Math.max(1, effectiveMaxHeight.value)}px`,
    '--tray-height': `${scrollable.value ? Math.max(1, effectiveMaxHeight.value) : Math.min(Math.max(1, naturalHeight.value), Math.max(1, effectiveMaxHeight.value))}px`,
    transform: `translateY(${dragOffset.value ?? offsetForRank(stateRank())}px)`,
  };
});

let resizeObserver;
let mutationObserver;
let measureFrame = 0;
function measureContent() {
  cancelAnimationFrame(measureFrame);
  measureFrame = requestAnimationFrame(() => {
    updateContentMetrics();
  });
}
function updateContentMetrics() {
  const head = headElement.value;
  const body = contentElement.value;
  if (!head || !body) return;
  const headHeight = head.offsetHeight;
  const bodyHeight = bodyContentElement.value?.scrollHeight ?? body.scrollHeight;
  const topBorder = Number.parseFloat(getComputedStyle(trayElement.value).borderTopWidth) || 0;
  naturalHeight.value = headHeight + bodyHeight + topBorder;
  const mediumHeight = Math.min(props.mediumHeight, effectiveMaxHeight.value);
  scrollable.value = naturalHeight.value > mediumHeight + 1;
  if (!scrollable.value && maximize.value) maximize.value = false;
}
watch(() => [props.maxHeight, effectiveMaxHeight.value, props.mediumHeight], () => { measureContent(); dragOffset.value = null; });

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight;
  measureContent();
}

watch([open, maximize, () => props.mediumHeight, () => props.maxHeight], () => {
  if (!dragging.value) dragOffset.value = null;
});

function allowedRanks(startRank) {
  return [0, 1, ...(maxAllowed.value ? [2] : [])].filter(rank => rank === startRank
    || (rank > startRank && props.canDragOpen)
    || (rank < startRank && props.canDragClose));
}

function clampOffset(value, startRank) {
  const offsets = allowedRanks(startRank).map(offsetForRank);
  return Math.min(Math.max(...offsets), Math.max(Math.min(...offsets), value));
}

function setPosition(rank) {
  if (rank === 2 && !maxAllowed.value) rank = 1;
  open.value = rank > 0;
  maximize.value = rank === 2;
}

function handleWheel(event) {
  if (!open.value || props.busy || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  updateContentMetrics();
  if (scrollable.value && !maximize.value && props.canDragOpen && event.deltaY > 0) {
    event.preventDefault();
    setPosition(2);
  } else if (scrollable.value && maximize.value && props.canDragClose && event.deltaY < 0 && (contentElement.value?.scrollTop ?? 0) <= 0) {
    event.preventDefault();
    setPosition(1);
  }
}

onMounted(async () => {
  await nextTick();
  measureContent();
  trayElement.value?.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  window.addEventListener('resize', updateViewportHeight, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measureContent);
    for (const root of [headElement.value, bodyContentElement.value]) {
      if (!root) continue;
      resizeObserver.observe(root);
      root.querySelectorAll('*').forEach(element => resizeObserver.observe(element));
    }
  }
  if (typeof MutationObserver !== 'undefined' && bodyContentElement.value) {
    mutationObserver = new MutationObserver(() => {
      for (const root of [headElement.value, bodyContentElement.value]) {
        root?.querySelectorAll('*').forEach(element => resizeObserver?.observe(element));
      }
      measureContent();
    });
    mutationObserver.observe(bodyContentElement.value, { attributes: true, childList: true, subtree: true, characterData: true });
  }
});
onBeforeUnmount(() => {
  trayElement.value?.removeEventListener('wheel', handleWheel, true);
  window.removeEventListener('resize', updateViewportHeight);
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
  cancelAnimationFrame(measureFrame);
});

function startDrag(event) {
  const startRank = stateRank();
  if (!showHandle.value) return;
  event.preventDefault();
  try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* synthetic story events have no active pointer to capture */ }
  dragging.value = true;
  const startOffset = offsetForRank(startRank);
  dragStart = {
    y: event.clientY,
    offset: startOffset,
    startRank,
    samples: [{ y: event.clientY, time: event.timeStamp }],
    moved: false,
  };
  dragOffset.value = startOffset;
}

function moveDrag(event) {
  if (!dragging.value || !dragStart) return;
  const delta = event.clientY - dragStart.y;
  dragOffset.value = clampOffset(dragStart.offset + delta, dragStart.startRank);
  dragStart.moved ||= Math.abs(delta) > 4;
  dragStart.samples = dragStart.samples.filter(sample => event.timeStamp - sample.time <= 120);
  dragStart.samples.push({ y: event.clientY, time: event.timeStamp });
}

function endDrag(event) {
  if (!dragging.value || !dragStart) return;
  const samples = [...dragStart.samples.filter(sample => event.timeStamp - sample.time <= 120), { y: event.clientY, time: event.timeStamp }];
  const first = samples[0];
  const last = samples.at(-1);
  const distance = last.y - first.y;
  const duration = last.time - first.time;
  const flick = Math.abs(distance) >= 12 && duration >= 0 && Math.abs(distance) / Math.max(16, duration) >= 0.5;
  const startRank = dragStart.startRank;
  const moved = dragStart.moved;
  dragging.value = false;
  const finalOffset = dragOffset.value ?? dragStart.offset;
  dragOffset.value = null;
  dragStart = null;
  suppressNextClick = event.type === 'pointerup' && moved;
  const ranks = allowedRanks(startRank);
  let targetRank = startRank;
  if (flick) {
    const nextRank = Math.max(0, Math.min(2, startRank + (distance < 0 ? 1 : -1)));
    if (ranks.includes(nextRank)) targetRank = nextRank;
  } else {
    targetRank = ranks.reduce((nearest, rank) =>
      Math.abs(offsetForRank(rank) - finalOffset) < Math.abs(offsetForRank(nearest) - finalOffset) ? rank : nearest,
    ranks[0]);
  }
  setPosition(targetRank);
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}

function toggleFromClick() {
  if (suppressNextClick) { suppressNextClick = false; return; }
  if (open.value && props.toggleMaximizeOnClick && maxAllowed.value) { maximize.value = !maximize.value; return; }
  if (open.value && props.toggleMaximizeOnClick && !maxAllowed.value) { setPosition(0); return; }
  if (open.value && props.canDragClose) setPosition(0);
  else if (!open.value && props.canDragOpen) setPosition(maximize.value ? 2 : 1);
}

defineExpose({ element: trayElement, content: contentElement, contentElement, headElement });
</script>

<style scoped>
.tray-layer {
  position: fixed;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.tray-shell, .tray__handle { pointer-events: auto; }
.tray-shell {
  position: absolute;
  z-index: 2;
  inset-inline: 0;
  bottom: 0;
  height: var(--tray-height);
  max-height: var(--tray-max-height);
  transition: height 260ms cubic-bezier(.22, .61, .36, 1), transform 220ms ease-out;
  max-width: 1024px;
  margin-left: auto;
  margin-right: auto;
}
.tray-shell--dragging { transition: none; }
.tray-shell--closed, .tray-shell--closed .tray { pointer-events: none; }
.tray {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: v-bind('surface.background');
  color: v-bind('surface.foreground');
  border-radius: 8px 8px 0 0;
  border-top: 1px solid v-bind('surface.border');
  box-shadow: 0 -3px 16px #00000040;
}
.tray__head { position: sticky; top: 0; z-index: 1; flex: 0 0 auto; }
.tray__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: v-bind('surface.foreground') transparent; scrollbar-width: thin; }
.tray__body-content { flex: 0 0 auto; }
.tray__handle {
  position: absolute;
  z-index: 2;
  top: -12px;
  inset-inline: 0;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: v-bind('surface.foreground');
  cursor: grab;
  touch-action: none;
}
.tray__handle:active { cursor: grabbing; }
.tray__grip {
  width: 50%;
  height: 6px;
  border-radius: 999px;
  background: #fff;
  filter: invert(1);
  mix-blend-mode: difference;
  opacity: .5;
  transition: opacity 140ms ease-out;
}
.tray__grip--dark {
  filter: invert(0);
}
.tray__handle:hover .tray__grip { opacity: .8; }
.tray-shell--dragging .tray__handle .tray__grip { opacity: 1; }
.tray-shell--closed .tray__handle { pointer-events: auto; }
@media (prefers-reduced-motion: reduce) {
  .tray-shell, .tray__grip { transition: none; }
}
</style>
