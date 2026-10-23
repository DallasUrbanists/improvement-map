<template>
  <div class="address-bar" :data-mode="activeMode" :data-theme="theme" :style="colors" @focus.capture="onAddressFocus" @click.capture="onAddressFocus">
    <div class="address-bar__controls">
      <SquareIconButton
        class="address-bar__menu"
        :theme="theme"
        icon="bars"
        label="Menu"
        layout="floating"
        @click="$emit('menu-click')"
      />
      <TextWithInlineButton
        class="address-bar__address"
        :theme="theme"
        :variant="'neutral'"
        :placeholder="inputPlaceholder"
        :button-icon="actionIcon"
        :button-label="actionLabel"
        :layout="'floating'"
        :model-value="addressValue"
        :readonly="activeMode === 'viewing'"
        @update:model-value="updateAddress"
      />
    </div>
    <div v-if="activeMode === 'searching'" class="address-bar__results" role="list" aria-label="Address search results">
      <RowItem
        v-for="(result, index) in results"
        :key="result.id || `${result.label}-${index}`"
        role="listitem"
        :theme="theme"
        :label="result.label"
        :subtitle="result.subtitle"
        symbol-type="icon"
        icon="location-dot"
        :buttons="[{ icon: 'arrow-right', label: `Go to ${result.label}` }]"
        @button-click="$emit('select-result', result)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import SquareIconButton from './SquareIconButton.vue';
import TextWithInlineButton from './TextWithInlineButton.vue';
import RowItem from './RowItem.vue';
import { buttonColors } from '../design/buttonColors.js';

/** Floating address/search bar with browsing, searching, and read-only viewing modes. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  mode: { type: String, default: 'browsing', validator: value => ['browsing', 'searching', 'viewing'].includes(value) },
  /** Address text is kept in sync as the surrounding map navigates or the user searches. */
  modelValue: { type: String, default: '' },
  /** Search results rendered while searching. Each item accepts id, label, and subtitle. */
  results: { type: Array, default: () => [] },
  /** Optional replacement for the default searching hint. */
  placeholder: { type: String, default: 'Search address or place' },
});
const emit = defineEmits(['update:mode', 'mode-change', 'update:modelValue', 'menu-click', 'select-result']);
const activeMode = ref(props.mode);
const addressValue = ref(props.modelValue);
watch(() => props.mode, value => { activeMode.value = value; });
watch(() => props.modelValue, value => { addressValue.value = value; });
const inputPlaceholder = computed(() => activeMode.value === 'viewing' ? 'Current address' : props.placeholder);
const actionIcon = computed(() => activeMode.value === 'viewing' ? 'location-dot' : 'magnifying-glass');
const actionLabel = computed(() => activeMode.value === 'viewing' ? 'Current location' : 'Search');
const colors = computed(() => {
  const palette = buttonColors[props.theme]?.neutral || buttonColors.light.neutral;
  return {
    '--address-background': palette.background,
    '--address-border': palette.border,
  };
});
function changeMode(value) {
  if (value === activeMode.value) return;
  activeMode.value = value;
  emit('update:mode', value);
  emit('mode-change', value);
}
function onAddressFocus(event) {
  if (event.target.matches('input.text-input') && activeMode.value !== 'viewing') changeMode('searching');
}
function updateAddress(value) {
  addressValue.value = value;
  emit('update:modelValue', value);
}
</script>

<style scoped>
.address-bar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  color: inherit;
}
.address-bar__controls {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}
.address-bar__menu {
  flex: 0 0 48px;
}
.address-bar__controls :deep(.address-bar__address) {
  flex: 1 1 auto;
  min-width: 0;
}
.address-bar__controls :deep(.text-with-inline-button) {
  width: auto;
  min-width: 0;
}
.address-bar__results {
  box-sizing: border-box;
  width: calc(100% - 8px);
  margin: 4px;
  overflow: hidden;
  border: 1px solid var(--address-border);
  border-radius: 8px;
  background: var(--address-background);
  box-shadow: 0 3px 12px #00000040;
}
</style>
