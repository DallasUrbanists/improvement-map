<template>
  <div v-bind="$attrs" class="map-ui map-toolbar" :data-menu-open="menuOpen" role="group" aria-label="Map view options">
    <button v-if="showMapControls" type="button" class="map-ui-button map-icon-button map-location-button" data-testid="center-on-location-control"
      title="Center on my location" aria-label="Center on my location" :aria-busy="locating" :disabled="recenterDisabled" @click="$emit('center')">
      <i class="fa-solid fa-crosshairs" :class="{ 'animate-spin': locating }" aria-hidden="true"></i>
    </button>
    <span v-if="showMapControls" class="map-toolbar-divider" aria-hidden="true"></span>
    <button v-if="showMapControls" type="button" class="map-ui-button" :aria-pressed="modelValue !== 'list'"
      :aria-label="modelValue === 'list' ? `Show ${modeLabel} map` : `Switch to ${nextModeLabel} view`"
      :title="modelValue === 'list' ? `Show ${modeLabel} map` : `Switch to ${nextModeLabel} view`"
      @click="$emit('update:modelValue', modelValue === 'list' ? mapMode : nextMode)">
      <i :class="['fa-solid', mapMode === 'satellite' ? 'fa-earth-americas' : 'fa-road']" aria-hidden="true"></i>
      <span>{{ modeLabel }}</span>
    </button>
    <button type="button" class="map-ui-button" aria-label="Browse" :aria-pressed="isBrowse && modelValue === 'list'"
      @click="browseList">
      <i class="fa-solid fa-list-ul" aria-hidden="true"></i>
      <span>Browse</span>
    </button>
    <button type="button" class="map-ui-button" :aria-label="route.path === '/submit' ? 'Close' : 'Submit'" :aria-pressed="route.path === '/submit'" @click="exitSubmit ? $emit('exit-submit') : router.push('/submit')">
      <i class="fa-solid fa-plus transition-transform duration-200" :class="{ 'rotate-45': route.path === '/submit' }" aria-hidden="true"></i>
      <span>{{ route.path === '/submit' ? 'Close' : 'Submit' }}</span>
    </button>
    <button ref="menuButton" :id="menuId" type="button" class="map-ui-button map-icon-button" aria-label="Menu" title="Menu" aria-haspopup="menu" :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen">
      <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
    </button>
  </div>
  <k-popover :opened="menuOpen" :target="`#${menuId}`" :angle="false" @backdropclick="menuOpen = false" class="map-ui map-menu-popover min-w-48">
    <div class="p-1" role="menu" aria-label="Map settings">
      <button type="button" role="menuitem" class="map-ui-button w-full justify-between" aria-haspopup="dialog" @click="openMarkerSettings">
        Marker settings
        <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      </button>
      <button type="button" role="menuitem" class="map-ui-button w-full justify-between" aria-haspopup="dialog" @click="openRailSettings">
        Rail settings
        <i class="fa-solid fa-train" aria-hidden="true"></i>
      </button>
      <button v-for="option in themeOptions" :key="option.value" type="button" role="menuitemradio"
        :aria-checked="(isDark ? 'dark' : 'light') === option.value" class="map-ui-button w-full justify-between"
        @click="selectTheme(option.value)">
        {{ option.label }}
        <i v-if="(isDark ? 'dark' : 'light') === option.value" class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
    </div>
  </k-popover>
  <Teleport to="body">
    <dialog ref="markerSettingsDialog" class="map-ui marker-settings-dialog marker-settings-tray" :aria-labelledby="`${menuId}-settings-title`"
      @keydown.esc.stop @click.self="closeMarkerSettings" @close="menuButton?.focus()">
      <div class="marker-settings-panel">
        <div class="marker-settings-header">
          <h2 :id="`${menuId}-settings-title`">Marker settings</h2>
          <button type="button" class="map-ui-button map-icon-button" aria-label="Close marker settings" @click="closeMarkerSettings">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker visibility threshold">
          <label for="map-marker-threshold">Marker threshold</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-threshold" type="range" min="1" max="20" step="1" :value="markerZoomThreshold"
              aria-label="Marker threshold zoom level" @input="$emit('update:markerZoomThreshold', Number($event.target.value))" />
            <output for="map-marker-threshold">{{ markerZoomThreshold }}</output>
          </div>
          <small>Heatmap below {{ markerZoomThreshold }} · Markers at {{ markerZoomThreshold }}+</small>
          <small>Current zoom: {{ Number(mapZoom.toFixed(1)) }}</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker pulse speed">
          <label for="map-marker-pulse-speed">Pulse speed</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-pulse-speed" type="range" min="0.5" max="2" step="0.1" :value="markerPulseSpeed"
              aria-label="Marker pulse speed" :aria-valuetext="`${markerPulseSpeed.toFixed(1)} times normal speed`"
              @input="$emit('update:markerPulseSpeed', Number($event.target.value))" />
            <output for="map-marker-pulse-speed">×{{ markerPulseSpeed.toFixed(1) }}</output>
          </div>
          <small>Higher values pulse faster.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Pulse easing">
          <label for="map-marker-pulse-easing">Pulse easing</label>
          <select id="map-marker-pulse-easing" class="marker-settings-select" :value="markerPulseEasing"
            aria-label="Pulse easing" @change="$emit('update:markerPulseEasing', $event.target.value)">
            <option v-for="easing in markerEasingOptions" :key="easing.value" :value="easing.value">{{ easing.label }}</option>
          </select>
          <small>Controls how each pulse grows and shrinks.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker pulse scale">
          <label for="map-marker-pulse-scale">Pulse scale</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-pulse-scale" type="range" min="1" max="2" step="0.05" :value="markerPulseScale"
              aria-label="Marker pulse maximum scale" :aria-valuetext="`${markerPulseScale.toFixed(2)} times normal size`"
              @input="$emit('update:markerPulseScale', Number($event.target.value))" />
            <output for="map-marker-pulse-scale">×{{ markerPulseScale.toFixed(2) }}</output>
          </div>
          <small>Maximum marker size during each pulse.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker bobbing speed">
          <label for="map-marker-bob-speed">Bobbing speed</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-bob-speed" type="range" min="0.5" max="2" step="0.1" :value="markerBobSpeed"
              aria-label="Marker rotational bobbing speed" :aria-valuetext="`${markerBobSpeed.toFixed(1)} times normal speed`"
              @input="$emit('update:markerBobSpeed', Number($event.target.value))" />
            <output for="map-marker-bob-speed">×{{ markerBobSpeed.toFixed(1) }}</output>
          </div>
          <small>Controls rotation speed independently of pulsing.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Bobbing easing">
          <label for="map-marker-bob-easing">Bobbing easing</label>
          <select id="map-marker-bob-easing" class="marker-settings-select" :value="markerBobEasing"
            aria-label="Bobbing easing" @change="$emit('update:markerBobEasing', $event.target.value)">
            <option v-for="easing in markerEasingOptions" :key="easing.value" :value="easing.value">{{ easing.label }}</option>
          </select>
          <small>Controls the rotational movement between sides.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker rotational bobbing">
          <label for="map-marker-bob-angle">Rotational bobbing</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-bob-angle" type="range" min="0" max="12" step="1" :value="markerBobAngle"
              aria-label="Marker rotational bob angle" :aria-valuetext="markerBobAngle ? `${markerBobAngle} degrees` : 'Off'"
              @input="$emit('update:markerBobAngle', Number($event.target.value))" />
            <output for="map-marker-bob-angle">{{ markerBobAngle ? `±${markerBobAngle}°` : 'Off' }}</output>
          </div>
          <small>Rotate side to side in sync with the pulse.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker spotlight size">
          <label for="map-marker-spotlight-size">Spotlight size</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-spotlight-size" type="range" min="48" max="480" step="4" :value="markerSpotlightSize"
              aria-label="Marker spotlight diameter" :aria-valuetext="`${markerSpotlightSize} pixels diameter`"
              @input="$emit('update:markerSpotlightSize', Number($event.target.value))" />
            <output for="map-marker-spotlight-size">{{ markerSpotlightSize }} px</output>
          </div>
          <small>Diameter of the clear area around the selected marker.</small>
        </div>
        <div class="map-marker-threshold-setting" role="group" aria-label="Marker spotlight feathering">
          <label for="map-marker-spotlight-feather">Spotlight feathering</label>
          <div class="map-marker-threshold-control">
            <input id="map-marker-spotlight-feather" type="range" min="0" max="96" step="1" :value="markerSpotlightFeather"
              aria-label="Marker spotlight feather width" :aria-valuetext="`${markerSpotlightFeather} pixels`"
              @input="$emit('update:markerSpotlightFeather', Number($event.target.value))" />
            <output for="map-marker-spotlight-feather">{{ markerSpotlightFeather }} px</output>
          </div>
          <small>Width of the fade from clear map to the shade.</small>
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
        <button type="button" class="map-ui-button marker-settings-done" @click="closeMarkerSettings">Done</button>
      </div>
    </dialog>
    <dialog ref="railSettingsDialog" class="map-ui marker-settings-dialog marker-settings-tray" :aria-labelledby="`${menuId}-rail-title`"
      @keydown.esc.stop @click.self="closeRailSettings" @close="menuButton?.focus()">
      <div class="marker-settings-panel">
        <div class="marker-settings-header">
          <h2 :id="`${menuId}-rail-title`">Rail settings</h2>
          <button type="button" class="map-ui-button map-icon-button" aria-label="Close rail settings" @click="closeRailSettings">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="map-marker-threshold-setting">
          <label :for="`${menuId}-rail-thickness`">Rail thickness</label>
          <div class="map-marker-threshold-control">
            <input :id="`${menuId}-rail-thickness`" type="range" min="1" max="9" step="0.5" :value="railThickness"
              :aria-valuetext="`${railThickness} pixels`" @input="setRailThickness($event.target.value)" />
            <output :for="`${menuId}-rail-thickness`">{{ railThickness }} px</output>
          </div>
          <small>Updates the map live, including lane spacing and white casing.</small>
        </div>
        <button type="button" class="map-ui-button marker-settings-done" @click="closeRailSettings">Done</button>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch, onDeactivated, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kPopover } from 'konsta/vue';
