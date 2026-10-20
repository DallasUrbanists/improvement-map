<template>
    <button ref="opener" type="button" class="map-ui style-settings-launch" aria-label="Style settings" title="Style settings" @click="open">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.0001L12 18.0001L3 14.0001M21 10.0001L12 14.0001L3 10.0001L12 6.00012L21 10.0001Z" /></svg>
    </button>
    <dialog ref="dialog" class="map-ui marker-settings-dialog style-settings-dialog" aria-labelledby="style-settings-title"
      @keydown.esc.stop.prevent="close" @click.self="close" @close="restoreFocus">
      <header class="map-tray-header marker-settings-header">
        <div class="map-tray-heading"><h2 id="style-settings-title">Style Settings</h2></div>
        <button type="button" class="map-ui-button map-tray-close" aria-label="Close Style Settings" @click="close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
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
      <footer class="style-settings-footer"><button type="button" class="action-button" @click="$emit('more-settings')">More map settings</button></footer>
    </dialog>
</template>
<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { selectedTheme, isDark, applyTheme } from '../services/theme';
defineProps({ mapStyle: String, iconSize: Number, railsVisible: Boolean, railThickness: Number });
const emit = defineEmits(['before-open', 'map-style', 'icon-size', 'rails-visible', 'rail-thickness', 'more-settings']);
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
const dialog = ref(null);
const opener = ref(null);
onMounted(() => {
  if (systemThemeQuery?.addEventListener) systemThemeQuery.addEventListener('change', syncSystemTheme);
  else systemThemeQuery?.addListener?.(syncSystemTheme);
});
onBeforeUnmount(() => {
  if (systemThemeQuery?.removeEventListener) systemThemeQuery.removeEventListener('change', syncSystemTheme);
  else systemThemeQuery?.removeListener?.(syncSystemTheme);
});
async function open() { emit('before-open'); await nextTick(); dialog.value?.showModal(); }
function close() { dialog.value?.close(); }
function restoreFocus() { opener.value?.focus({ preventScroll: true }); }
defineExpose({ close, getOpener: () => opener.value });
</script>
