<template>
  <div class="map-workspace view-panel" :data-tray-open="trayOpen" @pointerdown.capture="interruptMapMotion" @wheel.capture.passive="interruptMapMotion">
    <div ref="browseMapContainerEl" class="workspace-map-canvas" data-testid="persistent-map"></div>
    <div v-if="!hasGoogleMapsKey || googleMapsAuthError || mapError" class="workspace-map-status" role="status">
      <p>{{ mapError || googleMapsAuthError || 'Google Maps is unavailable. You can still browse suggestions.' }}</p>
    </div>
    <div v-else-if="!isMapReady" class="workspace-map-status" role="status">Loading Map…</div>
    <Transition name="workspace-backdrop"><div v-if="trayOpen" class="workspace-backdrop" :class="{ 'workspace-backdrop-sharp': isDetail || (isSubmit && (draft.step === 3 || draft.step === 4)) }" aria-hidden="true"></div></Transition>
    <Teleport :to="draftCrosshairPane || 'body'" :disabled="isSubmit || !draftCrosshairPane">
    <div v-if="!isDetail && (isSubmit || hasDraftPin)" ref="submissionCrosshairElement" class="submission-crosshair" :class="{ 'is-locating': isSubmitLocate, 'is-animating-pin': isSubmitLocate && crosshairEntranceReady }" :style="isSubmitLocate ? { left: '50%', top: '50%' } : pendingCrosshairStart?.style || submissionCrosshairPosition">
      <svg :key="isSubmitLocate ? 'locating' : 'locked'" data-testid="suggestion-location-crosshair" viewBox="0 0 50 50" aria-hidden="true" @animationend="onCrosshairAnimationEnd">
        <g transform="translate(25 25)" fill="none" stroke="white" stroke-width="3">
          <circle r="9" /><path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25" /><circle r="2" fill="white" stroke="none" />
        </g>
      </svg>
      <div v-if="isSubmit && submissionCoordinates" ref="coordinateLabel" class="crosshair-coordinate-label" :class="{ 'is-left': coordinateLabelOnLeft, 'is-moving': isSubmitLocate && isPinMoving }" :style="coordinateLabelStyle">
        <button type="button" class="map-ui map-ui-button" :aria-label="`Copy latitude and longitude: ${submissionCoordinates}`" @click.stop="copySubmissionCoordinates">{{ submissionCoordinates }}</button>
        <span v-if="coordinateCopyMessage" class="map-ui crosshair-copy-tooltip" role="status">{{ coordinateCopyMessage }}</span>
      </div>
    </div>
    </Teleport>
    <Teleport v-if="draftCrosshairPane && isPopupOpen && popupCoordinates" :to="draftCrosshairPane">
      <div ref="popupCoordinateElement" class="popup-target-coordinates" :style="popupCoordinatePosition">
        <button type="button" class="map-ui map-ui-button" :aria-label="`Copy latitude and longitude: ${popupCoordinates}`" @click.stop="copyCoordinates(popupCoordinates)">{{ popupCoordinates }}</button>
        <span v-if="coordinateCopyMessage" class="map-ui crosshair-copy-tooltip" role="status">{{ coordinateCopyMessage }}</span>
      </div>
    </Teleport>
    <div v-if="isDetail && detailCoordinates" class="detail-map-target" :style="detailTargetPosition">
      <img :key="route.params.id" :src="suggestionMarkerUrl" alt="Submission location" class="detail-target-icon" />
      <div ref="coordinateLabel" class="crosshair-coordinate-label" :class="{ 'is-left': coordinateLabelOnLeft }" :style="coordinateLabelStyle">
        <button type="button" class="map-ui map-ui-button" :aria-label="`Copy latitude and longitude: ${detailCoordinates}`" @click.stop="copyCoordinates(detailCoordinates)">{{ detailCoordinates }}</button>
        <span v-if="coordinateCopyMessage" class="map-ui crosshair-copy-tooltip" role="status">{{ coordinateCopyMessage }}</span>
      </div>
      <div class="map-ui detail-marker-byline">{{ detailByline }}</div>
    </div>
    <div v-if="isDetail && isMapReady && !mapError" class="map-ui detail-zoom-ui" role="group" aria-label="Map zoom">
      <button type="button" class="map-ui-button" aria-label="Zoom in" @click="zoomDetailMap(1)">+</button>
      <button type="button" class="map-ui-button" aria-label="Zoom out" @click="zoomDetailMap(-1)">−</button>
    </div>
    <div class="workspace-route-layer">
      <router-view v-slot="{ Component }">
        <keep-alive include="BrowseView,SubmitView"><component :is="Component" :key="route.name" /></keep-alive>
      </router-view>
    </div>
      <MapSearchOverlay :query="mapSearchQuery" :has-suggestions="mapSearchResults.length > 0" :read-only="readOnlyAddress">
        <div
          class="map-ui map-search-panel relative flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-xl">
          <span class="pl-3 pr-2 text-zinc-400">
            <i :class="['fa-solid', readOnlyAddress ? 'fa-location-dot' : 'fa-magnifying-glass']" aria-hidden="true"></i>
          </span>
          <input type="text" v-model="mapSearchQuery" :readonly="readOnlyAddress" aria-label="Search address or neighborhood" @input="onMapSearchInput" @focus="searchEditing = true" @blur="searchEditing = false"
            placeholder="Search address or neighborhood..."
            class="w-full py-2.5 pr-8 bg-transparent text-xs sm:text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none" />
          <button v-if="mapSearchQuery && !readOnlyAddress" @click="mapSearchQuery = ''; mapSearchResults = []"
            class="map-search-clear p-2 text-zinc-400 hover:text-black dark:hover:text-white" aria-label="Clear search" type="button">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
          <button v-if="readOnlyAddress && isSubmit" type="button" class="map-ui-button map-search-edit-location" aria-label="Edit location" @click="submission?.editLocation()">
            <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
            Edit
          </button>
          <span v-if="isSearching" class="map-search-spinner pr-3 text-zinc-400">
            <i class="fa-solid fa-spinner animate-spin text-sm"></i>
          </span>
        </div>

        <!-- Autocomplete dropdown list -->
        <div v-if="mapSearchResults.length > 0"
          class="map-ui map-search-results mt-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xl max-h-56 overflow-y-auto z-40 divide-y divide-zinc-200 dark:divide-zinc-800">
          <button v-for="item in mapSearchResults" :key="item.id" type="button" @click="selectMapSearchResult(item)"
            class="w-full text-left px-3.5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-2 text-xs sm:text-sm text-black dark:text-white">
            <i class="fa-solid fa-location-dot mt-0.5 flex-shrink-0 text-zinc-500"></i>
            <span class="line-clamp-2">{{ item.displayName }}</span>
          </button>
        </div>
      </MapSearchOverlay>
    <MapToolbar v-if="!isSubmitting" class="absolute bottom-8 left-1/2 -translate-x-1/2 z-40"
      :model-value="trayOpen && !isSubmit ? 'list' : currentMapType === 'hybrid' ? 'satellite' : 'streets'"
      :map-type="currentMapType" :locating="isLocating || !!submission?.isLocating?.value"
      :recenter-disabled="readOnlyAddress" :exit-submit="isSubmit" @exit-submit="closeTray" @center="onCenterOnLocationClick" @update:model-value="selectTab" />
  </div>
