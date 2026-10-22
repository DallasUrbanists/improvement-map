<template>
  <section class="remote-controller-page" aria-label="Presentation controller">
    <div class="remote-controller-wrap" :inert="isMapIdeaTransitioning" :aria-busy="isMapIdeaTransitioning">
      <div class="remote-mode-row" role="group" aria-label="Presentation mode">
        <button v-for="mode in modes" :key="mode.value" type="button" class="presentation-button" :class="{ 'is-active': state.mode === mode.value }" :aria-pressed="state.mode === mode.value" :disabled="isMapIdeaTransitioning || (mode.value === 'photo' ? !activeItem : mode.value === 'description' && !session.content)" @click="setMode(mode.value)">{{ mode.label }}</button>
      </div>

      <div v-if="session.content" class="remote-preview-card">
        <div class="remote-preview-aspect" :style="previewAspectStyle">
          <PresentationMap ref="presentationMap" :class="{ 'is-mode-hidden': state.mode !== 'map' && !(state.mode === 'description' && !descriptionBackgroundPhoto) }" :camera="state.camera" :style="state.mapStyle" :theme="state.theme" :rails="state.railVisible" :icon-style="state.iconStyle" :idea="session.content" :interactive="state.mode === 'map'" :animate-camera="isMapIdeaTransitioning" :idea-transitioning="isMapIdeaTransitioning" role="controller" label="Controller map preview" @camera="cameraChanged" />
          <div v-show="state.mode === 'map'" class="remote-map-layers">
            <button type="button" class="map-ui remote-map-layers-trigger" :style="{ backgroundImage: `url(${mapStylePreview(state.mapStyle === 'streets' ? 'satellite' : 'streets')})` }" aria-label="Choose map layers" aria-controls="remote-map-layers-menu" :aria-expanded="mapStylePickerOpen" @click="mapStylePickerOpen = !mapStylePickerOpen"><span>Layers</span></button>
            <div v-if="mapStylePickerOpen" id="remote-map-layers-menu" class="map-ui remote-map-layers-menu" role="group" aria-label="Map layers">
              <button v-for="option in mapStyleOptions" :key="option.value" type="button" class="remote-map-layer-option" :class="{ 'is-selected': state.mapStyle === option.value }" :style="{ backgroundImage: `url(${mapStylePreview(option.value)})` }" :aria-pressed="state.mapStyle === option.value" @click="selectMapStyle(option.value)"><span class="remote-map-layer-radio" aria-hidden="true"><i v-if="state.mapStyle === option.value" class="fa-solid fa-check"></i></span><span class="remote-map-layer-label">{{ option.label }}</span></button>
            </div>
          </div>
          <button v-show="state.mode === 'map'" type="button" class="map-ui presentation-button remote-map-recenter" :disabled="isMapIdeaTransitioning" @click="centerMap">Recenter on {{ submissionEmoji(session.content.emoji) }}</button>
          <button v-show="state.mode === 'map'" type="button" class="map-ui presentation-button remote-map-description-toggle" :disabled="isMapIdeaTransitioning" :aria-pressed="state.captionVisible" @click="toggleMapDescription">{{ state.captionVisible ? 'Hide description' : 'Show description' }}</button>
          <button v-if="activeItem && activeItem.kind !== 'streetmix'" v-show="state.mode === 'photo'" type="button" class="map-ui presentation-button remote-map-recenter remote-photo-reframe" @click="reframePhoto">Reframe</button>
          <button v-if="activeItem?.caption && activeItem.kind !== 'streetmix'" v-show="state.mode === 'photo'" type="button" class="map-ui presentation-button remote-map-description-toggle remote-photo-caption-toggle" :aria-pressed="state.captionVisible" @click="toggleCaption">{{ state.captionVisible ? 'Hide caption' : 'Show caption' }}</button>
          <PresentationPhoto v-if="descriptionBackgroundPhoto" class="remote-description-background" :class="{ 'is-mode-hidden': state.mode !== 'description' }" :src="descriptionBackgroundPhoto.url" :alt="descriptionBackgroundPhoto.caption || ''" :frame="{ scale: 1, centerX: 0.5, centerY: 0.5 }" :item="descriptionBackgroundPhoto" :aspect-ratio="receiverAspect" :interactive="false" />
          <PresentationDescription :class="{ 'is-mode-hidden': state.mode !== 'description' }" :title="state.descriptionPage === 0 ? session.content.summary : ''" :text="descriptionText" @pointerdown="onDescriptionPointerDown" @pointerup="onDescriptionPointerUp" @pointercancel="onDescriptionPointerCancel" />
          <template v-if="activeItem?.kind === 'streetmix'">
            <PresentationStreetmix :class="{ 'is-mode-hidden': state.mode !== 'photo' }" :item="activeItem" :idea-id="session.content.id" :idea-title="session.content.summary" />
          </template>
          <template v-else-if="activeItem">
            <PresentationPhoto :class="{ 'is-mode-hidden': state.mode !== 'photo' }" :src="activeItem.url" :alt="activeItem.caption || session.content.summary" :frame="state.photoFrame" :item="activeItem" :aspect-ratio="receiverAspect" :interactive="true" @frame="photoFrameChanged" @swipe="direction => moveAlbum(direction === 'left' ? 1 : -1)" />
            <div v-show="state.mode === 'photo' && state.captionVisible && activeItem.caption" class="map-ui remote-preview-caption">{{ activeItem.caption }}</div>
          </template>
          <div v-if="activeItem && activeItem.kind !== 'streetmix'" v-show="state.mode === 'photo'" class="map-ui remote-photo-zoom remote-photo-zoom-overlay" role="group" aria-label="Photo zoom controls">
            <button type="button" class="map-ui-button" :disabled="state.photoFrame.scale <= 1" aria-label="Zoom photo out" @click="zoomPhoto(-0.25)"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <button type="button" class="map-ui-button" :disabled="state.photoFrame.scale >= 4" aria-label="Zoom photo in" @click="zoomPhoto(0.25)"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </div>
          <div v-if="activeItem && activeItem.kind !== 'streetmix'" v-show="state.mode === 'photo'" class="map-ui remote-photo-camera-control" role="group" aria-label="Pan zoomed photo">
            <button type="button" aria-label="Pan photo up" @click="panPhoto('up')"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan photo left" @click="panPhoto('left')"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span aria-hidden="true"></span>
            <button type="button" aria-label="Pan photo right" @click="panPhoto('right')"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan photo down" @click="panPhoto('down')"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
          </div>
        </div>

        <div v-if="state.mode === 'photo' && activeItem && album.length > 1" class="remote-preview-paginator remote-photo-paginator">
          <AlbumPaginator :index="albumIndex" :total="album.length" label="Presentation album" item-label="album item" button-class="presentation-button" @previous="moveAlbum(-1)" @next="moveAlbum(1)" />
        </div>
        <div v-if="state.mode === 'description' && session.content && pages.length > 1" class="remote-preview-paginator remote-description-paginator">
          <AlbumPaginator :index="state.descriptionPage" :total="pages.length" label="Idea description pages" item-label="description page" button-class="presentation-button" @previous="moveDescription(-1)" @next="moveDescription(1)" />
        </div>
      </div>
      <div class="remote-idea-panel" aria-label="Current idea and queue">
        <div class="remote-idea-heading" :class="{ 'is-empty': !session.content }">
          <div><h1>{{ session.content?.summary || 'No idea selected' }}</h1><p v-if="session.content" class="remote-idea-heading-meta">{{ session.content.authorName || 'Anonymous Contributor' }} · {{ formatIdeaCreationDate(session.content.creationDate) }}</p><p>{{ session.content?.location?.address || session.content?.location?.description || 'Select an idea from Find ideas.' }}</p></div>
        </div>
        <div v-if="session.content" class="remote-idea-nav" role="group" aria-label="Change presented idea">
          <button type="button" class="presentation-button" :disabled="isMapIdeaTransitioning || queuePosition <= 1" @click="moveIdea(-1)"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span class="remote-idea-nav-label">Previous idea</span><span class="remote-idea-nav-compact-label">Previous</span></button>
          <span v-if="session.content" class="remote-idea-position" aria-label="Position in current idea results">{{ queuePosition }} / {{ queue.length }}</span>
          <button type="button" class="presentation-button is-primary" :disabled="isMapIdeaTransitioning || queuePosition === 0 || queuePosition >= queue.length" @click="moveIdea(1)"><span class="remote-idea-nav-label">Next idea</span><span class="remote-idea-nav-compact-label">Next</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
        <div v-if="queue.length" class="remote-quick-list" role="group" aria-label="All ideas in the current result order">
          <button v-for="idea in queue" :key="idea.id" type="button" class="presentation-button" :class="{ 'is-selected': !isMapIdeaTransitioning && String(idea.id) === String(state.selectedIdeaId), 'is-loading': String(idea.id) === String(mapTransitionTargetId) }" :aria-pressed="!isMapIdeaTransitioning && String(idea.id) === String(state.selectedIdeaId)" :disabled="isMapIdeaTransitioning" @click="present(idea.id)"><span class="remote-quick-list-emoji" aria-hidden="true">{{ submissionEmoji(idea.emoji) }}</span><span class="remote-quick-list-copy"><span class="remote-quick-list-summary">{{ idea.summary }}</span><span class="remote-quick-list-meta">{{ idea.authorName || 'Anonymous Contributor' }} · {{ formatIdeaCreationDate(idea.creationDate) }}</span></span><span v-if="String(idea.id) === String(mapTransitionTargetId)" class="remote-quick-list-loader" aria-hidden="true"></span></button>
        </div>
        <p v-if="catalogError" class="presentation-error" role="status">{{ catalogError }}</p>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="isMapIdeaTransitioning" class="remote-map-transition-lock" role="status" aria-live="polite" aria-label="Loading selected idea and moving the map"></div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AlbumPaginator from '../components/AlbumPaginator.vue';
