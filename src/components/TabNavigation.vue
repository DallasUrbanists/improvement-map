<template>
  <div
    ref="root"
    class="tab-navigation"
    :data-theme="theme"
    :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel"
    :style="{ '--tab-navigation-active-surface': activeSurface }"
    @keydown="onKeydown"
  >
    <Toolbar
      class="tab-navigation__toolbar"
      role="tablist"
      aria-label="Sections"
      :theme="theme"
      variant="neutral"
      button-type="text"
      :surface-level="surfaceLevel"
      :buttons="toolbarButtons"
      @button-click="selectTab($event.index)"
    />
    <ContainedSection
      v-if="tabs[selectedIndex]"
      :key="tabs[selectedIndex].id || selectedIndex"
      :id="panelId(selectedIndex)"
      class="tab-navigation__section tab-navigation__section--active"
      :theme="theme"
      :surface-level="surfaceLevel"
      :padded="tabs[selectedIndex].padded !== false"
      :content="tabs[selectedIndex].content || ''"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="tabId(selectedIndex)"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ContainedSection from './ContainedSection.vue';
import Toolbar from './Toolbar.vue';
import { surfaceColors } from '../design/surfaceColors.js';

/** Surface-aware tab strip and its selected content section. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Surface depth for the active tab and selected section; null makes them transparent. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Tabs accept id, label, HTML content and optional padded. */
  tabs: { type: Array, default: () => [] },
});
const selectedIndex = defineModel('selectedIndex', { type: Number, default: 0 });
const emit = defineEmits(['tab-change']);
const root = ref(null);

const activeSurface = computed(() => props.surfaceLevel === null
  ? 'transparent'
  : surfaceColors[props.theme]?.active[`level${props.surfaceLevel}`] || surfaceColors.light.active.level1);

const toolbarButtons = computed(() => props.tabs.map((tab, index) => ({
  ...tab,
  icon: '',
  label: tab.label || `Tab ${index + 1}`,
  id: tabId(index),
  controls: panelId(index),
  role: 'tab',
  isActive: index === selectedIndex.value,
})));

function tabId(index) { return `tab-navigation-tab-${index}`; }
function panelId(index) { return `tab-navigation-panel-${index}`; }

function selectTab(index) {
  if (index < 0 || index >= props.tabs.length || index === selectedIndex.value) return;
  selectedIndex.value = index;
  emit('tab-change', { tab: props.tabs[index], index });
}

function onKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || props.tabs.length === 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? props.tabs.length - 1
      : (selectedIndex.value + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length;
  selectTab(next);
  root.value?.querySelector(`#${tabId(next)}`)?.focus();
}
</script>

<style scoped>
.tab-navigation {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}
.tab-navigation :deep(.toolbar.tab-navigation__toolbar) {
  min-height: 48px;
  background-color: transparent;
  border-bottom: 0;
}
.tab-navigation :deep(.map-ui-button[role="tab"][aria-selected="true"]) {
  background: var(--tab-navigation-active-surface);
}
.tab-navigation :deep(.map-ui-button[role="tab"][aria-selected="true"]:hover:not(:disabled)),
.tab-navigation :deep(.map-ui-button[role="tab"][aria-selected="true"]:active:not(:disabled)) {
  background: var(--tab-navigation-active-surface);
}
.tab-navigation :deep(.tab-navigation__section--active) {
  background: var(--tab-navigation-active-surface);
}
</style>