</template>
<script setup>

import MapToolbar from './MapToolbar.vue';
import MapSearchOverlay from './MapSearchOverlay.vue';
import { ref, computed, onMounted, provide, shallowRef, inject, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

import { isDark } from '../services/theme';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { loadWizardDraft, saveWizardDraft } from '../services/storage';
import { browseMapInitialization, sharedBrowseMap } from '../services/sharedBrowseMap';
import suggestionMarkerUrl from '../assets/suggestion-marker.svg';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { clusterAppearance, createMarkerSpiderfier, shouldSpiderfy } from '../services/markerSpiderfier';
import { getSuggestions } from '../services/api';
import { addFormattedDistances, sortSuggestionsByDistance } from '../services/geo';
import {
  getStoredBrowseTab,
  setStoredBrowseTab,
  getStoredMapView,
  setStoredMapView,
  removeStoredMapView,
  getStoredBrowseSort,
  setStoredBrowseSort,
  getStoredActiveInfoWindowSuggestionId,
  setStoredActiveInfoWindowSuggestionId,
  removeStoredActiveInfoWindowSuggestionId,
} from '../services/storage';
import {
  loadGoogleMaps,
  hasGoogleMapsKey,
  googleMapsAuthError,
  searchAddressWithGoogle,
  resolveGooglePlace,
  getMapStyles,
  updateMapTheme,
  insetMapZoomControls,
  disposeMapTheme,
  reverseGeocodeWithGoogle,
} from '../services/googleMaps';

const router = useRouter();
const route = useRoute();

const savedTab = getStoredBrowseTab(); // 'streets' | 'satellite' | 'list'
const suggestions = ref([]);
const failedPhotoIds = ref(new Set());
const isLoading = ref(false);
const userLocation = ref(null); // { lat, lng }
const isLocating = ref(false);
const currentMapType = ref(getStoredMapView()?.mapType || (savedTab === 'satellite' ? 'hybrid' : 'roadmap'));
const activeSort = ref(getStoredBrowseSort());

// Map & List DOM & State
const browseMapContainerEl = ref(null);
const isMapReady = ref(false);
const mapError = ref('');
let map = null;
let googleMaps = null;
let infoWindow = null;
let clusterZoomTimer = null;
let clusterZoomRun = 0;
function cancelClusterZoom() {
  clusterZoomRun++;
  if (clusterZoomTimer !== null) clearTimeout(clusterZoomTimer);
  clusterZoomTimer = null;
}
function interruptMapMotion() {
  cancelClusterZoom();
  if (!map) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (!center || zoom == null) return;
  // Finish native camera motion at its current position before the user's
  // pointer or wheel gesture supplies the next movement.
  if (map.moveCamera) map.moveCamera({ center, zoom });
  else { map.setCenter(center); map.setZoom(zoom); }
}
function zoomIntoCluster(cluster) {
  cancelClusterZoom();
  const run = clusterZoomRun;
  if (!map) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    map.fitBounds(cluster.bounds, 72);
    return;
  }
  const startZoom = map.getZoom() ?? 13;
  const maximumZoom = map.get('maxZoom') ?? map.mapTypes.get(map.getMapTypeId())?.maxZoom ?? 21;
  const projection = map.getProjection();
  let targetZoom = Math.min(maximumZoom, Math.floor(startZoom) + 1);
  if (projection) {
    const ne = projection.fromLatLngToPoint(cluster.bounds.getNorthEast());
    const sw = projection.fromLatLngToPoint(cluster.bounds.getSouthWest());
    const width = Math.max(1, map.getDiv().clientWidth - 144);
    const height = Math.max(1, map.getDiv().clientHeight - 144);
    const spanX = (ne.x - sw.x + 256) % 256;
    const spanY = Math.abs(ne.y - sw.y);
    const fitZoom = Math.floor(Math.log2(Math.min(width / Math.max(spanX, 1e-8), height / Math.max(spanY, 1e-8))));
    targetZoom = Math.min(maximumZoom, Math.max(targetZoom, fitZoom));
  }
  const center = cluster.bounds.getCenter();
  map.panTo(center);
  let requestedZoom = startZoom;
  function advance() {
    if (run !== clusterZoomRun || !map) return;
    clusterZoomTimer = null;
    const zoom = map.getZoom() ?? requestedZoom;
    // Stop if the camera was changed externally or the provider clamped a
    // requested level. Never repeatedly request an unreachable zoom level.
    if (zoom < requestedZoom - .01 || zoom >= targetZoom) return;
    requestedZoom = Math.min(targetZoom, Math.floor(requestedZoom) + 1);
    map.setZoom(requestedZoom);
    if (requestedZoom < targetZoom && run === clusterZoomRun) clusterZoomTimer = setTimeout(advance, 280);
  }
  clusterZoomTimer = setTimeout(advance, 180);
}
const isPopupOpen = ref(false);
const isSpiderOpen = ref(false);
let popupShadeOverlay = null;
const popupTarget = shallowRef(null);
const popupCoordinateElement = ref(null);
const popupCoordinates = ref('');
const popupCoordinatePosition = ref({});
const draftCrosshairPane = shallowRef(null);
function closeInfoWindow() {
  infoWindow?.close();
  isPopupOpen.value = false;
}

let markersArray = [];
let suggestionClusterer = null;
let markerSpiderfier = null;
let userLocationMarker = null;
let submissionCrosshairOverlay = null;
let detailTargetOverlay = null;
const detailTargetPosition = ref({ left: '50%', top: '25%' });
const submissionCrosshairPosition = ref({ left: '50%', top: '50%' });
const submissionCrosshairElement = ref(null);
const pendingCrosshairStart = ref(null);
let crosshairTravelAnimation = null;
let crosshairTravelFrame = null;
const crosshairEntranceReady = ref(true);
const pinContinueReady = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function onCrosshairAnimationEnd(event) {
  if (event.animationName === 'crosshair-appear' && isSubmitLocate.value) pinContinueReady.value = true;
}
const locatingCoordinates = ref(null);
const coordinateLabel = ref(null);
const coordinateLabelOnLeft = ref(false);
const coordinateLabelStyle = ref({});
const isPinMoving = ref(false);
const pinMotionListeners = [];
const coordinateCopyMessage = ref('');
let coordinateCopyTimeout;
let submissionFrameRequest = null;
let areSuggestionMarkersVisible = true;
let isProgrammaticChange = false;

