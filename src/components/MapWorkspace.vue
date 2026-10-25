<template>
  <div class="map-workspace view-panel" :data-tray-open="trayOpen" :data-detail-loading="detailLoading" @pointerdown.capture="interruptMapMotion" @wheel.capture.passive="interruptMapMotion">
    <div ref="browseMapContainerEl" class="workspace-map-canvas" data-testid="persistent-map" :inert="detailLoading"></div>
    <div v-if="!hasGoogleMapsKey || googleMapsAuthError || mapError" class="workspace-map-status" role="status">
      <p>{{ mapError || googleMapsAuthError || 'Google Maps is unavailable. You can still browse ideas.' }}</p>
    </div>
    <div v-else-if="!isMapReady" class="workspace-map-status" role="status">Loading Map…</div>
    <Transition name="workspace-backdrop"><div v-if="trayOpen && !desktopSideTray" class="workspace-backdrop" :class="{ 'workspace-backdrop-sharp': isDetail || (isSubmit && (draft.step === 3 || draft.step === 4)), 'workspace-backdrop-detail': isDetail }" :style="isDetail ? { '--spotlight-opacity': detailMapOpacity, '--target-x': detailTargetPosition.left, '--target-y': detailTargetPosition.top, '--spotlight-radius': `${markerSpotlightSize / 2}px`, '--spotlight-feather': `${markerSpotlightFeather}px` } : undefined" aria-hidden="true"></div></Transition>
    <Teleport :to="draftCrosshairPane || 'body'" :disabled="isSubmit || !draftCrosshairPane">
    <div v-if="isSubmit" ref="submissionCrosshairElement" class="submission-crosshair" :class="{ 'is-locating': isSubmitLocate, 'is-animating-pin': isSubmitLocate && crosshairEntranceReady }" :style="isSubmitLocate ? { left: '50%', top: '50%' } : pendingCrosshairStart?.style || submissionCrosshairPosition">
      <svg :key="isSubmitLocate ? 'locating' : 'locked'" data-testid="suggestion-location-crosshair" viewBox="0 0 50 50" aria-hidden="true" @animationend="onCrosshairAnimationEnd">
        <g transform="translate(25 25)" fill="none" stroke="var(--color-primary)" stroke-width="3">
          <circle r="9" /><path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25" /><circle r="2" fill="var(--color-primary)" stroke="none" />
        </g>
      </svg>
      <div v-if="isSubmit && submissionCoordinates" ref="coordinateLabel" class="crosshair-coordinate-label" :class="{ 'is-left': coordinateLabelOnLeft, 'is-moving': isSubmitLocate && isPinMoving }" :style="coordinateLabelStyle">
        <button type="button" class="map-ui map-ui-button" :aria-label="`Copy latitude and longitude: ${submissionCoordinates}`" @click.stop="copySubmissionCoordinates">{{ submissionCoordinates }}</button>
        <span v-if="coordinateCopyMessage" class="map-ui crosshair-copy-tooltip" role="status">{{ coordinateCopyMessage }}</span>
      </div>
    </div>
    </Teleport>
    <div v-if="isDetail" class="detail-map-target" :style="{ ...detailTargetPosition, opacity: detailMapOpacity, visibility: detailMapOpacity === 0 ? 'hidden' : undefined }">
      <div ref="detailTextElement" class="detail-marker-text" :style="{ visibility: detailLoading && !detailTextErasing ? 'hidden' : undefined }">
        <div v-if="detailSummary" ref="detailSummaryElement" class="detail-marker-summary">
          <span class="sr-only">{{ detailSummary }}</span>
          <span aria-hidden="true"><span class="detail-typewriter-visible">{{ revealedSummary.settled }}<span v-for="character in revealedSummary.leading" :key="character.index" :style="{ opacity: character.opacity }">{{ character.text }}</span></span><span class="detail-typewriter-pending">{{ revealedSummary.pending }}</span></span>
        </div>

      </div>
    </div>
    <div class="workspace-route-layer">
      <router-view v-slot="{ Component }">
        <keep-alive include="BrowseView,SubmitView"><component :is="Component" :key="route.name" /></keep-alive>
      </router-view>
    </div>
      <MapSearchOverlay :has-suggestions="mapSearchResults.length > 0" :inert="detailLoading">
        <AddressBar :theme="isDark ? 'dark' : 'light'" :mode="addressBarMode" :model-value="mapSearchQuery"
          :results="addressBarResults" menu-id="map-menu-trigger" :menu-expanded="Boolean(mapToolbar?.menuIsOpen)"
          placeholder="Search address or neighborhood..." @update:model-value="setMapSearchQuery"
          @update:mode="onAddressBarModeChange" @menu-click="mapToolbar?.toggleMenu?.()"
          @select-result="selectAddressBarResult" />
      </MapSearchOverlay>
    <StyleSettings ref="styleSettings" :map-style="selectedMapStyle" :icon-size="suggestionIconSize"
      :rails-visible="railVisible" :rail-thickness="railThickness" @map-style="changeMapStyle" @icon-size="setSuggestionIconSize"
      @rails-visible="setRailVisibility" @rail-thickness="setRailThickness" @more-settings="openAdvancedMapSettings"
      :locating="isLocating || !!submission?.isLocating?.value" :recenter-disabled="readOnlyAddress" @center="onCenterOnLocationClick"
      @before-open="mapToolbar?.closeMarkerSettings?.()" />
    <NewIdeaSpecialButton v-if="!isSubmitting" ref="primaryMapActionButton"
      :state="isSubmitLocate ? 'pin' : isSubmit ? 'close' : 'new'" :theme="isDark ? 'dark' : 'light'"
      :pin-top="pinContinueTop" :pin-ready="pinContinueReady" :inert="detailLoading"
      :morphing="fabMorphing" :morph-phase="fabMorphPhase" :reverse-travel-offset="fabReverseTravelOffset"
      @new="startNewIdea" @set-pin="submission?.nextStep?.()" @cancel-pin="cancelPin" @close="closeTray" />
    <MapToolbar v-if="!isSubmitting" class="absolute bottom-8 left-6 z-10" :inert="detailLoading"
      ref="mapToolbar" :model-value="trayOpen && !isSubmit ? 'list' : 'map'" :marker-zoom-threshold="markerZoomThreshold" :map-zoom="mapZoom"
      @present-on-tv="openPresentationSetup"
      @update:model-value="selectTab"
      :heatmap-opacity="heatmapOpacity" @update:heatmap-opacity="setHeatmapOpacity"
      :heatmap-radius="heatmapRadius" @update:heatmap-radius="setHeatmapRadius"
      :marker-pulse-speed="markerPulseSpeed" @update:marker-pulse-speed="setMarkerPulseSpeed"
      :marker-pulse-scale="markerPulseScale" @update:marker-pulse-scale="setMarkerPulseScale"
      :marker-bob-angle="markerBobAngle" @update:marker-bob-angle="setMarkerBobAngle"
      :marker-bob-speed="markerBobSpeed" @update:marker-bob-speed="setMarkerBobSpeed"
      :marker-pulse-easing="markerPulseEasing" @update:marker-pulse-easing="setMarkerPulseEasing"
      :marker-bob-easing="markerBobEasing" @update:marker-bob-easing="setMarkerBobEasing"
      :marker-spotlight-size="markerSpotlightSize" @update:marker-spotlight-size="setMarkerSpotlightSize"
      :marker-spotlight-feather="markerSpotlightFeather" @update:marker-spotlight-feather="setMarkerSpotlightFeather"
      @update:marker-zoom-threshold="setMarkerZoomThreshold" />
  </div>
</template>
<script setup>

