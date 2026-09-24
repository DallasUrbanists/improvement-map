<template>
  <div class="relative w-full h-[60vh] min-h-[380px] max-h-[600px] rounded-2xl overflow-hidden border border-slate-700 dark:border-slate-700 light:border-slate-300 shadow-inner flex flex-col bg-slate-900">
    <!-- Search Bar Overlay with Autocomplete Dropdown (Powered by Google Maps Places / Geocoding) -->
    <div class="absolute top-3 left-3 right-3 z-30 flex flex-col max-w-lg">
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

    <!-- Google Map Target Container Wrapper -->
    <div class="relative w-full flex-1 min-h-[320px] bg-slate-900 overflow-hidden">
      <!-- Pure Map Canvas Element (Empty container owned by Google Maps SDK) -->
      <div
        ref="mapContainerEl"
        class="w-full h-full min-h-[320px] bg-slate-900"
        style="height: 100%; width: 100%; min-height: 320px;"
      ></div>

      <!-- Missing API Key or Auth Error Notice Overlay -->
      <div
        v-if="!hasGoogleMapsKey || googleMapsAuthError"
        class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95 text-slate-300 z-20 backdrop-blur-sm"
      >
        <i class="fa-solid fa-triangle-exclamation text-3xl text-st-yellow mb-3"></i>
        <h4 class="text-base font-bold text-white mb-1">Google Maps Setup Required</h4>
        <p class="text-xs text-slate-300 max-w-sm mb-3 leading-relaxed">
          {{ googleMapsAuthError || 'Set VITE_GOOGLE_MAPS_API_KEY in your .env file and restart Vite (npm run dev).' }}
        </p>
        <div class="text-[11px] text-slate-400 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 text-left max-w-sm">
          <div class="font-semibold text-st-yellow mb-1">Required in Google Cloud Console:</div>
          <ul class="list-disc list-inside space-y-0.5">
            <li><strong>Maps JavaScript API</strong> enabled</li>
            <li><strong>Places API</strong> enabled</li>
            <li><strong>Geocoding API</strong> enabled</li>
            <li>Billing account attached to GCP project</li>
          </ul>
        </div>
      </div>

      <!-- Loading indicator while SDK initializes -->
      <div
        v-else-if="!isMapReady"
        class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 z-10"
      >
        <i class="fa-solid fa-spinner animate-spin text-2xl text-st-yellow mb-2"></i>
        <span class="text-xs font-semibold">Loading Google Maps...</span>
      </div>
    </div>

    <!-- Floating Map Controls (Top Right: Basemap Switcher - Streets / Satellite) -->
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

    <!-- Floating Map Controls (Bottom Right: Recenter on GPS Coordinates) -->
    <div class="absolute bottom-3 right-3 z-30 flex flex-col gap-2">
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

    <!-- Active Location Summary Footer -->
    <div class="px-3.5 py-2 bg-dark-card dark:bg-dark-card light:bg-slate-100 border-t border-slate-700 dark:border-slate-700 light:border-slate-300 text-xs flex items-center justify-between gap-2 z-20">
      <div class="truncate flex items-center gap-1.5 text-slate-300 dark:text-slate-300 light:text-slate-700">
        <i class="fa-solid fa-map-pin text-st-yellow"></i>
        <span class="font-semibold">{{ displayAddress || 'Tap or drag pin to set location' }}</span>
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { isDark } from '../services/theme';
import {
  loadGoogleMaps,
  hasGoogleMapsKey,
  googleMapsAuthError,
  searchAddressWithGoogle,
  resolveGooglePlace,
  reverseGeocodeWithGoogle,
  getMapStyles,
  updateMapTheme,
} from '../services/googleMaps';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      latitude: 32.7767,
      longitude: -96.7970,
      address: '',
      description: '',
    }),
  },
});

const emit = defineEmits(['update:modelValue']);

const mapContainerEl = ref(null);
const isMapReady = ref(false);
const isLocating = ref(false);
const currentMapType = ref('roadmap');

// Search state
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

// Modal state
const isDescModalOpen = ref(false);
const tempDescription = ref('');

// Google Maps objects
let map = null;
let marker = null;
let googleMaps = null;

