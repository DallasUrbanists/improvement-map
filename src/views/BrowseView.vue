<template>
  <div class="h-[calc(100vh-4rem)] flex flex-col relative overflow-hidden">
    <!-- Top Bar: View Mode Switcher (Map / List) & Quick Stats -->
    <header class="bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 border-b border-slate-700 dark:border-slate-700 light:border-slate-300 px-4 py-2.5 z-30 flex items-center justify-between shadow-sm">
      <!-- Tabs Switcher -->
      <div class="flex items-center bg-slate-900 dark:bg-slate-900 light:bg-slate-200 p-1 rounded-xl border border-slate-700/60 dark:border-slate-700/60 light:border-slate-300">
        <button
          type="button"
          @click="setTab('map')"
          class="touch-target px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
          :class="activeTab === 'map' ? 'bg-st-yellow text-st-navy shadow-sm' : 'text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white'"
        >
          <i class="fa-solid fa-map-location-dot"></i>
          <span>Map View</span>
        </button>

        <button
          type="button"
          @click="setTab('list')"
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

    <!-- TAB 1: MAP VIEW (Google Maps SDK) -->
    <div v-show="activeTab === 'map'" class="relative flex-1 w-full h-full bg-slate-900 overflow-hidden">
      <!-- Search Address Overlay with Autocomplete (Google Places / Geocoder) -->
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

      <!-- Basemap Switcher (Streets / Satellite) -->
      <div class="absolute top-3 right-3 z-30 flex items-center bg-dark-card/95 dark:bg-dark-card/95 light:bg-white/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-lg p-1">
        <button
          type="button"
          @click="setMapType('roadmap')"
          class="px-2.5 py-1 text-xs font-bold rounded-lg transition-colors"
          :class="currentMapType === 'roadmap' ? 'bg-st-yellow text-st-navy shadow-sm' : 'text-slate-300 hover:text-white'"
        >
          <i class="fa-solid fa-road mr-1"></i>
          Streets
        </button>
        <button
          type="button"
          @click="setMapType('hybrid')"
          class="px-2.5 py-1 text-xs font-bold rounded-lg transition-colors"
          :class="currentMapType === 'hybrid' ? 'bg-st-yellow text-st-navy shadow-sm' : 'text-slate-300 hover:text-white'"
        >
          <i class="fa-solid fa-earth-americas mr-1"></i>
          Satellite
        </button>
      </div>

      <!-- Google Map Target Container Wrapper -->
      <div class="relative w-full h-full min-h-[400px] bg-slate-900 overflow-hidden">
        <!-- Dedicated Google Map Canvas Container -->
        <div
          ref="browseMapContainerEl"
          class="w-full h-full min-h-[400px] bg-slate-900"
          style="width: 100%; height: 100%; min-height: 100%;"
        ></div>

        <!-- Missing API Key or Auth Error Notice -->
        <div
          v-if="!hasGoogleMapsKey || googleMapsAuthError"
          class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 text-slate-300 z-20 backdrop-blur-sm"
        >
          <i class="fa-solid fa-triangle-exclamation text-3xl text-st-yellow mb-3"></i>
          <h4 class="text-base font-bold text-white mb-1">Google Maps Setup Required</h4>
          <p class="text-xs text-slate-300 max-w-sm mb-4 leading-relaxed">
            {{ googleMapsAuthError || 'Set VITE_GOOGLE_MAPS_API_KEY in your .env file and restart Vite (npm run dev).' }}
          </p>
          <div class="text-[11px] text-slate-400 bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-left max-w-sm mb-4">
            <div class="font-semibold text-st-yellow mb-1">Required in Google Cloud Console:</div>
            <ul class="list-disc list-inside space-y-0.5">
              <li><strong>Maps JavaScript API</strong> enabled</li>
              <li><strong>Places API</strong> enabled</li>
              <li><strong>Geocoding API</strong> enabled</li>
              <li>Billing account linked to GCP project</li>
            </ul>
          </div>
          <button
            type="button"
            @click="setTab('list')"
            class="btn-st-primary text-xs px-4 py-2"
          >
            <i class="fa-solid fa-list-ul mr-1.5"></i>
            Open List Mode
          </button>
        </div>

        <!-- Loading indicator while SDK initializes -->
        <div
          v-else-if="!isMapReady"
          class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 z-10"
        >
          <i class="fa-solid fa-spinner animate-spin text-2xl text-st-yellow mb-2"></i>
          <span class="text-xs font-semibold">Loading Map...</span>
        </div>
      </div>

      <!-- Map Recenter Controls Overlay -->
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
              <span>View suggestion</span>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { isDark } from '../services/theme';
import { getSuggestions } from '../services/api';
import { sortSuggestionsByDistance } from '../services/geo';
import {
  loadGoogleMaps,
  hasGoogleMapsKey,
  googleMapsAuthError,
  searchAddressWithGoogle,
  resolveGooglePlace,
  getMapStyles,
  updateMapTheme,
} from '../services/googleMaps';

