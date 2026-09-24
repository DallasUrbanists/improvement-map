<template>
  <div class="flex-grow flex flex-col relative overflow-hidden h-full min-h-0">

    <!-- TAB 1: MAP VIEW (Google Maps SDK) -->
    <div v-show="activeTab === 'map'" class="flex-grow relative min-h-0 h-full">
      <!-- Search Address Overlay with Autocomplete (Google Places / Geocoder) -->
      <div class="absolute top-3 left-3 right-3 sm:right-auto sm:w-96 z-30 flex flex-col">
        <div
          class="relative flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-xl">
          <span class="pl-3 pr-2 text-zinc-400">
            <i class="fa-solid fa-magnifying-glass"></i>
          </span>
          <input type="text" v-model="mapSearchQuery" @input="onMapSearchInput"
            placeholder="Search address or neighborhood..."
            class="w-full py-2.5 pr-8 bg-transparent text-xs sm:text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none" />
          <button v-if="mapSearchQuery" @click="mapSearchQuery = ''; mapSearchResults = []"
            class="p-2 text-zinc-400 hover:text-black dark:hover:text-white" type="button">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
          <span v-if="isSearching" class="pr-3 text-zinc-400">
            <i class="fa-solid fa-spinner animate-spin text-sm"></i>
          </span>
        </div>

        <!-- Autocomplete dropdown list -->
        <div v-if="mapSearchResults.length > 0"
          class="mt-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xl max-h-56 overflow-y-auto z-40 divide-y divide-zinc-200 dark:divide-zinc-800">
          <button v-for="item in mapSearchResults" :key="item.id" type="button" @click="selectMapSearchResult(item)"
            class="w-full text-left px-3.5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-2 text-xs sm:text-sm text-black dark:text-white">
            <i class="fa-solid fa-location-dot mt-0.5 flex-shrink-0 text-zinc-500"></i>
            <span class="line-clamp-2">{{ item.displayName }}</span>
          </button>
        </div>
      </div>

      <!-- Basemap Switcher (Streets / Satellite) with Konsta Segmented -->
      <div
        class="absolute bottom-3 left-3 z-30 flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-lg p-0.5">
        <k-segmented :raised="true" class="w-auto">
          <k-segmented-button :active="currentMapType === 'roadmap'" @click="setMapType('roadmap')" small
            class="text-xs font-bold px-2.5 py-1">
            <i class="fa-solid fa-road mr-1"></i>
            Streets
          </k-segmented-button>
          <k-segmented-button :active="currentMapType === 'hybrid'" @click="setMapType('hybrid')" small
            class="text-xs font-bold px-2.5 py-1">
            <i class="fa-solid fa-earth-americas mr-1"></i>
            Satellite
          </k-segmented-button>
          <k-segmented-button @click="requestGps" small
            class="text-xs font-bold px-2.5 py-1"
            title="Center on my location" aria-label="Center on my location">
            <i class="fa-solid fa-crosshairs mr-1" :class="{ 'animate-spin': isLocating }"></i>
            Recenter
          </k-segmented-button>
        </k-segmented>
      </div>

      <!-- Google Map Target Container Wrapper -->
      <div class="absolute top-0 right-0 left-0 bottom-0">
        <!-- Dedicated Google Map Canvas Container -->
        <div ref="browseMapContainerEl" class="w-full h-full min-h-[400px] bg-zinc-900"
          style="width: 100%; height: 100%; min-height: 100%;"></div>

        <!-- Missing API Key or Auth Error Notice -->
        <div v-if="!hasGoogleMapsKey || googleMapsAuthError"
          class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/95 text-zinc-300 z-20 backdrop-blur-sm">
          <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500 mb-3"></i>
          <h4 class="text-base font-bold text-white mb-1">Google Maps Setup Required</h4>
          <p class="text-xs text-zinc-300 max-w-sm mb-4 leading-relaxed">
            {{ googleMapsAuthError || 'Set VITE_GOOGLE_MAPS_API_KEY in your .env file and restart Vite (npm run dev).'
            }}
          </p>
          <div
            class="text-[11px] text-zinc-400 bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 text-left max-w-sm mb-4">
            <div class="font-semibold text-zinc-200 mb-1">Required in Google Cloud Console:</div>
            <ul class="list-disc list-inside space-y-0.5">
              <li><strong>Maps JavaScript API</strong> enabled</li>
              <li><strong>Places API</strong> enabled</li>
              <li><strong>Geocoding API</strong> enabled</li>
              <li>Billing account linked to GCP project</li>
            </ul>
          </div>
          <k-button type="button" @click="setTab('list')" :rounded="true" small inline
            class="text-xs font-semibold px-4">
            <i class="fa-solid fa-list-ul mr-1.5"></i>
            Open List Mode
          </k-button>
        </div>

        <!-- Loading indicator while SDK initializes -->
        <div v-else-if="!isMapReady"
          class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 z-10">
          <k-preloader class="w-8 h-8 mb-2" />
          <span class="text-xs font-semibold">Loading Map...</span>
        </div>
      </div>

    </div>

    <!-- TAB 2: LIST VIEW -->
    <div v-show="activeTab === 'list'"
      class="flex-grow overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 py-6 max-w-4xl w-full mx-auto">
      <div class="mb-4">
        <h2 class="text-xl sm:text-2xl font-bold">Civic Suggestions</h2>
      </div>

      <!-- List View Header with Distance Sorting Indicator -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          <span v-if="userLocation">
            <i class="fa-solid fa-arrow-down-short-wide mr-1 text-zinc-600 dark:text-zinc-300"></i>
            Sorted by distance from your current location
          </span>
          <span v-else>
            <i class="fa-solid fa-clock mr-1 text-zinc-600 dark:text-zinc-300"></i>
            Sorted by newest submissions
          </span>
        </p>

        <k-button v-if="!userLocation" type="button" @click="requestGps" :outline="true" :rounded="true" small
          class="text-xs self-start sm:self-auto gap-1.5 py-1.5">
          <i class="fa-solid fa-location-crosshairs mr-1"></i>
          <span>Sort by My Distance</span>
        </k-button>
      </div>

      <!-- Suggestions List -->
      <div v-if="sortedListSuggestions.length > 0" class="space-y-3.5">
        <!-- List Card item using Konsta Card -->
        <k-card v-for="item in sortedListSuggestions" :key="item.id" :outline="true" :content-wrap="false"
          class="!mx-0 mb-4 p-3.5 gap-3.5 sm:p-4 hover:shadow-md transition-all flex flex-col sm:flex-row cursor-pointer"
          @click="$router.push(`/suggestion/${item.id}`)">
          <!-- Left: Thumbnail and Summary -->
          <div class="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <!-- Photo thumbnail -->
            <div
              class="w-20 h-20 sm:w-24 sm:h-20 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 relative">
              <img v-if="getPrimaryPhoto(item)" :src="getPrimaryPhoto(item)" :alt="item.content?.summary"
                class="w-full h-full object-cover" loading="lazy" />
              <div v-else
                class="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900">
                <i class="fa-solid fa-camera text-base"></i>
              </div>

              <!-- Distance Badge with Konsta Badge -->
              <k-badge v-if="item._formattedDistance" class="absolute bottom-1 left-1 text-[10px] font-bold">
                {{ item._formattedDistance }}
              </k-badge>
            </div>

            <!-- Summary Text and Meta -->
            <div class="min-w-0 flex-1">
              <h3 class="font-bold text-sm sm:text-base line-clamp-2 leading-snug">
                {{ item.content?.summary || 'Public Improvement' }}
              </h3>
              <p v-if="item.location?.address" class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1">
                <i class="fa-solid fa-location-dot mr-1 text-zinc-400"></i>
                {{ item.location.address }}
              </p>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                <span>By {{ item.author?.name || 'Anonymous' }}</span>
                <span>•</span>
                <span>{{ formatTime(item.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Right: View Suggestion Button Link -->
          <k-button type="button" :rounded="true" small class="font-bold flex-shrink-0 w-full sm:w-auto text-center"
            @click="router.push(`/suggestion/${item.id}`)">
            <span>View suggestion</span>
            <i class="fa-solid fa-arrow-right ml-1"></i>
          </k-button>
        </k-card>
      </div>

      <!-- Empty State -->
      <k-card v-else :outline="true" :content-wrap="false" class="!m-0 text-center py-12">
        <i class="fa-solid fa-inbox text-3xl text-zinc-400 mb-2"></i>
        <h3 class="text-base font-bold">No suggestions found</h3>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Be the first to add an idea to the map!</p>
        <k-button component="router-link" to="/submit" :rounded="true" class="text-xs font-bold">
          Submit Suggestion
        </k-button>
      </k-card>
    </div>

    <!-- Bottom Tabbar -->
    <k-tabbar
      :labels="true"
      class="w-full bg-zinc-900 flex-shrink-0 sticky bottom-0 z-30"
    >
      <k-tabbar-link
        label="Map"
        :active="activeTab === 'map'"
        @click="setTab('map')"
      ></k-tabbar-link>

      <k-tabbar-link
        label="List"
        :active="activeTab === 'list'"
        @click="setTab('list')"
      ></k-tabbar-link>
    </k-tabbar>
    
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  kTabbar,
  kTabbarLink,
  kSegmented,
  kSegmentedButton,
  kButton,
  kCard,
  kBadge,
  kPreloader,
} from 'konsta/vue';
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

const router = useRouter();

const activeTab = ref('map'); // 'map' | 'list'
const suggestions = ref([]);
const isLoading = ref(false);
const userLocation = ref(null); // { lat, lng }
const isLocating = ref(false);
const currentMapType = ref('roadmap');

// Map DOM & State
const browseMapContainerEl = ref(null);
const isMapReady = ref(false);
let map = null;
let googleMaps = null;
let infoWindow = null;
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
  } else if (tab === 'list' && infoWindow) {
    infoWindow.close();
  }
}

