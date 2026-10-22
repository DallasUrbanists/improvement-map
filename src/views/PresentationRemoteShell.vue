<template>
  <section class="presentation-shell presentation-remote-shell" :class="[theme, { 'is-controller': route.name === 'RemoteController' }]" aria-label="Presenter remote">
    <header v-if="enabled && connected" class="remote-header" :class="{ 'has-page-title': ['RemoteIdeas', 'RemoteStyles', 'RemoteAudience'].includes(route.name) }">
      <div v-if="['RemoteIdeas', 'RemoteStyles', 'RemoteAudience'].includes(route.name)" class="remote-header-page-title">
        <button type="button" class="map-ui map-ui-button" aria-label="Back to controller" @click="backToController"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
        <h1>{{ route.name === 'RemoteIdeas' ? 'Find ideas' : route.name === 'RemoteStyles' ? 'Style Settings' : 'Audience' }}</h1>
      </div>
      <div v-else-if="route.name === 'RemoteController'" class="remote-header-page-title">
        <h1>Controller</h1>
      </div>
      <div class="presentation-status" role="status" aria-live="polite">
        <i :class="[connectionIcon, { 'is-connected': session.status === 'active' }]" aria-hidden="true"></i><span>{{ statusText }}</span>
        <span v-if="session.transportError" class="presentation-muted">· {{ session.transportError }}</span>
        <span v-if="remainingTime" class="presentation-muted">· {{ remainingTime }}</span>
      </div>
      <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
      <button ref="menuTrigger" type="button" class="map-ui map-ui-button map-icon-button remote-menu-trigger" aria-label="Open remote menu" aria-haspopup="menu" :aria-expanded="menuOpen" @click="toggleMenu"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
      <button v-if="menuOpen" type="button" class="remote-menu-backdrop" aria-label="Close menu" @click="closeMenu"></button>
      <nav v-if="menuOpen" ref="menuPanel" class="remote-menu map-ui" role="menu" aria-label="Presenter remote pages" @keydown.esc.stop.prevent="closeMenu">
        <button v-for="item in menuItems" :key="item.name" type="button" role="menuitem" class="map-ui-button w-full" :class="{ 'is-current': route.name === item.name }" :aria-current="route.name === item.name ? 'page' : undefined" @click="openPage(item)">{{ item.label }}</button>
        <div class="menu-divider" role="separator"></div>
        <button v-if="route.name === 'RemoteController'" type="button" role="menuitem" class="map-ui-button w-full" @click="toggleFullscreen"><i :class="fullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" aria-hidden="true"></i>{{ fullscreen ? 'Exit fullscreen' : 'Fullscreen' }}</button>
        <div v-if="route.name === 'RemoteController'" class="menu-divider" role="separator"></div>
        <button type="button" role="menuitem" class="map-ui-button w-full" @click="endPresentation"><i class="fa-solid fa-door-open" aria-hidden="true"></i>End presentation</button>
      </nav>
    </header>
    <main class="remote-pages">
      <div v-if="!enabled" class="remote-connection"><div class="presentation-card remote-connection-card"><h1>Presentation mode is unavailable</h1><p class="presentation-muted">This build does not have presenter controls enabled.</p><RouterLink class="presentation-button" to="/">Return to the map</RouterLink></div></div>
      <div v-else-if="!connected" class="remote-connection">
        <form class="presentation-card remote-connection-card" @submit.prevent="pair">
          <h1>Connect to a presentation</h1>
          <p class="presentation-muted">Scan the presenter QR from the TV, or enter its five-digit code. Audience viewing codes use a separate page.</p>
          <label for="presenter-code">Presenter code</label>
          <input id="presenter-code" v-model="code" type="text" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" aria-describedby="presenter-code-help" placeholder="01234" />
          <small id="presenter-code-help" class="presentation-muted">Enter five digits.</small>
          <button type="submit" class="presentation-button is-primary" :disabled="pairing">{{ pairing ? 'Connecting…' : 'Connect remote' }}</button>
          <p v-if="session.error" class="presentation-error" role="alert">{{ session.error }}</p>
          <RouterLink class="presentation-link" to="/audience">Join as an audience member</RouterLink>
          <RouterLink class="presentation-link" to="/tv">Set up this screen as the TV</RouterLink>
        </form>
      </div>
      <RouterView v-else />
    </main>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { presentationIsEnabled, getActivePresentationCredential } from '../services/presentationApi.js';
