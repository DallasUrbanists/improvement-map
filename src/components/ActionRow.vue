<template>
  <article class="action-row" :class="{ 'action-row--hidden': hidden }" :data-theme="theme" :data-action-key="action.key" :style="colors">
    <button class="action-row-open" type="button" :aria-labelledby="summaryId" aria-haspopup="dialog" @click="openDetails" />
    <span :id="summaryId" class="action-row-summary">{{ hidden ? '(Hidden action) ' : '' }}{{ action.summary }}</span>
    <MapControlButton v-if="!hidden" class="idea-bookmark action-row-control" :aria-label="saved ? 'Unsave' : 'Save'" :data-tooltip="saved ? 'Unsave' : 'Save'" :pressed="saved" :aria-describedby="summaryId" @click="$emit('save', $event)">
      <i :class="[saved ? 'fa-solid' : 'fa-regular', 'fa-bookmark']" aria-hidden="true"></i>
    </MapControlButton>
    <MapControlButton class="idea-bookmark action-row-control" :aria-label="hidden ? 'Unhide' : 'Hide'" :data-tooltip="hidden ? 'Unhide' : 'Hide'" :aria-describedby="summaryId" @click="$emit('hide', $event)">
      <i class="fa-solid" :class="hidden ? 'fa-eye' : 'fa-eye-slash'" aria-hidden="true"></i>
    </MapControlButton>
    <DetailSheet v-model="detailsOpen" title="Action details">
      <div class="actions-panel">
        <h3 class="font-semibold">{{ action.summary }}</h3>
        <p v-if="action.description" class="whitespace-pre-line">{{ action.description }}</p>
        <p v-if="action.expirationDate" class="secondary-copy">{{ expired ? 'Expired' : 'Expires' }} {{ expiration }}</p>
        <p v-if="action.instructions" class="whitespace-pre-line">{{ action.instructions }}</p>
        <a v-if="source" :href="source" target="_blank" rel="noopener noreferrer" class="action-button action-primary">View source ↗</a>
        <p v-if="action.reason"><strong>Why:</strong> {{ action.reason }}</p>
        <p v-if="action.status">Status: {{ action.status }}</p>
      </div>
    </DetailSheet>
  </article>
</template>
<script setup>
import { computed, ref, useId } from 'vue';
import MapControlButton from './MapControlButton.vue';
import DetailSheet from './DetailSheet.vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';

/** Full-summary action row with independent controls and a details dialog. */
const props = defineProps({
  action: { type: Object, required: true },
  saved: Boolean,
  hidden: Boolean,
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
});
defineEmits(['save', 'hide']);
const summaryId = `action-summary-${useId()}`;
const detailsOpen = ref(false);
const colors = computed(() => {
  const palette = (buttonColors[props.theme] || buttonColors.light).neutralByLevel[props.surfaceLevel ?? 1];
  const activeBackground = props.surfaceLevel === null ? 'transparent' : surfaceColors[props.theme]?.active[`level${props.surfaceLevel}`] || surfaceColors.light.active.level1;
  return {
    '--action-row-background': props.saved && !props.hidden ? activeBackground : props.surfaceLevel === null ? 'transparent' : palette.background,
    '--action-row-foreground': palette.foreground,
    '--action-row-border': palette.border,
    '--action-row-hover': palette.hover,
    '--action-row-focus': palette.focus,
    '--action-row-opacity': props.hidden ? 0.5 : 1,
  };
});
function openDetails(event) {
  event.currentTarget.focus({ preventScroll: true });
  detailsOpen.value = true;
}
const expired = computed(() => Date.parse(props.action.expirationDate) < Date.now());
const expiration = computed(() => new Date(props.action.expirationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
const source = computed(() => { try { const url = new URL(props.action.sourceUrl); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } });
</script>
<style scoped>
.action-row {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--action-row-border);
  background: var(--action-row-background);
  color: var(--action-row-foreground);
  opacity: var(--action-row-opacity);
  transition: opacity 180ms ease, background-color 180ms ease;
  white-space: normal;
}
.action-row-open { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; cursor: pointer; }
.action-row-open:hover { background: var(--action-row-hover); }
.action-row-open:focus-visible { outline: 2px solid var(--action-row-focus); outline-offset: -2px; }
.action-row-summary { position: relative; flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; pointer-events: none; }
.action-row--hidden .action-row-summary { font-style: italic; }
.action-row-control { position: relative; flex-shrink: 0; font-size: 16px; }
.action-row-control::after { position: absolute; right: 0; bottom: calc(100% + 4px); z-index: 4; width: max-content; padding: 4px 8px; background: var(--action-row-background); color: var(--action-row-foreground); border: 1px solid var(--action-row-border); border-radius: 4px; content: attr(data-tooltip); font-size: 12px; line-height: 16px; opacity: 0; pointer-events: none; }
.action-row-control:hover::after, .action-row-control:focus-visible::after { opacity: 1; }
</style>
