<template>
  <section class="presentation-shell presentation-remote-shell" :class="theme" aria-label="Presenter remote">
    <header v-if="enabled && connected" class="remote-header">
      <div class="presentation-status" role="status" aria-live="polite">
        <i :class="connectionIcon" aria-hidden="true"></i><span>{{ statusText }}</span>
        <span v-if="remainingTime" class="presentation-muted">· {{ remainingTime }}</span>
      </div>
      <button ref="menuTrigger" type="button" class="remote-menu-trigger" aria-label="Open remote menu" aria-haspopup="menu" :aria-expanded="menuOpen" @click="toggleMenu"><i class="fa-solid fa-bars" aria-hidden="true"></i></button>
      <button v-if="menuOpen" type="button" class="remote-menu-backdrop" aria-label="Close menu" @click="closeMenu"></button>
      <nav v-if="menuOpen" ref="menuPanel" class="remote-menu presentation-card" role="menu" aria-label="Presenter remote pages" @keydown.esc.stop.prevent="closeMenu">
        <button v-for="item in menuItems" :key="item.name" type="button" role="menuitem" class="presentation-button" :class="{ 'is-current': route.name === item.name }" :aria-current="route.name === item.name ? 'page' : undefined" @click="openPage(item)">{{ item.label }}</button>
        <button type="button" role="menuitem" class="presentation-button menu-end" @click="endPresentation">End presentation</button>
      </nav>
    </header>
    <main class="remote-pages">
      <div v-if="!enabled" class="remote-connection"><div class="presentation-card remote-connection-card"><h1>Presentation mode is unavailable</h1><p class="presentation-muted">This build does not have presenter controls enabled.</p><RouterLink class="presentation-button" to="/">Return to the map</RouterLink></div></div>
      <div v-else-if="!connected" class="remote-connection">
        <form class="presentation-card remote-connection-card" @submit.prevent="pair">
          <h1>Connect to a presentation</h1>
          <p class="presentation-muted">Scan the presenter QR from the TV, or enter its eight-character code. Audience viewing codes use a separate page.</p>
          <label for="presenter-code">Presenter code</label>
          <input id="presenter-code" v-model="code" autocomplete="one-time-code" inputmode="text" maxlength="10" aria-describedby="presenter-code-help" placeholder="ABCD 2345" />
          <small id="presenter-code-help" class="presentation-muted">Letters and numbers are not case-sensitive.</small>
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
const code = ref('');
const now = ref(Date.now());
const menuTrigger = ref(null);
const menuPanel = ref(null);
const connected = computed(() => session.role === 'controller' && ['waiting', 'active', 'reconnecting'].includes(session.status));
const theme = computed(() => session.state.theme);
const statusText = computed(() => session.status === 'reconnecting' ? 'Reconnecting' : session.status === 'waiting' ? 'Waiting for TV' : 'TV connected');
const connectionIcon = computed(() => session.status === 'reconnecting' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle');
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

onMounted(async () => {
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
  if (clockTimer) clearInterval(clockTimer);
  menuOpen.value = false;
  stopPresentationSession();
});
</script>