const displayAddress = computed(() => {
  if (props.modelValue.address) return props.modelValue.address;
  if (props.modelValue.latitude) {
    return `${Number(props.modelValue.latitude).toFixed(4)}, ${Number(props.modelValue.longitude).toFixed(4)}`;
  }
  return '';
});

async function initMap() {
  try {
    googleMaps = await loadGoogleMaps();
    if (!mapContainerEl.value || !googleMaps) return;

    const initialLat = props.modelValue.latitude || 32.7767;
    const initialLng = props.modelValue.longitude || -96.7970;
    const initialPos = { lat: Number(initialLat), lng: Number(initialLng) };

    // Default Streets view (ROADMAP) with dark/night basemap in dark mode and light/day basemap in light mode
    map = new googleMaps.Map(mapContainerEl.value, {
      center: initialPos,
      zoom: 15,
      mapTypeId: googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });

    // Google Maps Marker for selection (draggable)
    marker = new googleMaps.Marker({
      position: initialPos,
      map,
      draggable: true,
      animation: googleMaps.Animation?.DROP,
      title: 'Suggestion Location',
    });

    // Marker drag end listener
    marker.addListener('dragend', async () => {
      const pos = marker.getPosition();
      if (!pos) return;
      const lat = pos.lat();
      const lng = pos.lng();
      await updateCoordinates(lat, lng);
    });

    // Map click listener to relocate pin
    map.addListener('click', async (e) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);
      map.panTo(e.latLng);
      await updateCoordinates(lat, lng);
    });

    isMapReady.value = true;

    // Trigger map resize after DOM layout transition completes
    nextTick(() => {
      if (map && googleMaps) {
        googleMaps.event?.trigger(map, 'resize');
        map.setCenter(initialPos);
      }
    });
    setTimeout(() => {
      if (map && googleMaps) {
        googleMaps.event?.trigger(map, 'resize');
        map.setCenter(initialPos);
      }
    }, 250);

    // Trigger initial address reverse geocode if empty
    if (!props.modelValue.address) {
      updateCoordinates(initialLat, initialLng);
    }
  } catch (err) {
    console.warn('Google Maps initialization fallback:', err);
    isMapReady.value = true;
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

async function updateCoordinates(lat, lng) {
  const addr = await reverseGeocodeWithGoogle(lat, lng);
  emit('update:modelValue', {
    ...props.modelValue,
    latitude: lat,
    longitude: lng,
    address: addr || props.modelValue.address,
  });
}

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    searchResults.value = await searchAddressWithGoogle(q);
    isSearching.value = false;
  }, 350);
}

async function selectAddress(item) {
  searchQuery.value = item.displayName;
  searchResults.value = [];

  let lat = item.latitude;
  let lng = item.longitude;
  let address = item.displayName;

  if (lat === undefined || lng === undefined) {
    const resolved = await resolveGooglePlace(item.placeId || item.displayName);
    if (resolved) {
      lat = resolved.latitude;
      lng = resolved.longitude;
      address = resolved.address;
    }
  }

  if (lat !== undefined && lng !== undefined) {
    const pos = { lat, lng };
    if (map) {
      map.setCenter(pos);
      map.setZoom(16);
    }
    if (marker) {
      marker.setPosition(pos);
    }
    emit('update:modelValue', {
      ...props.modelValue,
      latitude: lat,
      longitude: lng,
      address,
    });
  }
}

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
      const pos = { lat, lng };

      if (map) {
        map.setCenter(pos);
        map.setZoom(16);
      }
      if (marker) {
        marker.setPosition(pos);
      }

      await updateCoordinates(lat, lng);
    },
    (err) => {
      isLocating.value = false;
      console.warn('GPS location error:', err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
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
    description: tempDescription.value.trim(),
  });
  isDescModalOpen.value = false;
}

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal.latitude && newVal.longitude && marker && map) {
      const curPos = marker.getPosition();
      if (!curPos || curPos.lat() !== newVal.latitude || curPos.lng() !== newVal.longitude) {
        const newPos = { lat: Number(newVal.latitude), lng: Number(newVal.longitude) };
        marker.setPosition(newPos);
      }
    }
  },
  { deep: true }
);

onMounted(() => {
  initMap();
});
</script>