import { railThickness, setRailThickness } from '../services/railSettings.js';
import { applyTheme, isDark } from '../services/theme';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: 'streets' },
  showMapControls: { type: Boolean, default: true },
  locating: { type: Boolean, default: false },
  mapType: { type: String, default: 'roadmap' },
  recenterDisabled: { type: Boolean, default: false },
  exitSubmit: { type: Boolean, default: false },
  markerZoomThreshold: { type: Number, default: 10 },
  mapZoom: { type: Number, default: 13 },
  heatmapOpacity: { type: Number, default: 0.4 },
  heatmapRadius: { type: Number, default: 56 },
  markerPulseSpeed: { type: Number, default: 1.5 },
  markerPulseScale: { type: Number, default: 1.5 },
  markerBobAngle: { type: Number, default: 0 },
  markerBobSpeed: { type: Number, default: 1 },
  markerPulseEasing: { type: String, default: 'ease-in-out' },
  markerBobEasing: { type: String, default: 'ease-in-out' },
  markerSpotlightSize: { type: Number, default: 108 },
  markerSpotlightFeather: { type: Number, default: 8 },
});
const emit = defineEmits(['update:modelValue', 'center', 'exit-submit', 'update:markerZoomThreshold', 'update:heatmapOpacity', 'update:heatmapRadius', 'update:markerPulseSpeed', 'update:markerPulseScale', 'update:markerBobAngle', 'update:markerBobSpeed', 'update:markerPulseEasing', 'update:markerBobEasing', 'update:markerSpotlightSize', 'update:markerSpotlightFeather']);
const route = useRoute();
const router = useRouter();
const isBrowse = computed(() => route.path === '/' || route.path === '/browse');
const menuId = `map-menu-${useId()}`;
const menuOpen = ref(false);
const menuButton = ref(null);
const markerSettingsDialog = ref(null);
const railSettingsDialog = ref(null);
const markerEasingOptions = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in and out' },
];
async function openRailSettings() {
  menuOpen.value = false;
  await nextTick();
  railSettingsDialog.value?.showModal();
}
function closeRailSettings() { railSettingsDialog.value?.close(); }
async function openMarkerSettings() {
  menuOpen.value = false;
  await nextTick();
  markerSettingsDialog.value?.showModal();
}
function closeMarkerSettings() { markerSettingsDialog.value?.close(); }
const themeOptions = [
  { value: 'light', label: 'Light theme' },
  { value: 'dark', label: 'Dark theme' },
];
function browseList() {
  if (props.showMapControls) emit('update:modelValue', 'list');
  else router.push({ path: '/', query: { view: 'list' } });
}
function selectTheme(theme) {
  applyTheme(theme);
  menuOpen.value = false;
}
watch(() => route.fullPath, () => { menuOpen.value = false; closeMarkerSettings(); closeRailSettings(); });
onDeactivated(() => { menuOpen.value = false; closeMarkerSettings(); closeRailSettings(); });
const mapMode = computed(() => props.modelValue === 'list'
  ? (props.mapType === 'hybrid' ? 'satellite' : 'streets') : props.modelValue);
const modeLabel = computed(() => mapMode.value === 'satellite' ? 'Satellite' : 'Streets');
const nextMode = computed(() => mapMode.value === 'satellite' ? 'streets' : 'satellite');
const nextModeLabel = computed(() => nextMode.value === 'satellite' ? 'Satellite' : 'Streets');
</script>
