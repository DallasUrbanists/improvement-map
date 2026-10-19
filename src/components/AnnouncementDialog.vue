<template>
  <Teleport to="body">
    <dialog ref="dialog" class="map-ui detail-sheet announcement-dialog" aria-labelledby="announcement-title" @cancel.prevent="dismiss" @close="onClose" @keydown="trapFocus">
      <div class="announcement-shell">
        <header class="map-tray-header">
          <div class="map-tray-heading"><h2 id="announcement-title">{{ screen === 'welcome' ? 'Welcome & guide' : "What's new" }}</h2></div>
          <button type="button" class="map-ui-button map-tray-close" :aria-label="screen === 'welcome' ? 'Close welcome' : 'Close release notes'" @click="dismiss"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div ref="content" class="detail-sheet-content announcement-content" tabindex="0" role="region" :aria-label="screen === 'welcome' ? 'App guide' : 'Release notes'">
          <template v-if="screen === 'welcome'">
            <p class="announcement-intro">Explore your neighbors’ ideas, share your own, and find a next step.</p>
            <div class="welcome-features">
              <article v-for="feature in features" :key="feature.title" class="welcome-feature">
                <i :class="['fa-solid', feature.icon]" aria-hidden="true"></i>
                <div><h3>{{ feature.title }}</h3><p>{{ feature.copy }}</p></div>
              </article>
            </div>
            <p class="announcement-note">Saved ideas, actions, and welcome preferences stay in this browser.</p>
          </template>
          <template v-else>
            <p v-if="screen === 'updates'" class="announcement-intro">{{ displayed.length === 1 ? 'One release' : `${displayed.length} releases` }} since your last visit</p>
            <p v-if="!displayed.length">No release notes have been published yet. Check back after the next update.</p>
            <article v-for="release in displayed" :key="release.id" class="announcement-release">
              <p class="announcement-note">v{{ release.version }} · {{ formatDate(release.publishedAt) }}</p>
              <h3>{{ release.title }}</h3>
              <div class="release-markdown" v-html="renderReleaseNotes(release.body)"></div>
              <a class="action-button" :href="release.url" target="_blank" rel="noopener noreferrer">View on GitHub <span aria-hidden="true">↗</span></a>
            </article>
          </template>
          <p v-if="store.notice.value" class="announcement-note" role="status">{{ store.notice.value }}</p>
        </div>
        <footer class="map-tray-footer announcement-footer" :class="{ 'welcome-footer': screen === 'welcome' }">
          <label v-if="screen === 'welcome'"><input type="checkbox" :checked="skipWelcome" @change="setSkip($event.target.checked)">Skip this welcome next time</label>
          <button type="button" class="action-button action-primary announcement-primary" @click="dismiss">{{ screen === 'welcome' ? 'Go to app' : screen === 'history' ? 'Done' : 'Got it' }}</button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { announcementRequest, createAnnouncementStore, ANNOUNCEMENT_KEY } from '../services/announcements';
