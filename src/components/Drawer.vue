<template>
  <div class="drawer-layer" :class="{ 'drawer-layer--open': open, 'drawer-layer--dragging': dragging }">
    <div class="drawer-backdrop" aria-hidden="true"></div>
    <div class="drawer-shell" :class="[`drawer-shell--from-${side}`, { 'drawer-shell--dragging': dragging }]" :style="drawerStyle">
      <aside ref="drawerElement" class="drawer" :data-theme="theme" :data-open="open" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" aria-label="Drawer">
        <div class="drawer__content" :inert="!open && !dragging">
          <slot />
        </div>
      </aside>
      <button
        v-if="(open && canDragClose) || (!open && canDragOpen)"
        class="drawer__handle"
        type="button"
        :aria-label="open ? 'Close drawer' : 'Open drawer'"
        :aria-expanded="open"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @click="toggleFromClick"
      ><span class="drawer__grip" :class="{ 'drawer__grip--dark': theme === 'light' && !open && canDragOpen }" aria-hidden="true"></span></button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** Full-height panel that enters from the selected viewport edge. */
const props = defineProps({
  side: { type: String, default: 'left', validator: value => ['left', 'right'].includes(value) },
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  canDragClose: Boolean,
  canDragOpen: Boolean,
});
const open = defineModel('open', { type: Boolean, default: true });
const surface = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 1] || buttonColors.light.neutralByLevel[1];
  return props.surfaceLevel === null ? { ...palette, background: 'transparent' } : palette;
});
const drawerElement = ref(null);
const dragging = ref(false);
const dragOffset = ref(null);
let dragStart = null;
let suppressNextClick = false;
const flickVelocity = 0.45;
const travel = () => Math.max(0, drawerElement.value?.getBoundingClientRect().width || 0);
const drawerStyle = computed(() => {
  if (dragOffset.value === null) {
    if (open.value) return { transform: 'translateX(0px)' };
    return { transform: props.side === 'left' ? 'translateX(-100%)' : 'translateX(100%)' };
  }
  const translation = props.side === 'left' ? -dragOffset.value : dragOffset.value;
  return { transform: `translateX(${translation}px)` };
});

watch(open, () => { if (!dragging.value) dragOffset.value = null; });

function towardClosed(delta) { return props.side === 'left' ? -delta : delta; }
function clampOffset(value) { return Math.min(travel(), Math.max(0, value)); }

function startDrag(event) {
  const allowed = open.value ? props.canDragClose : props.canDragOpen;
  if (!allowed) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  dragging.value = true;
  dragStart = {
    x: event.clientX,
    time: event.timeStamp,
    offset: open.value ? 0 : travel(),
    lastX: event.clientX,
    lastTime: event.timeStamp,
    velocity: 0,
    moved: false,
  };
  dragOffset.value = dragStart.offset;
}

function moveDrag(event) {
  if (!dragging.value || !dragStart) return;
  const delta = event.clientX - dragStart.x;
  dragOffset.value = clampOffset(dragStart.offset + towardClosed(delta));
  dragStart.moved ||= Math.abs(delta) > 4;
  const elapsed = event.timeStamp - dragStart.lastTime;
  if (elapsed > 0) dragStart.velocity = towardClosed(event.clientX - dragStart.lastX) / elapsed;
  dragStart.lastX = event.clientX;
  dragStart.lastTime = event.timeStamp;
}

function endDrag(event) {
  if (!dragging.value || !dragStart) return;
  const delta = event.clientX - dragStart.lastX;
  const elapsed = event.timeStamp - dragStart.lastTime;
  if (elapsed > 0) {
    dragStart.velocity = towardClosed(delta) / elapsed;
    dragOffset.value = clampOffset((dragOffset.value ?? dragStart.offset) + towardClosed(delta));
  }
  const position = dragOffset.value ?? dragStart.offset;
  const velocity = dragStart.velocity;
  const moved = dragStart.moved;
  dragging.value = false;
  dragOffset.value = null;
  dragStart = null;
  suppressNextClick = event.type === 'pointerup' && moved;
  let shouldClose = position > travel() / 2;
  if (Math.abs(velocity) >= flickVelocity) shouldClose = velocity > 0;
  if (shouldClose && props.canDragClose) open.value = false;
  else if (!shouldClose && props.canDragOpen) open.value = true;
  if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
}

function toggleFromClick() {
  if (suppressNextClick) { suppressNextClick = false; return; }
  if (open.value && props.canDragClose) open.value = false;
  else if (!open.value && props.canDragOpen) open.value = true;
}
</script>

<style scoped>
.drawer-shell {
  position: absolute;
  z-index: 2;
  inset-block: 0;
  width: min(320px, 85vw);
  transition: transform 220ms ease-out;
}
.drawer-shell--dragging { transition: none; }
.drawer-layer {
  position: fixed;
  z-index: 1;
  inset: 0;
  pointer-events: none;
}
.drawer-backdrop {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: rgb(0 0 0 / 36%);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 220ms ease-out;
}
.drawer-layer--open .drawer-backdrop { opacity: 1; }
.drawer-shell, .drawer__handle { pointer-events: auto; }
.drawer {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: v-bind('surface.background');
  color: v-bind('surface.foreground');
  box-shadow: 0 3px 16px #00000040;
}
.drawer__content { min-height: 100%; }
.drawer__handle {
  position: absolute;
  z-index: 2;
  inset-block: 0;
  width: 12px;
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
.drawer__handle:active { cursor: grabbing; }
.drawer__grip {
  width: 6px;
  height: 50%;
  border-radius: 999px;
  background: #fff;
  opacity: .5;
  transition: opacity 140ms ease-out;
}
.drawer__grip--dark { background: #000; }
.drawer__handle:hover .drawer__grip { opacity: .8; }
.drawer-shell--dragging .drawer__handle .drawer__grip { opacity: 1; }
.drawer-shell--from-left { left: 0; }
.drawer-shell--from-right { right: 0; }
.drawer-shell--from-left .drawer { border-inline-end: 1px solid v-bind('surface.border'); }
.drawer-shell--from-right .drawer { border-inline-start: 1px solid v-bind('surface.border'); }
.drawer-shell--from-left .drawer__handle { left: 100%; }
.drawer-shell--from-right .drawer__handle { right: 100%; }
@media (prefers-reduced-motion: reduce) {
  .drawer-shell, .drawer-backdrop, .drawer__grip { transition: none; }
}
</style>