import PresentationMap from '../components/PresentationMap.vue';
import PresentationDescription from '../components/PresentationDescription.vue';
import PresentationPhoto from '../components/PresentationPhoto.vue';
import PresentationStreetmix from '../components/PresentationStreetmix.vue';
import { bookmarks } from '../services/bookmarks.js';
import { submissionEmoji } from '../services/emojiMapMarker.js';
import { enqueuePresentationChanges, ensurePresentationCatalog, presentationSession as session, selectPresentationIdea, writableViewState } from '../services/presentationSession.js';
import { getPresentationAlbum, isStreetmixItem } from '../services/presentationState.js';
import { formatIdeaCreationDate } from '../services/ideaDateFormat.js';

const router = useRouter();
const state = writableViewState;
const catalogError = ref('');
const mapStylePickerOpen = ref(false);
const isMapIdeaTransitioning = ref(false);
const mapTransitionTargetId = ref(null);
const presentationMap = ref(null);
const modes = [{ value: 'map', label: 'Map' }, { value: 'photo', label: 'Photos' }, { value: 'description', label: 'Description' }];
const mapStyleOptions = [{ value: 'streets', label: 'Streets' }, { value: 'satellite', label: 'Satellite' }];
const album = computed(() => getPresentationAlbum(session.content));
const activeItem = computed(() => album.value.find(item => item.id === state.value.albumItemId) || null);
const descriptionBackgroundPhoto = computed(() => album.value.find(item => item.kind === 'photo') || null);
const albumIndex = computed(() => Math.max(0, album.value.findIndex(item => item.id === state.value.albumItemId)));
const descriptionPages = computed(() => session.content?.descriptionPages || []);
const pages = computed(() => [session.content?.summary || '', ...descriptionPages.value]);
const descriptionText = computed(() => state.value.descriptionPage > 0 ? descriptionPages.value[state.value.descriptionPage - 1] || '' : '');
const receiverAspect = computed(() => {
  const viewport = session.receiver?.viewport;
  return viewport?.width > 0 && viewport?.height > 0 ? viewport.width / viewport.height : 16 / 9;
});
const previewAspectStyle = computed(() => ({ aspectRatio: String(receiverAspect.value) }));
const descriptionPointers = new Map();
let descriptionSwipeHandled = false;

