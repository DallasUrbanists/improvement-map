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
import { createEmojiMarkerSvg } from '../services/emojiMapMarker.js';

const props = defineProps({
  camera: { type: Object, required: true },
  style: { type: String, default: 'streets' },
  theme: { type: String, default: 'dark' },
  rails: { type: Boolean, default: true },
  iconStyle: { type: Object, default: null },
  animateCamera: { type: Boolean, default: false },
  ideaTransitioning: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true },
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
let cameraAnimationResolve = null;
let cameraAnimationIdleListener = null;
let cameraAnimationActive = false;
let markerIdeaSnapshot = null;
let outgoingMarkers = new Set();
let receiverCameraTarget = null;

function markerIcon(idea, iconStyle, { entrance = false, exit = false } = {}) {
  const iconSize = Math.round(80 * (Number(iconStyle.size) || 100) / 100);
  const animationEnabled = iconStyle.animationEnabled !== false;
  const markerCanvasSize = Math.round(iconSize * (animationEnabled ? Number(iconStyle.pulseSize) || 1 : 1));
  return {
    url: createEmojiMarkerSvg(idea.emoji, {
      canvasSize: markerCanvasSize,
      emojiSize: 38 * iconSize / 80,
      pulse: animationEnabled && !exit,
      pulseScale: iconStyle.pulseSize,
      pulseSpeed: iconStyle.pulseSpeed,
      bobAngle: iconStyle.bobbingRotation,
      bobSpeed: iconStyle.bobbingSpeed,
      pulseEasing: iconStyle.animationEasing,
      bobEasing: iconStyle.animationEasing,
      animateAppearance: entrance || (animationEnabled && !exit),
      appearanceExit: exit,
      appearanceDuration: entrance || exit ? 1000 : 450,
    }),
    scaledSize: new window.google.maps.Size(markerCanvasSize, markerCanvasSize),
    anchor: new window.google.maps.Point(markerCanvasSize / 2, markerCanvasSize / 2),
  };
}

function targetCameraMatchesIdea(camera, idea) {
  return Boolean(camera && Number.isFinite(idea?.location?.latitude) && Number.isFinite(idea?.location?.longitude)
    && Math.abs(camera.latitude - idea.location.latitude) < 1e-6
    && Math.abs(camera.longitude - idea.location.longitude) < 1e-6);
}

function animateCameraTo(target) {
  if (!Number.isFinite(target?.latitude) || !Number.isFinite(target?.longitude) || !Number.isFinite(target?.zoom)) return Promise.resolve();
  if (!map) return Promise.resolve();
  cameraAnimationIdleListener?.remove?.();
  cameraAnimationIdleListener = null;
  cameraAnimationResolve?.();
  cameraAnimationResolve = null;
  const start = currentCamera();
  if (!start) return Promise.resolve();
  const alreadyAtTarget = Math.abs(start.latitude - target.latitude) < 1e-7
    && Math.abs(start.longitude - target.longitude) < 1e-7
    && Math.abs(start.zoom - target.zoom) < .001;
  if (alreadyAtTarget) return Promise.resolve();
  cameraAnimationActive = true;
  applyingProps = true;
  expectedCamera = { ...target };
  return new Promise(resolve => {
    let mapIdle = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cameraAnimationIdleListener?.remove?.();
      cameraAnimationIdleListener = null;
      cameraAnimationActive = false;
      applyingProps = false;
      expectedCamera = { ...target };
      cameraAnimationResolve = null;
      resolve();
    };
    const finishWhenReady = () => {
      if (!mapIdle) return;
      const camera = currentCamera();
      if (camera && Math.abs(camera.latitude - target.latitude) < 1e-7
        && Math.abs(camera.longitude - target.longitude) < 1e-7
        && Math.abs(camera.zoom - target.zoom) < .001) finish();
    };
    cameraAnimationResolve = finish;
    cameraAnimationIdleListener = map.addListener('idle', () => {
      mapIdle = true;
      finishWhenReady();
    });
    map.panTo({ lat: target.latitude, lng: target.longitude });
    map.setZoom(target.zoom);
  });
}