const activeTab = ref('map'); // 'map' | 'list'
const suggestions = ref([]);
const isLoading = ref(false);
const userLocation = ref(null); // { lat, lng }
const isLocating = ref(false);
const selectedMarker = ref(null);
const currentMapType = ref('roadmap');

// Map DOM & State
const browseMapContainerEl = ref(null);
const isMapReady = ref(false);
let map = null;
let googleMaps = null;
let markersArray = [];
let userLocationMarker = null;

// Address search state
const mapSearchQuery = ref('');
const mapSearchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

// Sorted suggestions for List View
const sortedListSuggestions = computed(() => {
  if (userLocation.value) {
    return sortSuggestionsByDistance(suggestions.value, userLocation.value.lat, userLocation.value.lng);
  }
  return [...suggestions.value].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
});

function setTab(tab) {
  activeTab.value = tab;
  if (tab === 'map' && map && googleMaps) {
    setTimeout(() => {
      googleMaps.event?.trigger(map, 'resize');
    }, 100);
  }
}

function setMapType(type) {
  currentMapType.value = type;
  if (!map || !googleMaps) return;
  if (type === 'hybrid') {
    map.setMapTypeId(googleMaps.MapTypeId.HYBRID);
    map.setOptions({ styles: [] });
  } else {
    map.setMapTypeId(googleMaps.MapTypeId.ROADMAP);
    map.setOptions({ styles: getMapStyles(isDark.value, 'roadmap') });
  }
}

// Watch theme changes to update Streets basemap styling dynamically
watch(isDark, (darkMode) => {
  if (!map || !googleMaps) return;
  updateMapTheme(map, darkMode, currentMapType.value);
});

async function initGoogleMap() {
  try {
    googleMaps = await loadGoogleMaps();
    if (!browseMapContainerEl.value || !googleMaps) return;

    const initialCenter = userLocation.value
      ? { lat: userLocation.value.lat, lng: userLocation.value.lng }
      : { lat: 32.7767, lng: -96.7970 };

    // Default Streets view (ROADMAP) with dark/night basemap in dark mode and light/day basemap in light mode
    map = new googleMaps.Map(browseMapContainerEl.value, {
      center: initialCenter,
      zoom: 13,
      mapTypeId: googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    isMapReady.value = true;
    renderSuggestionMarkers();

    nextTick(() => {
      if (map && googleMaps) {
        googleMaps.event?.trigger(map, 'resize');
        map.setCenter(initialCenter);
      }
    });
    setTimeout(() => {
      if (map && googleMaps) {
        googleMaps.event?.trigger(map, 'resize');
        map.setCenter(initialCenter);
      }
    }, 250);
  } catch (err) {
    console.warn('Google Maps BrowseView init warning:', err);
    isMapReady.value = true;
  }
}

function renderSuggestionMarkers() {
  if (!map || !googleMaps) return;

  // Clear existing markers
  markersArray.forEach((m) => m.setMap(null));
  markersArray = [];

  // Add Google Maps markers for each suggestion
  suggestions.value.forEach((s) => {
    const lat = s.location?.latitude ?? s.latitude;
    const lng = s.location?.longitude ?? s.longitude;
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      const gMarker = new googleMaps.Marker({
        position: { lat: Number(lat), lng: Number(lng) },
        map,
        title: s.content?.summary || 'Suggestion',
        animation: googleMaps.Animation?.DROP,
      });

      gMarker.addListener('click', () => {
        openPopup(s);
      });

      markersArray.push(gMarker);
    }
  });

  // Render user location marker if available
  if (userLocation.value) {
    if (userLocationMarker) userLocationMarker.setMap(null);
    userLocationMarker = new googleMaps.Marker({
      position: { lat: userLocation.value.lat, lng: userLocation.value.lng },
      map,
      title: 'Your Location',
      icon: {
        path: googleMaps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#488BE3',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
  }
}

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

// Search handling with Google Maps Autocomplete / Geocoder
function onMapSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = mapSearchQuery.value.trim();
  if (q.length < 2) {
    mapSearchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    mapSearchResults.value = await searchAddressWithGoogle(q);
    isSearching.value = false;
  }, 350);
}

async function selectMapSearchResult(item) {
  mapSearchQuery.value = item.displayName;
  mapSearchResults.value = [];

  let lat = item.latitude;
  let lng = item.longitude;

  if (lat === undefined || lng === undefined) {
    const resolved = await resolveGooglePlace(item.placeId || item.displayName);
    if (resolved) {
      lat = resolved.latitude;
      lng = resolved.longitude;
    }
  }

  if (lat !== undefined && lng !== undefined && map) {
    map.setCenter({ lat, lng });
    map.setZoom(15);
  }
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

      if (map) {
        map.setCenter({ lat, lng });
        map.setZoom(14);
        renderSuggestionMarkers();
      }
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
    renderSuggestionMarkers();
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => suggestions.value,
  () => {
    renderSuggestionMarkers();
  },
  { deep: true }
);

onMounted(async () => {
  requestGps();
  suggestions.value = await getSuggestions(false);
  initGoogleMap();
});
</script>
