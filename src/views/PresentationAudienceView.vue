<template>
  <section class="presentation-shell presentation-audience" :class="session.state.theme" aria-label="Audience presentation">
    <div v-if="!enabled" class="audience-join"><div class="presentation-card audience-join-card"><h1>Audience viewing is unavailable</h1><p class="presentation-muted">This build does not have audience viewing enabled.</p><RouterLink class="presentation-button" to="/">Return to the map</RouterLink></div></div>
    <div v-else-if="session.role !== 'audience' || ['disconnected', 'ended', 'expired'].includes(session.status)" class="audience-join">
      <form class="presentation-card audience-join-card" @submit.prevent="join">
        <h1>{{ terminal ? 'Presentation ended' : 'Join the audience' }}</h1>
        <p class="presentation-muted">Enter the audience viewing code shown on the TV, or open an audience QR link. This code does not grant presenter controls.</p>
        <label for="audience-code">Audience viewing code</label>
        <input id="audience-code" v-model="code" autocomplete="one-time-code" inputmode="text" maxlength="10" placeholder="ABCD 2345" />
        <button type="submit" class="presentation-button is-primary" :disabled="joining || terminal">{{ joining ? 'Joining…' : 'Join presentation' }}</button>
        <button v-if="terminal" type="button" class="presentation-button" @click="leaveTerminal">Leave ended presentation</button>
        <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
        <RouterLink class="presentation-link" to="/remote">Open presenter remote</RouterLink>
      </form>
    </div>
    <div v-else-if="session.status === 'waiting'" class="audience-join">
      <div class="presentation-card audience-join-card"><h1>Waiting for the presenter</h1><p class="presentation-muted">This screen will show the selected idea when the presenter starts.</p><p v-if="session.error" role="status">{{ session.error }}</p></div>
    </div>
    <div v-else-if="session.content" class="audience-viewer" :data-following="following">
      <div class="audience-stage">
        <div v-if="displayed.mode === 'map'" class="audience-map">
          <PresentationMap :camera="displayed.camera" :style="session.state.mapStyle" :theme="session.state.theme" :rails="session.state.railVisible" :idea="session.content" role="audience" label="Audience map" @camera="cameraChanged" />
          <div class="audience-map-controls" role="group" aria-label="Map pan and zoom controls">
            <button type="button" aria-label="Pan map up" @click="panMap('up')"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map left" @click="panMap('left')"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
            <button type="button" aria-label="Zoom map out" :disabled="displayed.camera.zoom <= 1" @click="zoomMap(-1)"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map right" @click="panMap('right')"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            <button type="button" aria-label="Pan map down" @click="panMap('down')"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <button type="button" aria-label="Zoom map in" :disabled="displayed.camera.zoom >= 20" @click="zoomMap(1)"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </div>
          <div class="audience-idea-title">{{ session.content.summary }}</div>
        </div>
        <div v-else-if="displayed.mode === 'photo'" class="audience-photo">
          <PresentationStreetmix v-if="activeItem?.kind === 'streetmix'" :item="activeItem" :idea-id="session.content.id" :idea-title="session.content.summary" />
          <PresentationPhoto v-else :src="activeItem?.url || ''" :alt="activeItem?.caption || session.content.summary" :frame="displayed.photoFrame" :item="activeItem" :interactive="activeItem?.kind !== 'streetmix'" :aspect-ratio="1" @frame="photoFrameChanged" />
          <div class="audience-idea-title">{{ session.content.summary }}<span v-if="captionVisible"> · {{ activeItem?.caption }}</span></div>
        </div>
        <div v-else class="audience-description">
          <article class="presentation-card audience-description-card">
            <h1>{{ session.content.summary }}</h1><p>{{ descriptionText }}</p>
            <AlbumPaginator :index="displayed.descriptionPage" :total="pages.length" label="Audience description pages" item-label="description page" @previous="moveDescription(-1)" @next="moveDescription(1)" />
          </article>
        </div>
      </div>

      <nav class="audience-viewer-controls" role="group" aria-label="Choose personal view">
        <button v-for="tab in tabs" :key="tab.mode" type="button" class="presentation-button" :aria-pressed="session.audienceView.mode === tab.mode" @click="setTab(tab.mode)">{{ tab.label }}</button>
      </nav>
      <div class="audience-status-control">
        <span v-if="following" class="audience-status-chip" role="status">{{ session.status === 'reconnecting' ? 'Reconnecting' : 'Following presenter' }}</span>
        <button v-else type="button" class="presentation-button" @click="returnToPresenter">Return to presenter</button>
      </div>

      <div v-if="displayed.mode === 'photo'" class="audience-bottom-controls" role="group" aria-label="Browse audience photos">
        <button type="button" class="presentation-button" :disabled="albumIndex <= 0" aria-label="Previous photo" @click="movePhoto(-1)"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
        <span class="presentation-button" aria-live="polite">{{ albumIndex + 1 }} / {{ album.length }}</span>
        <button type="button" class="presentation-button" :disabled="albumIndex >= album.length - 1" aria-label="Next photo" @click="movePhoto(1)"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
        <template v-if="activeItem?.kind !== 'streetmix'">
          <button type="button" class="presentation-button" :disabled="displayed.photoFrame.scale <= 1" aria-label="Zoom photo out" @click="zoomPhoto(-0.25)"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
          <button type="button" class="presentation-button" :disabled="displayed.photoFrame.scale >= 4" aria-label="Zoom photo in" @click="zoomPhoto(0.25)"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          <button type="button" class="presentation-button" @click="reframePhoto">Reframe</button>
        </template>
      </div>
      <p v-if="session.status === 'reconnecting'" class="audience-reconnect presentation-muted" role="status">Connection lost. Showing the last synchronized presentation.</p>
    </div>
    <div v-else class="audience-join"><div class="presentation-card audience-join-card"><h1>Waiting for an idea</h1><p class="presentation-muted">The presenter has not selected an idea yet.</p><button type="button" class="presentation-button" @click="returnToPresenter">Return to presenter</button></div></div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AlbumPaginator from '../components/AlbumPaginator.vue';