function setMapType(type) {
  currentMapType.value = type;
  if (!map || !googleMaps) return;
  if (type === 'hybrid') {
    map.setMapTypeId(googleMaps.MapTypeId.HYBRID);
    map.setOptions({ styles: getMapStyles(isDark.value, 'hybrid') });
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
      //mapTypeId: googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });

    infoWindow = new googleMaps.InfoWindow();

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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createInfoWindowContent(suggestion) {
  const container = document.createElement('div');
  container.className = 'gm-suggestion-infowindow';
  container.style.cssText = 'padding: 4px; max-width: 260px; font-family: Inter, system-ui, -apple-system, sans-serif; color: #1e293b;';

  const summary = suggestion.content?.summary || 'Civic Suggestion';
  const photoUrl = getPrimaryPhoto(suggestion);
  const address = suggestion.location?.address;
  const timeStr = formatTime(suggestion.createdAt);

  let html = `<h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.35;">${escapeHtml(summary)}</h4>`;

  if (photoUrl) {
    html += `
      <div style="width: 100%; height: 110px; margin-bottom: 8px; border-radius: 8px; overflow: hidden; background-color: #f1f5f9;">
        <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(summary)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
      </div>
    `;
  }

  html += `
    <div style="font-size: 12px; color: #64748b; margin-bottom: 10px; line-height: 1.3;">
      ${address ? `<span>📍 ${escapeHtml(address)}</span>` : `<span>🕒 ${escapeHtml(timeStr)}</span>`}
    </div>
    <div>
      <a href="/suggestion/${suggestion.id}" class="info-window-view-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #0f172a; background-color: #f59e0b; border-radius: 8px; text-decoration: none;">
        <span>View suggestion</span>
        <span>&rarr;</span>
      </a>
    </div>
  `;

  container.innerHTML = html;

  const btn = container.querySelector('.info-window-view-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      router.push(`/suggestion/${suggestion.id}`);
    });
  }

  return container;
}

function openInfoWindow(suggestion, marker) {
  if (!map || !googleMaps) return;
  if (!infoWindow) {
    infoWindow = new googleMaps.InfoWindow();
  }
  const contentEl = createInfoWindowContent(suggestion);
  infoWindow.setContent(contentEl);
  infoWindow.open({
    anchor: marker,
    map,
  });
}

function renderSuggestionMarkers() {
  if (!map || !googleMaps) return;

  // Clear existing markers & close infoWindow
  if (infoWindow) {
    infoWindow.close();
  }
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
        openInfoWindow(s, gMarker);
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
