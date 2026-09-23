<template>
  <div class="h-[calc(100vh-4rem)] flex flex-col relative overflow-hidden">
    <!-- Top Bar: View Mode Switcher (Map / List) & Quick Stats -->
    <header class="bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 border-b border-slate-700 dark:border-slate-700 light:border-slate-300 px-4 py-2.5 z-30 flex items-center justify-between shadow-sm">
      <!-- Tabs Switcher -->
      <div class="flex items-center bg-slate-900 dark:bg-slate-900 light:bg-slate-200 p-1 rounded-xl border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300">
        <button
          type="button"
          @click="activeTab = 'map'"
          class="touch-target px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
          :class="activeTab === 'map' ? 'bg-st-yellow text-st-navy shadow-sm' : 'text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white'"
        >
          <i class="fa-solid fa-map-location-dot"></i>
          <span>Map View</span>
        </button>

        <button
          type="button"
          @click="activeTab = 'list'"
          class="touch-target px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
          :class="activeTab === 'list' ? 'bg-st-yellow text-st-navy shadow-sm' : 'text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white'"
        >
          <i class="fa-solid fa-list-ul"></i>
          <span>List View ({{ suggestions.length }})</span>
        </button>
      </div>

      <!-- GPS Status / Recenter Badge -->
      <div class="flex items-center gap-2">
        <button
          v-if="!userLocation"
          type="button"
          @click="requestGps"
          class="btn-st-ghost text-xs border border-st-yellow/40 text-st-yellow px-2.5 py-1.5 gap-1"
          title="Enable GPS to sort by distance"
        >
          <i class="fa-solid fa-location-crosshairs"></i>
          <span class="hidden sm:inline">Enable GPS</span>
        </button>
        <span
          v-else
          class="text-xs text-emerald-400 font-semibold hidden sm:flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20"
        >
          <i class="fa-solid fa-location-dot"></i>
          <span>GPS Active</span>
        </span>

        <button
          type="button"
          @click="refreshData"
          :disabled="isLoading"
          class="btn-st-ghost text-xs p-2"
          title="Refresh suggestions"
        >
          <i class="fa-solid fa-arrows-rotate" :class="{ 'animate-spin': isLoading }"></i>
        </button>
      </div>
    </header>

    <!-- TAB 1: MAP VIEW -->
    <div v-show="activeTab === 'map'" class="relative flex-1 w-full h-full bg-slate-900 overflow-hidden">
      <!-- Search Address Overlay with Autocomplete -->
      <div class="absolute top-3 left-3 right-3 sm:right-auto sm:w-96 z-30 flex flex-col">
        <div class="relative flex items-center bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 backdrop-blur-md rounded-xl border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-xl">
          <span class="pl-3 pr-2 text-slate-400">
            <i class="fa-solid fa-magnifying-glass"></i>
          </span>
          <input
            type="text"
            v-model="mapSearchQuery"
            @input="onMapSearchInput"
            placeholder="Search address or neighborhood..."
            class="w-full py-2.5 pr-8 bg-transparent text-xs sm:text-sm text-slate-100 dark:text-slate-100 light:text-st-navy placeholder-slate-400 focus:outline-none"
          />
          <button
            v-if="mapSearchQuery"
            @click="mapSearchQuery = ''; mapSearchResults = []"
            class="p-2 text-slate-400 hover:text-white"
            type="button"
          >
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
          <span v-if="isSearching" class="pr-3 text-slate-400">
            <i class="fa-solid fa-spinner animate-spin text-sm"></i>
          </span>
        </div>

        <!-- Autocomplete dropdown list -->
        <div
          v-if="mapSearchResults.length > 0"
          class="mt-1 bg-dark-card dark:bg-dark-card light:bg-white rounded-xl border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-2xl max-h-56 overflow-y-auto z-40 divide-y divide-slate-800 dark:divide-slate-800 light:divide-slate-200"
        >
          <button
            v-for="item in mapSearchResults"
            :key="item.id"
            type="button"
            @click="selectMapSearchResult(item)"
            class="w-full text-left px-3.5 py-2.5 hover:bg-st-blue/20 dark:hover:bg-slate-800 light:hover:bg-slate-100 transition-colors flex items-start gap-2 text-xs sm:text-sm text-slate-200 dark:text-slate-200 light:text-st-navy"
          >
            <i class="fa-solid fa-location-dot text-st-yellow mt-0.5 flex-shrink-0"></i>
            <span class="line-clamp-2">{{ item.displayName }}</span>
          </button>
        </div>
      </div>

      <!-- Map Canvas Container (Full Viewport) -->
      <div
        ref="browseMapContainer"
        class="relative w-full h-full touch-none select-none cursor-grab active:cursor-grabbing overflow-hidden"
        @mousedown="startPan"
        @mousemove="doPan"
        @mouseup="endPan"
        @mouseleave="endPan"
        @touchstart="startTouchPan"
        @touchmove="doTouchPan"
        @touchend="endTouchPan"
      >
        <!-- Dynamic Map Tiles -->
        <div class="absolute inset-0 transition-transform duration-75 origin-center" :style="mapTransformStyle">
          <div class="grid grid-cols-3 grid-rows-3 w-[300%] h-[300%] -top-[100%] -left-[100%] absolute pointer-events-none">
            <div
              v-for="tile in visibleTiles"
              :key="tile.key"
              class="w-full h-full bg-slate-900 border border-slate-800/40 relative overflow-hidden"
            >
              <img
                :src="tile.url"
                class="w-full h-full object-cover select-none pointer-events-none opacity-90 dark:invert dark:hue-rotate-180 dark:brightness-90 dark:contrast-125"
                alt=""
                loading="lazy"
              />
            </div>
          </div>
        </div>

        <!-- Suggestion Markers Placed Everywhere -->
        <div
          v-for="item in markerPositions"
          :key="item.id"
          class="absolute transform -translate-x-1/2 -translate-y-full cursor-pointer z-20 group transition-transform"
          :style="{ left: `${item.pixelX}px`, top: `${item.pixelY}px` }"
          @click.stop="openPopup(item.suggestion)"
        >
          <div class="flex flex-col items-center hover:scale-110 active:scale-95 transition-transform duration-150">
            <!-- Pin Badge -->
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-xl border-2"
              :class="selectedMarker?.id === item.id ? 'bg-amber-400 text-st-navy border-white ring-4 ring-st-yellow/50 scale-110' : 'bg-st-yellow text-st-navy border-st-navy'"
            >
              <i class="fa-solid fa-map-pin"></i>
            </div>
            <div class="w-2 h-2 bg-st-navy rotate-45 -mt-1 border-r border-b border-st-yellow"></div>
          </div>
        </div>

        <!-- User GPS Location Marker (if available) -->
        <div
          v-if="userMarkerPosition"
          class="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
          :style="{ left: `${userMarkerPosition.pixelX}px`, top: `${userMarkerPosition.pixelY}px` }"
        >
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 rounded-full bg-st-blue/30 animate-ping absolute"></div>
            <div class="w-4 h-4 rounded-full bg-st-blue border-2 border-white shadow-lg"></div>
          </div>
        </div>
      </div>

      <!-- Map Zoom and Recenter Controls Overlay -->
      <div class="absolute bottom-6 right-4 z-30 flex flex-col gap-2">
        <button
          type="button"
          @click="requestGps"
          class="touch-target w-11 h-11 rounded-xl bg-st-navy/90 hover:bg-st-navy text-st-yellow border border-slate-700 shadow-xl flex items-center justify-center backdrop-blur-md active:scale-95 transition"
          title="Center on my location"
          aria-label="Center on my location"
        >
          <i class="fa-solid fa-crosshairs text-lg" :class="{ 'animate-spin': isLocating }"></i>
        </button>

        <div class="flex flex-col rounded-xl overflow-hidden border border-slate-700 shadow-xl bg-st-navy/90 backdrop-blur-md">
          <button
            type="button"
            @click="zoomIn"
            class="touch-target w-11 h-10 hover:bg-st-navy text-slate-100 flex items-center justify-center border-b border-slate-700 active:bg-slate-800"
            aria-label="Zoom in"
          >
            <i class="fa-solid fa-plus text-sm"></i>
          </button>
          <button
            type="button"
            @click="zoomOut"
            class="touch-target w-11 h-10 hover:bg-st-navy text-slate-100 flex items-center justify-center active:bg-slate-800"
            aria-label="Zoom out"
          >
            <i class="fa-solid fa-minus text-sm"></i>
          </button>
        </div>
      </div>

      <!-- Marker Popup Modal / Card Bottom Overlay -->
      <div
        v-if="selectedMarker"
        class="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-20 sm:w-80 z-40 animate-in slide-in-from-bottom-5 duration-200"
      >
        <div class="st-card p-3.5 bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 backdrop-blur-md border border-st-yellow/60 shadow-2xl rounded-2xl">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="font-bold text-sm leading-snug line-clamp-2 text-slate-100 dark:text-slate-100 light:text-st-navy">
              {{ selectedMarker.content?.summary || 'Civic Suggestion' }}
            </h4>
            <button
              @click="selectedMarker = null"
              class="text-slate-400 hover:text-white p-1"
              type="button"
              aria-label="Close popup"
            >
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          <!-- Popup Photo if attached -->
          <div
            v-if="getPrimaryPhoto(selectedMarker)"
            class="w-full h-32 rounded-xl overflow-hidden mb-2.5 bg-slate-800 border border-slate-700"
          >
            <img
              :src="getPrimaryPhoto(selectedMarker)"
              :alt="selectedMarker.content?.summary"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- Location Info & View Link -->
          <div class="flex items-center justify-between text-xs pt-1">
            <span v-if="selectedMarker.location?.address" class="text-slate-400 truncate max-w-[160px]">
              <i class="fa-solid fa-location-dot text-st-yellow mr-1"></i>
              {{ selectedMarker.location.address }}
            </span>
            <span v-else class="text-slate-400">
              <i class="fa-solid fa-calendar mr-1"></i>
              {{ formatTime(selectedMarker.createdAt) }}
            </span>

            <router-link
              :to="`/suggestion/${selectedMarker.id}`"
              class="btn-st-primary text-xs py-1.5 px-3 rounded-lg shadow-none"
            >
              <span>View Suggestion</span>
              <i class="fa-solid fa-arrow-right text-[10px] ml-1"></i>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: LIST VIEW -->
    <div v-show="activeTab === 'list'" class="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 max-w-4xl w-full mx-auto">
      <!-- List View Header with Distance Sorting Indicator -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-700/60">
        <div>
          <h2 class="text-xl font-bold font-serif text-slate-100 dark:text-slate-100 light:text-st-navy">
            Civic Suggestions
          </h2>
          <p class="text-xs text-slate-400">
            <span v-if="userLocation">
              <i class="fa-solid fa-arrow-down-short-wide text-st-yellow mr-1"></i>
              Sorted by distance from your current location (closest first)
            </span>
            <span v-else>
              <i class="fa-solid fa-clock text-st-yellow mr-1"></i>
              Sorted by newest submissions (enable GPS to sort by distance)
            </span>
          </p>
        </div>

        <button
          v-if="!userLocation"
          type="button"
          @click="requestGps"
          class="btn-st-outline text-xs self-start sm:self-auto gap-1.5 py-1.5"
        >
          <i class="fa-solid fa-location-crosshairs text-st-yellow"></i>
          <span>Sort by My Distance</span>
        </button>
      </div>

      <!-- Suggestions List -->
      <div v-if="sortedListSuggestions.length > 0" class="space-y-3.5">
        <!-- List Card item -->
        <div
          v-for="item in sortedListSuggestions"
          :key="item.id"
          class="st-card p-3.5 sm:p-4 hover:border-st-yellow/70 transition-all flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between"
        >
          <!-- Left: Thumbnail and Summary -->
          <div class="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <!-- Photo thumbnail -->
            <div class="w-20 h-20 sm:w-24 sm:h-20 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700 relative">
              <img
                v-if="getPrimaryPhoto(item)"
                :src="getPrimaryPhoto(item)"
                :alt="item.content?.summary"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-slate-500 bg-slate-900">
                <i class="fa-solid fa-camera text-base"></i>
              </div>

              <!-- Distance Badge -->
              <span
                v-if="item._formattedDistance"
                class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-st-navy/90 text-st-yellow border border-st-yellow/30"
              >
                {{ item._formattedDistance }}
              </span>
            </div>

            <!-- Summary Text and Meta -->
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-sm sm:text-base text-slate-100 dark:text-slate-100 light:text-st-navy line-clamp-2 leading-snug">
                {{ item.content?.summary || 'Public Improvement' }}
              </h3>
              <p v-if="item.location?.address" class="text-xs text-slate-400 truncate mt-1">
                <i class="fa-solid fa-location-dot text-st-yellow mr-1"></i>
                {{ item.location.address }}
              </p>
              <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                <span>By {{ item.author?.name || 'Anonymous' }}</span>
                <span>•</span>
                <span>{{ formatTime(item.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Right: View Suggestion Button Link -->
          <router-link
            :to="`/suggestion/${item.id}`"
            class="btn-st-primary text-xs py-2 px-4 flex-shrink-0 w-full sm:w-auto text-center touch-target"
          >
            <span>View suggestion</span>
            <i class="fa-solid fa-arrow-right ml-1.5"></i>
          </router-link>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="st-card text-center py-12">
        <i class="fa-solid fa-inbox text-3xl text-slate-500 mb-2"></i>
        <h3 class="text-base font-bold">No suggestions found</h3>
        <p class="text-xs text-slate-400 mb-4">Be the first to add an idea to the map!</p>
        <router-link to="/submit" class="btn-st-primary text-xs">
          Submit Suggestion
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { getSuggestions } from '../services/api';
import { sortSuggestionsByDistance } from '../services/geo';
import { searchAddress } from '../services/nominatim';

const activeTab = ref('map'); // 'map' | 'list'
const suggestions = ref([]);
const isLoading = ref(false);
const userLocation = ref(null); // { lat, lng }
const isLocating = ref(false);
const selectedMarker = ref(null);

// Map view pan/zoom state
const centerLat = ref(32.7767);
const centerLng = ref(-96.7970);
const zoom = ref(13);
const offsetX = ref(0);
const offsetY = ref(0);
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const browseMapContainer = ref(null);

// Address search
const mapSearchQuery = ref('');
const mapSearchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

// Tile computation
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

const mapTransformStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px)`
}));

// Project lat/lon to container pixels relative to center
function coordToPixel(lat, lon) {
  const container = browseMapContainer.value;
  const width = container ? container.clientWidth : 800;
  const height = container ? container.clientHeight : 600;

  const scale = Math.pow(2, zoom.value);
  const worldX = ((lon + 180) / 360) * 256 * scale;
  const sinY = Math.sin((lat * Math.PI) / 180);
  const worldY = (0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI)) * 256 * scale;

  const centerWorldX = ((centerLng.value + 180) / 360) * 256 * scale;
  const centerSinY = Math.sin((centerLat.value * Math.PI) / 180);
  const centerWorldY = (0.5 - Math.log((1 + centerSinY) / (1 - centerSinY)) / (4 * Math.PI)) * 256 * scale;

  const pixelX = width / 2 + (worldX - centerWorldX) + offsetX.value;
  const pixelY = height / 2 + (worldY - centerWorldY) + offsetY.value;

  return { pixelX, pixelY };
}

const markerPositions = computed(() => {
  return suggestions.value
    .filter(s => s.location && s.location.latitude && s.location.longitude)
    .map(s => {
      const { pixelX, pixelY } = coordToPixel(s.location.latitude, s.location.longitude);
      return {
        id: s.id,
        suggestion: s,
        pixelX,
        pixelY
      };
    });
});

const userMarkerPosition = computed(() => {
  if (!userLocation.value) return null;
  return coordToPixel(userLocation.value.lat, userLocation.value.lng);
});

// Sorted suggestions for List View
const sortedListSuggestions = computed(() => {
  if (userLocation.value) {
    return sortSuggestionsByDistance(suggestions.value, userLocation.value.lat, userLocation.value.lng);
  }
  // Sort by timestamp newest first
  return [...suggestions.value].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
});

function getPrimaryPhoto(item) {
  const photos = item.content?.photos || item.photos || [];
  return photos.length > 0 ? photos[0].url : '';
}

function formatTime(timestamp) {
  if (!timestamp) return 'Recently';
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function openPopup(suggestion) {
  selectedMarker.value = suggestion;
}

// Map gestures
function startPan(e) {
  isDragging.value = true;
  startX.value = e.clientX - offsetX.value;
  startY.value = e.clientY - offsetY.value;
}
function doPan(e) {
  if (!isDragging.value) return;
  offsetX.value = e.clientX - startX.value;
  offsetY.value = e.clientY - startY.value;
}
function endPan() {
  if (!isDragging.value) return;
  isDragging.value = false;
  commitPan();
}

function startTouchPan(e) {
  if (e.touches.length === 1) {
    isDragging.value = true;
    startX.value = e.touches[0].clientX - offsetX.value;
    startY.value = e.touches[0].clientY - offsetY.value;
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
  commitPan();
}

function commitPan() {
  const scale = Math.pow(2, zoom.value);
  centerLng.value += (-offsetX.value / (256 * scale)) * 360;
  centerLat.value += (offsetY.value / (256 * scale)) * 170;
  offsetX.value = 0;
  offsetY.value = 0;
}

function zoomIn() {
  if (zoom.value < 18) zoom.value++;
}
function zoomOut() {
  if (zoom.value > 5) zoom.value--;
}

// Search handling
function onMapSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = mapSearchQuery.value.trim();
  if (q.length < 3) {
    mapSearchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    mapSearchResults.value = await searchAddress(q, 5);
    isSearching.value = false;
  }, 350);
}

function selectMapSearchResult(item) {
  centerLat.value = item.latitude;
  centerLng.value = item.longitude;
  zoom.value = 15;
  offsetX.value = 0;
  offsetY.value = 0;
  mapSearchQuery.value = item.displayName;
  mapSearchResults.value = [];
}

// Geolocation
function requestGps() {
  if (!navigator.geolocation) return;
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      isLocating.value = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      userLocation.value = { lat, lng };
      centerLat.value = lat;
      centerLng.value = lng;
      zoom.value = 14;
      offsetX.value = 0;
      offsetY.value = 0;
    },
    (err) => {
      isLocating.value = false;
      console.warn('GPS error:', err);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function refreshData() {
  isLoading.value = true;
  try {
    suggestions.value = await getSuggestions(true);
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  // Request GPS on load as specified
  requestGps();
  // Fetch suggestions
  suggestions.value = await getSuggestions(false);
});
</script>
