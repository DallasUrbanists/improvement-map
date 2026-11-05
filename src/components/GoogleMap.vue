<template>
  <div
    ref="host"
    class="google-map"
    :class="{ 'google-map--cover-viewport': coverViewport }"
    :style="rootStyle"
    :data-theme="theme"
    :data-map-style="mapStyle"
    :data-rails-enabled="String(railsEnabled)"
    :data-rails-thickness="railsThickness"
    :data-cover-viewport="String(coverViewport)"
    role="region"
    aria-label="Google map of Dallas"
  >
    <div ref="canvas" class="google-map__canvas" aria-hidden="true"></div>
    <div v-if="status !== 'ready'" class="google-map__status map-ui" role="status">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  disposeMapTheme,
  getMapStyles,
  hasGoogleMapsKey,
  loadGoogleMaps,
  setMapRailsThickness,
  setMapRailsVisible,
  updateMapTheme,
} from '../services/googleMaps.js';

const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  mapStyle: { type: String, default: 'road', validator: value => ['road', 'satellite'].includes(value) },
  railsEnabled: { type: Boolean, default: true },
  railsThickness: { type: Number, default: 2, validator: value => Number.isInteger(value) && value >= 1 && value <= 9 },
  width: { type: String, default: '100%' },
  height: { type: String, default: '33vh' },
  coverViewport: { type: Boolean, default: false },
});

const host = ref(null);
const canvas = ref(null);
const status = ref('loading');
const statusMessage = ref('Loading map…');
const rootStyle = computed(() => ({
  width: props.coverViewport ? '100vw' : props.width,
  height: props.coverViewport ? '100vh' : props.height,
}));

let map = null;
let disposed = false;

function mapTypeId(maps, style) {
  return style === 'satellite' ? maps.MapTypeId.SATELLITE : maps.MapTypeId.ROADMAP;
}

async function initializeMap() {
  if (!canvas.value || !hasGoogleMapsKey) {
    status.value = 'error';
    statusMessage.value = 'Google Maps is not configured for this build.';
    return;
  }

  try {
    const maps = await loadGoogleMaps();
    if (disposed || !canvas.value) return;
    const mapType = mapTypeId(maps, props.mapStyle);
    map = new maps.Map(canvas.value, {
      center: { lat: 32.7767, lng: -96.797 },
      zoom: 13,
      mapTypeId: mapType,
      styles: getMapStyles(props.theme === 'dark', mapType, 13),
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      zoomControlOptions: { position: maps.ControlPosition.TOP_RIGHT },
      scaleControl: false,
      rotateControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
      keyboardShortcuts: false,
    });
    updateMapTheme(map, props.theme === 'dark', mapType, {
      railsEnabled: props.railsEnabled,
      railsThickness: props.railsThickness,
    });
    setMapRailsVisible(map, props.railsEnabled);
    status.value = 'ready';
    statusMessage.value = '';
  } catch (error) {
    if (disposed) return;
    status.value = 'error';
    statusMessage.value = error?.message || 'Google Maps could not be loaded.';
  }
}

watch(() => [props.theme, props.mapStyle], () => {
  if (!map || !window.google?.maps) return;
  const type = mapTypeId(window.google.maps, props.mapStyle);
  map.setMapTypeId(type);
  map.setOptions({ styles: getMapStyles(props.theme === 'dark', type, map.getZoom()) });
  updateMapTheme(map, props.theme === 'dark', type);
});
watch(() => props.railsEnabled, value => setMapRailsVisible(map, value));
watch(() => props.railsThickness, value => setMapRailsThickness(map, value));

onMounted(initializeMap);
onBeforeUnmount(() => {
  disposed = true;
  if (map) disposeMapTheme(map);
  map = null;
});
</script>

<style scoped>
.google-map {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: #d9e1de;
}
.google-map__canvas { position: absolute; inset: 0; }
.google-map__status {
  position: absolute;
  z-index: 1;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  max-width: min(90%, 28rem);
  padding: .8rem 1rem;
  text-align: center;
}
.google-map--cover-viewport {
  position: fixed;
  z-index: 0;
  inset: 0;
  width: 100vw;
  height: 100vh;
}
</style>
