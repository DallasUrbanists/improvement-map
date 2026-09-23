<template>
  <div class="relative w-full h-[60vh] min-h-[380px] max-h-[600px] rounded-2xl overflow-hidden border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-inner flex flex-col bg-slate-900">
    <!-- Search Bar Overlay with Autocomplete Dropdown -->
    <div class="absolute top-3 left-3 right-3 z-30 flex flex-col">
      <div class="relative flex items-center bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 backdrop-blur-md rounded-xl border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-lg">
        <span class="pl-3.5 pr-2 text-slate-400">
          <i class="fa-solid fa-magnifying-glass"></i>
        </span>
        <input
          type="text"
          v-model="searchQuery"
          @input="onSearchInput"
          placeholder="Search address or street corridor..."
          class="w-full py-2.5 pr-8 bg-transparent text-sm text-slate-100 dark:text-slate-100 light:text-st-navy placeholder-slate-400 focus:outline-none"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''; searchResults = []"
          class="p-2 text-slate-400 hover:text-slate-200"
          type="button"
          aria-label="Clear search"
        >
          <i class="fa-solid fa-xmark text-sm"></i>
        </button>
        <span v-if="isSearching" class="pr-3 text-slate-400">
          <i class="fa-solid fa-spinner animate-spin text-sm"></i>
        </span>
      </div>

      <!-- Autocomplete Dropdown Menu -->
      <div
        v-if="searchResults.length > 0"
        class="mt-1 bg-dark-card dark:bg-dark-card light:bg-white rounded-xl border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-2xl max-h-52 overflow-y-auto z-40 divide-y divide-slate-800 dark:divide-slate-800 light:divide-slate-200"
      >
        <button
          v-for="item in searchResults"
          :key="item.id"
          type="button"
          @click="selectAddress(item)"
          class="w-full text-left px-3.5 py-2.5 hover:bg-st-blue/20 dark:hover:bg-slate-800 light:hover:bg-slate-100 transition-colors flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 dark:text-slate-200 light:text-st-navy"
        >
          <i class="fa-solid fa-location-dot text-st-yellow mt-0.5 flex-shrink-0"></i>
          <span class="line-clamp-2">{{ item.displayName }}</span>
        </button>
      </div>
    </div>

    <!-- Map Canvas / Tile Container -->
    <div
      ref="mapContainer"
      class="relative w-full flex-1 touch-none select-none overflow-hidden cursor-crosshair"
      @mousedown="startPan"
      @mousemove="doPan"
      @mouseup="endPan"
      @mouseleave="endPan"
      @touchstart="startTouchPan"
      @touchmove="doTouchPan"
      @touchend="endTouchPan"
      @click="onMapClick"
    >
      <!-- Interactive Dynamic OpenStreetMap / Canvas Renderer -->
      <div
        class="absolute inset-0 transition-transform duration-75 origin-center"
        :style="mapTransformStyle"
      >
        <div class="grid grid-cols-3 grid-rows-3 w-[300%] h-[300%] -top-[100%] -left-[100%] absolute pointer-events-none">
          <div
            v-for="tile in visibleTiles"
            :key="tile.key"
            class="w-full h-full bg-slate-900 border border-slate-800/40 relative overflow-hidden"
          >
            <img
              :src="tile.url"
              class="w-full h-full object-cover select-none pointer-events-none opacity-85 dark:invert dark:hue-rotate-180 dark:brightness-90 dark:contrast-125 transition-opacity"
              alt=""
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <!-- Center Crosshair / Location Marker Pin -->
      <div
        class="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full transition-transform duration-100 z-20"
        :style="markerPositionStyle"
      >
        <div class="flex flex-col items-center animate-bounce-short">
          <div class="w-9 h-9 rounded-full bg-st-yellow text-st-navy shadow-xl flex items-center justify-center font-bold border-2 border-st-navy text-lg">
            <i class="fa-solid fa-location-dot"></i>
          </div>
          <div class="w-2.5 h-2.5 bg-st-navy rotate-45 -mt-1.5 border-r border-b border-st-yellow"></div>
          <div class="w-4 h-1.5 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      </div>

      <!-- Map Instructions Overlay on First Load -->
      <div
        v-if="showHint"
        class="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-st-navy/90 text-white text-xs px-3.5 py-1.5 rounded-full border border-st-yellow/40 shadow-lg backdrop-blur-sm pointer-events-none flex items-center gap-1.5"
      >
        <i class="fa-solid fa-hand-pointer text-st-yellow"></i>
        Tap anywhere or drag to set location
      </div>
    </div>

    <!-- Map Action Floating Overlay Buttons -->
    <div class="absolute bottom-3 right-3 z-30 flex flex-col gap-2">
      <!-- Recenter on GPS Coordinates -->
      <button
        type="button"
        @click="requestGpsLocation"
        :disabled="isLocating"
        class="touch-target w-11 h-11 rounded-xl bg-st-navy/90 hover:bg-st-navy text-st-yellow border border-slate-700 shadow-xl flex items-center justify-center backdrop-blur-md active:scale-95 transition"
        title="Recenter to my current GPS location"
        aria-label="Recenter to current GPS location"
      >
        <i class="fa-solid fa-crosshairs text-lg" :class="{ 'animate-spin': isLocating }"></i>
      </button>

      <!-- Zoom In / Out Controls -->
      <div class="flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-xl bg-st-navy/90 backdrop-blur-md">
        <button
          type="button"
          @click="zoomIn"
          class="touch-target w-11 h-10 hover:bg-st-navy text-slate-100 flex items-center justify-center border-b border-slate-700 active:bg-slate-800"
          aria-label="Zoom In"
        >
          <i class="fa-solid fa-plus text-sm"></i>
        </button>
        <button
          type="button"
          @click="zoomOut"
          class="touch-target w-11 h-10 hover:bg-st-navy text-slate-100 flex items-center justify-center active:bg-slate-800"
          aria-label="Zoom Out"
        >
          <i class="fa-solid fa-minus text-sm"></i>
        </button>
      </div>
    </div>

    <!-- Describe Location Overlay Button (Bottom Left) -->
    <div class="absolute bottom-3 left-3 z-30">
      <button
        type="button"
        @click="openLocationDescModal"
        class="touch-target inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-st-navy/90 hover:bg-st-navy text-white text-xs sm:text-sm font-semibold border border-slate-700 shadow-xl backdrop-blur-md active:scale-95 transition"
      >
        <i class="fa-solid fa-comment-dots text-st-yellow"></i>
        <span>{{ modelValue.description ? 'Edit Description' : 'Describe location' }}</span>
      </button>
    </div>

    <!-- Active Location Summary Badge (Top Banner) -->
    <div class="px-3.5 py-2 bg-dark-card dark:bg-dark-card light:bg-slate-100 border-t border-slate-700 dark:border-slate-700 light:border-slate-300 text-xs flex items-center justify-between gap-2">
      <div class="truncate flex items-center gap-1.5 text-slate-300 dark:text-slate-300 light:text-slate-700">
        <i class="fa-solid fa-map-pin text-st-yellow"></i>
        <span class="font-semibold">{{ displayAddress || 'Tap on map or search address' }}</span>
      </div>
      <div v-if="modelValue.latitude" class="text-[11px] text-slate-400 font-mono flex-shrink-0">
        {{ Number(modelValue.latitude).toFixed(4) }}, {{ Number(modelValue.longitude).toFixed(4) }}
      </div>
    </div>

    <!-- Describe Location Modal Dialog -->
    <div
      v-if="isDescModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      @click.self="discardDescModal"
    >
      <div class="st-card max-w-lg w-full p-5 sm:p-6 bg-dark-card text-white shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold font-serif flex items-center gap-2">
            <i class="fa-solid fa-comment-dots text-st-yellow"></i>
            Describe Location
          </h3>
          <button @click="discardDescModal" class="text-slate-400 hover:text-white p-1">
            <i class="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        <p class="text-xs sm:text-sm text-slate-300 mb-4">
          Add landmarks, intersection details, or specific physical cues (e.g., "Northwest corner in front of the bakery").
        </p>

        <textarea
          v-model="tempDescription"
          rows="3"
          placeholder="e.g., Along Elm St between Harwood and St Paul, opposite Pegasus Plaza..."
          class="st-input mb-5"
          autofocus
        ></textarea>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            @click="discardDescModal"
            class="btn-st-ghost text-sm px-4 py-2 border border-slate-700"
          >
            Discard
          </button>
          <button
            type="button"
            @click="saveDescModal"
            class="btn-st-primary text-sm px-5 py-2"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { searchAddress, reverseGeocode } from '../services/nominatim';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      latitude: 32.7767,
      longitude: -96.7970,
      address: '',
      description: '',
    })
  }
});