// Address search state
const mapSearchQuery = ref('');
const mapSearchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;
const searchEditing = ref(false);

// Sorted suggestions for List View
const sortedListSuggestions = computed(() => {
  if (activeSort.value === 2 && userLocation.value) {
    return sortSuggestionsByDistance(suggestions.value, userLocation.value.lat, userLocation.value.lng);
  }
  const newestFirst = [...suggestions.value].sort((a, b) => {
    const timeA = new Date(a.creationDate || 0).getTime();
    const timeB = new Date(b.creationDate || 0).getTime();
    return timeB - timeA;
  });

  if (!userLocation.value) return newestFirst;
  return addFormattedDistances(newestFirst, userLocation.value.lat, userLocation.value.lng);
});

function selectTab(tab) {
  if (tab === 'list') {
    if (isList.value) closeTray();
    else { rememberFocus(); router.push({ path: '/', query: { view: 'list' } }); }
  } else if (trayOpen.value && !isSubmit.value) {
    closeToMap();
  } else {
    setMapType(tab === 'satellite' ? 'hybrid' : 'roadmap');
  }
}
function setTab(tab) { router.push({ path: '/', query: { view: tab === 'list' ? 'list' : 'map' } }); }
function setSortMode(sort) { activeSort.value = sort; setStoredBrowseSort(sort); }
function setMapType(type) {
  cancelClusterZoom();
  currentMapType.value = type;
  setStoredBrowseTab(isList.value ? 'list' : type === 'hybrid' ? 'satellite' : 'streets');
  if (!map) return;
  map.setMapTypeId(type);
  updateMapTheme(map, isDark.value, type);
  saveCurrentMapView();
}
function saveCurrentMapView() {
  if (!map || !isMapReady.value || isProgrammaticChange || !isBrowse.value) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (center && typeof zoom === 'number') {
    setStoredMapView({
      lat: center.lat(),
      lng: center.lng(),
      zoom: zoom,
      mapType: currentMapType.value,
    });
  }
}

function setSuggestionMarkersVisible(visible) {
  areSuggestionMarkersVisible = visible;
  if (!visible) markerSpiderfier?.collapse();
  suggestionClusterer?.setMap(visible ? map : null);
  if (!visible) closeInfoWindow();
}

function renderSuggestionCluster({ count, position }) {
  const { diameter, fill, text } = clusterAppearance(count);
  const size = diameter + 32; // Transparent padding keeps the drop shadow inside the image.
  const center = size / 2;
  const radius = diameter / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter></defs><circle cx="${center}" cy="${center}" r="${radius}" fill="${fill}" stroke="#d8c394" stroke-width="2" filter="url(#s)"/><text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" fill="${text}" font-family="Roboto,Arial,sans-serif" font-size="15" font-weight="700">${count}</text></svg>`;
  return new googleMaps.Marker({
    position,
    title: `${count} suggestions in this area. Select to zoom or expand.`,
    optimized: false,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new googleMaps.Size(size, size),
      anchor: new googleMaps.Point(center, center),
    },
    zIndex: 1000 + count,
  });
}

// Watch theme changes to update Streets basemap styling dynamically
watch(isDark, (darkMode) => {
  if (!map || !googleMaps) return;
  updateMapTheme(map, darkMode, currentMapType.value);
});

async function initGoogleMap() {
  try {
    googleMaps = await loadGoogleMaps();
    if (!browseMapContainerEl.value || !googleMaps) {
      browseMapInitialization.value = 'failed';
      return;
    }

    isProgrammaticChange = true;
    const savedView = getStoredMapView();
    const initialCenter = savedView
      ? { lat: savedView.lat, lng: savedView.lng }
      : userLocation.value
      ? { lat: userLocation.value.lat, lng: userLocation.value.lng }
      : { lat: 32.7767, lng: -96.7970 };
    const initialZoom = savedView ? savedView.zoom : 13;

    // Default Streets view (ROADMAP) or Satellite (HYBRID)
    map = new googleMaps.Map(browseMapContainerEl.value, {
      center: initialCenter,
      zoom: initialZoom,
      mapTypeId: currentMapType.value === 'hybrid' ? googleMaps.MapTypeId.HYBRID : googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: googleMaps.ControlPosition.TOP_RIGHT },
      mapTypeControl: false,
      gestureHandling: 'greedy',
      clickableIcons: false,
      heading: 0,
      tilt: 0,
      rotateControl: false,
      headingInteractionEnabled: false,
      tiltInteractionEnabled: false,
    });

    insetMapZoomControls(map, googleMaps);
    updateMapTheme(map, isDark.value, currentMapType.value);
    infoWindow = new googleMaps.InfoWindow();
    sharedBrowseMap.value = {
      map,
      googleMaps,
      setSuggestionMarkersVisible,
      setMapType,
    };
    browseMapInitialization.value = 'ready';

    map.addListener('dragend', () => {
      saveCurrentMapView();
    });
    map.addListener('dragstart', cancelClusterZoom);

    map.addListener('zoom_changed', () => {
      saveCurrentMapView();
    });

    isMapReady.value = true;
    renderSuggestionMarkers();

    isProgrammaticChange = false;
    if (pendingLocation) focusLocation(pendingLocation);
  } catch (err) {
    console.warn('Google Maps BrowseView init warning:', err);
    mapError.value = 'The map could not be loaded. You can still browse suggestions.';
    isMapReady.value = true;
    isProgrammaticChange = false;
    browseMapInitialization.value = 'failed';
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
  container.className = 'map-ui gm-suggestion-infowindow';

  const summary = suggestion.content?.summary || 'Civic Suggestion';
  const photoUrl = getPrimaryPhoto(suggestion);
  const address = suggestion.location?.address?.replace(/,\s*USA\s*$/i, '');
  const timeStr = formatTime(suggestion.creationDate);

  let html = `<button type="button" class="map-ui-button suggestion-popup-close" aria-label="Close suggestion"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button><h4 class="suggestion-popup-title">${escapeHtml(summary)}</h4>`;

  if (photoUrl) {
    html += `
      <div class="suggestion-popup-photo" hidden>
        <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(summary)}" />
      </div>
    `;
  }

  html += `
    <div class="suggestion-popup-address">
      ${address ? `<span>📍 ${escapeHtml(address)}</span>` : `<span>🕒 ${escapeHtml(timeStr)}</span>`}
    </div>
    <div>
      <a href="${escapeHtml(router.resolve('/suggestion/' + suggestion.id).href)}" class="map-ui-button info-window-view-btn">
        <span>View suggestion</span>
      </a>
    </div>
  `;

  container.innerHTML = html;
  container.querySelector('.suggestion-popup-close').addEventListener('click', () => {
    closeInfoWindow();
    removeStoredActiveInfoWindowSuggestionId();
    saveCurrentMapView();
  });
  const image = container.querySelector('.suggestion-popup-photo img');
  if (image) {
    const showPhoto = () => { if (image.naturalWidth > 0) image.parentElement.hidden = false; };
    image.addEventListener('load', showPhoto);
    image.addEventListener('error', () => { image.parentElement.hidden = true; });
    if (image.complete) showPhoto();
  }

  const btn = container.querySelector('.info-window-view-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openSuggestion(suggestion);
    });
  }

  return container;
}

