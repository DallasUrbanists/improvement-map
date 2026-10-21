<template>
  <div ref="host" class="presentation-map-canvas" role="region" :aria-label="label" :data-presentation-map="role">
    <div v-if="status !== 'ready'" class="presentation-map-status map-ui" role="status">
      <template v-if="status === 'loading'">Loading map…</template>
      <template v-else>{{ errorMessage || 'Map unavailable. The rest of the presentation remains available.' }}</template>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { hasGoogleMapsKey, loadGoogleMaps, getMapStyles, updateMapTheme, setMapRailsVisible, disposeMapTheme } from '../services/googleMaps.js';
import { submissionEmoji } from '../services/emojiMapMarker.js';

const props = defineProps({
  camera: { type: Object, required: true },
  style: { type: String, default: 'streets' },
  theme: { type: String, default: 'dark' },
  rails: { type: Boolean, default: true },
  idea: { type: Object, default: null },
  role: { type: String, default: 'screen' },
  label: { type: String, default: 'Presentation map' },
});
const emit = defineEmits(['camera', 'status']);
const host = ref(null);
const status = ref('loading');
const errorMessage = ref('');
let map = null;
let marker = null;
let idleListener = null;
let disposed = false;
let applyingProps = false;
let ignoreInitialIdle = true;
let expectedCamera = null;

function currentCamera() {
  if (!map) return null;
  const center = map.getCenter();
  return center ? { latitude: center.lat(), longitude: center.lng(), zoom: map.getZoom() || props.camera.zoom } : null;
}

function onIdle() {
  if (disposed || !map || applyingProps) return;
  if (ignoreInitialIdle) { ignoreInitialIdle = false; return; }
  const camera = currentCamera();
  if (expectedCamera && camera && Math.abs(camera.latitude - expectedCamera.latitude) < 1e-7
    && Math.abs(camera.longitude - expectedCamera.longitude) < 1e-7 && Math.abs(camera.zoom - expectedCamera.zoom) < .001) {
    expectedCamera = null;
    return;
  }
  if (camera) emit('camera', camera);
}

function setStatus(value, error = null) {
  status.value = value;
  errorMessage.value = error || '';
  emit('status', value, error);
}

function updateMarker() {
  if (!map || !window.google?.maps?.Marker) return;
  const lat = props.idea?.location?.latitude;
  const lng = props.idea?.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    marker?.setMap(null);
    return;
  }
  const options = {
    map,
    position: { lat, lng },
    title: props.idea.summary || 'Selected improvement idea',
    label: { text: submissionEmoji(props.idea.emoji), fontSize: '28px' },
    zIndex: 1000,
  };
  if (!marker) marker = new window.google.maps.Marker(options);
  else {
    marker.setMap(map);
    marker.setPosition(options.position);
    marker.setTitle(options.title);
    marker.setLabel(options.label);
  }
}

async function mountMap() {
  if (!host.value || !hasGoogleMapsKey) {
    setStatus('error', hasGoogleMapsKey ? null : 'Google Maps is not configured for this build.');
    return;
  }
  try {
    const maps = await loadGoogleMaps();
    if (disposed || !host.value) return;
    const hybrid = props.style === 'satellite';
    expectedCamera = { ...props.camera };
    map = new maps.Map(host.value, {
      center: { lat: props.camera.latitude, lng: props.camera.longitude },
      zoom: props.camera.zoom,
      mapTypeId: hybrid ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP,
      styles: getMapStyles(props.theme === 'dark', hybrid ? 'hybrid' : 'roadmap', props.camera.zoom),
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: 'greedy',
      keyboardShortcuts: false,
    });
    updateMapTheme(map, props.theme === 'dark', hybrid ? 'hybrid' : 'roadmap');
    setMapRailsVisible(map, props.rails);
    idleListener = map.addListener('idle', () => {
      if (status.value !== 'ready') setStatus('ready');
      onIdle();
    });
    updateMarker();
    // Google Maps' own logo and attribution are rendered by the SDK.
  } catch (error) {
    if (!disposed) setStatus('error', error?.message || 'Google Maps could not be loaded.');
  }
}

watch(() => [props.camera.latitude, props.camera.longitude, props.camera.zoom], () => {
  if (!map || !Number.isFinite(props.camera.latitude) || !Number.isFinite(props.camera.longitude)) return;
  applyingProps = true;
  expectedCamera = { ...props.camera };
  map.setCenter({ lat: props.camera.latitude, lng: props.camera.longitude });
  map.setZoom(props.camera.zoom);
  requestAnimationFrame(() => { applyingProps = false; });
});

watch(() => props.style, value => {
  if (!map) return;
  const type = value === 'satellite' ? window.google.maps.MapTypeId.HYBRID : window.google.maps.MapTypeId.ROADMAP;
  map.setMapTypeId(type);
  map.setOptions({ styles: getMapStyles(props.theme === 'dark', type, map.getZoom()) });
});
watch(() => props.theme, value => {
  if (map) updateMapTheme(map, value === 'dark', map.getMapTypeId());
});
watch(() => props.rails, value => setMapRailsVisible(map, value));
watch(() => props.idea, updateMarker, { deep: true });

onMounted(mountMap);
onBeforeUnmount(() => {
  disposed = true;
  idleListener?.remove?.();
  marker?.setMap(null);
  if (map) disposeMapTheme(map);
  map = null;
});
</script>

<style scoped>
.presentation-map-canvas { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; background: #e3e9e5; }
.dark .presentation-map-canvas { background: #27332d; }
.presentation-map-status { position: absolute; z-index: 1; inset: 50% auto auto 50%; translate: -50% -50%; max-width: min(90%, 28rem); padding: .8rem 1rem; text-align: center; }
</style>