const emit = defineEmits(['update:modelValue']);

// Map coordinates state
const centerLat = ref(props.modelValue.latitude || 32.7767);
const centerLng = ref(props.modelValue.longitude || -96.7970);
const zoom = ref(15);
const showHint = ref(true);

// Search state
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

// Modal state
const isDescModalOpen = ref(false);
const tempDescription = ref('');
const isLocating = ref(false);

// Pan state
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const offsetX = ref(0);
const offsetY = ref(0);
const mapContainer = ref(null);

// Address string
const displayAddress = computed(() => {
  if (props.modelValue.address) return props.modelValue.address;
  if (props.modelValue.latitude) {
    return `${Number(props.modelValue.latitude).toFixed(4)}, ${Number(props.modelValue.longitude).toFixed(4)}`;
  }
  return '';
});

// Tile computation for smooth OpenStreetMap rendering
function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function lat2tile(lat, z) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, z)
  );
}

const visibleTiles = computed(() => {
  const z = Math.min(18, Math.max(2, Math.round(zoom.value)));
  const x = lon2tile(centerLng.value, z);
  const y = lat2tile(centerLat.value, z);

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const curX = x + dx;
      const curY = y + dy;
      tiles.push({
        key: `${z}/${curX}/${curY}`,
        url: `https://tile.openstreetmap.org/${z}/${curX}/${curY}.png`
      });
    }
  }
  return tiles;
});