function openInfoWindow(suggestion, marker, autoRestore = false) {
  cancelClusterZoom();
  if (!map || !googleMaps || trayOpen.value) return;
  if (!infoWindow) {
    infoWindow = new googleMaps.InfoWindow();
    infoWindow.addListener('closeclick', () => {
      isPopupOpen.value = false;
      removeStoredActiveInfoWindowSuggestionId();
      saveCurrentMapView();
    });
  }

  setStoredActiveInfoWindowSuggestionId(suggestion.id);
  popupTarget.value = marker;
  const position = marker.getPosition?.() || marker.get('position');
  popupCoordinates.value = `${position.lat().toFixed(6)}, ${position.lng().toFixed(6)}`;
  const contentEl = createInfoWindowContent(suggestion);
  infoWindow.setContent(contentEl);
  infoWindow.open({
    anchor: marker,
    map,
  });
  isPopupOpen.value = true;

  // 1. Persist map view immediately when clicking marker
  saveCurrentMapView();

  // 2. Persist map view after infoWindow pan/transition animation
  setTimeout(() => {
    saveCurrentMapView();
  }, 400);
}

function renderSuggestionMarkers() {
  if (!map || !googleMaps) return;
  markerSpiderfier?.dispose();
  const markerSuggestions = new WeakMap();
  markerSpiderfier = createMarkerSpiderfier(map, googleMaps, (marker, anchor) => {
    const suggestion = markerSuggestions.get(marker);
    if (suggestion) openInfoWindow(suggestion, anchor);
  }, () => { isSpiderOpen.value = false; closeInfoWindow(); }, () => { isSpiderOpen.value = true; }, () => {
    closeInfoWindow();
    removeStoredActiveInfoWindowSuggestionId();
  });

  // Clear existing markers & close infoWindow
  if (infoWindow) {
    closeInfoWindow();
  }
  suggestionClusterer?.clearMarkers();
  suggestionClusterer?.setMap(null);
  suggestionClusterer = null;
  markersArray.forEach((m) => m.setMap(null));
  markersArray = [];

  const storedActiveId = getStoredActiveInfoWindowSuggestionId();
  let markerToRestore = null;
  let suggestionToRestore = null;

  // Add Google Maps markers for each suggestion
  suggestions.value.forEach((s) => {
    const lat = s.location?.latitude ?? s.latitude;
    const lng = s.location?.longitude ?? s.longitude;
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      const gMarker = new googleMaps.Marker({
        position: { lat: Number(lat), lng: Number(lng) },
        title: s.content?.summary || 'Suggestion',
        icon: {
          url: suggestionMarkerUrl,
          scaledSize: new googleMaps.Size(40, 48),
          anchor: new googleMaps.Point(20, 18),
        },
        optimized: false,
        animation: googleMaps.Animation?.DROP,
      });

      gMarker.addListener('click', () => {
        openInfoWindow(s, gMarker);
      });

      markersArray.push(gMarker);
      markerSuggestions.set(gMarker, s);

      if (storedActiveId && String(s.id) === String(storedActiveId)) {
        markerToRestore = gMarker;
        suggestionToRestore = s;
      }
    }
  });

  suggestionClusterer = new MarkerClusterer({
    map: areSuggestionMarkersVisible ? map : null,
    markers: markersArray,
    algorithm: new SuperClusterAlgorithm({ radius: 64, maxZoom: 30 }),
    renderer: { render: renderSuggestionCluster },
    onClusterClick: (_event, cluster) => {
      cancelClusterZoom();
      closeInfoWindow();
      if (shouldSpiderfy(cluster.markers, map)) {
        markerSpiderfier.expand(cluster.markers, cluster.position);
      } else {
        markerSpiderfier.collapse();
        zoomIntoCluster(cluster);
      }
    },
  });

  if (markerToRestore && suggestionToRestore) {
    openInfoWindow(suggestionToRestore, markerToRestore, true);
  }

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

function onPhotoError(itemId) {
  failedPhotoIds.value = new Set(failedPhotoIds.value).add(itemId);
}

const usStateCodes = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const usStateNames = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming', 'district of columbia',
]);

function formatBrowseAddress(address) {
  if (typeof address !== 'string') return '';

  const parts = address.split(',').map(part => part.trim());
  const stateIndex = parts.findIndex(part => {
    const state = part.replace(/\s+\d{5}(?:-\d{4})?$/, '');
    const match = state.match(/^([A-Z]{2})$/i);
    return (match && usStateCodes.has(match[1].toUpperCase())) || usStateNames.has(state.toLowerCase());
  });

  return stateIndex > 0 ? parts.slice(0, stateIndex).join(', ') : address;
}

function formatTime(timestamp) {
  if (!timestamp) return 'Recently';
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function formatCreationDate(timestamp) {
  if (!timestamp) return 'Recently';

  const createdAt = dayjs(timestamp);
  if (!createdAt.isValid()) return 'Recently';

  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAt.valueOf() < twoWeeksMs
    ? createdAt.fromNow()
    : formatTime(timestamp);
}

// Search handling with Google Maps Autocomplete / Geocoder
function onMapSearchInput() {
  if (readOnlyAddress.value) return;
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = mapSearchQuery.value.trim();
  if (q.length < 2) {
    mapSearchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    const results = await searchAddressWithGoogle(q);
    if (mapSearchQuery.value.trim() !== q || readOnlyAddress.value) return;
    mapSearchResults.value = results;
    isSearching.value = false;
  }, 350);
}

