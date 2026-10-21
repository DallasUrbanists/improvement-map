<template>
  <section class="remote-controller-page" aria-label="Presentation controller">
    <div class="remote-controller-wrap">
      <div class="remote-mode-row" role="group" aria-label="Presentation mode">
        <button v-for="mode in modes" :key="mode.value" type="button" class="presentation-button" :class="{ 'is-active': state.mode === mode.value }" :aria-pressed="state.mode === mode.value" :disabled="mode.value === 'photo' ? !activeItem : mode.value === 'description' && !session.content" @click="setMode(mode.value)">{{ mode.label }}</button>
      </div>

      <div v-if="session.content && activeItem" class="presentation-card remote-preview-card">
        <div class="remote-preview-aspect" :style="previewAspectStyle">
          <PresentationMap v-if="state.mode === 'map'" :camera="state.camera" :style="state.mapStyle" :theme="state.theme" :rails="state.railVisible" :idea="session.content" role="controller" label="Controller map preview" @camera="cameraChanged" />
          <PresentationDescription v-else-if="state.mode === 'description'" :title="session.content.summary" :text="descriptionText" />
          <template v-else-if="activeItem.kind === 'streetmix'">
            <PresentationStreetmix :item="activeItem" :idea-id="session.content.id" :idea-title="session.content.summary" />
          </template>
          <template v-else>
            <PresentationPhoto :src="activeItem.url" :alt="activeItem.caption || session.content.summary" :frame="state.photoFrame" :item="activeItem" :aspect-ratio="receiverAspect" :interactive="true" @frame="photoFrameChanged" />
            <div v-if="state.captionVisible && activeItem.caption" class="remote-preview-caption">{{ activeItem.caption }}</div>
          </template>
        </div>

        <div v-if="state.mode === 'map'" class="remote-map-controls" role="group" aria-label="Map controls">
          <div class="remote-pan-controls" role="group" aria-label="Pan map">
            <button type="button" aria-label="Pan map up" @click="panMap('up')"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map left" @click="panMap('left')"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map down" @click="panMap('down')"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map right" @click="panMap('right')"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          </div>
          <div class="remote-map-options">
            <button type="button" class="presentation-button" :disabled="state.camera.zoom <= 1" aria-label="Zoom map out" @click="zoomMap(-1)"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <button type="button" class="presentation-button" :disabled="state.camera.zoom >= 20" aria-label="Zoom map in" @click="zoomMap(1)"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            <button type="button" class="presentation-button" @click="toggleMapStyle">{{ state.mapStyle === 'streets' ? 'Satellite' : 'Streets' }}</button>
            <button type="button" class="presentation-button" @click="centerMap">Center</button>
          </div>
        </div>

        <div v-else-if="state.mode === 'photo'" class="remote-photo-controls" role="group" aria-label="Photo controls">
          <div v-if="activeItem.kind !== 'streetmix'" class="remote-photo-zoom">
            <button type="button" class="presentation-button" :disabled="state.photoFrame.scale <= 1" aria-label="Zoom photo out" @click="zoomPhoto(-0.25)"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <button type="button" class="presentation-button" :disabled="state.photoFrame.scale >= 4" aria-label="Zoom photo in" @click="zoomPhoto(0.25)"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            <button type="button" class="presentation-button" @click="reframePhoto">Reframe</button>
            <button type="button" class="presentation-button" :aria-pressed="state.captionVisible" @click="toggleCaption">Caption {{ state.captionVisible ? 'on' : 'off' }}</button>
            <button type="button" class="presentation-button" :disabled="!hasStreetmix" @click="openStreetmix">Streetmix</button>
          </div>
          <div v-if="activeItem.kind !== 'streetmix'" class="remote-pan-controls" role="group" aria-label="Pan zoomed photo">
            <button type="button" aria-label="Pan photo up" :disabled="state.photoFrame.scale <= 1" @click="panPhoto('up')"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan photo left" :disabled="state.photoFrame.scale <= 1" @click="panPhoto('left')"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <span></span>
            <button type="button" aria-label="Pan photo right" :disabled="state.photoFrame.scale <= 1" @click="panPhoto('right')"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan photo down" :disabled="state.photoFrame.scale <= 1" @click="panPhoto('down')"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
          </div>
        </div>
      </div>
      <div v-else class="presentation-card remote-empty-card">
        <h1>No idea selected</h1>
        <p class="presentation-muted">Find a public improvement idea to present.</p>
        <button type="button" class="presentation-button is-primary" @click="openFinder">Find ideas</button>
      </div>

      <div class="presentation-card remote-idea-panel" aria-label="Current idea and queue">
        <div class="remote-idea-heading">
          <div><h1>{{ session.content?.summary || 'No idea selected' }}</h1><p>{{ session.content?.location?.address || session.content?.location?.description || 'Select an idea from Find ideas.' }}</p></div>
          <span v-if="session.content" class="remote-idea-position" aria-label="Position in current idea results">{{ queuePosition }} / {{ queue.length }}</span>
        </div>
        <div class="remote-idea-nav" role="group" aria-label="Change presented idea">
          <button type="button" class="presentation-button" :disabled="queuePosition <= 1" @click="moveIdea(-1)"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Previous idea</button>
          <button type="button" class="presentation-button" :disabled="queuePosition === 0 || queuePosition >= queue.length" @click="moveIdea(1)">Next idea <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        </div>
        <div v-if="quickIdeas.length" class="remote-quick-list" role="group" aria-label="Nearby ideas in the current result order">
          <button v-for="idea in quickIdeas" :key="idea.id" type="button" class="presentation-button" :class="{ 'is-selected': idea.id === session.state.selectedIdeaId }" :aria-pressed="idea.id === session.state.selectedIdeaId" @click="present(idea.id)">{{ idea.summary }}</button>
        </div>
        <div v-if="state.mode === 'photo' && activeItem" class="remote-current-paginator">
          <AlbumPaginator :index="albumIndex" :total="album.length" label="Presentation album" item-label="album item" @previous="moveAlbum(-1)" @next="moveAlbum(1)" />
        </div>
        <div v-if="state.mode === 'description' && session.content" class="remote-current-paginator">
          <AlbumPaginator :index="state.descriptionPage" :total="pages.length" label="Idea description pages" item-label="description page" @previous="moveDescription(-1)" @next="moveDescription(1)" />
        </div>
        <p v-if="catalogError" class="presentation-error" role="status">{{ catalogError }}</p>
      </div>
    </div>
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
import { enqueuePresentationChanges, ensurePresentationCatalog, presentationSession as session, selectPresentationIdea, writableViewState } from '../services/presentationSession.js';
import { getPresentationAlbum, isStreetmixItem } from '../services/presentationState.js';

