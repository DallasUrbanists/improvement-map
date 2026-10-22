<template>
  <section class="presentation-shell presentation-tv" :class="session.state.theme" aria-label="TV presentation">
    <div v-if="!enabled" class="tv-setup">
        <div class="tv-setup-content"><h1>Presentation mode is unavailable</h1><p class="presentation-muted">This build does not have TV presentation enabled.</p><RouterLink class="presentation-button" to="/">Return to the map</RouterLink></div>
    </div>
    <template v-else>
      <div v-if="session.role !== 'receiver' || session.status === 'disconnected' || session.status === 'ended' || session.status === 'expired'" class="tv-setup">
        <div class="tv-setup-content">
          <h1>Present on TV</h1>
          <p class="presentation-muted tv-setup-instructions">Keep this screen open on the display. Scan the presenter QR with the phone remote to pair a controller.</p>
          <button type="button" class="presentation-button is-primary" :disabled="starting" @click="start">{{ starting ? 'Starting presentation…' : 'Start presentation' }}</button>
          <label class="tv-fullscreen-option"><input v-model="startInFullscreen" type="checkbox" />Start in fullscreen</label>
          <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
          <p v-if="!configuredApi" class="presentation-muted">The presentation API has not been configured for this build.</p>
        </div>
      </div>
      <div v-else-if="session.status === 'waiting'" class="tv-setup">
        <div class="tv-setup-content">
          <h1>Pair the presenter remote</h1>
          <p class="presentation-muted">Open the remote on a phone and scan this QR code, or enter the code in the remote.</p>
          <PresentationQr v-if="presenterLink" :value="presenterLink" label="presenter pairing link" />
          <div class="tv-presenter-code">{{ formatPresentationCode(session.credential?.presenterCode) }}</div>
          <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
          <p class="presentation-muted">Pairing code expires in {{ pairingTimeRemaining }}.</p>
          <RouterLink class="presentation-link" to="/remote">Open presenter remote on this device</RouterLink>
          <div class="tv-setup-actions" aria-label="TV setup controls">
            <button type="button" class="presentation-button" @click="toggleFullscreen">{{ fullscreen ? 'Exit fullscreen' : 'Fullscreen' }}</button>
            <button type="button" class="presentation-button" @click="repairCode">New pairing code</button>
            <button type="button" class="presentation-button" @click="endSession">End</button>
          </div>
        </div>
      </div>
      <div v-else class="tv-stage" :data-session-status="session.status">
        <div v-show="state.mode === 'map' || (state.mode === 'description' && !descriptionBackgroundPhoto)" class="tv-map" :class="{ 'tv-description-map-background': state.mode === 'description' }">
          <PresentationMap :camera="state.camera" :style="state.mapStyle" :theme="state.theme" :rails="state.railVisible" :icon-style="state.iconStyle" :idea="session.content" :interactive="state.mode === 'map'" role="receiver" label="TV presentation map" @camera="cameraChanged" @status="mapStatus" />
          <div v-show="state.mode === 'map' && session.content && state.captionVisible" class="map-ui tv-idea-overlay"><h1>{{ session.content?.summary }}</h1><p>{{ session.content?.location?.address || session.content?.location?.description || '' }}</p></div>
        </div>
        <div v-show="state.mode === 'photo'" class="tv-photo">
          <template v-if="mediaItem?.kind === 'streetmix'">
            <PresentationStreetmix :item="mediaItem" :idea-id="session.content.id" :idea-title="session.content.summary" @status="streetmixStatus" />
          </template>
          <PresentationPhoto v-else :src="mediaItem?.url || ''" :alt="mediaItem?.caption || session.content?.summary || 'Presentation photo'" :frame="state.photoFrame" :interactive="false" :animate-frame="true" :item="mediaItem" :aspect-ratio="1" @status="photoStatus" />
          <div v-show="state.captionVisible && mediaItem?.kind !== 'streetmix' && mediaItem?.caption" class="map-ui tv-caption">{{ mediaItem?.caption }}</div>
        </div>
        <div v-show="state.mode === 'description' && session.content" class="tv-description">
          <img v-if="descriptionBackgroundPhoto" class="tv-description-photo" :src="descriptionBackgroundPhoto.url" alt="" aria-hidden="true" />
          <div class="tv-description-content"><div v-if="state.descriptionPage === 0" class="tv-description-emoji" aria-hidden="true">{{ submissionEmoji(session.content?.emoji) }}</div><h1 v-if="state.descriptionPage === 0">{{ session.content?.summary }}</h1><p v-if="state.descriptionPage > 0">{{ descriptionText }}</p></div>
          <div v-if="descriptionPageCount > 1" class="tv-description-footer">Page {{ state.descriptionPage + 1 }} of {{ descriptionPageCount }}</div>
        </div>
        <div v-show="!session.content || !['map', 'photo', 'description'].includes(state.mode)" class="tv-setup"><div class="presentation-card tv-setup-card"><h1>Waiting for an idea</h1><p class="presentation-muted">Choose an idea from Find ideas on the remote.</p></div></div>

        <div class="tv-connection" :class="{ 'is-connected': session.status === 'active', 'is-reconnecting': session.transportState === 'reconnecting', 'has-error': Boolean(session.error || session.transportError) }" role="status" aria-live="polite">
          <template v-if="session.transportState === 'reconnecting'">Reconnecting · showing the last received presentation</template>
          <template v-else-if="session.transportState === 'disabled'">HTTP updates active · {{ session.transportError }}</template>
          <template v-else-if="session.error">Connected · {{ session.error }}</template>
          <template v-else>Presentation connected</template>
          <span v-if="session.receiver?.renderStatus === 'error'"> · Display issue: {{ renderErrorLabel }}</span>
          <span v-if="expiryWarning"> · Session expires in {{ expiryWarning }}</span>
        </div>

        <div v-if="state.audienceDisplay.showQr || state.audienceDisplay.showCode" class="map-ui tv-audience-overlay" aria-label="Audience joining details">
          <PresentationQr v-if="state.audienceDisplay.showQr && audienceLink" :value="audienceLink" label="audience viewing link" />
          <div v-if="state.audienceDisplay.showCode" class="tv-audience-code">{{ formatPresentationCode(session.credential?.audienceCode) }}</div>
        </div>
        <div v-if="showPairing" class="tv-repair-overlay presentation-card" aria-label="Replacement presenter pairing code">
          <button type="button" class="presentation-button" aria-label="Hide pairing code" @click="showPairing = false"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          <PresentationQr v-if="presenterLink" :value="presenterLink" label="replacement presenter pairing link" />
          <div class="tv-presenter-code">{{ formatPresentationCode(session.credential?.presenterCode) }}</div>
        </div>
        <div class="tv-local-menu" aria-label="TV presentation controls" @keydown.esc.stop.prevent="showControls = false">
          <button type="button" class="map-ui map-ui-button map-icon-button tv-menu-trigger" :aria-label="showControls ? 'Close TV controls' : 'Open TV controls'" :aria-expanded="showControls" aria-controls="tv-local-menu-panel" @click="showControls = !showControls">
            <i :class="showControls ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'" aria-hidden="true"></i>
          </button>
          <div v-if="showControls" id="tv-local-menu-panel" class="tv-local-menu-panel map-ui" role="menu" aria-label="TV controls">
            <button type="button" role="menuitem" class="map-ui-button w-full" @click="toggleFullscreen(); showControls = false"><i :class="fullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" aria-hidden="true"></i>{{ fullscreen ? 'Exit fullscreen' : 'Fullscreen' }}</button>
            <button type="button" role="menuitem" class="map-ui-button w-full" @click="repairCode(); showControls = false"><i class="fa-solid fa-link" aria-hidden="true"></i>Re-pair</button>
            <div class="menu-divider" role="separator"></div>
            <button type="button" role="menuitem" class="map-ui-button w-full" @click="endSession(); showControls = false"><i class="fa-solid fa-stop" aria-hidden="true"></i>End presentation</button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import PresentationMap from '../components/PresentationMap.vue';
