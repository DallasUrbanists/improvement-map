<template>
  <div class="relative flex h-[50vh] max-h-[50vh] flex-col overflow-hidden border-y border-zinc-200 dark:border-zinc-700">
    <div class="relative flex shrink-0 items-center border-b border-zinc-200 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900">
      <input
        type="text"
        :value="location?.address || 'Dallas, TX'"
        readonly
        aria-label="Selected location address"
        class="min-w-0 flex-1 bg-transparent text-xs text-zinc-800 outline-none dark:text-zinc-100"
      />
      <button
        type="button"
        @click="centerMap"
        title="Center map on selected location"
        aria-label="Center map on selected location"
        class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      ><i class="fa-solid fa-crosshairs" aria-hidden="true"></i></button>
    </div>
    <div class="relative min-h-0 flex-1 bg-zinc-100 dark:bg-zinc-800" aria-label="Map preview of selected location">
      <div ref="mapContainer" class="absolute inset-0"></div>
      <div class="absolute left-2 top-2 z-20 rounded-xl border border-zinc-300 bg-white/95 p-0.5 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
        <k-segmented :raised="!isDark" :outline="isDark" class="w-auto" aria-label="Map view">
          <k-segmented-button :active="mapType === 'roadmap'" @click="setMapType('roadmap')" small class="justify-center px-2.5 py-1 text-xs font-bold">Streets</k-segmented-button>
          <k-segmented-button :active="mapType === 'hybrid'" @click="setMapType('hybrid')" small class="justify-center px-2.5 py-1 text-xs font-bold">Satellite</k-segmented-button>
        </k-segmented>
      </div>
      <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
        <svg :style="crosshairStyle" class="absolute h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 drop-shadow" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="17" :fill="pinButtonColor" />
          <g transform="translate(25 25)" fill="none" stroke="#ffffff" stroke-width="3">
            <circle r="9" />
            <path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25" />
            <circle r="2" fill="#ffffff" stroke="none" />
          </g>
        </svg>
      </div>
    </div>
    <p class="shrink-0 border-t border-zinc-200 px-3 py-2 text-[11px] font-mono text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {{ latitude.toFixed(5) }}, {{ longitude.toFixed(5) }}
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { kSegmented, kSegmentedButton } from 'konsta/vue';
import { isDark } from '../services/theme';
import { getMapStyles, hasGoogleMapsKey, loadGoogleMaps } from '../services/googleMaps';

const props = defineProps({
  location: { type: Object, default: () => ({}) },
});

const mapContainer = ref(null);
const crosshairStyle = ref({ left: '50%', top: '50%' });
const mapType = ref('hybrid');
const pinButtonColor = computed(() => (isDark.value ? '#60a5fa' : '#1e3a8a'));
const latitude = computed(() => Number(props.location?.latitude ?? 32.7767));
const longitude = computed(() => Number(props.location?.longitude ?? -96.797));
let mapInstance = null;
let mapGeneration = 0;

async function initializeMap() {
  const container = mapContainer.value;
  const generation = ++mapGeneration;
  if (!container || !hasGoogleMapsKey) return;

  const maps = await loadGoogleMaps();
  if (!maps || generation !== mapGeneration || container !== mapContainer.value) return;

  const position = { lat: latitude.value, lng: longitude.value };
  mapInstance = new maps.Map(container, {
    center: position,
    zoom: 16,
    mapTypeId: mapType.value === 'hybrid' ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    gestureHandling: 'cooperative',
    clickableIcons: false,
    styles: getMapStyles(isDark.value, 'roadmap'),
  });

  const crosshairOverlay = new maps.OverlayView();
  crosshairOverlay.onAdd = () => {};
  crosshairOverlay.draw = () => {
    const point = crosshairOverlay.getProjection()?.fromLatLngToContainerPixel(position);
    if (point) crosshairStyle.value = { left: `${point.x}px`, top: `${point.y}px` };
  };
  crosshairOverlay.onRemove = () => {};
  crosshairOverlay.setMap(mapInstance);
}

function setMapType(type) {
  mapType.value = type;
  mapInstance?.setMapTypeId(type);
}

function centerMap() {
  mapInstance?.panTo({ lat: latitude.value, lng: longitude.value });
}

onMounted(initializeMap);
onBeforeUnmount(() => {
  mapGeneration++;
  mapInstance = null;
});

watch(isDark, (darkMode) => {
  if (mapInstance) mapInstance.setOptions({ styles: getMapStyles(darkMode, mapType.value) });
});
</script>
