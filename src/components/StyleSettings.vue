<template>
    <SquareIconButton ref="opener" class="style-settings-launch" icon="layer-group" label="Style settings"
      :theme="isDark ? 'dark' : 'light'" @click="open" />
    <SquareIconButton class="style-location-launch" data-testid="center-on-location-control" icon="satellite"
      label="Center on my location" :theme="isDark ? 'dark' : 'light'" :aria-busy="locating"
      :disabled="recenterDisabled" @click="$emit('center')" />
    <Teleport to="body">
    <FloatingModal v-model:open="modalOpen" class="style-settings-modal" label="Style settings" form-factor="tall" position="center" blocking
      :theme="isDark ? 'dark' : 'light'" :footer-buttons="[{ label: 'More map settings' }]" @footer-button-click="$emit('more-settings')" @backdrop-click="close">
      <section class="style-settings-content">
        <fieldset class="theme-options"><legend>Color theme</legend>
          <label v-for="option in themes" :key="option.value" class="theme-choice" :class="themeChoiceClass(option.value)"><input type="radio" name="style-theme" :value="option.value" :checked="selectedTheme === option.value" @change="applyTheme(option.value)" /> {{ option.label }}</label>
        </fieldset>
        <fieldset class="map-style-options"><legend>Map style</legend>
          <label class="map-style-choice" :class="{ 'is-selected': mapStyle === 'streets' }" :style="{ backgroundImage: `url(${isDark ? '/images/map-style-streets-dark.png' : '/images/map-style-streets-light.png'})` }"><input type="radio" name="map-style" value="streets" :checked="mapStyle === 'streets'" @change="$emit('map-style', 'streets')" /><span>Streets</span></label>
          <label class="map-style-choice" :class="{ 'is-selected': mapStyle === 'satellite' }" style="background-image: url('/images/map-style-satellite.png')"><input type="radio" name="map-style" value="satellite" :checked="mapStyle === 'satellite'" @change="$emit('map-style', 'satellite')" /><span>Satellite</span></label>
        </fieldset>
        <div class="style-range-setting"><label for="style-icon-size">Icon size</label><div><input id="style-icon-size" type="range" min="50" max="150" step="5" :value="iconSize" :aria-valuetext="`${iconSize}%`" @input="$emit('icon-size', $event.target.value)" /><output for="style-icon-size">{{ iconSize }}%</output></div></div>
        <label class="style-checkbox"><input type="checkbox" :checked="railsVisible" @change="$emit('rails-visible', $event.target.checked)" /> Show rail lines</label>
        <div v-if="railsVisible" class="style-range-setting"><label for="style-rail-thickness">Rail line thickness</label><div><input id="style-rail-thickness" type="range" min="1" max="9" step="0.5" :value="railThickness" :aria-valuetext="`${railThickness} pixels`" @input="$emit('rail-thickness', $event.target.value)" /><output for="style-rail-thickness">{{ railThickness }} px</output></div></div>
      </section>
    </FloatingModal>
    </Teleport>
</template>
<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { selectedTheme, isDark, applyTheme } from '../services/theme';
import SquareIconButton from './SquareIconButton.vue';
import FloatingModal from './FloatingModal.vue';
defineProps({ mapStyle: String, iconSize: Number, railsVisible: Boolean, railThickness: Number, locating: Boolean, recenterDisabled: Boolean });
const emit = defineEmits(['before-open', 'center', 'map-style', 'icon-size', 'rails-visible', 'rail-thickness', 'more-settings']);
const themeOptions = {
  system: { value: 'system', label: 'System' },
  light: { value: 'light', label: 'Light' },
  dark: { value: 'dark', label: 'Dark' },
};
const systemThemeQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const systemIsDark = ref(systemThemeQuery?.matches === true);
const themes = computed(() => systemIsDark.value
  ? [themeOptions.light, themeOptions.dark, themeOptions.system]
  : [themeOptions.system, themeOptions.light, themeOptions.dark]);
function syncSystemTheme(event) { systemIsDark.value = event.matches; }
function themeChoiceClass(value) {
  const dark = value === 'dark' || (value === 'system' && systemIsDark.value);
  return dark ? 'theme-choice-dark' : 'theme-choice-light';
}
const modalOpen = ref(false);
const opener = ref(null);
onMounted(() => {
  if (systemThemeQuery?.addEventListener) systemThemeQuery.addEventListener('change', syncSystemTheme);
  else systemThemeQuery?.addListener?.(syncSystemTheme);
});
onBeforeUnmount(() => {
  if (systemThemeQuery?.removeEventListener) systemThemeQuery.removeEventListener('change', syncSystemTheme);
  else systemThemeQuery?.removeListener?.(syncSystemTheme);
});
async function open() { emit('before-open'); await nextTick(); modalOpen.value = true; }
function close() { modalOpen.value = false; }
defineExpose({ close, getOpener: () => opener.value?.$el || opener.value });
</script>
