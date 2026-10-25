<template>
  <div class="tray-layer" :class="{ 'tray-layer--open': open, 'tray-layer--dragging': dragging }" :data-position="positionName">
    <div class="tray-shell" :class="{ 'tray-shell--dragging': dragging, 'tray-shell--closed': !open }" :style="trayStyle">
      <aside ref="trayElement" class="tray" :class="panelClass" :data-theme="theme" :data-open="open" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :aria-label="label" :aria-busy="busy || undefined" :inert="!open && !dragging">
        <div ref="contentElement" class="tray__content">
          <slot />
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
      ><span class="tray__grip" :class="{ 'tray__grip--dark': theme === 'light' && !open && canDragOpen }" aria-hidden="true"></span></button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
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
const open = defineModel('open', { type: Boolean, default: true });
const maximize = defineModel('maximize', { type: Boolean, default: false });
const surface = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 1] || buttonColors.light.neutralByLevel[1];
  return props.surfaceLevel === null ? { ...palette, background: 'transparent' } : palette;
});
const trayElement = ref(null);
const contentElement = ref(null);
const dragging = ref(false);
const dragOffset = ref(null);
let dragStart = null;
let suppressNextClick = false;
const travel = () => Math.max(1, trayElement.value?.offsetHeight || props.maxHeight);
const mediumOffset = () => Math.max(0, travel() - Math.min(props.mediumHeight, travel()));
const stateRank = () => !open.value ? 0 : maximize.value ? 2 : 1;
const offsetForRank = rank => rank === 0 ? travel() : rank === 1 ? mediumOffset() : 0;
const positionName = computed(() => !open.value ? 'closed' : maximize.value ? 'max' : 'medium');
const showHandle = computed(() => !open.value
  ? props.canDragOpen
  : props.canDragClose || (!maximize.value && props.canDragOpen));
const trayStyle = computed(() => {
  return {
    '--tray-max-height': `${Math.max(1, props.maxHeight)}px`,
    transform: `translateY(${dragOffset.value ?? offsetForRank(stateRank())}px)`,
  };
});

watch([open, maximize, () => props.mediumHeight, () => props.maxHeight], () => {
  if (!dragging.value) dragOffset.value = null;
});

function allowedRanks(startRank) {
  return [0, 1, 2].filter(rank => rank === startRank
    || (rank > startRank && props.canDragOpen)
    || (rank < startRank && props.canDragClose));
}

function clampOffset(value, startRank) {
  const offsets = allowedRanks(startRank).map(offsetForRank);
  return Math.min(Math.max(...offsets), Math.max(Math.min(...offsets), value));
}

function setPosition(rank) {
  open.value = rank > 0;
  maximize.value = rank === 2;
}

function handleWheel(event) {
  if (!open.value || props.busy || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  if (!maximize.value && props.canDragOpen && event.deltaY > 0) {
    event.preventDefault();
    setPosition(2);
  } else if (maximize.value && props.canDragClose && event.deltaY < 0 && (trayElement.value?.scrollTop ?? 0) <= 0) {
    event.preventDefault();
    setPosition(1);
  }
}

onMounted(() => trayElement.value?.addEventListener('wheel', handleWheel, { capture: true, passive: false }));
onBeforeUnmount(() => trayElement.value?.removeEventListener('wheel', handleWheel, true));

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
  if (open.value && props.toggleMaximizeOnClick) { maximize.value = !maximize.value; return; }
  if (open.value && props.canDragClose) setPosition(0);
  else if (!open.value && props.canDragOpen) setPosition(maximize.value ? 2 : 1);
}

defineExpose({ element: trayElement, content: trayElement, contentElement });
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
  height: var(--tray-max-height);
  max-height: var(--tray-max-height);
  transition: transform 220ms ease-out;
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
  overflow: auto;
  background: v-bind('surface.background');
  color: v-bind('surface.foreground');
  border-radius: 8px 8px 0 0;
  border-top: 1px solid v-bind('surface.border');
  box-shadow: 0 -3px 16px #00000040;
}
.tray__content { min-height: 100%; }
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
  opacity: .5;
  transition: opacity 140ms ease-out;
}
.tray__grip--dark { background: #000; }
.tray__handle:hover .tray__grip { opacity: .8; }
.tray-shell--dragging .tray__handle .tray__grip { opacity: 1; }
.tray-shell--closed .tray__handle { pointer-events: auto; }
@media (prefers-reduced-motion: reduce) {
  .tray-shell, .tray__grip { transition: none; }
}
</style>