import { formatPresentationCode } from '../services/presentationState.js';
import { connectController, leaveOrEndPresentation, loadInitialFromCodeFragment, presentationSession as session, restorePresentationSession, stopPresentationSession } from '../services/presentationSession.js';

const route = useRoute();
const router = useRouter();
const enabled = presentationIsEnabled();
const menuOpen = ref(false);
const pairing = ref(false);
const fullscreen = ref(Boolean(document.fullscreenElement));
const code = ref('');
const now = ref(Date.now());
const menuTrigger = ref(null);
const menuPanel = ref(null);
const connected = computed(() => session.role === 'controller' && ['waiting', 'active'].includes(session.status));
const theme = computed(() => session.state.theme);
const statusText = computed(() => session.status === 'waiting' ? 'Waiting for TV' : session.transportState === 'reconnecting' ? 'Reconnecting · showing the last presentation' : session.transportState === 'disabled' ? 'TV connected · HTTP updates' : 'TV connected');
const connectionIcon = computed(() => session.transportState === 'reconnecting' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle');
const expiresAt = computed(() => session.credential?.expiresAt);
const remainingTime = computed(() => {
  if (!expiresAt.value || Date.parse(expiresAt.value) - now.value > 5 * 60_000) return '';
  const milliseconds = Math.max(0, Date.parse(expiresAt.value) - now.value);
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `ends in ${minutes}:${String(seconds).padStart(2, '0')}`;
});
const menuItems = [
  { name: 'RemoteController', label: 'Controller' },
  { name: 'RemoteIdeas', label: 'Find ideas' },
  { name: 'RemoteStyles', label: 'Style Settings' },
  { name: 'RemoteAudience', label: 'Audience' },
];
let clockTimer = null;

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
  if (menuOpen.value) nextTick(() => menuPanel.value?.querySelector('button')?.focus({ preventScroll: true }));
}
function closeMenu() {
  menuOpen.value = false;
  nextTick(() => menuTrigger.value?.focus({ preventScroll: true }));
}
function backToController() { router.push({ name: 'RemoteController' }); }
async function openPage(item) {
  closeMenu();
  await router.push({ name: item.name });
  nextTick(() => menuTrigger.value?.focus({ preventScroll: true }));
}
async function pair() {
  pairing.value = true;
  session.error = '';
  try {
    await connectController(code.value);
    code.value = formatPresentationCode(code.value);
  } catch (error) { session.error = error?.message || 'The presenter code could not be used.'; }
  finally { pairing.value = false; }
}
async function endPresentation() {
  closeMenu();
  await leaveOrEndPresentation({ end: true });
  await router.replace({ name: 'RemoteController' });
}
async function toggleFullscreen() {
  const next = !document.fullscreenElement;
  closeMenu();
  try {
    if (next) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch { /* Fullscreen can be blocked by browser policy or unsupported on the device. */ }
}
function updateFullscreenState() { fullscreen.value = Boolean(document.fullscreenElement); }

onMounted(async () => {
  document.addEventListener('fullscreenchange', updateFullscreenState);
  if (!enabled) return;
  const credential = getActivePresentationCredential();
  if (credential?.role === 'controller') await restorePresentationSession();
  if (!connected.value) {
    const codeFromQr = await loadInitialFromCodeFragment('controller');
    if (codeFromQr) {
      code.value = formatPresentationCode(codeFromQr) || codeFromQr;
      await pair();
    }
  }
  clockTimer = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState);
  if (clockTimer) clearInterval(clockTimer);
  menuOpen.value = false;
  stopPresentationSession();
});
</script>