import MapToolbar from './MapToolbar.vue';
import NewIdeaSpecialButton from './NewIdeaSpecialButton.vue';
import MapSearchOverlay from './MapSearchOverlay.vue';
import AddressBar from './AddressBar.vue';
import StyleSettings from './StyleSettings.vue';
import { ref, computed, onMounted, provide, shallowRef, inject, onBeforeUnmount, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { isDark } from '../services/theme';
import { formatIdeaCreationDate as formatCreationDate, formatIdeaShortDate } from '../services/ideaDateFormat.js';
import { railVisible, railThickness, setRailVisible, setRailThickness } from '../services/railSettings.js';
import { suggestionIconSize, selectedMapStyle, setSuggestionIconSize, setSelectedMapStyle } from '../services/styleSettings.js';
import { mapWorkspaceKey, detailMotionDuration } from '../services/mapWorkspace';
import { loadWizardDraft, saveWizardDraft } from '../services/storage';
import { browseMapInitialization, sharedBrowseMap } from '../services/sharedBrowseMap';
import { createEmojiMarkerSvg } from '../services/emojiMapMarker';
import { createSuggestionDensityOverlay } from '../services/suggestionDensityOverlay';
import { MarkerClusterer, SuperClusterAlgorithm } from '@googlemaps/markerclusterer';
import { clusterAppearance, createMarkerSpiderfier } from '../services/markerSpiderfier';
import { getSuggestions } from '../services/api';
import { bookmarks } from '../services/bookmarks';
import { addFormattedDistances, sortSuggestionsByDistance } from '../services/geo';
import {
  getStoredBrowseTab,
  setStoredBrowseTab,
  getStoredMapView,
  setStoredMapView,
  removeStoredMapView,
  getStoredBrowseSort,
  getStoredMarkerZoomThreshold,
  setStoredMarkerZoomThreshold,
  getStoredHeatmapOpacity,
  setStoredHeatmapOpacity,
  getStoredHeatmapRadius,
  setStoredHeatmapRadius,
  getStoredMarkerPulseSpeed,
  setStoredMarkerPulseSpeed,
  getStoredMarkerPulseScale,
  setStoredMarkerPulseScale,
  getStoredMarkerBobAmount,
  setStoredMarkerBobAmount,
  getStoredMarkerBobSpeed,
  setStoredMarkerBobSpeed,
  getStoredMarkerPulseEasing,
  setStoredMarkerPulseEasing,
  getStoredMarkerBobEasing,
  setStoredMarkerBobEasing,
  getStoredMarkerSpotlightSize,
  setStoredMarkerSpotlightSize,
  getStoredMarkerSpotlightFeather,
  setStoredMarkerSpotlightFeather,
  setStoredBrowseSort,
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
  setMapRailsVisible,
  disposeMapTheme,
  reverseGeocodeWithGoogle,
} from '../services/googleMaps';

const router = useRouter();
const route = useRoute();

const savedTab = getStoredBrowseTab(); // 'streets' | 'satellite' | 'list'
const suggestions = ref([]);
const resolvedSuggestions = ref(new Map());
const failedPhotoIds = ref(new Set());
const isLoading = ref(true);
const listError = ref('');
const locationError = ref('');
const restoredLocation = window.history.state?.ideaView?.location;
const userLocation = ref(restoredLocation && Number.isFinite(restoredLocation.lat) && Number.isFinite(restoredLocation.lng)
  && Math.abs(restoredLocation.lat) <= 90 && Math.abs(restoredLocation.lng) <= 180 ? restoredLocation : null);
const isLocating = ref(false);
const currentMapType = ref(selectedMapStyle.value === 'satellite' ? 'hybrid' : 'roadmap');
const styleSettings = ref(null);
const mapToolbar = ref(null);
let requestedSort = getStoredBrowseSort();
const activeSort = ref(requestedSort === 2 && userLocation.value ? 2 : 1);
const markerZoomThreshold = ref(getStoredMarkerZoomThreshold());
const heatmapOpacity = ref(getStoredHeatmapOpacity());
const heatmapRadius = ref(getStoredHeatmapRadius());
const markerPulseSpeed = ref(getStoredMarkerPulseSpeed());
const markerPulseScale = ref(getStoredMarkerPulseScale());
const markerBobAngle = ref(getStoredMarkerBobAmount());
const markerBobSpeed = ref(getStoredMarkerBobSpeed());
const markerPulseEasing = ref(getStoredMarkerPulseEasing());
const markerBobEasing = ref(getStoredMarkerBobEasing());
const markerSpotlightSize = ref(getStoredMarkerSpotlightSize());
const markerSpotlightFeather = ref(getStoredMarkerSpotlightFeather());
const mapZoom = ref(getStoredMapView()?.zoom ?? 13);

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
const draftCrosshairPane = shallowRef(null);
function closeInfoWindow() {
  infoWindow?.close();
  isPopupOpen.value = false;
}

let markersArray = [];
let suggestionMarkersById = new Map();
let suggestionMarkerData = new WeakMap();
let suggestionClusterer = null;
let densityOverlay = null;
let renderedMarkerVisibility = null;
let detailPinnedMarker = null;
const detailMapOpacity = ref(1);
function setDetailReadingProgress(progress) {
  detailMapOpacity.value = 1 - Math.max(0, Math.min(1, progress));
  detailPinnedMarker?.setOpacity?.(detailMapOpacity.value);
}
let markerSpiderfier = null;
let userLocationMarker = null;
let submissionCrosshairOverlay = null;
let detailTargetOverlay = null;
const detailTextElement = ref(null);
const detailSummaryElement = ref(null);
let detailTextFrame = 0;
// The marker target is 50px high; the caption starts 44px below its center.
const detailMarkerHalfHeight = 25;
const detailSummaryOffset = 44;
const detailHandleHeight = 22;
function fitDetailText() {
  const text = detailTextElement.value;
  const summary = detailSummaryElement.value;
  const tray = document.querySelector('.submission-detail-tray');
  if (!text?.isConnected || !tray || tray.matches('.is-reading, .is-dragging')) return;
  const frame = tray.getBoundingClientRect();
  const target = text.parentElement.getBoundingClientRect();
  const bounds = browseMapContainerEl.value?.getBoundingClientRect();
  const searchBottom = document.querySelector('.address-bar')?.getBoundingClientRect().bottom || 60;
  text.style.width = `${Math.max(1, frame.width - 16)}px`;
  text.style.left = `${frame.left + frame.width / 2 - target.left}px`;
  const summaryOffset = bounds?.height <= 500 ? 24 : detailSummaryOffset;
  text.style.top = `${detailMarkerHalfHeight + summaryOffset}px`;
  if (!summary || !bounds) return;
  summary.style.fontSize = '18px';
  const trayBottom = bounds.bottom - 88;
  const requiredGap = () => detailMarkerHalfHeight + summaryOffset + summary.getBoundingClientRect().height + 2 * (detailHandleHeight + 16);
  if (trayBottom - searchBottom - requiredGap() < 140) summary.style.fontSize = '16px';
  const value = `${Math.floor(Math.max(100, trayBottom - searchBottom - requiredGap()))}px`;
  if (tray.style.getPropertyValue('--detail-readable-height') !== value) tray.style.setProperty('--detail-readable-height', value);
}
function scheduleDetailTextFit() {
  if (detailTextFrame) return;
  detailTextFrame = requestAnimationFrame(() => { detailTextFrame = 0; fitDetailText(); });
}
function detailMarkerTargetY(searchBottom, trayTop) {
  const summaryHeight = detailSummaryElement.value?.getBoundingClientRect().height || 0;
  const summaryOffset = (detailTextElement.value?.offsetTop || detailMarkerHalfHeight + detailSummaryOffset) - detailMarkerHalfHeight;
  const groupCenterOffset = summaryHeight ? (summaryOffset + summaryHeight - detailMarkerHalfHeight) / 2 : 0;
  // Center the entire marker/caption group between the search bar and tray.
  return (searchBottom + trayTop) / 2 - groupCenterOffset;
}
const detailTargetPosition = ref({ left: '50%', top: '25%' });
const submissionCrosshairPosition = ref({ left: '50%', top: '50%' });
const submissionCrosshairElement = ref(null);
const pendingCrosshairStart = ref(null);
let crosshairTravelAnimation = null;
let crosshairTravelFrame = null;
const crosshairEntranceReady = ref(true);
const pinContinueReady = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const pinContinueTop = ref('50%');
const primaryMapActionButton = ref(null);
const fabMorphing = ref(false);
const fabMorphPhase = ref('idle');
let pendingFabMorphRect = null;
let pendingReverseFabMorphRect = null;
const fabReverseTravelOffset = ref(null);
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

const bookmarkedSuggestions = computed(() => {
  const current = new Map(suggestions.value.map(item => [String(item.id), item]));
  return bookmarks.value.map(entry => resolvedSuggestions.value.get(entry.suggestion.id) || current.get(entry.suggestion.id) || entry.suggestion);
});

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
  }
}
function setTab(tab) { router.push({ path: '/', query: { view: tab === 'list' ? 'list' : 'map' } }); }
function setSortMode(sort) {
  requestedSort = sort;
  setStoredBrowseSort(sort);
  locationError.value = '';
  if (sort === 2 && !userLocation.value) { requestGps(); return; }
  if (activeSort.value === sort) return;
  activeSort.value = sort;
  nextTick(() => {
    const content = document.querySelector('.idea-list-tray .map-tray-content');
    if (content) content.scrollTop = 0;
    saveViewState();
  });
}
function setMapType(type) {
  cancelClusterZoom();
  currentMapType.value = type;
  setSelectedMapStyle(type === 'hybrid' || type === 'satellite' ? 'satellite' : 'streets');
  setStoredBrowseTab(isList.value ? 'list' : type === 'hybrid' ? 'satellite' : 'streets');
  if (!map) return;
  map.setMapTypeId(type);
  updateMapTheme(map, isDark.value, type);
  saveCurrentMapView();
}
function changeMapStyle(style) {
  setSelectedMapStyle(style);
  setMapType(style === 'satellite' ? 'hybrid' : 'roadmap');
}
function setRailVisibility(visible) {
  setRailVisible(visible);
  if (map) setMapRailsVisible(map, railVisible.value);
}
function openAdvancedMapSettings() {
  styleSettings.value?.close();
  nextTick(() => mapToolbar.value?.openMarkerSettings?.(styleSettings.value?.getOpener?.()));
}
function saveCurrentMapView() {
  if (!map || !isMapReady.value || isProgrammaticChange || (!isBrowse.value && route.name !== 'Bookmarks')) return;
  const center = map.getCenter();
  const zoom = map.getZoom();
  if (center && typeof zoom === 'number') {
    setStoredMapView({
      lat: center.lat(),
      lng: center.lng(),
      zoom: zoom,
      mapType: currentMapType.value,
    });
    if (viewReady) saveViewState();
  }
}