import PresentationPhoto from '../components/PresentationPhoto.vue';
import PresentationQr from '../components/PresentationQr.vue';
import PresentationStreetmix from '../components/PresentationStreetmix.vue';
import { submissionEmoji } from '../services/emojiMapMarker.js';
import { presentationIsEnabled, getActivePresentationCredential } from '../services/presentationApi.js';
import { formatPresentationCode } from '../services/presentationState.js';
import { presentationLink, readBrowsePresentationSnapshot } from '../services/presentationLinks.js';
import { leaveOrEndPresentation, presentationSession as session, reportReceiverRender, restorePresentationSession, stopPresentationSession, writableViewState } from '../services/presentationSession.js';

const enabled = presentationIsEnabled();
const configuredApi = Boolean(import.meta.env.VITE_API_BASE_URL || 'https://api.dallasurbanists.org');
const starting = ref(false);
const startInFullscreen = ref(true);
const fullscreen = ref(false);
const showPairing = ref(false);
const showControls = ref(false);
const now = ref(Date.now());
const state = writableViewState;
const mediaItem = computed(() => session.content?.album?.find(item => item.id === state.value.albumItemId) || null);
const descriptionBackgroundPhoto = computed(() => session.content?.album?.find(item => item.kind === 'photo') || null);
const descriptionPageCount = computed(() => (session.content?.descriptionPages?.length || 0) + 1);
const descriptionText = computed(() => state.value.descriptionPage > 0 ? session.content?.descriptionPages?.[state.value.descriptionPage - 1] || '' : '');
const presenterLink = computed(() => session.credential?.presenterCode ? presentationLink('remote', 'pair', session.credential.presenterCode) : '');
const audienceLink = computed(() => session.credential?.audienceCode ? presentationLink('audience', 'view', session.credential.audienceCode) : '');
const pairingTimeRemaining = computed(() => formatRemaining(session.credential?.presenterCodeExpiresAt, now.value));
const expiryWarning = computed(() => {
  const value = session.credential?.expiresAt;
  if (!value || Date.parse(value) - now.value > 5 * 60_000) return '';
  const remaining = formatRemaining(value, now.value);
  return remaining === '0:00' ? '' : remaining;
});
const renderErrorLabel = computed(() => ({ MAP_UNAVAILABLE: 'Map unavailable', IMAGE_UNAVAILABLE: 'Photo unavailable', STREETMIX_UNAVAILABLE: 'Streetmix unavailable', CONTENT_UNAVAILABLE: 'Content unavailable' }[session.renderError] || 'Content could not be shown'));
let clockTimer = null;
let renderToken = 0;