const router = useRouter();
const state = writableViewState;
const catalogError = ref('');
const modes = [{ value: 'map', label: 'Map' }, { value: 'photo', label: 'Photo' }, { value: 'description', label: 'Description' }];
const album = computed(() => getPresentationAlbum(session.content));
const activeItem = computed(() => album.value.find(item => item.id === state.value.albumItemId) || null);
const albumIndex = computed(() => Math.max(0, album.value.findIndex(item => item.id === state.value.albumItemId)));
const pages = computed(() => session.content?.descriptionPages || []);
const descriptionText = computed(() => pages.value[state.value.descriptionPage] || '');
const hasStreetmix = computed(() => album.value.some(isStreetmixItem));
const receiverAspect = computed(() => {
  const viewport = session.receiver?.viewport;
  return viewport?.width > 0 && viewport?.height > 0 ? viewport.width / viewport.height : 16 / 9;
});
const previewAspectStyle = computed(() => ({ aspectRatio: String(receiverAspect.value) }));

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
const queueIndex = computed(() => queue.value.findIndex(idea => idea.id === session.state.selectedIdeaId));
const queuePosition = computed(() => queueIndex.value >= 0 ? queueIndex.value + 1 : 0);
const quickIdeas = computed(() => {
  if (queueIndex.value < 0) return queue.value.slice(0, 3);
  return queue.value.slice(Math.max(0, queueIndex.value - 1), Math.min(queue.value.length, queueIndex.value + 2));
});

function setMode(mode) {
  if (!['map', 'photo', 'description'].includes(mode) || (mode === 'photo' && !activeItem.value) || (mode === 'description' && !session.content)) return;
  enqueuePresentationChanges({ mode }, { immediate: true });
}
function cameraChanged(camera) { enqueuePresentationChanges({ camera }); }
function zoomMap(amount) { enqueuePresentationChanges({ camera: { ...state.value.camera, zoom: Math.max(1, Math.min(20, state.value.camera.zoom + amount)) } }, { immediate: true }); }
function panMap(direction) {
  const delta = .0008 * 2 ** (16 - state.value.camera.zoom);
  const camera = { ...state.value.camera };
  if (direction === 'left') camera.longitude = Math.max(-180, camera.longitude - delta);
  if (direction === 'right') camera.longitude = Math.min(180, camera.longitude + delta);
  if (direction === 'up') camera.latitude = Math.min(85.05112878, camera.latitude + delta);
  if (direction === 'down') camera.latitude = Math.max(-85.05112878, camera.latitude - delta);
  enqueuePresentationChanges({ camera }, { immediate: true });
}
function centerMap() {
  const location = session.content?.location;
  enqueuePresentationChanges({ camera: Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)
    ? { latitude: location.latitude, longitude: location.longitude, zoom: 16 }
    : { latitude: 32.7767, longitude: -96.797, zoom: 13 } }, { immediate: true });
}
function toggleMapStyle() { enqueuePresentationChanges({ mapStyle: state.value.mapStyle === 'streets' ? 'satellite' : 'streets' }, { immediate: true }); }
function photoFrameChanged(frame) { enqueuePresentationChanges({ photoFrame: frame }); }
function zoomPhoto(amount) { photoFrameChanged({ ...state.value.photoFrame, scale: Math.max(1, Math.min(4, state.value.photoFrame.scale + amount)) }); }
function panPhoto(direction) {
  const frame = { ...state.value.photoFrame };
  if (direction === 'left') frame.centerX = Math.min(1, frame.centerX + .08);
  if (direction === 'right') frame.centerX = Math.max(0, frame.centerX - .08);
  if (direction === 'up') frame.centerY = Math.min(1, frame.centerY + .08);
  if (direction === 'down') frame.centerY = Math.max(0, frame.centerY - .08);
  photoFrameChanged(frame);
}
function reframePhoto() { enqueuePresentationChanges({ photoFrame: { scale: 1, centerX: .5, centerY: .5 } }, { immediate: true }); }
function toggleCaption() { if (!isStreetmixItem(activeItem.value)) enqueuePresentationChanges({ captionVisible: !state.value.captionVisible }, { immediate: true }); }
function openStreetmix() { const last = [...album.value].reverse().find(isStreetmixItem); if (last) enqueuePresentationChanges({ albumItemId: last.id }, { immediate: true }); }
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
async function present(id) {
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
.remote-preview-caption { position: absolute; z-index: 3; inset: auto 0 .4rem; margin-inline: auto; width: fit-content; max-width: 90%; padding: .3rem .5rem; border-radius: .5rem; color: #fff0ce; background: #0c2340d9; font-size: .75rem; text-align: center; }
.remote-pan-controls button:disabled { opacity: .4; cursor: not-allowed; }
</style>