defineExpose({ transitionCameraTo: animateCameraTo });

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
    markerIdeaSnapshot = null;
    return;
  }
  const iconStyle = props.iconStyle || {};
  const ideaChanged = Boolean(marker && markerIdeaSnapshot && String(markerIdeaSnapshot.id) !== String(props.idea.id));
  const animateIdeaChange = ideaChanged && (props.ideaTransitioning
    || (props.role === 'receiver' && targetCameraMatchesIdea(receiverCameraTarget, props.idea)));
  if (animateIdeaChange && markerIdeaSnapshot) {
    const oldLocation = markerIdeaSnapshot.location;
    const oldLat = oldLocation?.latitude;
    const oldLng = oldLocation?.longitude;
    if (Number.isFinite(oldLat) && Number.isFinite(oldLng)) {
      const departing = new window.google.maps.Marker({
        map,
        position: { lat: oldLat, lng: oldLng },
        title: markerIdeaSnapshot.summary || 'Selected improvement idea',
        optimized: false,
        icon: markerIcon(markerIdeaSnapshot, iconStyle, { exit: true }),
        zIndex: 999,
      });
      outgoingMarkers.add(departing);
      window.setTimeout(() => {
        departing.setMap(null);
        outgoingMarkers.delete(departing);
      }, 1000);
    }
  }
  const options = {
    map,
    position: { lat, lng },
    title: props.idea.summary || 'Selected improvement idea',
    optimized: false,
    icon: markerIcon(props.idea, iconStyle, { entrance: animateIdeaChange }),
    zIndex: 1000,
  };
  if (!marker) marker = new window.google.maps.Marker(options);
  else {
    marker.setMap(map);
    marker.setPosition(options.position);
    marker.setTitle(options.title);
    marker.setIcon(options.icon);
  }
  markerIdeaSnapshot = {
    id: props.idea.id,
    emoji: props.idea.emoji,
    summary: props.idea.summary,
    location: { latitude: lat, longitude: lng },
  };
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
    disableDefaultUI: props.role === 'receiver',
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: props.interactive ? 'greedy' : 'none',
      draggable: props.interactive,
      scrollwheel: props.interactive,
      disableDoubleClickZoom: !props.interactive,
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
  if (cameraAnimationActive && props.animateCamera) return;
  if (props.animateCamera || props.role === 'receiver') {
    if (props.role === 'receiver') receiverCameraTarget = { ...props.camera };
    void animateCameraTo(props.camera);
    return;
  }
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
watch(() => props.interactive, value => map?.setOptions({
  gestureHandling: value ? 'greedy' : 'none',
  draggable: value,
  scrollwheel: value,
  disableDoubleClickZoom: !value,
}));
// Rebuild the SVG marker only when one of its inputs changes. Remote session
// updates can replace these objects with equivalent clones; watching the full
// objects deeply would call setIcon again and restart the SVG entrance motion.
watch([
  () => props.idea?.location?.latitude,
  () => props.idea?.location?.longitude,
  () => props.idea?.summary,
  () => props.idea?.emoji,
  () => props.iconStyle?.size,
  () => props.iconStyle?.animationEnabled,
  () => props.iconStyle?.pulseSize,
  () => props.iconStyle?.pulseSpeed,
  () => props.iconStyle?.bobbingRotation,
  () => props.iconStyle?.bobbingSpeed,
  () => props.iconStyle?.animationEasing,
], () => updateMarker());

onMounted(mountMap);
onBeforeUnmount(() => {
  disposed = true;
  cameraAnimationIdleListener?.remove?.();
  cameraAnimationResolve?.();
  idleListener?.remove?.();
  marker?.setMap(null);
  for (const outgoing of outgoingMarkers) outgoing.setMap(null);
  outgoingMarkers.clear();
  if (map) disposeMapTheme(map);
  map = null;
});
</script>

<style scoped>
.presentation-map-canvas { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; background: var(--presentation-bg, #f5f3ee); }
.presentation-map-status { position: absolute; z-index: 1; inset: 50% auto auto 50%; translate: -50% -50%; max-width: min(90%, 28rem); padding: .8rem 1rem; text-align: center; }
</style>