import PresentationMap from '../components/PresentationMap.vue';
import PresentationPhoto from '../components/PresentationPhoto.vue';
import PresentationStreetmix from '../components/PresentationStreetmix.vue';
import { presentationIsEnabled, getActivePresentationCredential } from '../services/presentationApi.js';
import { formatPresentationCode, getAlbumItem, getPresentationAlbum } from '../services/presentationState.js';
import { connectAudience, leaveOrEndPresentation, loadInitialFromCodeFragment, presentationSession as session, restorePresentationSession, setLocalAudienceView, audienceDisplayedState, audienceFollowing, stopPresentationSession } from '../services/presentationSession.js';

const enabled = presentationIsEnabled();
const code = ref('');
const joining = ref(false);
const tabs = [{ mode: 'map', label: 'Map' }, { mode: 'photo', label: 'Photos' }, { mode: 'description', label: 'Description' }];
const following = audienceFollowing;
const displayed = audienceDisplayedState;
const terminal = computed(() => ['ended', 'expired'].includes(session.status));
const album = computed(() => getPresentationAlbum(session.content));
const pages = computed(() => session.content?.descriptionPages || []);
const activeItem = computed(() => getAlbumItem(session.content, displayed.value.albumItemId));
const albumIndex = computed(() => Math.max(0, album.value.findIndex(item => item.id === displayed.value.albumItemId)));
const descriptionText = computed(() => pages.value[displayed.value.descriptionPage] || '');
const captionVisible = computed(() => Boolean(session.state.captionVisible && activeItem.value?.kind !== 'streetmix' && activeItem.value?.caption));

async function join() {
  joining.value = true;
  session.error = '';
  try { await connectAudience(code.value); }
  catch (error) { session.error = error?.message || 'The audience code could not be used.'; }
  finally { joining.value = false; }
}
function setTab(mode) { setLocalAudienceView({ type: 'tab', mode }); }
function cameraChanged(camera) { setLocalAudienceView({ type: 'camera', camera }); }
function panMap(direction) {
  const camera = { ...displayed.value.camera };
  const delta = .0008 * 2 ** (16 - camera.zoom);
  if (direction === 'left') camera.longitude = Math.max(-180, camera.longitude - delta);
  if (direction === 'right') camera.longitude = Math.min(180, camera.longitude + delta);
  if (direction === 'up') camera.latitude = Math.min(85.05112878, camera.latitude + delta);
  if (direction === 'down') camera.latitude = Math.max(-85.05112878, camera.latitude - delta);
  setLocalAudienceView({ type: 'camera', camera });
}
function zoomMap(amount) { setLocalAudienceView({ type: 'camera', camera: { ...displayed.value.camera, zoom: Math.max(1, Math.min(20, displayed.value.camera.zoom + amount)) } }); }
function movePhoto(delta) {
  const index = albumIndex.value + delta;
  if (index < 0 || index >= album.value.length) return;
  setLocalAudienceView({ type: 'photo', index });
}
function photoFrameChanged(frame) { setLocalAudienceView({ type: 'photoFrame', frame }); }
function zoomPhoto(amount) { photoFrameChanged({ ...displayed.value.photoFrame, scale: Math.max(1, Math.min(4, displayed.value.photoFrame.scale + amount)) }); }
function reframePhoto() { photoFrameChanged({ scale: 1, centerX: .5, centerY: .5 }); }
function moveDescription(delta) { setLocalAudienceView({ type: 'descriptionPage', page: displayed.value.descriptionPage + delta }); }
function returnToPresenter() { setLocalAudienceView({ type: 'return' }); }
async function leaveTerminal() { await leaveOrEndPresentation(); }

onMounted(async () => {
  if (!enabled) return;
  const credential = getActivePresentationCredential();
  if (credential?.role === 'audience') await restorePresentationSession();
  if (!session.credential || session.role !== 'audience') {
    const codeFromQr = await loadInitialFromCodeFragment('audience');
    if (codeFromQr) { code.value = formatPresentationCode(codeFromQr) || codeFromQr; await join(); }
  }
});
onBeforeUnmount(stopPresentationSession);
</script>

<style scoped>
.audience-reconnect { position: absolute; z-index: 12; bottom: .5rem; right: .75rem; max-width: 55vw; padding: .35rem .55rem; border-radius: .5rem; background: var(--presentation-surface); }
.audience-map-controls button:disabled { opacity: .45; }
</style>