function setSuggestionMarkersVisible(visible) {
  // Reattaching an unchanged clusterer clears its markers until the next map
  // idle/zoom cycle. Popup state must never cause that reset.
  if (areSuggestionMarkersVisible === visible) return;
  areSuggestionMarkersVisible = visible;
  syncSuggestionDisplay();
}
function setMarkerZoomThreshold(value) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) return;
  markerZoomThreshold.value = Math.max(1, Math.min(20, Math.round(threshold)));
  setStoredMarkerZoomThreshold(markerZoomThreshold.value);
}
function syncSuggestionDisplay() {
  const markersVisible = areSuggestionMarkersVisible && !isDensityMode.value;
  if (renderedMarkerVisibility !== markersVisible) {
    renderedMarkerVisibility = markersVisible;
    if (!markersVisible) { markerSpiderfier?.collapse(); closeInfoWindow(); }
    if (suggestionClusterer) {
      suggestionClusterer.setMap(null);
      if (markersVisible) {
        // Detaching clears rendered clusters but leaves the algorithm's cached
        // result intact. A fresh clusterer must redraw even at the same zoom.
        suggestionClusterer.clearMarkers(true);
        suggestionClusterer = createSuggestionClusterer(true);
      }
    }
  }
  densityOverlay?.setMap(isDensityMode.value ? map : null);
}
function setHeatmapOpacity(value) {
  if (!Number.isFinite(value)) return;
  heatmapOpacity.value = Math.max(0, Math.min(1, value));
  densityOverlay?.setOpacity(heatmapOpacity.value);
  setStoredHeatmapOpacity(heatmapOpacity.value);
}
function setHeatmapRadius(value) {
  if (!Number.isFinite(value)) return;
  heatmapRadius.value = Math.max(8, Math.min(160, Math.round(value)));
  densityOverlay?.setRadius(heatmapRadius.value);
  setStoredHeatmapRadius(heatmapRadius.value);
}
function suggestionMarkerIcon(suggestion, pulse = false) {
  const size = Math.round((pulse ? 128 : 80) * suggestionIconSize.value / 100);
  return {
    url: createEmojiMarkerSvg(suggestion.emoji, {
      pulse,
      pulseSpeed: markerPulseSpeed.value,
      pulseScale: markerPulseScale.value,
      bobAngle: markerBobAngle.value,
      bobSpeed: markerBobSpeed.value,
      pulseEasing: markerPulseEasing.value,
      bobEasing: markerBobEasing.value,
      canvasSize: size,
    }),
    scaledSize: new googleMaps.Size(size, size),
    anchor: new googleMaps.Point(size / 2, size / 2),
  };
}
function refreshSuggestionMarkerIcons() {
  for (const marker of markersArray) {
    const suggestion = suggestionMarkerData.get(marker);
    if (suggestion) marker.setIcon(suggestionMarkerIcon(suggestion, marker === detailPinnedMarker));
  }
}
watch(suggestionIconSize, refreshSuggestionMarkerIcons, { flush: 'sync' });
watch(railVisible, visible => { if (map) setMapRailsVisible(map, visible); }, { flush: 'sync' });
function updatePinnedDetailMarkerIcon() {
  if (!detailPinnedMarker) return;
  const suggestion = suggestionMarkerData.get(detailPinnedMarker);
  if (suggestion) detailPinnedMarker.setIcon(suggestionMarkerIcon(suggestion, true));
}
function setMarkerPulseSpeed(value) {
  markerPulseSpeed.value = Math.min(2, Math.max(.5, Number(value)));
  setStoredMarkerPulseSpeed(markerPulseSpeed.value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerPulseScale(value) {
  markerPulseScale.value = Math.min(2, Math.max(1, Number(value)));
  setStoredMarkerPulseScale(markerPulseScale.value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerBobAngle(value) {
  markerBobAngle.value = Math.min(12, Math.max(0, Number(value)));
  setStoredMarkerBobAmount(markerBobAngle.value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerBobSpeed(value) {
  markerBobSpeed.value = Math.min(2, Math.max(.5, Number(value)));
  setStoredMarkerBobSpeed(markerBobSpeed.value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerPulseEasing(value) {
  markerPulseEasing.value = value;
  setStoredMarkerPulseEasing(value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerBobEasing(value) {
  markerBobEasing.value = value;
  setStoredMarkerBobEasing(value);
  updatePinnedDetailMarkerIcon();
}
function setMarkerSpotlightSize(value) {
  markerSpotlightSize.value = Math.min(480, Math.max(48, Number(value)));
  setStoredMarkerSpotlightSize(markerSpotlightSize.value);
}
function setMarkerSpotlightFeather(value) {
  markerSpotlightFeather.value = Math.min(96, Math.max(0, Number(value)));
  setStoredMarkerSpotlightFeather(markerSpotlightFeather.value);
}
function syncDetailSuggestionMarker(targetId = isDetail.value ? route.params.id : null) {
  if (!suggestionClusterer || !map || !googleMaps) return;
  const target = isDetail.value && targetId != null ? suggestionMarkersById.get(String(targetId)) : null;
  if (detailPinnedMarker === target) return;
  if (detailPinnedMarker) {
    const previous = detailPinnedMarker;
    previous.setZIndex(null);
    previous.setOpacity?.(1);
    const item = suggestionMarkerData.get(previous);
    if (item) previous.setIcon(suggestionMarkerIcon(item));
    suggestionClusterer.addMarker(previous, true);
    detailPinnedMarker = null;
  }
  if (target) {
    const item = suggestionMarkerData.get(target);
    if (item) target.setIcon(suggestionMarkerIcon(item, true));
    target.setZIndex((googleMaps.Marker.MAX_ZINDEX || 100000) + 1);
    suggestionClusterer.removeMarker(target, true);
    suggestionClusterer.render();
    target.setMap(map);
    detailPinnedMarker = target;
    target.setOpacity?.(detailMapOpacity.value);
  } else {
    suggestionClusterer.render();
  }
}

function renderSuggestionCluster({ count, position }) {
  const { diameter, fill, text } = clusterAppearance(count);
  const size = diameter + 32; // Transparent padding keeps the drop shadow inside the image.
  const center = size / 2;
  const radius = diameter / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter></defs><circle cx="${center}" cy="${center}" r="${radius}" fill="${fill}" stroke="#d8c394" stroke-width="2" filter="url(#s)"/><text x="${center}" y="${center}" text-anchor="middle" dominant-baseline="central" fill="${text}" font-family="Roboto,Arial,sans-serif" font-size="15" font-weight="700">${count}</text></svg>`;
  return new googleMaps.Marker({
    position,
    title: `${count} suggestions in this area. Select to expand.`,
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
    mapZoom.value = initialZoom;

    // Default Streets view (ROADMAP) or Satellite (HYBRID)
    map = new googleMaps.Map(browseMapContainerEl.value, {
      center: initialCenter,
      zoom: initialZoom,
      mapTypeId: currentMapType.value === 'hybrid' ? googleMaps.MapTypeId.HYBRID : googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      gestureHandling: detailLoading.value ? 'none' : 'greedy',
      keyboardShortcuts: !detailLoading.value,
      clickableIcons: false,
      heading: 0,
      tilt: 0,
      rotateControl: false,
      headingInteractionEnabled: false,
      tiltInteractionEnabled: false,
    });

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
      mapZoom.value = map.getZoom() ?? mapZoom.value;
      saveCurrentMapView();
    });
    map.addListener('idle', refreshDetailNavigation);

    isMapReady.value = true;
    renderSuggestionMarkers();

    isProgrammaticChange = false;
    if (pendingLocation) focusLocation(pendingLocation);
  } catch (err) {
    console.warn('Google Maps BrowseView init warning:', err);
    mapError.value = 'The map could not be loaded. You can still browse ideas.';
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
  const timeStr = formatIdeaShortDate(suggestion.creationDate);

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
  if (!map || !googleMaps || blocksMap.value) return;
  if (!infoWindow) {
    infoWindow = new googleMaps.InfoWindow();
    infoWindow.addListener('closeclick', () => {
      isPopupOpen.value = false;
      removeStoredActiveInfoWindowSuggestionId();
      saveCurrentMapView();
    });
  }

  setStoredActiveInfoWindowSuggestionId(suggestion.id);
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

function createSuggestionClusterer(visible) {
  return new MarkerClusterer({
    map: visible ? map : null,
    markers: markersArray.filter(marker => marker !== detailPinnedMarker),
    algorithm: new SuperClusterAlgorithm({ radius: 64, maxZoom: 30 }),
    renderer: { render: renderSuggestionCluster },
    onClusterClick: async (_event, cluster) => {
      cancelClusterZoom();
      closeInfoWindow();
      // Closing details can rebuild clusters when its highlighted marker returns.
      const group = [...cluster.markers];
      const position = cluster.position;
      if (isDetail.value) {
        cancelDetailTransition();
        skipRestore = true;
        await closeToMap();
        await nextTick();
        if (!isBrowse.value || !map) return;
        // Keep the opened spider in marker mode when leaving a zoomed-out detail.
        if ((map.getZoom() ?? 0) < markerZoomThreshold.value) {
          map.setZoom(markerZoomThreshold.value);
          await nextTick();
        }
        map.setCenter(position);
        saveCurrentMapView();
      }
      markerSpiderfier?.expand(group, position);
    },
  });
}

function renderSuggestionMarkers() {
  if (!map || !googleMaps) return;
  markerSpiderfier?.dispose();
  markerSpiderfier = createMarkerSpiderfier(map, googleMaps, (marker) => {
    const suggestion = suggestionMarkerData.get(marker);
    if (suggestion) {
      closeInfoWindow();
      removeStoredActiveInfoWindowSuggestionId();
      openSuggestion(suggestion);
    }
  }, () => { isSpiderOpen.value = false; closeInfoWindow(); }, () => { isSpiderOpen.value = true; }, () => {
    closeInfoWindow();
    removeStoredActiveInfoWindowSuggestionId();
  }, marker => suggestionMarkerData.get(marker)?.emoji);

  // Clear existing markers & close infoWindow
  if (infoWindow) {
    closeInfoWindow();
  }
  suggestionClusterer?.clearMarkers();
  suggestionClusterer?.setMap(null);
  suggestionClusterer = null;
  markersArray.forEach((m) => m.setMap(null));
  markersArray = [];
  suggestionMarkersById = new Map();
  suggestionMarkerData = new WeakMap();
  detailPinnedMarker = null;

  // Add Google Maps markers for each suggestion
  suggestions.value.forEach((s) => {
    const lat = s.location?.latitude ?? s.latitude;
    const lng = s.location?.longitude ?? s.longitude;
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      const gMarker = new googleMaps.Marker({
        position: { lat: Number(lat), lng: Number(lng) },
        title: s.content?.summary || 'Suggestion',
        icon: suggestionMarkerIcon(s),
        optimized: false,
      });

      gMarker.addListener('click', () => {
        closeInfoWindow();
        removeStoredActiveInfoWindowSuggestionId();
        openSuggestion(suggestionMarkerData.get(gMarker) || s);
      });

      markersArray.push(gMarker);
      suggestionMarkersById.set(String(s.id), gMarker);
      suggestionMarkerData.set(gMarker, s);

    }
  });

  suggestionClusterer = createSuggestionClusterer(areSuggestionMarkersVisible && !isDensityMode.value);
  renderedMarkerVisibility = areSuggestionMarkersVisible && !isDensityMode.value;
  if (!densityOverlay) densityOverlay = createSuggestionDensityOverlay(map, googleMaps, { opacity: heatmapOpacity.value, radius: heatmapRadius.value });
  densityOverlay.setData(markersArray.map(marker => marker.getPosition()));
  densityOverlay.setMap(isDensityMode.value ? map : null);
  syncDetailSuggestionMarker();

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
  if (lat !== undefined && lng !== undefined && (isList.value || route.name === 'Bookmarks')) await closeToMap();
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
  if (isLocating.value) return;
  const fail = () => {
    isLocating.value = false;
    if (requestedSort === 2) locationError.value = userLocation.value
      ? 'Could not update your location. Distances use your last location.'
      : 'Your location is unavailable. Showing newest ideas.';
  };
  if (!navigator.geolocation) { fail(); return; }
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      isLocating.value = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { fail(); return; }
      userLocation.value = { lat, lng };
      locationError.value = '';
      if (requestedSort === 2) setSortMode(2);

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
      fail();
      console.warn('GPS error:', err);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

async function refreshData(force = true) {
  isLoading.value = true;
  listError.value = '';
  try {
    suggestions.value = await getSuggestions(force, { strict: true });
    renderSuggestionMarkers();
  } catch {
    listError.value = 'Ideas could not be loaded. Please try again.';
  } finally {
    isLoading.value = false;
  }
}

watch(
  () => suggestions.value,
  () => {
    renderSuggestionMarkers();
    refreshDetailNavigation();
  },
  { deep: true }
);


const isBrowse = computed(() => route.name === 'Browse');
const isDensityMode = computed(() => isBrowse.value && !isList.value && route.query.view !== 'map' && mapZoom.value < markerZoomThreshold.value);
const isList = computed(() => isBrowse.value && (route.query.view === 'list' || (!route.query.view && savedTab === 'list')));
const submission = shallowRef(null);
const initialDraft = loadWizardDraft();
const draft = computed(() => submission.value?.draft || initialDraft);
const isSubmit = computed(() => route.name === 'Submit');
const isDetail = computed(() => route.name === 'SubmissionDetail');
const detailLoading = ref(false);
// History navigation is asynchronous; stop queued framing when closing starts.
let detailClosing = false;
let detailMotionFrame = 0;
let cancelDetailMotion = null;
const detailLocation = ref(null);
const detailSummary = ref('');
const detailRevealProgress = ref(1);
const revealedSummary = computed(() => revealPrefix(detailSummary.value));
function revealPrefix(text) {
  const characters = Array.from(text);
  const fadeWidth = 6;
  const cursor = (characters.length + fadeWidth) * detailRevealProgress.value;
  const start = Math.max(0, Math.floor(cursor - fadeWidth));
  const end = Math.min(characters.length, Math.ceil(cursor));
  return {
    settled: characters.slice(0, start).join(''),
    leading: characters.slice(start, end).map((text, offset) => ({
      text,
      index: start + offset,
      opacity: Math.min(1, Math.max(0, (cursor - start - offset) / fadeWidth)),
    })),
    pending: characters.slice(end).join(''),
  };
}
const detailTextErasing = ref(false);
let cancelDetailTextAnimation = null;
let detailTextEraseVersion = 0;
function animateDetailText(target) {
  cancelDetailTextAnimation?.();
  const from = detailRevealProgress.value;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === target) {
    detailRevealProgress.value = target;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); cancelDetailTextAnimation = null; resolve(); };
    cancelDetailTextAnimation = finish;
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / (target === 0 ? 400 : 1000));
      detailRevealProgress.value = from + (target - from) * progress;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
  });
}
async function eraseDetailText() {
  const version = ++detailTextEraseVersion;
  detailTextErasing.value = true;
  await animateDetailText(0);
  if (version === detailTextEraseVersion) detailTextErasing.value = false;
}
watch([isDetail, detailLoading, detailSummary], ([active, loading]) => {
  if (active && loading && detailTextErasing.value) return;
  cancelDetailTextAnimation?.();
  detailRevealProgress.value = 0;
  if (active && !loading) animateDetailText(1);
}, { immediate: true });
onBeforeUnmount(() => cancelDetailTextAnimation?.());
const detailNavigation = ref({ olderId: null, newerId: null });
let detailSuggestionId = null;
let detailCreationTime = NaN;
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
watch([submissionCoordinates, submissionCrosshairPosition, isSubmitLocate], () => nextTick(positionCoordinateLabel), { flush: 'post' });
watch(coordinateLabel, (element, _, onCleanup) => {
  if (!element) return;
  const observer = new ResizeObserver(positionCoordinateLabel);
  observer.observe(element);
  onCleanup(() => observer.disconnect());
});
watch(isSubmitLocate, async active => {
  if (active && pendingFabMorphRect) {
    const startRect = pendingFabMorphRect;
    pendingFabMorphRect = null;
    fabMorphPhase.value = 'travel';
    fabMorphing.value = true;
    void (async () => {
      await nextTick();
      const button = getPrimaryActionButton();
      if (button) button.classList.remove('is-morph-prep');
      const endRect = button?.getBoundingClientRect();
      if (button) button.classList.add('is-morph-prep');
      if (!button || !endRect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        fabMorphPhase.value = 'complete';
        fabMorphing.value = false;
        return;
      }
      const travel = button.animate([
        { translate: `${startRect.left - endRect.left}px ${startRect.top - endRect.top}px`, width: `${startRect.width}px`, height: `${startRect.height}px`, borderRadius: '50%', transformOrigin: 'top left' },
        { translate: '0px 0px', width: `${startRect.width}px`, height: `${startRect.height}px`, borderRadius: '50%', transformOrigin: 'top left' },
      ], { duration: 300, easing: 'linear', fill: 'forwards' });
      await travel.finished.catch(() => {});
      if (!button.isConnected) { travel.cancel(); return; }
      fabMorphPhase.value = 'expand';
      await nextTick();
      const expand = button.animate([
        { translate: '0px 0px', width: `${startRect.width}px`, height: `${startRect.height}px`, borderRadius: '50%', transformOrigin: 'top left' },
        { translate: '0px 0px', width: `${endRect.width}px`, height: `${endRect.height}px`, borderRadius: '999px', transformOrigin: 'top left' },
      ], { duration: 110, easing: 'ease-out', fill: 'forwards' });
      await expand.finished.catch(() => {});
      expand.cancel();
      fabMorphPhase.value = 'complete';
      fabMorphing.value = false;
    })();
  } else if (!active && pendingReverseFabMorphRect) {
    const { startRect, endRect, offset } = pendingReverseFabMorphRect;
    pendingReverseFabMorphRect = null;
    fabMorphPhase.value = 'reverse-travel';
    fabMorphing.value = true;
    void (async () => {
      await nextTick();
      const button = getPrimaryActionButton();
      if (!button || !endRect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        fabMorphing.value = false;
        fabMorphPhase.value = 'idle';
        fabReverseTravelOffset.value = null;
        return;
      }
      const travelBack = button.animate([
        { translate: offset, width: '72px', height: '72px', borderRadius: '50%', transformOrigin: 'top left' },
        { translate: '0px 0px', width: '72px', height: '72px', borderRadius: '50%', transformOrigin: 'top left' },
      ], { duration: 300, easing: 'linear', fill: 'forwards' });
      await travelBack.finished.catch(() => {});
      travelBack.cancel();
      fabReverseTravelOffset.value = null;
      fabMorphing.value = false;
      fabMorphPhase.value = 'idle';
    })();
  } else if (!active) {
    fabMorphPhase.value = 'idle';
    fabMorphing.value = false;
    pendingFabMorphRect = null;
  } else {
    fabMorphPhase.value = 'complete';
    fabMorphing.value = false;
  }
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
}, { immediate: true });
async function cancelPin() {
  const button = getPrimaryActionButton();
  if (!button || !isSubmitLocate.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await closeTray();
    return;
  }
  fabMorphPhase.value = 'reverse-expand';
  fabMorphing.value = true;
  await nextTick();
  const currentRect = button.getBoundingClientRect();
  const contract = button.animate([
    { width: `${currentRect.width}px`, height: `${currentRect.height}px`, borderRadius: '999px' },
    { width: '72px', height: '72px', borderRadius: '50%' },
  ], { duration: 110, easing: 'ease-in', fill: 'forwards' });
  await contract.finished.catch(() => {});
  if (!button.isConnected) { contract.cancel(); return; }
  const startRect = button.getBoundingClientRect();
  const pinTop = button.style.top;
  button.classList.remove('is-pin-continue');
  button.style.removeProperty('top');
  const endRect = button.getBoundingClientRect();
  button.classList.add('is-pin-continue');
  button.style.top = pinTop;
  const offset = `${startRect.left - endRect.left}px ${startRect.top - endRect.top}px`;
  pendingReverseFabMorphRect = { startRect, endRect, offset };
  fabReverseTravelOffset.value = offset;
  await closeTray();
  contract.cancel();
}
function getPrimaryActionButton() {
  return primaryMapActionButton.value?.getMainButtonElement?.() || null;
}
function startNewIdea() {
  pendingFabMorphRect = getPrimaryActionButton()?.getBoundingClientRect() || null;
  fabMorphing.value = true;
  router.push('/submit').catch(() => { fabMorphing.value = false; pendingFabMorphRect = null; });
}
function openPresentationSetup() {
  const center = map?.getCenter?.();
  const snapshot = center ? {
    camera: { latitude: center.lat(), longitude: center.lng(), zoom: map.getZoom() || 13 },
    selectedIdeaId: route.name === 'SubmissionDetail' && /^\d+$/.test(String(route.params.id)) ? String(route.params.id) : null,
  } : null;
  try {
    if (snapshot) localStorage.setItem('presentation-browse-snapshot-v1', JSON.stringify(snapshot));
    else localStorage.removeItem('presentation-browse-snapshot-v1');
  } catch { /* This public camera/selection snapshot is optional. */ }
  router.push('/tv');
}
const readOnlyAddress = computed(() => isDetail.value || (isSubmit.value && draft.value.step > 1));
const addressBarMode = computed(() => readOnlyAddress.value ? 'viewing' : searchEditing.value ? 'searching' : 'browsing');
const addressBarResults = computed(() => mapSearchResults.value.map(item => ({ id: item.id, label: item.displayName, subtitle: '' })));
function setMapSearchQuery(value) {
  mapSearchQuery.value = value;
  onMapSearchInput();
}
function onAddressBarModeChange(mode) { searchEditing.value = mode === 'searching'; }
function selectAddressBarResult(result) {
  const item = mapSearchResults.value.find(candidate => candidate.id === result.id);
  if (item) {
    searchEditing.value = false;
    selectMapSearchResult(item);
  }
}
const trayOpen = computed(() => isList.value || route.name === 'MyActions' || route.name === 'Bookmarks' || route.name === 'SubmissionDetail' || readOnlyAddress.value);
const wideScreen = window.matchMedia('(min-width: 1024px)');
const isWideScreen = ref(wideScreen.matches);
const updateWideScreen = event => { isWideScreen.value = event.matches; };
wideScreen.addEventListener('change', updateWideScreen);
const desktopSideTray = computed(() => isWideScreen.value && (isList.value || route.name === 'Bookmarks'));
const blocksMap = computed(() => trayOpen.value && !desktopSideTray.value);
const isSubmitting = inject('isSubmitting', ref(false));
let browseOrigin = null;
let pendingLocation = null;
let skipRestore = false;
let originFocus = null;
let originFocusSelector = null;
let browseSearch = '';
// Persist only plain view data in each history entry. Nested return contexts
// preserve Details -> Bookmarks -> Details without inheriting stale origins.
let viewState = window.history.state?.ideaView || {};
let viewPosition = window.history.state?.position;
let incomingView = null;
let isHistoryNavigation = false;
let markerEntry = false;
let restoringView = false;
let viewReady = false;
let viewSaveTimer;
const viewEntries = new Map([[viewPosition, viewState]]);
function currentTray() {
  if (route.name === 'Browse' && !isList.value) return null;
  const selectors = { Browse: '.idea-list-tray[aria-label="Browse ideas"]', Bookmarks: '.idea-list-tray[aria-label="Saved ideas"]',
    MyActions: '.map-tray[aria-label="My actions"]', SubmissionDetail: '.submission-detail-tray' };
  return document.querySelector(selectors[route.name] || '.map-tray:not(.map-tray-leave-active)');
}
function persistViewState() {
  clearTimeout(viewSaveTimer);
  if (window.history.state?.position === viewPosition) window.history.replaceState({ ...window.history.state, ideaView: viewState }, '');
}
function getViewState() { return viewState; }
function captureView() {
  const content = currentTray()?.querySelector('.map-tray-content');
  const focused = document.activeElement;
  const row = focused?.closest('[data-suggestion-id], .idea-row')?.querySelector?.('[data-suggestion-id]') || focused?.closest('[data-suggestion-id]');
  const firstVisible = content && [...content.querySelectorAll('[data-suggestion-id]')].find(el => el.getBoundingClientRect().bottom > content.getBoundingClientRect().top);
  return { ...viewState, url: route.fullPath, position: viewPosition,
    scroll: content?.scrollTop || 0, anchor: firstVisible?.dataset.suggestionId,
    anchorOffset: firstVisible && content ? firstVisible.getBoundingClientRect().top - content.getBoundingClientRect().top : 0,
    focusId: row?.dataset.suggestionId || null,
    focusHref: focused?.closest('a[href]')?.getAttribute('href') || null,
    focusLabel: focused?.closest('[role="menu"]') ? 'Menu' : focused?.getAttribute('aria-label') || null,
    sort: activeSort.value, location: userLocation.value ? { ...userLocation.value } : null,
    search: mapSearchQuery.value, viewport: snapshot() };
}
function saveViewState(immediate = false) {
  if (restoringView || window.history.state?.position !== viewPosition) return;
  viewState = captureView();
  viewEntries.set(viewPosition, viewState);
  clearTimeout(viewSaveTimer);
  // Keep scroll events cheap and avoid excessive History API writes on mobile.
  if (immediate === true) persistViewState();
  else viewSaveTimer = setTimeout(persistViewState, 500);
}
async function restoreView(detailReturnViewport, preserveCamera = false) {
  restoringView = true;
  const state = viewState;
  if (state.location) userLocation.value = state.location;
  if (state.sort) activeSort.value = state.sort === 2 && userLocation.value ? 2 : 1;
  if (state.search != null && !isDetail.value && !isSubmit.value) mapSearchQuery.value = state.search;
  await nextTick();
  if (state !== viewState) { restoringView = false; return; }
  const viewport = state.viewport || detailReturnViewport;
  if (!preserveCamera && viewport && !isDetail.value && !isSubmit.value) restoreSnapshot(viewport, !!detailReturnViewport);
  const content = currentTray()?.querySelector('.map-tray-content');
  if (content && state.scroll != null) {
    content.scrollTop = state.scroll;
    const anchor = state.anchor && content.querySelector('[data-suggestion-id="' + CSS.escape(state.anchor) + '"]');
    if (anchor) content.scrollTop += anchor.getBoundingClientRect().top - content.getBoundingClientRect().top - (state.anchorOffset || 0);
  }
  let target = state.focusId
    ? content?.querySelector('[data-suggestion-id="' + CSS.escape(state.focusId) + '"]')
    : state.focusLabel ? document.querySelector('button[aria-label="' + CSS.escape(state.focusLabel) + '"]')
    : state.focusHref && content?.querySelector('a[href="' + CSS.escape(state.focusHref) + '"]');
  if (!target && state.focusId && content) {
    target = [...content.querySelectorAll('[data-suggestion-id]')].find(el => el.getBoundingClientRect().bottom > content.getBoundingClientRect().top)
      || content.querySelector('a') || currentTray()?.querySelector('.map-tray-close');
  }
  target?.focus({ preventScroll: true });
  restoringView = false;
  viewReady = true;
}
async function returnToOrigin() {
  const origin = viewState.returnTo;
  if (!origin) {
    if (route.name === 'MyActions') await router.push('/browse');
    else await closeToMap();
    return;
  }
  if (Number.isInteger(origin.position) && origin.position < viewPosition) {
    router.go(origin.position - viewPosition);
  } else {
    await router.push({ path: origin.url, state: { ideaView: origin } });
  }
}
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
function restoreSnapshot(view, animate = false) {
  if (!view) return;
  if (!map) { pendingLocation = { latitude: view.lat, longitude: view.lng, zoom: view.zoom, mapType: view.mapType }; return; }
  if (map.getZoom() !== view.zoom) map.setZoom(view.zoom);
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.panTo({ lat: view.lat, lng: view.lng });
  else map.setCenter({ lat: view.lat, lng: view.lng });
}
function focusLocation(location) {
  if (!location || location.latitude == null || location.longitude == null) return;
  pendingLocation = location;
  if (!map) return;
  const lat = Number(location.latitude), lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  map.setCenter({ lat, lng });
  map.setZoom(location.zoom ?? 16);
  pendingLocation = null;
}
function setDetailLocation(location, summary = '', suggestionId = null, creationDate = '') {
  detailLocation.value = location;
  detailSummary.value = summary;
  detailSuggestionId = suggestionId == null ? null : String(suggestionId);
  syncDetailSuggestionMarker(detailSuggestionId);
  detailCreationTime = new Date(creationDate).getTime();
  refreshDetailNavigation();
}
function rememberSuggestion(item) {
  if (item?.id) resolvedSuggestions.value = new Map(resolvedSuggestions.value).set(String(item.id), item);
}
function updateSuggestionMarker(item) {
  if (!item?.id) return;
  rememberSuggestion(item);
  const id = String(item.id);
  const marker = suggestionMarkersById.get(id);
  suggestions.value = suggestions.value.map(suggestion =>
    String(suggestion.id) === id ? { ...suggestion, ...item } : suggestion,
  );
  refreshDetailNavigation();
  if (!marker) return;
  const updated = suggestions.value.find(suggestion => String(suggestion.id) === id) || item;
  suggestionMarkerData.set(marker, updated);
  marker.setTitle(updated.content?.summary || updated.summary || 'Suggestion');
  marker.setIcon(suggestionMarkerIcon(updated, marker === detailPinnedMarker));
}
function setDetailMarkerTarget(suggestionId) { syncDetailSuggestionMarker(suggestionId); }
function setDetailLoading(loading) {
  const wasLoading = detailLoading.value;
  detailLoading.value = !!loading;
  map?.setOptions({ gestureHandling: detailLoading.value || blocksMap.value ? 'none' : 'greedy', keyboardShortcuts: !detailLoading.value && !blocksMap.value });
  if (wasLoading && !detailLoading.value && isDetail.value) {
    nextTick(() => requestAnimationFrame(() => {
      if (!detailLoading.value && isDetail.value) frameDetailLocation();
    }));
  }
}
function findSuggestionLocation(id) {
  const item = suggestions.value.find(suggestion => String(suggestion.id) === String(id));
  return item?.location || (item?.latitude != null && item?.longitude != null ? { latitude: item.latitude, longitude: item.longitude } : null);
}
function ensureDetailTargetOverlay() {
  if (detailTargetOverlay || !map || !googleMaps) return;
  detailTargetOverlay = new googleMaps.OverlayView();
  detailTargetOverlay.onAdd = () => {};
  detailTargetOverlay.onRemove = () => {};
  detailTargetOverlay.draw = () => {
    const location = detailLocation.value;
    if (!isDetail.value || !location) return;
    const point = detailTargetOverlay.getProjection()?.fromLatLngToContainerPixel(new googleMaps.LatLng(Number(location.latitude), Number(location.longitude)));
    if (point) {
      detailTargetPosition.value = { left: `${point.x}px`, top: `${point.y}px` };
      scheduleDetailTextFit();
    }
  };
  detailTargetOverlay.setMap(map);
}
function transitionToDetailLocation(location, finalTrayTop, trayAnimation) {
  if (!isDetail.value || !map || !googleMaps || location?.latitude == null || location?.longitude == null) return Promise.resolve();
  const lat = Number(location.latitude), lng = Number(location.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve();
  const tray = document.querySelector('.submission-detail-tray');
  const search = document.querySelector('.address-bar');
  const bounds = browseMapContainerEl.value?.getBoundingClientRect();
  let target = { lat, lng };
  const projection = map.getProjection?.();
  if (projection && tray && search && bounds) {
    // Navigation can resize the tray while panning; aim at its settled layout.
    const targetY = detailMarkerTargetY(search.getBoundingClientRect().bottom, finalTrayTop ?? tray.getBoundingClientRect().top);
    const offset = bounds.top + bounds.height / 2 - targetY;
    const point = projection.fromLatLngToPoint(new googleMaps.LatLng(lat, lng));
    const center = projection.fromPointToLatLng(new googleMaps.Point(point.x, point.y + offset / 2 ** (map.getZoom() || 1)));
    target = { lat: center.lat(), lng: center.lng() };
  }
  ensureDetailTargetOverlay();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    map.setCenter(target);
    detailTargetOverlay?.draw();
    return Promise.resolve();
  }
  if (cancelDetailMotion) cancelDetailMotion();
  const center = map.getCenter();
  if (!center) { map.setCenter(target); return Promise.resolve(); }
  const from = { lat: center.lat(), lng: center.lng() };
  let deltaLng = target.lng - from.lng;
  if (deltaLng > 180) deltaLng -= 360;
  if (deltaLng < -180) deltaLng += 360;
  if (Math.abs(target.lat - from.lat) < 1e-7 && Math.abs(deltaLng) < 1e-7) {
    map.setCenter(target);
    detailTargetOverlay?.draw();
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const started = performance.now();
    let finished = false;
    const stop = () => {
      if (finished) return;
      finished = true;
      if (detailMotionFrame) cancelAnimationFrame(detailMotionFrame);
      detailMotionFrame = 0;
      cancelDetailMotion = null;
      resolve();
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      if (detailMotionFrame) cancelAnimationFrame(detailMotionFrame);
      detailMotionFrame = 0;
      cancelDetailMotion = null;
      map.setCenter(target);
      detailTargetOverlay?.draw();
      resolve();
    };
    cancelDetailMotion = stop;
    const animate = now => {
      if (trayAnimation?.playState === 'idle') { stop(); return; }
      const progress = Math.min(1, (now - started) / detailMotionDuration);
      // Use the tray's actual eased timeline, not a second approximation or
      // clock, so both movements reach their endpoints in the same frame.
      const eased = trayAnimation
        ? (trayAnimation.playState === 'finished' ? 1 : trayAnimation.effect.getComputedTiming().progress ?? 0)
        : (progress < .5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2);
      map.setCenter({ lat: from.lat + (target.lat - from.lat) * eased, lng: from.lng + deltaLng * eased });
      if (eased >= 1) finish();
      else detailMotionFrame = requestAnimationFrame(animate);
    };
    detailMotionFrame = requestAnimationFrame(animate);
  });
}
function cancelDetailTransition() { cancelDetailMotion?.(); }
function refreshDetailNavigation() {
  const order = viewState?.order;
  if (isDetail.value && order?.length) {
    const index = order.indexOf(String(route.params.id));
    detailNavigation.value = { olderId: index > 0 ? order[index - 1] : null, newerId: index >= 0 ? order[index + 1] || null : null };
    return;
  }
  if (!isDetail.value || !detailSuggestionId || !Number.isFinite(detailCreationTime)) {
    detailNavigation.value = { olderId: null, newerId: null };
    return;
  }
  const compare = (a, b) => a.created - b.created || a.id.localeCompare(b.id);
  const available = suggestions.value.flatMap((item) => {
    const created = new Date(item.creationDate || 0).getTime();
    if (!Number.isFinite(created)) return [];
    return [{ id: String(item.id), created }];
  }).sort(compare);
  const current = { id: detailSuggestionId, created: detailCreationTime };
  const older = available.filter(item => item.id !== current.id && compare(item, current) < 0).at(-1);
  const newer = available.find(item => item.id !== current.id && compare(item, current) > 0);
  detailNavigation.value = {
    olderId: older?.id || null,
    newerId: newer?.id || null,
  };
}
function navigateDetail(direction) {
  if (detailLoading.value) return;
  const id = direction === 'older' ? detailNavigation.value.olderId : detailNavigation.value.newerId;
  if (id) router.push(`/suggestion/${encodeURIComponent(id)}`);
}
function frameDetailLocation(immediate = false) {
  if (detailClosing || !isDetail.value || !map || !googleMaps || !detailLocation.value) return;
  const { latitude, longitude } = detailLocation.value;
  if (latitude == null || longitude == null) return;
  const position = { lat: Number(latitude), lng: Number(longitude) };
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
  const tray = document.querySelector('.submission-detail-tray');
  const search = document.querySelector('.address-bar');
  const bounds = browseMapContainerEl.value?.getBoundingClientRect();
  if (!tray || !search || !bounds) return;
  if (tray.classList.contains('is-reading') || tray.classList.contains('is-dragging')) return;
  const targetY = detailMarkerTargetY(search.getBoundingClientRect().bottom, tray.getBoundingClientRect().top);
  const offset = bounds.top + bounds.height / 2 - targetY;
  const projection = map.getProjection?.();
  if (projection) {
    const point = projection.fromLatLngToPoint(new googleMaps.LatLng(position.lat, position.lng));
    const center = projection.fromPointToLatLng(new googleMaps.Point(point.x, point.y + offset / 2 ** map.getZoom()));
    const current = map.getCenter();
    if (current) {
      const currentPoint = projection.fromLatLngToPoint(current);
      const targetPoint = projection.fromLatLngToPoint(center);
      const scale = 2 ** map.getZoom();
      // Loading completion and ResizeObserver can request the same framing.
      // Avoid starting a second camera motion for subpixel rounding differences.
      if (Math.hypot(currentPoint.x - targetPoint.x, currentPoint.y - targetPoint.y) * scale < .5) return;
    }
    if (immediate === true || window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setCenter(center);
    else map.panTo(center);
  } else { map.setCenter(position); map.panBy?.(0, offset); }
  ensureDetailTargetOverlay();
  detailTargetOverlay.draw();
}
function frameSubmissionLocation() {
    if (!map || !googleMaps || !isSubmit.value || ![3, 4].includes(draft.value.step)) return;
    const location = draft.value.location;
    if (location?.latitude == null || location?.longitude == null) return;
    const position = { lat: Number(location.latitude), lng: Number(location.longitude) };
    if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;
    const title = draft.value.step === 3 ? 'Describe your idea' : 'Review submission';
    const tray = document.querySelector(`.submission-content-tray[aria-label="${title}"]`);
    const search = document.querySelector('.address-bar');
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
function openSuggestion(item) { markerEntry = true; router.push('/suggestion/' + encodeURIComponent(item.id)); }
async function closeToMap() {
  await router.push({ path: '/', query: { view: 'map' } });
  restoreFocus();
}
async function closeTray() {
  if (isSubmitting.value) return;
  if (['MyActions', 'Bookmarks', 'SubmissionDetail'].includes(route.name)) {
    if (route.name === 'SubmissionDetail') detailClosing = true;
    await returnToOrigin();
    return;
  }
  if (isSubmit.value) submission.value?.saveDraft?.();
  const focusLabel = isList.value ? 'List' : isSubmit.value ? 'New' : null;
  await closeToMap();
  if (focusLabel) nextTick(() => document.querySelector(focusLabel === 'New' ? '.new-idea-fab' : '.map-list-fab')?.focus({ preventScroll: true }));
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
  savedDraft.location = { latitude: viewport.lat, longitude: viewport.lng, zoom: viewport.zoom, address: '', description: '' };
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
let detailReturnViewport = null;
let detailExitAnimations = [];
const removeNavigationGuard = router.beforeEach(async (to, from) => {
  detailExitAnimations.forEach(animation => animation.cancel());
  detailExitAnimations = [];
  cancelClusterZoom();
  isHistoryNavigation = window.history.state?.position !== viewPosition;
  const outgoing = captureView();
  viewEntries.set(viewPosition, outgoing);
  clearTimeout(viewSaveTimer);
  saveViewState(true);
  detailReturnViewport = null;
  if (from.name === 'SubmissionDetail' && to.name !== 'SubmissionDetail') {
    detailClosing = true;
    cancelDetailTransition();
    detailReturnViewport = !skipRestore ? viewState.returnTo?.viewport : null;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Keep the detail layout and camera intact until its visual exit ends.
      const elements = document.querySelectorAll('.submission-detail-tray, .detail-map-target, .workspace-backdrop-detail');
      const animations = [...elements].map(element => element.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 240, easing: 'ease-out', fill: 'forwards' },
      ));
      detailExitAnimations = animations;
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
      // Route unmount removes these elements; retain the final opacity until then.
    }
  }
  const fromBrowse = from.name === 'Browse';
  incomingView = {};
  if (to.name === 'SubmissionDetail') {
    if (from.name === 'SubmissionDetail') incomingView = { returnTo: viewState.returnTo, order: viewState.order };
    else {
      incomingView = { returnTo: outgoing };
      if (!markerEntry && fromBrowse && isList.value) incomingView.order = sortedListSuggestions.value.map(item => String(item.id));
      if (!markerEntry && from.name === 'Bookmarks') incomingView.order = bookmarkedSuggestions.value.map(item => String(item.id));
    }
  } else if (['Bookmarks', 'MyActions'].includes(to.name)) {
    incomingView = { returnTo: outgoing };
  }
  markerEntry = false;
  if (fromBrowse && (to.name === 'SubmissionDetail' || to.name === 'Submit')) {
    browseOrigin = { url: from.fullPath, viewport: snapshot() };
    rememberFocus();
    browseSearch = mapSearchQuery.value;
    if (to.name === 'Submit') resetSubmissionToBrowseCenter(browseOrigin.viewport);
  }
  if (to.name === 'Browse' && (from.name === 'SubmissionDetail' || from.name === 'Submit')) {
    pendingLocation = null;
    skipRestore = false;
    mapSearchQuery.value = browseSearch;
  }
});
const removeAfterNavigation = router.afterEach((to, from, failure) => {
  detailClosing = false;
  const exitAnimations = detailExitAnimations;
  detailExitAnimations = [];
  if (failure) { exitAnimations.forEach(animation => animation.cancel()); return; }
  nextTick(() => {
    for (const animation of exitAnimations) {
      const element = animation.effect?.target;
      // A list/submit destination can reuse the backdrop instead of unmounting it.
      if (element?.isConnected && !element.classList.contains('workspace-backdrop-leave-active')) {
        animation.cancel();
        if (element.classList.contains('workspace-backdrop')) element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      }
    }
  });
  viewPosition = window.history.state?.position;
  viewState = (isHistoryNavigation && viewEntries.get(viewPosition)) || window.history.state?.ideaView || incomingView || {};
  const preserveCamera = from.name === 'SubmissionDetail' && to.name === 'Browse'
    && !(to.query.view === 'list' || (!to.query.view && savedTab === 'list'));
  if (preserveCamera) {
    // Returning to the bare map adopts the detail camera as the browse view,
    // including when history contains an older viewport for this entry.
    viewState = { ...viewState, viewport: snapshot() };
    if (viewState.viewport) setStoredMapView(viewState.viewport);
  }
  isHistoryNavigation = false;
  viewEntries.set(viewPosition, viewState);
  window.history.replaceState({ ...window.history.state, ideaView: viewState }, '');
  incomingView = null;
  refreshDetailNavigation();
  restoreView(detailReturnViewport, preserveCamera);
  detailReturnViewport = null;
});
function handleEscape(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  if (detailLoading.value) { event.preventDefault(); return; }
  if (isPopupOpen.value) { closeInfoWindow(); removeStoredActiveInfoWindowSuggestionId(); event.preventDefault(); return; }
  const openMenu = document.querySelector('.address-bar__menu[aria-expanded="true"]');
  if (openMenu) { openMenu.click(); event.preventDefault(); return; }
  if (isSubmit.value && submission.value?.dismissNested?.()) { event.preventDefault(); return; }
  if (workspace.dismissDetail?.()) { event.preventDefault(); return; }
  if (trayOpen.value) { event.preventDefault(); closeTray(); }
}
window.addEventListener('keydown', handleEscape);
window.addEventListener('pagehide', persistViewState);
const workspace = {
  eraseDetailText, fitDetailText, setDetailReadingProgress, setDetailLocation, setDetailMarkerTarget, setDetailLoading, transitionToDetailLocation, cancelDetailTransition, findSuggestionLocation, updateSuggestionMarker, detailLoading, detailNavigation, navigateDetail,
  pinContinueReady,
  suggestions, sortedListSuggestions, bookmarkedSuggestions, activeSort, setSortMode, requestGps, isLocating, refreshData,
  isLoading, listError, locationError, saveViewState, getViewState, rememberSuggestion,
  formatBrowseAddress, formatCreationDate, getPrimaryPhoto, failedPhotoIds, onPhotoError,
  isList, trayOpen, closeTray, closeToMap, openSuggestion, focusLocation, revealLocation,
  registerSubmission: value => { submission.value = value; }, pinContinueTop,
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
watch([blocksMap, isMapReady], ([open]) => {
  map?.setOptions({ gestureHandling: open ? 'none' : 'greedy', keyboardShortcuts: !open });
  if (open) { closeInfoWindow(); markerSpiderfier?.collapse(); }
}, { immediate: true });
watch([isSubmit, isDetail, isMapReady], () => {
  if (!isDetail.value) syncDetailSuggestionMarker(null);
  setSuggestionMarkersVisible(!isSubmit.value);
  if (isDetail.value) syncDetailSuggestionMarker(route.params.id);
}, { immediate: true });
watch([isDensityMode, isMapReady], syncSuggestionDisplay, { immediate: true });
watch([isSubmit, isDetail, isMapReady, hasDraftPin, isPopupOpen], () => {
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
watch([isDetail, detailLoading, detailSummary, detailTextElement, detailTargetPosition], (_, __, onCleanup) => {
  const observer = new ResizeObserver(scheduleDetailTextFit);
  if (detailTextElement.value) {
    for (const element of [document.querySelector('.submission-detail-tray'), browseMapContainerEl.value]) {
      if (element) observer.observe(element);
    }
    scheduleDetailTextFit();
  }
  onCleanup(() => {
    observer.disconnect();
    if (detailTextFrame) cancelAnimationFrame(detailTextFrame);
    detailTextFrame = 0;
  });
}, { flush: 'post' });
watch([isDetail, isMapReady, detailLocation], async (_, __, onCleanup) => {
  let cancelled = false;
  let observer;
  let zoomListener;
  let frameRequest = 0;
  let settleTimer = 0;
  const recenterAfterResize = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(recenter, 120);
  };
  const recenter = () => {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      frameRequest = 0;
      if (cancelled || !isDetail.value || !map || !googleMaps) return;
      googleMaps.event?.trigger?.(map, 'resize');
      if (detailLoading.value) { detailTargetOverlay?.draw(); refreshDetailNavigation(); return; }
      // Description reveals and accordion changes alter the visible map area.
      // Ease into its new center instead of snapping after the resize settles.
      frameDetailLocation();
      refreshDetailNavigation();
    });
  };
  onCleanup(() => {
    cancelled = true;
    clearTimeout(settleTimer);
    observer?.disconnect();
    zoomListener?.remove();
    window.removeEventListener('resize', recenter);
    window.visualViewport?.removeEventListener('resize', recenter);
    if (frameRequest) cancelAnimationFrame(frameRequest);
    detailTargetOverlay?.setMap(null);
    detailTargetOverlay = null;
  });
  if (!isDetail.value || !isMapReady.value || !detailLocation.value) return;
  await nextTick();
  if (cancelled) return;
  observer = new ResizeObserver(recenterAfterResize);
  zoomListener = map.addListener('zoom_changed', () => frameDetailLocation(true));
  for (const element of [document.querySelector('.submission-detail-tray'), browseMapContainerEl.value]) {
    if (element) observer.observe(element);
  }
  window.addEventListener('resize', recenter);
  window.visualViewport?.addEventListener('resize', recenter);
  recenter();
}, { immediate: true });
watch([isDetail, detailLocation], () => {
  if (!isDetail.value) return;
  const location = detailLocation.value;
  mapSearchQuery.value = location?.address || 'Idea address unavailable';
}, { immediate: true });
watch(() => [isSubmitLocate.value, draft.value.location?.latitude, draft.value.location?.longitude], updateSubmissionCrosshair);
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
  const search = document.querySelector('.address-bar');
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
watch(isBrowse, value => { if (value && !viewState.focusId) restoreFocus(); });
watch(detailLoading, loading => {
  if (!loading && viewState.url === route.fullPath) restoreView();
});

onMounted(async () => {
  window.addEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.addEventListener('resize', positionCoordinateLabel);
  window.visualViewport?.addEventListener('scroll', positionCoordinateLabel);
  browseMapInitialization.value = 'loading';
  if (hasGoogleMapsKey) initGoogleMap();
  else browseMapInitialization.value = 'failed';
  requestGps();
  await refreshData(false);
  await restoreView();
});

onBeforeUnmount(() => {
  cancelClusterZoom();
  popupShadeOverlay?.setMap(null);
  densityOverlay?.setMap(null);
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
  removeAfterNavigation();
  clearTimeout(viewSaveTimer);
  window.removeEventListener('pagehide', persistViewState);
  wideScreen.removeEventListener('change', updateWideScreen);
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
