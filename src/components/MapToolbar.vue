<template>
  <button v-bind="$attrs" type="button" class="map-ui map-ui-button map-list-fab" aria-label="List" :aria-pressed="isBrowse && modelValue === 'list'"
    @click="browseList">
    <i class="fa-solid fa-list-ul" aria-hidden="true"></i>
    <span>List</span>
  </button>
  <Teleport to="body">
    <AppMenu v-model:open="menuOpen" :theme="isDark ? 'dark' : 'light'" @item-click="handleAppMenuItemClick" />
  </Teleport>
  <Teleport to="body">
    <dialog ref="markerSettingsDialog" class="map-ui marker-settings-dialog marker-settings-tray" :aria-labelledby="`${menuId}-settings-title`"
      @keydown.esc.stop.prevent="closeMarkerSettings" @click.self="closeMarkerSettings" @close="restoreMarkerSettingsFocus">
      <header class="map-tray-header marker-settings-header">
        <div class="map-tray-heading">
          <h2 :id="`${menuId}-settings-title`">Map settings</h2>
        </div>
        <button type="button" class="map-ui-button map-tray-header-action" :aria-label="`Reset ${settingsTab} settings`" @click="settingsTab === 'markers' ? resetMarkerSettings() : setRailThickness(DEFAULT_RAIL_THICKNESS)">
          Reset
        </button>
        <button type="button" class="map-ui-button map-tray-close" aria-label="Close Map settings" @click="closeMarkerSettings">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      <div class="settings-tabs" role="group" aria-label="Settings category"><button class="action-button" :aria-pressed="settingsTab === 'markers'" @click="settingsTab = 'markers'">Markers</button><button class="action-button" :aria-pressed="settingsTab === 'rail'" @click="settingsTab = 'rail'">Rail</button></div>
      <div v-show="settingsTab === 'markers'" class="marker-settings-panel">
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker visibility threshold">
          <label for="map-marker-threshold">Show markers at zoom</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-threshold" type="range" min="1" max="20" step="1" :value="markerZoomThreshold"
              aria-label="Marker threshold zoom level" @input="$emit('update:markerZoomThreshold', Number($event.target.value))" />
            <output for="map-marker-threshold">{{ markerZoomThreshold }}</output>
          </div>
          <small>Heatmap below zoom {{ markerZoomThreshold }}.</small>
          <small>Current zoom: {{ Number(mapZoom.toFixed(1)) }}</small>
        </div>
        <div class="settings-animation"><button type="button" class="action-button" role="switch" :aria-checked="animationEnabled" @click="toggleAnimation">Animation {{ animationEnabled ? 'on' : 'off' }}</button><img :src="markerPreview" width="80" height="80" alt="Marker animation preview" /></div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker spotlight size">
          <label for="map-marker-spotlight-size">Selected marker highlight</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-spotlight-size" type="range" min="48" max="480" step="4" :value="markerSpotlightSize"
              aria-label="Marker spotlight diameter" :aria-valuetext="`${markerSpotlightSize} pixels diameter`"
              @input="$emit('update:markerSpotlightSize', Number($event.target.value))" />
            <output for="map-marker-spotlight-size">{{ markerSpotlightSize }} px</output>
          </div>
          <small>Diameter of the clear area around the selected marker.</small>
        </div>
        <details class="settings-advanced"><summary>Advanced</summary>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker pulse speed">
          <label for="map-marker-pulse-speed">Pulse speed</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-pulse-speed" type="range" min="0.5" max="2" step="0.1" :value="markerPulseSpeed"
              aria-label="Marker pulse speed" :aria-valuetext="`${markerPulseSpeed.toFixed(1)} times normal speed`"
              @input="$emit('update:markerPulseSpeed', Number($event.target.value))" />
            <output for="map-marker-pulse-speed">×{{ markerPulseSpeed.toFixed(1) }}</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Pulse easing">
          <label for="map-marker-pulse-easing">Pulse easing</label>
          <select id="map-marker-pulse-easing" class="marker-settings-select" :value="markerPulseEasing"
            aria-label="Pulse easing" @change="$emit('update:markerPulseEasing', $event.target.value)">
            <option v-for="easing in markerEasingOptions" :key="easing.value" :value="easing.value">{{ easing.label }}</option>
          </select>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker pulse scale">
          <label for="map-marker-pulse-scale">Pulse scale</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-pulse-scale" type="range" min="1" max="2" step="0.05" :value="markerPulseScale"
              aria-label="Marker pulse maximum scale" :aria-valuetext="`${markerPulseScale.toFixed(2)} times normal size`"
              @input="$emit('update:markerPulseScale', Number($event.target.value))" />
            <output for="map-marker-pulse-scale">×{{ markerPulseScale.toFixed(2) }}</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker bobbing speed">
          <label for="map-marker-bob-speed">Bobbing speed</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-bob-speed" type="range" min="0.5" max="2" step="0.1" :value="markerBobSpeed"
              aria-label="Marker rotational bobbing speed" :aria-valuetext="`${markerBobSpeed.toFixed(1)} times normal speed`"
              @input="$emit('update:markerBobSpeed', Number($event.target.value))" />
            <output for="map-marker-bob-speed">×{{ markerBobSpeed.toFixed(1) }}</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Bobbing easing">
          <label for="map-marker-bob-easing">Bobbing easing</label>
          <select id="map-marker-bob-easing" class="marker-settings-select" :value="markerBobEasing"
            aria-label="Bobbing easing" @change="$emit('update:markerBobEasing', $event.target.value)">
            <option v-for="easing in markerEasingOptions" :key="easing.value" :value="easing.value">{{ easing.label }}</option>
          </select>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker rotational bobbing">
          <label for="map-marker-bob-angle">Rotational bobbing</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-bob-angle" type="range" min="0" max="12" step="1" :value="markerBobAngle"
              aria-label="Marker rotational bob angle" :aria-valuetext="markerBobAngle ? `${markerBobAngle} degrees` : 'Off'"
              @input="$emit('update:markerBobAngle', Number($event.target.value))" />
            <output for="map-marker-bob-angle">{{ markerBobAngle ? `±${markerBobAngle}°` : 'Off' }}</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker spotlight feathering">
          <label for="map-marker-spotlight-feather">Highlight softness</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-spotlight-feather" type="range" min="0" max="96" step="1" :value="markerSpotlightFeather"
              aria-label="Marker spotlight feather width" :aria-valuetext="`${markerSpotlightFeather} pixels`"
              @input="$emit('update:markerSpotlightFeather', Number($event.target.value))" />
            <output for="map-marker-spotlight-feather">{{ markerSpotlightFeather }} px</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Heatmap appearance">
          <label for="map-heatmap-opacity">Heatmap opacity</label>
          <div class="map-marker-threshold-control">
            <input id="map-heatmap-opacity" type="range" min="0" max="100" step="5" :value="Math.round(heatmapOpacity * 100)"
              aria-label="Heatmap opacity" :aria-valuetext="`${Math.round(heatmapOpacity * 100)}%`"
              @input="$emit('update:heatmapOpacity', Number($event.target.value) / 100)" />
            <output for="map-heatmap-opacity">{{ Math.round(heatmapOpacity * 100) }}%</output>
          </div>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Heatmap radius">
          <label for="map-heatmap-radius">Heatmap radius</label>
          <div class="map-marker-threshold-control">
            <input id="map-heatmap-radius" type="range" min="8" max="160" step="4" :value="heatmapRadius"
              aria-label="Heatmap radius" :aria-valuetext="`${heatmapRadius} pixels`"
              @input="$emit('update:heatmapRadius', Number($event.target.value))" />
            <output for="map-heatmap-radius">{{ heatmapRadius }} px</output>
          </div>
          <small>Larger radius blends suggestions across a wider area.</small>
        </div>
        </details>
      </div>
      <div v-show="settingsTab === 'rail'" class="marker-settings-panel">
        <div class="map-marker-threshold-setting">
          <label :for="`${menuId}-rail-thickness`">Line width</label>
          <div class="map-marker-threshold-control">
            <input :id="`${menuId}-rail-thickness`" type="range" min="1" max="9" step="0.5" :value="railThickness"
              :aria-valuetext="`${railThickness} pixels`" @input="setRailThickness($event.target.value)" />
            <output :for="`${menuId}-rail-thickness`">{{ railThickness }} px</output>
          </div>
          <svg class="rail-preview" viewBox="0 0 240 40" role="img" aria-label="Rail line preview"><path d="M10 20 H230" stroke="currentColor" :stroke-width="railThickness + 2" /><path d="M10 20 H230" stroke="#eab308" :stroke-width="railThickness" /></svg>
        </div>
      </div>
    </dialog>

  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch, onDeactivated, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppMenu from './AppMenu.vue';