function distanceFromCamera(idea) {
  const lat = idea.location?.latitude;
  const lng = idea.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat - state.value.camera.latitude);
  const dLng = radians(lng - state.value.camera.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(state.value.camera.latitude)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const queue = computed(() => {
  let values = [...session.catalog];
  const finder = session.finder;
  const query = finder.query.trim().toLowerCase();
  if (query) values = values.filter(idea => `${idea.summary} ${idea.details} ${idea.location?.address || ''} ${idea.location?.description || ''}`.toLowerCase().includes(query));
  if (finder.filter === 'saved') {
    const saved = new Set(bookmarks.value.map(entry => String(entry.suggestion.id)));
    values = values.filter(idea => saved.has(String(idea.id)));
  } else if (finder.filter === 'streetmix') values = values.filter(idea => idea.album.some(item => item.kind === 'streetmix'));
  if (finder.sort === 'nearest') values.sort((a, b) => distanceFromCamera(a) - distanceFromCamera(b) || a.summary.localeCompare(b.summary));
  else values.sort((a, b) => Date.parse(b.creationDate || '') - Date.parse(a.creationDate || '') || String(a.id).localeCompare(String(b.id)));
  return values;
});
const queueIndex = computed(() => queue.value.findIndex(idea => String(idea.id) === String(state.value.selectedIdeaId)));
const queuePosition = computed(() => queueIndex.value >= 0 ? queueIndex.value + 1 : 0);
function setMode(mode) {
  if (!['map', 'photo', 'description'].includes(mode) || (mode === 'photo' && !activeItem.value) || (mode === 'description' && !session.content)) return;
  enqueuePresentationChanges({ mode }, { immediate: true });
}
function cameraChanged(camera) { enqueuePresentationChanges({ camera }); }
function centerMap() {
  const location = session.content?.location;
  const zoom = state.value.camera.zoom;
  enqueuePresentationChanges({ camera: Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)
    ? { latitude: location.latitude, longitude: location.longitude, zoom }
    : { latitude: 32.7767, longitude: -96.797, zoom } }, { immediate: true });
}
function mapStylePreview(style) {
  if (style === 'satellite') return '/images/map-style-satellite.png';
  return state.value.theme === 'dark' ? '/images/map-style-streets-dark.png' : '/images/map-style-streets-light.png';
}
function selectMapStyle(style) {
  if (!['streets', 'satellite'].includes(style)) return;
  enqueuePresentationChanges({ mapStyle: style }, { immediate: true });
  mapStylePickerOpen.value = false;
}
function toggleMapDescription() { enqueuePresentationChanges({ captionVisible: !state.value.captionVisible }, { immediate: true }); }
function photoFrameChanged(frame) { enqueuePresentationChanges({ photoFrame: frame }); }
function zoomPhoto(amount) { photoFrameChanged({ ...state.value.photoFrame, scale: Math.max(1, Math.min(4, state.value.photoFrame.scale + amount)) }); }
function panPhoto(direction) {
  const frame = { ...state.value.photoFrame };
  // Create a little pan room on the first directional tap when the image is fit to frame.
  if (frame.scale <= 1) frame.scale = 1.25;
  if (direction === 'left') frame.centerX = Math.min(1, frame.centerX + .08);
  if (direction === 'right') frame.centerX = Math.max(0, frame.centerX - .08);
  if (direction === 'up') frame.centerY = Math.min(1, frame.centerY + .08);
  if (direction === 'down') frame.centerY = Math.max(0, frame.centerY - .08);
  photoFrameChanged(frame);
}
function reframePhoto() { enqueuePresentationChanges({ photoFrame: { scale: 1, centerX: .5, centerY: .5 } }, { immediate: true }); }
function toggleCaption() { if (!isStreetmixItem(activeItem.value)) enqueuePresentationChanges({ captionVisible: !state.value.captionVisible }, { immediate: true }); }
function moveAlbum(delta) {
  const index = albumIndex.value + delta;
  if (index < 0 || index >= album.value.length) return;
  enqueuePresentationChanges({ albumItemId: album.value[index].id, photoFrame: { scale: 1, centerX: .5, centerY: .5 } }, { immediate: true });
}
function moveDescription(delta) {
  const page = state.value.descriptionPage + delta;
  if (page < 0 || page >= pages.value.length) return;
  enqueuePresentationChanges({ descriptionPage: page }, { immediate: true });
}
function onDescriptionPointerDown(event) {
  if (state.value.mode !== 'description') return;
  if (descriptionPointers.size === 0) descriptionSwipeHandled = false;
  descriptionPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Ignore gestures cancelled by the browser. */ }
}
function onDescriptionPointerUp(event) {
  const start = descriptionPointers.get(event.pointerId);
  if (start && !descriptionSwipeHandled) {
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy)) {
      descriptionSwipeHandled = true;
      moveDescription(dx < 0 ? 1 : -1);
    }
  }
  descriptionPointers.delete(event.pointerId);
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Ignore a released pointer. */ }
  }
  if (descriptionPointers.size === 0) descriptionSwipeHandled = false;
}
function onDescriptionPointerCancel(event) {
  descriptionPointers.delete(event.pointerId);
  if (descriptionPointers.size === 0) descriptionSwipeHandled = false;
}
async function present(id) {
  if (isMapIdeaTransitioning.value) return;
  if (state.value.mode === 'map' && String(id) !== String(session.content?.id)) {
    const target = queue.value.find(idea => String(idea.id) === String(id));
    if (!target) return;
    isMapIdeaTransitioning.value = true;
    mapTransitionTargetId.value = target.id;
    const targetLocation = target.location;
    let mapTransition = Promise.resolve();
    if (Number.isFinite(targetLocation?.latitude) && Number.isFinite(targetLocation?.longitude)) {
      const targetCamera = { latitude: targetLocation.latitude, longitude: targetLocation.longitude, zoom: 16 };
      mapTransition = presentationMap.value?.transitionCameraTo(targetCamera) || Promise.resolve();
      enqueuePresentationChanges({
        camera: targetCamera,
      }, { immediate: true });
    }
    try {
      const [, ideaResult] = await Promise.allSettled([
        mapTransition,
        selectPresentationIdea(id),
      ]);
      if (ideaResult.status === 'rejected') catalogError.value = ideaResult.reason?.message || 'This idea could not be presented.';
    } finally {
      isMapIdeaTransitioning.value = false;
      mapTransitionTargetId.value = null;
    }
    return;
  }
  try { await selectPresentationIdea(id); }
  catch (error) { catalogError.value = error?.message || 'This idea could not be presented.'; }
}
async function moveIdea(delta) {
  const index = queueIndex.value;
  const next = index + delta;
  if (index < 0 || next < 0 || next >= queue.value.length) return;
  await present(queue.value[next].id);
}
function openFinder() { router.push({ name: 'RemoteIdeas' }); }

onMounted(async () => {
  try { await ensurePresentationCatalog(); }
  catch (error) { catalogError.value = error?.message || 'Ideas could not be loaded from the presentation service.'; }
});
</script>

<style scoped>
.remote-preview-caption { position: absolute; z-index: 3; inset: auto auto .4rem .4rem; margin: 0; width: fit-content; max-width: 90%; padding: .3rem .5rem; font-size: .75rem; text-align: left; }
</style>