function formatRemaining(value, timestamp) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const milliseconds = Math.max(0, Date.parse(value) - timestamp);
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function start() {
  // This call is made synchronously in the Start gesture before enrollment.
  try {
    if (startInFullscreen.value) {
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    Promise.resolve(fullscreenRequest).then(() => { fullscreen.value = Boolean(document.fullscreenElement); }).catch(() => { fullscreen.value = false; });
    }
  } catch { fullscreen.value = false; }
  if (!enabled || starting.value) return;
  starting.value = true;
  session.error = '';
  try { await import('../services/presentationSession.js').then(({ startReceiver }) => startReceiver(readBrowsePresentationSnapshot())); }
  catch (error) { session.error = error?.message || 'The presentation service could not be reached.'; }
  finally { starting.value = false; }
}

function toggleFullscreen() {
  const operation = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
  Promise.resolve(operation).then(() => { fullscreen.value = Boolean(document.fullscreenElement); }).catch(() => { fullscreen.value = false; });
}
async function repairCode() {
  try {
    const { rotatePresenterCode } = await import('../services/presentationSession.js');
    const value = await rotatePresenterCode();
    session.credential = { ...session.credential, presenterCode: value.presenterCode, presenterCodeExpiresAt: value.presenterCodeExpiresAt };
    showPairing.value = session.status === 'active';
  } catch (error) { session.error = error?.message || 'A new pairing code could not be created.'; }
}
async function endSession() {
  await leaveOrEndPresentation({ end: true });
}
function cameraChanged(camera) {
  if (session.role !== 'receiver') return;
  // The receiver reports its applied revision separately; receiver camera input is observational only.
  void camera;
}
function mapStatus(status, code) {
  if (session.role === 'receiver') reportReceiverRender(state.value.revision, status, status === 'error' ? 'MAP_UNAVAILABLE' : code);
}
function photoStatus(status, code) {
  if (session.role === 'receiver') reportReceiverRender(state.value.revision, status, status === 'error' ? code || 'IMAGE_UNAVAILABLE' : null);
}
function streetmixStatus(status, code) {
  if (session.role === 'receiver') reportReceiverRender(state.value.revision, status, status === 'error' ? code || 'STREETMIX_UNAVAILABLE' : null);
}

watch(() => [state.value.revision, state.value.mode, state.value.selectedIdeaId, mediaItem.value?.id, state.value.descriptionPage], async () => {
  const revision = state.value.revision;
  const mode = state.value.mode;
  const token = ++renderToken;
  reportReceiverRender(revision, 'loading');
  await nextTick();
  if (mode === 'description') requestAnimationFrame(() => { if (token === renderToken && session.role === 'receiver') reportReceiverRender(revision, 'ready'); });
  if (mode === 'photo' && (!mediaItem.value || (mediaItem.value.kind !== 'streetmix' && !mediaItem.value.url))) {
    requestAnimationFrame(() => { if (token === renderToken && session.role === 'receiver') reportReceiverRender(revision, 'error', 'CONTENT_UNAVAILABLE'); });
  }
});
onMounted(async () => {
  const credential = getActivePresentationCredential();
  if (credential?.role === 'receiver') await restorePresentationSession();
  fullscreen.value = Boolean(document.fullscreenElement);
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => { if (clockTimer) clearInterval(clockTimer); stopPresentationSession(); });
</script>

<style scoped>
.tv-repair-overlay { position: absolute; z-index: 12; top: 4.4rem; left: 50%; translate: -50% 0; display: grid; justify-items: center; gap: .5rem; padding: .75rem; color: var(--presentation-text); }
.tv-description-emoji { margin-bottom: .75rem; font-size: clamp(3rem, 8vw, 6rem); line-height: 1; }
.tv-repair-overlay > button { position: absolute; top: .3rem; right: .3rem; }
.tv-repair-overlay .presentation-qr { width: 6rem; min-width: 6rem; margin-top: 1.4rem; }
</style>
