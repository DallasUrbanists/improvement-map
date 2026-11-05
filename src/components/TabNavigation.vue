<template>
  <div
    ref="root"
    class="tab-navigation"
    :data-theme="theme"
    :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel"
    :style="{
      '--tab-navigation-active-surface': activeSurface,
      '--tab-navigation-background': activeSurface,
      '--tab-navigation-foreground': theme === 'light' ? '#000000' : '#ffffff',
    }"
    @keydown="onKeydown"
  >
    <Tabbar
      class="tab-navigation__toolbar"
      role="tablist"
      aria-label="Sections"
      :theme="theme"
      variant="neutral"
      button-type="text"
      :surface-level="surfaceLevel"
      :buttons="toolbarButtons"
      :selected-index="selectedIndex"
      @button-click="selectTab($event.index)"
    />
    <ContainedSection
      v-if="tabs[selectedIndex]"
      :key="tabs[selectedIndex].id || selectedIndex"
      :id="panelId(selectedIndex)"
      class="tab-navigation__section tab-navigation__section--active"
      :theme="theme"
      :surface-level="surfaceLevel"
      :padded="padded"
      role="tabpanel"
      tabindex="0"
      :aria-labelledby="tabId(selectedIndex)"
    >
      <slot name="section" :tab="tabs[selectedIndex]" :selected-index="selectedIndex">
        <div v-html="tabs[selectedIndex].content || ''"></div>
      </slot>
    </ContainedSection>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import ContainedSection from './ContainedSection.vue';
import Tabbar from './Tabbar.vue';
import { surfaceColors } from '../design/surfaceColors.js';

/** Surface-aware tab strip and selected content section; a section slot can render interactive content. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Neutral surface depth for the selected tab, section and root background. Null makes the surfaces transparent. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Tabs accept id, label and HTML content. */
  tabs: { type: Array, default: () => [] },
  /** Whether the selected Contained Section adds interior padding. */
  padded: { type: Boolean, default: true },
});
const selectedIndex = defineModel('selectedIndex', { type: Number, default: 0 });
const emit = defineEmits(['tab-change']);
const root = ref(null);

const activeSurface = computed(() => props.surfaceLevel === null
  ? 'transparent'
  : surfaceColors[props.theme]?.neutral[`level${props.surfaceLevel}`] || surfaceColors.light.neutral.level1);
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
  position: relative;
  isolation: isolate;
  background: var(--tab-navigation-background);
  color: var(--tab-navigation-foreground);
}
.tab-navigation::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: var(--tab-navigation-background);
  content: '';
  filter: brightness(0.5);
}
.tab-navigation :deep(.tabbar.tab-navigation__toolbar) {
  border-bottom: 1px solid var(--tabbar-border);
}
.tab-navigation :deep(.tabbar.tab-navigation__toolbar .map-ui-button[data-tabbar-selected="true"]) {
  position: relative;
  z-index: 2;
  border-bottom: 0;
}
.tab-navigation :deep(.tabbar.tab-navigation__toolbar .map-ui-button[data-tabbar-selected="true"]::after) {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--tabbar-background);
  content: '';
}
</style>