import { railThickness, setRailThickness, DEFAULT_RAIL_THICKNESS } from '../services/railSettings.js';
import { DEFAULT_MARKER_SETTINGS } from '../services/storage.js';
import { isDark } from '../services/theme';
import { openAnnouncement } from '../services/announcements';
function showAnnouncement(screen) {
  menuOpen.value = false;
  document.querySelector('.address-bar__menu')?.focus({ preventScroll: true });
  openAnnouncement(screen);
}
import { createEmojiMarkerSvg } from '../services/emojiMapMarker';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: 'streets' },
  showMapControls: { type: Boolean, default: true },
  markerZoomThreshold: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerZoomThreshold },
  mapZoom: { type: Number, default: 13 },
  heatmapOpacity: { type: Number, default: DEFAULT_MARKER_SETTINGS.heatmapOpacity },
  heatmapRadius: { type: Number, default: DEFAULT_MARKER_SETTINGS.heatmapRadius },
  markerPulseSpeed: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerPulseSpeed },
  markerPulseScale: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerPulseScale },
  markerBobAngle: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerBobAngle },
  markerBobSpeed: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerBobSpeed },
  markerPulseEasing: { type: String, default: DEFAULT_MARKER_SETTINGS.markerPulseEasing },
  markerBobEasing: { type: String, default: DEFAULT_MARKER_SETTINGS.markerBobEasing },
  markerSpotlightSize: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerSpotlightSize },
  markerSpotlightFeather: { type: Number, default: DEFAULT_MARKER_SETTINGS.markerSpotlightFeather },
});
const emit = defineEmits(['update:modelValue', 'update:markerZoomThreshold', 'update:heatmapOpacity', 'update:heatmapRadius', 'update:markerPulseSpeed', 'update:markerPulseScale', 'update:markerBobAngle', 'update:markerBobSpeed', 'update:markerPulseEasing', 'update:markerBobEasing', 'update:markerSpotlightSize', 'update:markerSpotlightFeather']);
const route = useRoute();
const router = useRouter();
const isBrowse = computed(() => route.path === '/' || route.path === '/browse');
const menuId = `map-menu-${useId()}`;
const menuOpen = ref(false);
const markerSettingsDialog = ref(null);
const markerSettingsReturnFocus = ref(null);
const settingsTab = ref('markers');
const animationEnabled = computed(() => props.markerPulseScale > 1 || props.markerBobAngle > 0);
let previousAnimation;
function toggleAnimation() {
  if (animationEnabled.value) {
    previousAnimation = { scale: props.markerPulseScale, angle: props.markerBobAngle };
    emit('update:markerPulseScale', 1); emit('update:markerBobAngle', 0);
  } else {
    emit('update:markerPulseScale', previousAnimation?.scale ?? DEFAULT_MARKER_SETTINGS.markerPulseScale);
    emit('update:markerBobAngle', previousAnimation?.angle ?? DEFAULT_MARKER_SETTINGS.markerBobAngle);
  }
}
const markerPreview = computed(() => createEmojiMarkerSvg('🌳', { pulse: animationEnabled.value, pulseScale: props.markerPulseScale, pulseSpeed: props.markerPulseSpeed, bobAngle: props.markerBobAngle, bobSpeed: props.markerBobSpeed, pulseEasing: props.markerPulseEasing, bobEasing: props.markerBobEasing }));
const markerEasingOptions = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in and out' },
];
function resetMarkerSettings() {
  for (const [setting, value] of Object.entries(DEFAULT_MARKER_SETTINGS)) {
    emit(`update:${setting}`, value);
  }
}
async function openMarkerSettings(returnFocus = null) {
  menuOpen.value = false;
  markerSettingsReturnFocus.value = returnFocus;
  await nextTick();
  markerSettingsDialog.value?.show();
}
function closeMarkerSettings() { markerSettingsDialog.value?.close(); }
function restoreMarkerSettingsFocus() {
  (markerSettingsReturnFocus.value || document.querySelector('.address-bar__menu'))?.focus({ preventScroll: true });
  markerSettingsReturnFocus.value = null;
}
function openTray(path) {
  menuOpen.value = false;
  document.querySelector('.address-bar__menu')?.focus({ preventScroll: true });
  router.push(path);
}
function handleAppMenuItemClick(item) {
  menuOpen.value = false;
  if (item.label === 'Saved ideas' || item.label === 'Saved actions') {
    openTray(item.href);
  } else if (item.label === 'Welcome guide') {
    showAnnouncement('welcome');
  } else if (item.label === "What's new") {
    showAnnouncement('history');
  } else if (item.label === 'Map settings') {
    openMarkerSettings();
  }
}
function browseList() {
  if (props.showMapControls) emit('update:modelValue', 'list');
  else router.push({ path: '/', query: { view: 'list' } });
}
watch(() => route.fullPath, () => { menuOpen.value = false; closeMarkerSettings(); });
onDeactivated(() => { menuOpen.value = false; closeMarkerSettings(); });
defineExpose({ openMarkerSettings, closeMarkerSettings, toggleMenu: () => { menuOpen.value = !menuOpen.value; }, menuIsOpen: menuOpen });
</script>
