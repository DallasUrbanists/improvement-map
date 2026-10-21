<template>
  <section class="presentation-shell presentation-tv" :class="session.state.theme" aria-label="TV presentation">
    <div v-if="!enabled" class="tv-setup">
      <div class="presentation-card tv-setup-card"><h1>Presentation mode is unavailable</h1><p class="presentation-muted">This build does not have TV presentation enabled.</p><RouterLink class="presentation-button" to="/">Return to the map</RouterLink></div>
    </div>
    <template v-else>
      <div v-if="session.role !== 'receiver' || session.status === 'disconnected' || session.status === 'ended' || session.status === 'expired'" class="tv-setup">
        <div class="presentation-card tv-setup-card">
          <h1>Present on TV</h1>
          <p class="presentation-muted">Keep this screen open on the display. Scan the presenter QR with the phone remote to pair a controller.</p>
          <button type="button" class="presentation-button is-primary" :disabled="starting" @click="start">{{ starting ? 'Starting presentation…' : 'Start presentation' }}</button>
          <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
          <p v-if="!configuredApi" class="presentation-muted">The presentation API has not been configured for this build.</p>
        </div>
      </div>
      <div v-else-if="session.status === 'waiting'" class="tv-setup">
        <div class="presentation-card tv-setup-card">
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
        <div v-if="state.mode === 'map'" class="tv-map">
          <PresentationMap :camera="state.camera" :style="state.mapStyle" :theme="state.theme" :rails="state.railVisible" :idea="session.content" role="receiver" label="TV presentation map" @camera="cameraChanged" @status="mapStatus" />
          <div v-if="session.content" class="tv-idea-overlay"><h1>{{ session.content.summary }}</h1><p>{{ session.content.location?.address || session.content.location?.description || '' }}</p></div>
          <div v-else class="tv-idea-overlay"><h1>Ready for the next idea</h1><p>Choose an idea on the presenter remote.</p></div>
        </div>
        <div v-else-if="state.mode === 'photo'" class="tv-photo">
          <template v-if="mediaItem?.kind === 'streetmix'">
            <PresentationStreetmix :item="mediaItem" :idea-id="session.content.id" :idea-title="session.content.summary" @status="streetmixStatus" />
          </template>
          <PresentationPhoto v-else :src="mediaItem?.url || ''" :alt="mediaItem?.caption || session.content?.summary || 'Presentation photo'" :frame="state.photoFrame" :interactive="false" :item="mediaItem" :aspect-ratio="1" @status="photoStatus" />
          <div v-if="state.captionVisible && mediaItem?.kind !== 'streetmix' && mediaItem?.caption" class="tv-caption">{{ mediaItem.caption }}</div>
        </div>
        <div v-else-if="state.mode === 'description' && session.content" class="tv-description">
          <div class="tv-description-content"><h1>{{ session.content.summary }}</h1><p>{{ descriptionText }}</p></div>
          <div v-if="session.content.descriptionPages.length" class="tv-description-footer">Page {{ state.descriptionPage + 1 }} of {{ session.content.descriptionPages.length }}</div>
        </div>
        <div v-else class="tv-setup"><div class="presentation-card tv-setup-card"><h1>Waiting for an idea</h1><p class="presentation-muted">Choose an idea from Find ideas on the remote.</p></div></div>

        <div class="tv-connection" role="status" aria-live="polite">
          <template v-if="session.status === 'reconnecting'">Reconnecting · showing the last received presentation</template>
          <template v-else-if="session.error">Connected · {{ session.error }}</template>
          <template v-else>Presentation connected</template>
          <span v-if="session.receiver?.renderStatus === 'error'"> · Display issue: {{ renderErrorLabel }}</span>
          <span v-if="expiryWarning"> · Session expires in {{ expiryWarning }}</span>
        </div>

        <div v-if="state.audienceDisplay.showQr || state.audienceDisplay.showCode" class="tv-audience-overlay" aria-label="Audience joining details">
          <PresentationQr v-if="state.audienceDisplay.showQr && audienceLink" :value="audienceLink" label="audience viewing link" />
          <div v-if="state.audienceDisplay.showCode" class="tv-audience-code">{{ formatPresentationCode(session.credential?.audienceCode) }}</div>
        </div>
        <div v-if="showPairing" class="tv-repair-overlay presentation-card" aria-label="Replacement presenter pairing code">
          <button type="button" class="presentation-button" aria-label="Hide pairing code" @click="showPairing = false"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          <PresentationQr v-if="presenterLink" :value="presenterLink" label="replacement presenter pairing link" />
          <div class="tv-presenter-code">{{ formatPresentationCode(session.credential?.presenterCode) }}</div>
        </div>
        <div class="tv-local-tools" aria-label="TV presentation controls">
          <button type="button" class="presentation-button" :aria-label="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'" @click="toggleFullscreen"><i :class="fullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" aria-hidden="true"></i></button>
          <button type="button" class="presentation-button" @click="repairCode">Re-pair</button>
          <button type="button" class="presentation-button" @click="endSession">End</button>
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
import { presentationIsEnabled, getActivePresentationCredential } from '../services/presentationApi.js';
import { formatPresentationCode } from '../services/presentationState.js';
import { presentationLink, readBrowsePresentationSnapshot } from '../services/presentationLinks.js';
import { leaveOrEndPresentation, presentationSession as session, reportReceiverRender, restorePresentationSession, stopPresentationSession, writableViewState } from '../services/presentationSession.js';

const enabled = presentationIsEnabled();
const configuredApi = Boolean(import.meta.env.VITE_API_BASE_URL || 'https://api.dallasurbanists.org');
const starting = ref(false);
const fullscreen = ref(false);
const showPairing = ref(false);
const now = ref(Date.now());
const state = writableViewState;
const mediaItem = computed(() => session.content?.album?.find(item => item.id === state.value.albumItemId) || null);
const descriptionText = computed(() => session.content?.descriptionPages?.[state.value.descriptionPage] || '');
const presenterLink = computed(() => session.credential?.presenterCode ? presentationLink('remote', 'pair', session.credential.presenterCode) : '');
const audienceLink = computed(() => session.credential?.audienceCode ? presentationLink('audience', 'view', session.credential.audienceCode) : '');
const pairingTimeRemaining = computed(() => formatRemaining(session.credential?.presenterCodeExpiresAt, now.value));
const expiryWarning = computed(() => {
  const value = session.credential?.expiresAt;
  if (!value || Date.parse(value) - now.value > 5 * 60_000) return '';
  return formatRemaining(value, now.value);
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
    const fullscreenRequest = document.documentElement.requestFullscreen?.();
    Promise.resolve(fullscreenRequest).then(() => { fullscreen.value = Boolean(document.fullscreenElement); }).catch(() => { fullscreen.value = false; });
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
.tv-repair-overlay > button { position: absolute; top: .3rem; right: .3rem; }
.tv-repair-overlay .presentation-qr { width: 6rem; min-width: 6rem; margin-top: 1.4rem; }
</style>