const mapTransformStyle = computed(() => {
  return {
    transform: `translate(${offsetX.value}px, ${offsetY.value}px)`
  };
});

const markerPositionStyle = computed(() => {
  return {
    top: '50%',
    left: '50%'
  };
});

// Geolocation
function requestGpsLocation() {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser');
    return;
  }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      isLocating.value = false;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      centerLat.value = lat;
      centerLng.value = lng;
      zoom.value = 16;
      offsetX.value = 0;
      offsetY.value = 0;

      const addr = await reverseGeocode(lat, lng);
      emit('update:modelValue', {
        ...props.modelValue,
        latitude: lat,
        longitude: lng,
        address: addr,
      });
    },
    (err) => {
      isLocating.value = false;
      console.warn('GPS location error:', err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Search handling with debounce
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = searchQuery.value.trim();
  if (q.length < 3) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    searchResults.value = await searchAddress(q, 5);
    isSearching.value = false;
  }, 350);
}

function selectAddress(item) {
  centerLat.value = item.latitude;
  centerLng.value = item.longitude;
  zoom.value = 16;
  offsetX.value = 0;
  offsetY.value = 0;
  searchQuery.value = item.displayName;
  searchResults.value = [];

  emit('update:modelValue', {
    ...props.modelValue,
    latitude: item.latitude,
    longitude: item.longitude,
    address: item.displayName,
  });
}

// Pan & touch gestures
function startPan(e) {
  isDragging.value = true;
  startX.value = e.clientX - offsetX.value;
  startY.value = e.clientY - offsetY.value;
  showHint.value = false;
}
function doPan(e) {
  if (!isDragging.value) return;
  offsetX.value = e.clientX - startX.value;
  offsetY.value = e.clientY - startY.value;
}
function endPan() {
  if (!isDragging.value) return;
  isDragging.value = false;
  commitPanCoordinates();
}

function startTouchPan(e) {
  if (e.touches.length === 1) {
    isDragging.value = true;
    startX.value = e.touches[0].clientX - offsetX.value;
    startY.value = e.touches[0].clientY - offsetY.value;
    showHint.value = false;
  }
}
function doTouchPan(e) {
  if (!isDragging.value || e.touches.length !== 1) return;
  offsetX.value = e.touches[0].clientX - startX.value;
  offsetY.value = e.touches[0].clientY - startY.value;
}
function endTouchPan() {
  if (!isDragging.value) return;
  isDragging.value = false;
  commitPanCoordinates();
}

function commitPanCoordinates() {
  // Convert offset px to lat/lng delta
  const scale = Math.pow(2, zoom.value);
  const deltaLng = (-offsetX.value / (256 * scale)) * 360;
  const deltaLat = (offsetY.value / (256 * scale)) * 170;

  centerLng.value += deltaLng;
  centerLat.value += deltaLat;
  offsetX.value = 0;
  offsetY.value = 0;

  updateCoordinates(centerLat.value, centerLng.value);
}

function onMapClick(e) {
  if (isDragging.value) return;
  showHint.value = false;
  // Update center coordinate directly
  updateCoordinates(centerLat.value, centerLng.value);
}

async function updateCoordinates(lat, lng) {
  const addr = await reverseGeocode(lat, lng);
  emit('update:modelValue', {
    ...props.modelValue,
    latitude: lat,
    longitude: lng,
    address: addr || props.modelValue.address,
  });
}

function zoomIn() {
  if (zoom.value < 18) zoom.value++;
}
function zoomOut() {
  if (zoom.value > 5) zoom.value--;
}

// Modal actions
function openLocationDescModal() {
  tempDescription.value = props.modelValue.description || '';
  isDescModalOpen.value = true;
}
function discardDescModal() {
  isDescModalOpen.value = false;
}
function saveDescModal() {
  emit('update:modelValue', {
    ...props.modelValue,
    description: tempDescription.value.trim()
  });
  isDescModalOpen.value = false;
}

onMounted(() => {
  // If coordinates already exist in draft, center there
  if (props.modelValue.latitude && props.modelValue.longitude) {
    centerLat.value = props.modelValue.latitude;
    centerLng.value = props.modelValue.longitude;
  } else {
    // Attempt automatic GPS location request on mount as required by spec
    requestGpsLocation();
  }
});
</script>

<style scoped>
@keyframes bounce-short {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.animate-bounce-short {
  animation: bounce-short 1.5s ease-in-out infinite;
}
</style>