async function selectMapSearchResult(item) {
  if (readOnlyAddress.value) return;
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

  if (readOnlyAddress.value) return;
  if (lat !== undefined && lng !== undefined && map) {
    map.setCenter({ lat, lng });
    map.setZoom(15);
    if (isSubmitLocate.value) await submission.value?.updateCoordinates(lat, lng, item.displayName);
    saveCurrentMapView();
  }
}

function onCenterOnLocationClick() {
  if (readOnlyAddress.value) return;
  if (isSubmitLocate.value) { submission.value?.requestGpsLocation(); return; }
  removeStoredMapView();
  if (userLocation.value && map) {
    isProgrammaticChange = true;
    map.setCenter({ lat: userLocation.value.lat, lng: userLocation.value.lng });
    map.setZoom(14);
    setTimeout(() => {
      isProgrammaticChange = false;
    }, 300);
  }
  requestGps(true);
}

// Geolocation
function requestGps(forceCenter = false) {
  if (!navigator.geolocation) return;
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      isLocating.value = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      userLocation.value = { lat, lng };

      if (map) {
        renderSuggestionMarkers();
        const hasSavedView = !!getStoredMapView();
        if (forceCenter || (!hasSavedView && isBrowse.value && !route.query.view)) {
          isProgrammaticChange = true;
          map.setCenter({ lat, lng });
          map.setZoom(14);
          setTimeout(() => {
            isProgrammaticChange = false;
          }, 300);
        }
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


const isBrowse = computed(() => route.name === 'Browse');
const isList = computed(() => isBrowse.value && (route.query.view === 'list' || (!route.query.view && savedTab === 'list')));
const submission = shallowRef(null);
const initialDraft = loadWizardDraft();
const draft = computed(() => submission.value?.draft || initialDraft);
const isSubmit = computed(() => route.name === 'Submit');
const isDetail = computed(() => route.name === 'SubmissionDetail');
const detailLocation = ref(null);
const detailByline = ref('');
const detailCoordinates = computed(() => {
  const location = detailLocation.value;
  if (location?.latitude == null || location?.longitude == null) return '';
  const lat = Number(location.latitude), lng = Number(location.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
});
const isSubmitLocate = computed(() => isSubmit.value && draft.value.step === 1);
const hasDraftPin = computed(() => draft.value.location?.latitude != null && draft.value.location?.longitude != null);
const submissionCoordinates = computed(() => {
  const location = isSubmitLocate.value && locatingCoordinates.value ? locatingCoordinates.value : draft.value.location;
  if (location?.latitude == null || location?.longitude == null) return '';
  const lat = Number(location.latitude), lng = Number(location.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '';
});
async function copySubmissionCoordinates() {
  await copyCoordinates(submissionCoordinates.value);
}
async function copyCoordinates(coordinates) {
  if (!coordinates) return;
  clearTimeout(coordinateCopyTimeout);
  try {
    await navigator.clipboard.writeText(coordinates);
    coordinateCopyMessage.value = 'Lat/long copied!';
  } catch {
    coordinateCopyMessage.value = 'Could not copy lat/long. Please try again.';
  }
  coordinateCopyTimeout = setTimeout(() => { coordinateCopyMessage.value = ''; }, 2200);
}
function positionCoordinateLabel() {
  const label = coordinateLabel.value;
  const crosshair = label?.parentElement;
  if (!crosshair) return;
  const bounds = crosshair.getBoundingClientRect();
  const width = label.offsetWidth, height = label.offsetHeight;
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 12;
  const top = (viewport?.offsetTop || 0) + 12;
  const right = left + (viewport?.width || window.innerWidth) - 24;
  const bottom = top + (viewport?.height || window.innerHeight) - 24;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  coordinateLabelOnLeft.value = centerX + 10 + width > right;
  const x = coordinateLabelOnLeft.value ? centerX - 10 - width : centerX + 10;
  const y = centerY - 10 - height;
  const labelX = Math.max(left, Math.min(x, right - width));
  const labelY = Math.max(top, Math.min(y, bottom - height));
  coordinateLabelStyle.value = {
    left: `${labelX - bounds.left}px`,
    top: `${labelY - bounds.top}px`,
    bottom: 'auto',
    transformOrigin: `${centerX - labelX}px ${centerY - labelY}px`,
  };
}
watch([submissionCoordinates, submissionCrosshairPosition, isSubmitLocate, detailCoordinates, detailTargetPosition], () => nextTick(positionCoordinateLabel), { flush: 'post' });
watch(coordinateLabel, (element, _, onCleanup) => {
  if (!element) return;
  const observer = new ResizeObserver(positionCoordinateLabel);
  observer.observe(element);
  onCleanup(() => observer.disconnect());
});
watch(isSubmitLocate, async active => {
  pinContinueReady.value = active && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  isPinMoving.value = false;
  crosshairTravelAnimation?.cancel();
  if (crosshairTravelFrame !== null) cancelAnimationFrame(crosshairTravelFrame);
  crosshairEntranceReady.value = active && !pendingCrosshairStart.value;
  if (!active || !pendingCrosshairStart.value) return;
  const start = pendingCrosshairStart.value;
  await nextTick();
  const element = submissionCrosshairElement.value;
  pendingCrosshairStart.value = null;
  if (!element || !isSubmitLocate.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    crosshairEntranceReady.value = isSubmitLocate.value;
    return;
  }
  const bounds = element.getBoundingClientRect();
  const dx = start.x - (bounds.left + bounds.width / 2);
  const dy = start.y - (bounds.top + bounds.height / 2);
  const animation = element.animate([
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))` },
    { transform: 'translate(-50%, -50%)' },
  ], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
  crosshairTravelAnimation = animation;
  function followTravel() {
    positionCoordinateLabel();
    if (animation.playState === 'running') crosshairTravelFrame = requestAnimationFrame(followTravel);
    else crosshairTravelFrame = null;
  }
  crosshairTravelFrame = requestAnimationFrame(followTravel);
  animation.finished.then(() => {
    if (crosshairTravelAnimation === animation) {
      crosshairTravelAnimation = null;
      crosshairEntranceReady.value = isSubmitLocate.value;
    }
    positionCoordinateLabel();
  }).catch(() => {});
});
const readOnlyAddress = computed(() => isDetail.value || (isSubmit.value && draft.value.step > 1));
const trayOpen = computed(() => isList.value || route.name === 'SubmissionDetail' || readOnlyAddress.value);
const isSubmitting = inject('isSubmitting', ref(false));
let browseOrigin = null;
let detailOrigin = null;
let pendingLocation = null;
let skipRestore = false;
let originFocus = null;
let originFocusSelector = null;
let browseSearch = '';
function rememberFocus() {
  originFocus = document.activeElement;
  const id = originFocus?.dataset?.suggestionId;
  const label = originFocus?.getAttribute('aria-label');
  originFocusSelector = id ? `[data-suggestion-id="${CSS.escape(id)}"]`
    : label ? `button[aria-label="${CSS.escape(label)}"]` : null;
}
function restoreFocus() {
  nextTick(() => {
    const target = originFocus?.isConnected ? originFocus : originFocusSelector && document.querySelector(originFocusSelector);
    target?.focus({ preventScroll: true });
  });
}
function snapshot() {
  const center = map?.getCenter();
  return center ? { lat: center.lat(), lng: center.lng(), zoom: map.getZoom(), mapType: currentMapType.value } : getStoredMapView();
}
function restoreSnapshot(view) {
  if (!view) return;
  if (!map) { pendingLocation = { latitude: view.lat, longitude: view.lng, zoom: view.zoom, mapType: view.mapType }; return; }
  if (view.mapType) setMapType(view.mapType);
  map.setCenter({ lat: view.lat, lng: view.lng });
  map.setZoom(view.zoom);
}
function focusLocation(location) {
  if (!location || location.latitude == null || location.longitude == null) return;
  pendingLocation = location;
  if (!map) return;
  const lat = Number(location.latitude), lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (location.mapType) setMapType(location.mapType);
  map.setCenter({ lat, lng });
  map.setZoom(location.zoom ?? 16);
  pendingLocation = null;
}
function setDetailLocation(location, byline = '') {
  detailLocation.value = location;
  detailByline.value = byline;
  if (location && isDetail.value) focusLocation(location);
}
function frameDetailLocation(immediate = false) {
  if (!isDetail.value || !map || !googleMaps || !detailLocation.value) return;
  const { latitude, longitude } = detailLocation.value;
  if (latitude == null || longitude == null) return;
  const position = { lat: Number(latitude), lng: Number(longitude) };
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
  const tray = document.querySelector('.submission-detail-tray');
  const search = document.querySelector('.map-search-panel');
  const bounds = browseMapContainerEl.value?.getBoundingClientRect();
  if (!tray || !search || !bounds) return;
  const targetY = (search.getBoundingClientRect().bottom + tray.getBoundingClientRect().top) / 2;
  const offset = bounds.top + bounds.height / 2 - targetY;
  const projection = map.getProjection?.();
  if (projection) {
    const point = projection.fromLatLngToPoint(new googleMaps.LatLng(position.lat, position.lng));
    const center = projection.fromPointToLatLng(new googleMaps.Point(point.x, point.y + offset / 2 ** map.getZoom()));
    if (immediate === true || window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setCenter(center);
    else map.panTo(center);
  } else { map.setCenter(position); map.panBy?.(0, offset); }
  if (!detailTargetOverlay) {
    detailTargetOverlay = new googleMaps.OverlayView();
    detailTargetOverlay.onAdd = () => {};
    detailTargetOverlay.onRemove = () => {};
    detailTargetOverlay.draw = () => {
      const location = detailLocation.value;
      if (!isDetail.value || !location) return;
      const point = detailTargetOverlay.getProjection()?.fromLatLngToContainerPixel(new googleMaps.LatLng(Number(location.latitude), Number(location.longitude)));
      if (point) detailTargetPosition.value = { left: `${point.x}px`, top: `${point.y}px` };
    };
    detailTargetOverlay.setMap(map);
  }
  detailTargetOverlay.draw();
}
function zoomDetailMap(direction) {
  if (!map || !isDetail.value) return;
  const zoom = (map.getZoom() ?? 16) + direction;
  map.setZoom(Math.max(map.get?.('minZoom') ?? 0, Math.min(map.get?.('maxZoom') ?? 22, zoom)));
}
function frameSubmissionLocation() {
    if (!map || !googleMaps || !isSubmit.value || ![3, 4].includes(draft.value.step)) return;
    const location = draft.value.location;
    if (location?.latitude == null || location?.longitude == null) return;
    const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    const title = draft.value.step === 3 ? 'Describe your idea' : 'Review submission';
    const tray = document.querySelector(`.submission-content-tray[aria-label="${title}"]`);
    const search = document.querySelector('.map-search-panel');
    const mapBounds = browseMapContainerEl.value?.getBoundingClientRect();
    if (!tray || !search || !mapBounds) return;
    const searchBottom = search.getBoundingClientRect().bottom;
    const trayTop = tray.getBoundingClientRect().top;
    const targetY = trayTop - searchBottom >= 100 ? (searchBottom + trayTop) / 2 : mapBounds.top + mapBounds.height / 2;
    const offsetY = mapBounds.top + mapBounds.height / 2 - targetY;
    const projection = map.getProjection?.();
    if (projection) {
      const point = projection.fromLatLngToPoint(new googleMaps.LatLng(position.lat, position.lng));
      const scale = 2 ** map.getZoom();
      const center = projection.fromPointToLatLng(new googleMaps.Point(point.x, point.y + offsetY / scale));
      // Follow the animated tray geometry directly instead of starting another
      // map animation on each resize, which would trail behind the tray.
      const heightAnimating = [...tray.getAnimations(), ...(tray.querySelector('.description-textarea')?.getAnimations() || [])]
        .some(animation => animation.playState === 'running');
      if (heightAnimating || window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setCenter(center);
      else map.panTo(center);
    } else {
      map.setCenter(position);
      map.panBy?.(0, offsetY);
    }
}
function updateSubmissionCrosshair() {
  const projection = submissionCrosshairOverlay?.getProjection();
  const pane = draftCrosshairPane.value;
  if (projection && pane && browseMapContainerEl.value) {
    const origin = projection.fromLatLngToDivPixel(projection.fromContainerPixelToLatLng(new googleMaps.Point(0, 0)));
    pane.style.left = `${origin.x}px`;
    pane.style.top = `${origin.y}px`;
    pane.style.width = `${browseMapContainerEl.value.clientWidth}px`;
    pane.style.height = `${browseMapContainerEl.value.clientHeight}px`;
    if (isPopupOpen.value && popupTarget.value) {
      const point = projection.fromLatLngToContainerPixel(popupTarget.value.getPosition?.() || popupTarget.value.get('position'));
      const width = popupCoordinateElement.value?.offsetWidth || 220;
      const height = popupCoordinateElement.value?.offsetHeight || 30;
      const viewportWidth = browseMapContainerEl.value.clientWidth;
      const viewportHeight = browseMapContainerEl.value.clientHeight;
      const spider = markerSpiderfier?.getScreenBounds();
      const rightX = Math.max(point.x + 20, spider ? spider.right + 12 : -Infinity);
      const leftX = Math.min(point.x - 20 - width, spider ? spider.left - 12 - width : Infinity);
      let x = rightX + width <= viewportWidth - 12 ? rightX : leftX;
      let y = point.y - height / 2;
      if (spider && (x < 12 || x + width > viewportWidth - 12)) {
        // Narrow screens may have no horizontal slot beside the expanded group.
        y = spider.bottom + 12 + height <= viewportHeight - 12 ? spider.bottom + 12 : spider.top - height - 12;
        x = point.x - width / 2;
      }
      x = Math.max(12, Math.min(x, viewportWidth - width - 12));
      y = Math.max(12, Math.min(y, viewportHeight - height - 12));
      popupCoordinatePosition.value = { left: `${x}px`, top: `${y}px`, transform: 'none' };
    }
  }
  if (isSubmitLocate.value) {
    const center = map?.getCenter();
    if (center) locatingCoordinates.value = { latitude: center.lat(), longitude: center.lng() };
    return;
  }
  const location = draft.value.location;
  if (location?.latitude == null || location?.longitude == null) return;
  const point = submissionCrosshairOverlay?.getProjection()?.fromLatLngToContainerPixel(
    new googleMaps.LatLng(Number(location.latitude), Number(location.longitude)),
  );
  if (point) submissionCrosshairPosition.value = { left: `${point.x}px`, top: `${point.y}px` };
}
function scheduleSubmissionFrame() {
  if (submissionFrameRequest !== null) cancelAnimationFrame(submissionFrameRequest);
  submissionFrameRequest = requestAnimationFrame(() => {
    submissionFrameRequest = null;
    frameSubmissionLocation();
  });
}
function openSuggestion(item) { router.push('/suggestion/' + item.id); }
async function closeToMap() {
  await router.push({ path: '/', query: { view: 'map' } });
  restoreFocus();
}
async function closeTray() {
  if (isSubmitting.value) return;
  if (isSubmit.value) submission.value?.saveDraft?.();
  const focusLabel = isList.value ? 'Browse' : isSubmit.value ? 'Submit' : null;
  if (route.name === 'SubmissionDetail' && detailOrigin) {
    await router.push(detailOrigin.url);
  } else await closeToMap();
  if (focusLabel) nextTick(() => document.querySelector(`.map-toolbar button[aria-label="${focusLabel}"]`)?.focus({ preventScroll: true }));
  else restoreFocus();
}
async function revealLocation(location) {
  skipRestore = true;
  await closeToMap();
  focusLocation(location);
}
function resetSubmissionToBrowseCenter(viewport) {
  const crosshair = submissionCrosshairElement.value;
  const mapBounds = browseMapContainerEl.value?.getBoundingClientRect();
  if (crosshair && mapBounds) {
    const bounds = crosshair.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    pendingCrosshairStart.value = { x, y, style: { left: `${x - mapBounds.left}px`, top: `${y - mapBounds.top}px` } };
  }
  const savedDraft = submission.value?.draft || loadWizardDraft();
  savedDraft.step = 1;
  initialDraft.step = 1;
  if (!viewport || !Number.isFinite(viewport.lat) || !Number.isFinite(viewport.lng)) {
    saveWizardDraft(savedDraft);
    return;
  }
  savedDraft.location = { latitude: viewport.lat, longitude: viewport.lng, address: '', description: '' };
  initialDraft.location = savedDraft.location;
  saveWizardDraft(savedDraft);
  if (!map || !isMapReady.value) return;
  reverseGeocodeWithGoogle(viewport.lat, viewport.lng).then(address => {
    const currentDraft = submission.value?.draft || loadWizardDraft();
    const location = currentDraft.location;
    if (!address || location?.latitude !== viewport.lat || location?.longitude !== viewport.lng || location.address) return;
    location.address = address;
    initialDraft.location = location;
    saveWizardDraft(currentDraft);
  }).catch(() => {});
}
const removeNavigationGuard = router.beforeEach((to, from) => {
  cancelClusterZoom();
  const fromBrowse = from.name === 'Browse';
  if (fromBrowse && (to.name === 'SubmissionDetail' || to.name === 'Submit')) {
    browseOrigin = { url: from.fullPath, viewport: snapshot() };
    rememberFocus();
    browseSearch = mapSearchQuery.value;
    if (to.name === 'Submit') resetSubmissionToBrowseCenter(browseOrigin.viewport);
  }
  if (to.name === 'SubmissionDetail' && fromBrowse) detailOrigin = browseOrigin;
  if (to.name === 'Browse' && (from.name === 'SubmissionDetail' || from.name === 'Submit')) {
    pendingLocation = null;
    if (!skipRestore && from.name === 'SubmissionDetail') restoreSnapshot(detailOrigin?.viewport);
    skipRestore = false;
    mapSearchQuery.value = browseSearch;
  }
});
function handleEscape(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (isPopupOpen.value) { closeInfoWindow(); removeStoredActiveInfoWindowSuggestionId(); event.preventDefault(); return; }
  const openMenu = document.querySelector('.map-toolbar[data-menu-open="true"]');
  if (openMenu) { openMenu.querySelector('[aria-label="Menu"]')?.click(); event.preventDefault(); return; }
  if (isSubmit.value && submission.value?.dismissNested?.()) { event.preventDefault(); return; }
  if (workspace.dismissDetail?.()) { event.preventDefault(); return; }
  if (trayOpen.value) { event.preventDefault(); closeTray(); }
}
window.addEventListener('keydown', handleEscape);
const workspace = {
  setDetailLocation,
  pinContinueReady,
  suggestions, sortedListSuggestions, activeSort, setSortMode, requestGps, isLocating, refreshData,
  formatBrowseAddress, formatCreationDate, getPrimaryPhoto, failedPhotoIds, onPhotoError,
  isList, trayOpen, closeTray, closeToMap, openSuggestion, focusLocation, revealLocation,
  registerSubmission: value => { submission.value = value; },
};
provide(mapWorkspaceKey, workspace);
watch([isPopupOpen, isSpiderOpen, isMapReady], ([popupOpen, spiderOpen]) => {
  const open = popupOpen || spiderOpen;
  if (!open || !map || !googleMaps) { popupShadeOverlay?.setMap(null); return; }
  if (!popupShadeOverlay) {
    const shade = document.createElement('div');
    shade.className = 'map-popup-shade';
    shade.setAttribute('aria-hidden', 'true');
    popupShadeOverlay = new googleMaps.OverlayView();
    popupShadeOverlay.onAdd = () => popupShadeOverlay.getPanes().overlayLayer.appendChild(shade);
    popupShadeOverlay.onRemove = () => shade.remove();
    popupShadeOverlay.draw = () => {
      const projection = popupShadeOverlay.getProjection();
      if (!projection || !browseMapContainerEl.value) return;
      const corner = projection.fromLatLngToDivPixel(projection.fromContainerPixelToLatLng(new googleMaps.Point(0, 0)));
      shade.style.left = `${corner.x}px`;
      shade.style.top = `${corner.y}px`;
      shade.style.width = `${browseMapContainerEl.value.clientWidth}px`;
      shade.style.height = `${browseMapContainerEl.value.clientHeight}px`;
    };
  }
  popupShadeOverlay.setMap(map);
});
watch([trayOpen, isMapReady], ([open]) => {
  map?.setOptions({ gestureHandling: open ? 'none' : 'greedy', keyboardShortcuts: !open });
  if (open) { closeInfoWindow(); markerSpiderfier?.collapse(); }
}, { immediate: true });
watch([isSubmit, isDetail, isMapReady, hasDraftPin, isPopupOpen], () => {
  setSuggestionMarkersVisible(!isSubmit.value && !isDetail.value);
  if (isSubmit.value) focusLocation(draft.value.location);
  if ((isSubmit.value || hasDraftPin.value || isPopupOpen.value) && map && googleMaps && !submissionCrosshairOverlay) {
    submissionCrosshairOverlay = new googleMaps.OverlayView();
    const pane = document.createElement('div');
    pane.className = 'draft-crosshair-map-pane';
    submissionCrosshairOverlay.onAdd = () => {
      submissionCrosshairOverlay.getPanes().overlayMouseTarget.appendChild(pane);
      draftCrosshairPane.value = pane;
    };
    submissionCrosshairOverlay.onRemove = () => { draftCrosshairPane.value = null; pane.remove(); };
    submissionCrosshairOverlay.draw = updateSubmissionCrosshair;
    submissionCrosshairOverlay.setMap(map);
    const markMoving = () => { if (isSubmitLocate.value) isPinMoving.value = true; };
    pinMotionListeners.push(map.addListener('bounds_changed', markMoving));
    pinMotionListeners.push(map.addListener('dragstart', markMoving));
    pinMotionListeners.push(map.addListener('idle', () => { isPinMoving.value = false; }));
  }
  updateSubmissionCrosshair();
}, { immediate: true });
watch([isDetail, isMapReady, detailLocation], async (_, __, onCleanup) => {
  let cancelled = false;
  let observer;
  let zoomListener;
  onCleanup(() => { cancelled = true; observer?.disconnect(); zoomListener?.remove(); detailTargetOverlay?.setMap(null); detailTargetOverlay = null; });
  if (!isDetail.value || !isMapReady.value || !detailLocation.value) return;
  await nextTick();
  if (cancelled) return;
  observer = new ResizeObserver(frameDetailLocation);
  zoomListener = map.addListener('zoom_changed', () => frameDetailLocation(true));
  for (const element of [document.querySelector('.submission-detail-tray'), browseMapContainerEl.value]) {
    if (element) observer.observe(element);
  }
  frameDetailLocation();
}, { immediate: true });
watch([isDetail, detailLocation], () => {
  if (!isDetail.value) return;
  const location = detailLocation.value;
  mapSearchQuery.value = location?.address || (location?.latitude != null ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}` : 'Submission address unavailable');
}, { immediate: true });
watch(() => [isSubmitLocate.value, draft.value.location?.latitude, draft.value.location?.longitude], updateSubmissionCrosshair);
watch(popupTarget, () => nextTick(updateSubmissionCrosshair));
watch(popupCoordinateElement, () => nextTick(updateSubmissionCrosshair));
watch([isSubmit, isMapReady, () => draft.value.step], async (_, __, onCleanup) => {
  let cancelled = false;
  let observer;
  onCleanup(() => {
    cancelled = true;
    observer?.disconnect();
    if (submissionFrameRequest !== null) cancelAnimationFrame(submissionFrameRequest);
    submissionFrameRequest = null;
  });
  if (!isSubmit.value || !isMapReady.value || ![3, 4].includes(draft.value.step)) return;
  await nextTick();
  if (cancelled) return;
  const title = draft.value.step === 3 ? 'Describe your idea' : 'Review submission';
  const tray = document.querySelector(`.submission-content-tray[aria-label="${title}"]`);
  const search = document.querySelector('.map-search-panel');
  observer = new ResizeObserver(scheduleSubmissionFrame);
  for (const element of [tray, search, browseMapContainerEl.value]) {
    if (element) observer.observe(element);
  }
  scheduleSubmissionFrame();
}, { immediate: true });
watch(() => [route.fullPath, draft.value.step, draft.value.location?.address, draft.value.location?.latitude, draft.value.location?.longitude], () => {
  if (isSubmit.value && (!searchEditing.value || readOnlyAddress.value)) {
    const location = draft.value.location;
    mapSearchQuery.value = location?.address || (location?.latitude != null ? Number(location.latitude).toFixed(5) + ', ' + Number(location.longitude).toFixed(5) : 'Selected location');
  }
  if (readOnlyAddress.value) { clearTimeout(searchDebounce); mapSearchResults.value = []; isSearching.value = false; }
});
watch(isList, value => { if (isBrowse.value) setStoredBrowseTab(value ? 'list' : currentMapType.value === 'hybrid' ? 'satellite' : 'streets'); });
watch(isBrowse, value => { if (value) restoreFocus(); });

onMounted(async () => {
  window.addEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.addEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.addEventListener('scroll', positionCoordinateLabel);
  browseMapInitialization.value = 'loading';
  if (hasGoogleMapsKey) initGoogleMap();
  else browseMapInitialization.value = 'failed';
  requestGps();
  suggestions.value = await getSuggestions(false);
});

onBeforeUnmount(() => {
  cancelClusterZoom();
  popupShadeOverlay?.setMap(null);
  detailTargetOverlay?.setMap(null);
  crosshairTravelAnimation?.cancel();
  if (crosshairTravelFrame !== null) cancelAnimationFrame(crosshairTravelFrame);
  window.removeEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.removeEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.removeEventListener('scroll', positionCoordinateLabel);
  pinMotionListeners.forEach(listener => listener.remove());
  clearTimeout(coordinateCopyTimeout);
  submissionCrosshairOverlay?.setMap(null);
  if (submissionFrameRequest !== null) cancelAnimationFrame(submissionFrameRequest);
  markerSpiderfier?.dispose();
  removeNavigationGuard();
  window.removeEventListener('keydown', handleEscape);
  clearTimeout(searchDebounce);
  suggestionClusterer?.clearMarkers();
  suggestionClusterer?.setMap(null);
  suggestionClusterer = null;
  markersArray = [];
  disposeMapTheme(map);
  if (sharedBrowseMap.value?.map === map) {
    sharedBrowseMap.value = null;
  }
});

</script>