import { compareVersions } from '../services/releaseVersions';
import { releases, renderReleaseNotes } from '../services/releases';
const props = defineProps({ isSubmitting: Boolean });
const route = useRoute();
// Access storage inside the adapter so even property-access SecurityErrors fall back safely.
const store = createAnnouncementStore({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, { getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key) });
const dialog = ref(null), content = ref(null), screen = ref('welcome'), displayed = ref([]), skipWelcome = ref(false);
let observer, timer, previousFocus, pendingManual = null, closingWithoutAcknowledgement = false, mounted = false;
const features = [
  { icon: 'fa-plus', title: 'Share an idea', copy: 'Choose a location, add photos, describe your idea, then review and submit.' },
  { icon: 'fa-location-dot', title: 'Explore nearby ideas', copy: 'Search a place, browse the map or list, and open an idea to learn more.' },
  { icon: 'fa-bookmark', title: 'Save and share', copy: 'Bookmark ideas for later or copy a link to share with others.' },
  { icon: 'fa-check', title: 'Take action', copy: 'Find recommendations and representatives. Save useful next steps in My actions.' },
  { icon: 'fa-road', title: 'Explore street designs', copy: 'Explore Streetmix tools within an idea to imagine how a street could change.' },
  { icon: 'fa-sliders', title: 'Make the map yours', copy: 'Switch between Streets and Satellite, choose a theme, and adjust map settings.' },
];
const formatDate = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
function setSkip(value) { skipWelcome.value = value; store.skip(value); }
function competingDialog() {
  return [...document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"], .popover, [aria-haspopup="menu"][aria-expanded="true"]')]
    .some(node => node !== dialog.value && !dialog.value?.contains(node) && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
}
function schedule() { if (mounted && !timer) timer = setTimeout(() => { timer = null; evaluate(); }, 100); }
async function show(target) {
  screen.value = target;
  const state = store.read();
  skipWelcome.value = state.skipWelcome;
  displayed.value = target === 'updates' ? releases.filter(r => !state.acknowledged || compareVersions(r.version, state.acknowledged) > 0) : releases;
  previousFocus = document.activeElement;
  await nextTick();
  if (!mounted || props.isSubmitting) return;
  content.value.scrollTop = 0;
  dialog.value.showModal();
  // Reopening the shared dialog must start at the heading, not restore a
  // previously focused footer control and its old scroll position.
  dialog.value.querySelector('.map-tray-close')?.focus({ preventScroll: true });
  content.value.scrollTop = 0;
  if (target === 'welcome') store.markWelcomeSeen();
}
function evaluate() {
  if (!mounted || dialog.value?.open || props.isSubmitting || route.name === 'TestDiagram') return;
  if (competingDialog()) return;
  if (pendingManual) { const target = pendingManual; pendingManual = null; show(target); return; }
  if (route.name !== 'Browse') return;
  const state = store.read();
  if (!state.skipWelcome && !store.welcomeSeen()) { show('welcome'); return; }
  if (releases.some(r => !state.acknowledged || compareVersions(r.version, state.acknowledged) > 0)) show('updates');
}
function dismiss() { dialog.value?.close(); }
function trapFocus(event) {
  if (event.key !== 'Tab') return;
  const controls = [...dialog.value.querySelectorAll('button, a[href], input, [tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if ((!event.shiftKey && document.activeElement === last) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus({ preventScroll: true });
  }
}
function onClose() {
  if (!closingWithoutAcknowledgement && screen.value !== 'welcome') store.acknowledge(displayed.value[0]?.version);
  closingWithoutAcknowledgement = false;
  if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
  else document.querySelector('[aria-label="Menu"]')?.focus({ preventScroll: true });
  schedule();
}
function storageChanged(event) {
  if (event.key !== null && event.key !== ANNOUNCEMENT_KEY) return;
  if (event.key === null || event.newValue === null) store.resetSession();
  store.initialize(releases[0]?.version);
  skipWelcome.value = store.read().skipWelcome;
  const state = store.read();
  if (dialog.value?.open && ((screen.value === 'welcome' && state.skipWelcome) || (screen.value === 'updates' && state.acknowledged && displayed.value.every(r => compareVersions(r.version, state.acknowledged) <= 0)))) {
    closingWithoutAcknowledgement = true;
    dialog.value.close();
  }
  schedule();
}
watch(announcementRequest, request => { if (request) { pendingManual = request.screen; schedule(); } });
watch(() => [route.fullPath, props.isSubmitting], () => {
  if (dialog.value?.open) { closingWithoutAcknowledgement = true; dialog.value.close(); }
  schedule();
});
onMounted(() => {
  mounted = true;
  if (!store.read().initialized) store.resetSession();
  store.initialize(releases[0]?.version);
  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'aria-expanded', 'class', 'style'] });
  window.addEventListener('storage', storageChanged);
  schedule();
});
onBeforeUnmount(() => { mounted = false; clearTimeout(timer); observer?.disconnect(); window.removeEventListener('storage', storageChanged); });
</script>

<style>
/* Reuse the same theme, reading sheet, header and controls as Action details. */
.announcement-shell { display: flex; flex: 1; flex-direction: column; min-height: 0; }
.announcement-dialog .announcement-content { padding: 16px; }
.announcement-content:focus-visible { outline: 2px solid var(--map-control-text); outline-offset: -3px; }
.announcement-intro { margin: 0 0 16px; }
.welcome-features { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
.welcome-feature { display: flex; gap: 12px; padding: 16px 0; border-top: 1px solid var(--map-control-border); min-width: 0; }
.welcome-feature > i { width: 22px; flex-shrink: 0; padding-top: 4px; }
.welcome-feature h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
.welcome-feature p { margin: 0; font-size: 16px; line-height: 1.5; }
.announcement-note { font-size: 14px; line-height: 1.45; margin: 16px 0 0; }
.announcement-footer { display: flex; justify-content: flex-end; align-items: center; gap: 12px; padding: 12px 16px max(12px, env(safe-area-inset-bottom)); }
.announcement-footer label { display: flex; align-items: center; gap: 12px; min-height: 44px; flex: 1; font-size: 14px; line-height: 1.45; cursor: pointer; }
.announcement-footer input { width: 22px; height: 22px; accent-color: var(--map-control-text); flex-shrink: 0; }
.announcement-footer input:focus-visible { outline: 2px solid var(--map-control-text); outline-offset: 3px; }
.announcement-primary { min-width: 120px; }
.announcement-release { padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid var(--map-control-border); overflow-wrap: anywhere; }
.announcement-release:last-of-type { border-bottom: 0; margin-bottom: 0; }
.announcement-release > .announcement-note { margin: 0 0 8px; }
.announcement-release > h3 { font-size: 18px; font-weight: 600; line-height: 1.4; margin: 0 0 12px; }
.announcement-release > .action-button { gap: 6px; margin-top: 8px; }
.release-markdown p, .release-markdown ul, .release-markdown ol { margin: 12px 0; }
.release-markdown ul { list-style: disc; padding-left: 24px; }
.release-markdown ol { list-style: decimal; padding-left: 24px; }
.release-markdown li { margin: 8px 0; }
.release-markdown :is(h1,h2,h3,h4,h5,h6) { font-size: 16px; font-weight: 600; margin: 16px 0 8px; }
.release-markdown pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.release-markdown table { display: block; overflow: auto; }
.release-markdown a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
.release-markdown a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (max-width: 600px) {
  .welcome-features { grid-template-columns: 1fr; }
  .announcement-footer { flex-direction: column; align-items: stretch; gap: 8px; }
}
</style>
