<template>
  <Tray ref="detailTray" v-model:open="trayOpen" v-model:maximize="readingExpanded" :theme="isDark ? 'dark' : 'light'" :surface-level="2" panel-class="submission-detail-tray" :handle-label="readingExpanded ? 'Show map' : 'Expand details'" :busy="isLoading" :can-drag-close="true" :can-drag-open="true" :toggle-maximize-on-click="true" :medium-height="detailTrayMediumHeight" :max-height="detailTrayMaxHeight" label="Idea details" @scroll="workspace.saveViewState">
    <template #head><Toolbar class="detail-toolbar" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :leftButtons="detailToolbarLeftButtons" :rightButtons="detailToolbarRightButtons" @button-click="handleToolbarAction" /></template>
    <template #default>

    <ContainedSection v-if="readingExpanded && suggestion" class="detail-reading-heading" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :padded="true">
      <h1>{{ suggestion.content?.summary || suggestion.summary }}</h1>
    </ContainedSection>
    <p v-if="bookmarkNotice" class="idea-notice" role="alert">{{ bookmarkNotice }}</p>
    <p class="sr-only" role="status">{{ bookmarkMessage }}</p>
    <p v-if="copyLinkMessage" class="sr-only" role="status">{{ copyLinkMessage }}</p>
    <p v-if="refreshError" class="detail-refresh-error" role="alert">{{ refreshError }}</p>

    <ContainedSection v-else-if="errorMessage" class="detail-error-message" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :padded="true">
      <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3" aria-hidden="true"></i>
      <h2 class="text-xl font-bold mb-2">Idea unavailable</h2>
      <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{{ errorMessage }}</p>
    </ContainedSection>

    <!-- Suggestion Details View with Konsta Card -->
    <div v-if="suggestion" class="detail-body-sections" :class="{ 'detail-content-obscured': isLoading }">
      <div
        :content-wrap="false"
        class="detail-body-sections"
      >

        <ContainedSection class="detail-description text-sm whitespace-pre-wrap break-words"
            :theme="isDark ? 'dark' : 'light'" :surface-level="2" :padded="true"
            :class="{ 'detail-description-revealing': isRevealingDetails }">
            <div class="detail-description-inner">
              <!-- Description Details -->
              <p>
                {{ fadingDetails.settled }}<span v-for="character in fadingDetails.leading" :key="character.index"
                  :style="{ opacity: character.opacity }">{{ character.text }}</span><span
                  class="detail-typewriter-pending" aria-hidden="true">{{ outgoingDetails.slice(displayedDetails.length)
                  }}</span>
              </p>
              <p class="detail-description-byline">{{ formattedDate }} · {{ suggestion.author?.name || 'Anonymous Contributor' }}</p>
              <p class="detail-pills">
                <PillText label="Photos" data-selectable variant="secondary" size="regular" :selected="activeDetailSection === 'photos'" @click="activeDetailSection = 'photos'" />
                <PillText label="Representatives" data-selectable variant="secondary" size="regular" :selected="activeDetailSection === 'representatives'" @click="activeDetailSection = 'representatives'" />
                <PillText label="Streetmix" data-selectable variant="secondary" size="regular" :selected="activeDetailSection === 'streetmix'" @click="activeDetailSection = 'streetmix'" />
                <PillText label="Recommended Actions" data-selectable variant="secondary" size="regular" :selected="activeDetailSection === 'actions'" @click="activeDetailSection = 'actions'" />
              </p>
              <div v-if="activeDetailSection === 'photos'" class="detail-photo-content">
                <p v-if="!photosList.length">No photos available.</p>
                <div v-else class="detail-photo-row">
                  <button v-for="(photo, index) in photosList" :key="photo.id || index" type="button" class="detail-photo-thumbnail" :aria-label="`Open photo ${index + 1}${photo.caption ? ': ' + photo.caption : ''}`" @click="previewPhoto(index, $event.currentTarget)">
                    <img :src="photo.dataUrl || photo.url" alt="" />
                    <span v-if="photo.caption" class="detail-photo-caption">{{ photo.caption }}</span>
                  </button>
                </div>
              </div>
              <div v-else-if="activeDetailSection === 'representatives'" class="detail-context-content">
                <section class="representatives-section">
                  <p v-if="representativesLoading" role="status">Loading representatives…</p>
                  <div v-else-if="representativesError" role="alert"><p>{{ representativesError }}</p><button class="action-button" @click="loadRepresentatives">Retry</button></div>
                  <p v-else-if="representativesLoaded && !representatives.length">No representatives found.</p>
                  <article v-for="representative in prioritizedRepresentatives" :key="representative.id" class="context-card">
                    <div class="representative-row-copy">
                      <h3>{{ representative.name || 'Name unavailable' }}</h3>
                      <p class="secondary-copy"><template v-if="representative.title">{{ representative.title }}<br /></template>{{ [representative.boundary?.entityName, representative.boundary?.bodyName, representative.boundary?.districtName].filter(Boolean).join(' · ') || 'Jurisdiction unavailable' }}</p>
                    </div>
                    <div class="action-card-controls representative-contact-controls">
                      <details v-if="getRepresentativeContactItems(representative).length" class="representative-contact-menu" @toggle="positionRepresentativeContactMenu">
                        <summary class="action-button"><i class="fa-solid fa-address-card" aria-hidden="true"></i> Contact</summary>
                        <div class="representative-contact-options">
                          <a v-for="contact in getRepresentativeContactItems(representative)" :key="contact.href + contact.label" :href="contact.href" :target="contact.external ? '_blank' : undefined" :rel="contact.external ? 'noopener noreferrer' : undefined" class="action-button" :aria-label="`${contactLabel(contact)}: ${contact.label}`" :title="contact.label"><i :class="['fa-solid', contact.external ? 'fa-globe' : contact.type === 'email' ? 'fa-envelope' : 'fa-phone']" aria-hidden="true"></i><span>{{ contact.buttonLabel }}</span></a>
                        </div>
                      </details>
                    </div>
                    <p v-if="!getRepresentativeContactItems(representative).length" class="secondary-copy">Contact information unavailable</p>
                  </article>
                </section>
              </div>
              <StreetmixPanel v-else-if="activeDetailSection === 'streetmix' && String(suggestion.id) === String(route.params.id)" :key="suggestion.id" :suggestion="suggestion" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :refresh-version="actionsRefreshVersion" @saved="updateStreetmixSummary" />
              <RecommendedActions v-else-if="activeDetailSection === 'actions'" :suggestion="suggestion" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :refresh-version="actionsRefreshVersion" />
            </div>
          </ContainedSection>
        </div>

    </div>

    <!-- Image Lightbox Modal -->
    <Teleport to="body">
      <dialog ref="photoDialog" class="detail-photo-dialog" aria-label="Photo preview"
        @keydown.tab.prevent="photoDialog.querySelector('button').focus()" @cancel.prevent="dismissLightbox" @click="handlePhotoBackdropClick" @close="dismissLightbox">
        <div class="detail-photo-viewer">
          <button type="button" class="detail-photo-close" aria-label="Close photo preview" autofocus @click="dismissLightbox">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
          <img v-if="lightboxUrl" :src="lightboxUrl" alt="Full size" :aria-describedby="lightboxCaption ? 'detail-photo-full-caption' : undefined" />
          <p v-if="lightboxCaption" id="detail-photo-full-caption" class="detail-photo-full-caption">{{ lightboxCaption }}</p>
        </div>
      </dialog>
    </Teleport>
    </template>
  </Tray>
</template>

<script setup>
import { ref, shallowRef, computed, watch, inject, onBeforeUnmount, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kButton, kCard } from 'konsta/vue';
import Tray from '../components/Tray.vue';
import Toolbar from '../components/Toolbar.vue';
import ContainedSection from '../components/ContainedSection.vue';
import PillText from '../components/PillText.vue';
import { getSuggestionById, getSuggestionRepresentatives, getSuggestionBoundaries } from '../services/api';
import { bookmarkNotice, bookmarkMessage, isBookmarked, toggleBookmark } from '../services/bookmarks';
import RecommendedActions from '../components/RecommendedActions.vue';
import StreetmixPanel from '../components/StreetmixPanel.vue';
import { mapWorkspaceKey, detailMotionDuration } from '../services/mapWorkspace';
import { applySubmissionShareMetadata } from '../services/submissionShareMetadata';
import { isDark } from '../services/theme';

const route = useRoute();
const router = useRouter();
const workspace = inject(mapWorkspaceKey);
const actionsRefreshVersion = ref(0);
function updateStreetmixSummary(summary) { if (suggestion.value) suggestion.value.streetmix = summary; }

const detailTray = ref(null);
const trayOpen = ref(true);
const readingExpanded = ref(false);
const viewportHeight = ref(window.innerHeight);
const detailTrayMediumHeight = computed(() => Math.max(280, Math.min(520, viewportHeight.value * .58)));
const detailTrayMaxHeight = computed(() => viewportHeight.value - 80);
const detailToolbarLeftButtons = computed(() => [
  { id: 'previous', icon: 'chevron-left', label: 'Previous idea', disabled: isLoading.value || !workspace.detailNavigation.value.olderId },
  { id: 'next', icon: 'chevron-right', label: 'Next idea', disabled: isLoading.value || !workspace.detailNavigation.value.newerId },
]);
const detailToolbarRightButtons = computed(() => [
  { id: 'bookmark', icon: 'bookmark', label: isBookmarked(suggestion.value?.id) ? 'Remove bookmark' : 'Save idea', isActive: isBookmarked(suggestion.value?.id), disabled: isLoading.value || !suggestion.value },
  { id: 'copy', icon: 'link', label: 'Copy idea link', disabled: isLoading.value || !suggestion.value },
  { id: 'close', icon: 'xmark', label: 'Close idea' },
]);
function handleToolbarAction({ button }) {
  if (button.id === 'close') goBack();
  else if (button.id === 'previous') workspace.navigateDetail('older');
  else if (button.id === 'next') workspace.navigateDetail('newer');
  else if (button.id === 'bookmark' && suggestion.value) toggleBookmark(suggestion.value);
  else if (button.id === 'copy') copySuggestionLink();
  else if (button.id === 'refresh') refreshSuggestion();
}
watch(trayOpen, open => { if (!open) goBack(); });
watch(readingExpanded, expanded => setReadingProgress(expanded ? 1 : 0));
let readingProgress = 0;
function setReadingProgress(progress) {
  readingProgress = Math.max(0, Math.min(1, progress));
  workspace.setDetailReadingProgress(readingProgress);
}
onBeforeUnmount(() => setReadingProgress(0));
watch(() => route.params.id, () => { setReadingProgress(0); readingExpanded.value = false; });
function updateViewportHeight() { viewportHeight.value = window.innerHeight; }
onMounted(() => {
  window.addEventListener('resize', updateViewportHeight, { passive: true });
});
onBeforeUnmount(() => window.removeEventListener('resize', updateViewportHeight));

const suggestion = ref(null);
const activeDetailSection = ref('photos');
const isLoading = ref(true);
const isRefreshing = ref(false);
const displayedDetails = ref('');
const erasingDetails = ref(false);
const outgoingDetails = ref('');
let cancelDetailsErase = null;
const isRevealingDetails = ref(false);
const detailsFadeWidth = 6;
const detailsCursor = ref(0);
const fadingDetails = computed(() => {
  if (!isRevealingDetails.value && !erasingDetails.value) return { settled: displayedDetails.value, leading: [] };
  const characters = Array.from(displayedDetails.value);
  const start = Math.max(0, Math.floor(detailsCursor.value - detailsFadeWidth));
  return {
    settled: characters.slice(0, start).join(''),
    leading: characters.slice(start).map((text, offset) => ({
      text,
      index: start + offset,
      opacity: Math.min(1, Math.max(0, (detailsCursor.value - start - offset) / detailsFadeWidth)),
    })),
  };
});
const restoringSuggestion = shallowRef(null);
let detailsRevealFrame = 0;
const errorMessage = ref('');
const refreshError = ref('');
const copyLinkMessage = ref('');
let copyLinkTimeout = 0;
const lightboxUrl = ref('');
const lightboxCaption = ref('');
const photoDialog = ref(null);
let photoTrigger = null;
watch(lightboxUrl, async url => {
  await nextTick();
  if (url && !photoDialog.value?.open) photoDialog.value?.showModal();
  else if (!url && photoDialog.value?.open) {
    photoDialog.value.close();
    if (photoTrigger?.isConnected) photoTrigger.focus({ preventScroll: true });
  }
});
function handlePhotoBackdropClick(event) {
  if (event.target !== photoDialog.value) return;
  const box = photoDialog.value.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismissLightbox();
}
const representatives = ref([]);
const representativesLoading = ref(false);
const representativesLoaded = ref(false);
const representativesError = ref('');
let representativesRequestVersion = 0;
let suggestionRequestVersion = 0;
const boundaries = ref([]);
function localPriority(boundary) {
  const text = [boundary?.entityName, boundary?.bodyName, boundary?.districtName].filter(Boolean).join(' ');
  return /neighborhood/i.test(text) ? 0 : /city|council/i.test(text) ? 1 : 2;
}
const prioritizedBoundaries = computed(() => [...boundaries.value].sort((a, b) => localPriority(a) - localPriority(b)));
const prioritizedRepresentatives = computed(() => [...representatives.value].sort((a, b) => localPriority(a.boundary) - localPriority(b.boundary)));
function contactLabel(contact) { return contact.href.startsWith('tel:') ? 'Call' : contact.href.startsWith('mailto:') ? 'Email' : 'Website'; }

function positionRepresentativeContactMenu(event) {
  const menu = event.currentTarget;
  if (!menu.open) {
    menu.classList.remove('opens-up');
    return;
  }
  requestAnimationFrame(() => {
    const options = menu.querySelector('.representative-contact-options');
    const trigger = menu.querySelector('summary');
    if (!options || !trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - triggerRect.bottom - 12;
    const spaceAbove = triggerRect.top - 12;
    const opensUp = spaceBelow < Math.min(options.scrollHeight, 240) && spaceAbove > spaceBelow;
    menu.classList.toggle('opens-up', opensUp);
    options.style.maxHeight = `${Math.max(120, Math.min(320, opensUp ? spaceAbove : spaceBelow))}px`;
  });
}
const boundariesLoading = ref(false);
const boundariesLoaded = ref(false);
const boundariesError = ref('');
let boundariesRequestVersion = 0;


const photosList = computed(() => {
  return suggestion.value?.content?.photos || suggestion.value?.photos || [];
});

watch([suggestion, () => route.fullPath], ([item], previous, onCleanup) => {
  if (!item) return;
  const pageUrl = new URL(router.resolve(route.fullPath).href, window.location.origin).href;
  onCleanup(applySubmissionShareMetadata(item, pageUrl));
}, { immediate: true });

const formattedDate = computed(() => {
  const dt = suggestion.value?.creationDate;
  if (!dt) return 'Recently';

  const date = new Date(dt);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();
  }

  const options = {
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  };
  return date.toLocaleDateString(undefined, options);
});

function previewPhoto(index, trigger) {
  const photo = photosList.value[index];
  photoTrigger = trigger;
  lightboxCaption.value = photo.caption || '';
  lightboxUrl.value = photo.dataUrl || photo.url;
}

function getRepresentativeContactItems(representative) {
  const items = [];
  const getValues = (values, key, type) => {
    if (!Array.isArray(values)) return;
    for (const item of values) {
      const value = typeof item === 'string' ? item : item?.[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const label = item?.label ? item.label + ': ' + value : value;
      items.push({
        label,
        value,
        type,
        href: type === 'email' ? 'mailto:' + value : 'tel:' + value,
        external: false,
      });
    }
  };

  getValues(representative.emails, 'email', 'email');
  getValues(representative.phones, 'phone', 'phone');

  const website = representative.webpage_url;
  if (typeof website === 'string' && /^https?:\/\//i.test(website)) {
    items.push({ label: 'Website', buttonLabel: 'Website', href: website, external: true });
  }

  for (const type of ['email', 'phone']) {
    const contacts = items.filter(item => item.type === type);
    contacts.forEach(contact => {
      const kindLabel = type === 'email' ? 'Email' : 'Call';
      contact.buttonLabel = contacts.length > 1 ? truncateContactValue(contact.value, type === 'email' ? 24 : 18) : kindLabel;
    });
  }

  return items;
}

function truncateContactValue(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength - 1) + '…' : value;
}

async function loadBoundaries() {
  const id = suggestion.value?.id;
  if (!id || boundariesLoading.value || boundariesLoaded.value) return;

  const requestVersion = ++boundariesRequestVersion;
  boundariesLoading.value = true;
  boundariesError.value = '';

  try {
    const result = await getSuggestionBoundaries(id);
    if (requestVersion === boundariesRequestVersion) {
      boundaries.value = result;
      boundariesLoaded.value = true;
    }
  } catch (error) {
    if (requestVersion === boundariesRequestVersion) {
      boundariesError.value = error.message || 'Unable to load boundaries.';
    }
  } finally {
    if (requestVersion === boundariesRequestVersion) {
      boundariesLoading.value = false;
    }
  }
}

async function loadRepresentatives() {
  const id = suggestion.value?.id;
  if (!id || representativesLoading.value || representativesLoaded.value) return;

  const requestVersion = ++representativesRequestVersion;
  representativesLoading.value = true;
  representativesError.value = '';

  try {
    const result = await getSuggestionRepresentatives(id);
    if (requestVersion === representativesRequestVersion) {
      representatives.value = result;
      representativesLoaded.value = true;
    }
  } catch (error) {
    if (requestVersion === representativesRequestVersion) {
      representativesError.value = error.message || 'Unable to load representatives.';
    }
  } finally {
    if (requestVersion === representativesRequestVersion) {
      representativesLoading.value = false;
    }
  }
}

function goBack() { workspace.closeTray(); }
async function copySuggestionLink() {
  if (!suggestion.value) return;
  clearTimeout(copyLinkTimeout);
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyLinkMessage.value = 'Link copied!';
  } catch {
    copyLinkMessage.value = 'Could not copy link';
  }
  copyLinkTimeout = setTimeout(() => { copyLinkMessage.value = ''; }, 2200);
}
async function refreshSuggestion() {
  const id = route.params.id;
  if (!id || isLoading.value) return;
  const requestVersion = ++suggestionRequestVersion;
  isLoading.value = true;
  isRefreshing.value = true;
  actionsRefreshVersion.value++;
  refreshError.value = '';
  workspace.setDetailLoading(true);
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  isRevealingDetails.value = false;
  try {
    const item = await getSuggestionById(id, true);
    if (requestVersion !== suggestionRequestVersion) return;
    suggestion.value = item;
    workspace.rememberSuggestion(item);
    setDetailMetadata(item);
    const layout = await prepareDetails(item);
    if (requestVersion !== suggestionRequestVersion) return;
    await Promise.all([layout.finished, workspace.transitionToDetailLocation(item.location, layout.trayTop, layout.animation)]);
    if (requestVersion !== suggestionRequestVersion) return;
    revealDetails(item);
  } catch (error) {
    if (requestVersion === suggestionRequestVersion) {
      refreshError.value = error.message || 'Unable to refresh this idea.';
    }
  } finally {
    if (requestVersion === suggestionRequestVersion) {
      isLoading.value = false;
      isRefreshing.value = false;
      workspace.setDetailLoading(false);
    }
  }
}
const dismissLightbox = () => {
  if (!lightboxUrl.value) return false;
  lightboxUrl.value = '';
  return true;
};
workspace.dismissDetail = dismissLightbox;
onBeforeUnmount(() => {
  clearTimeout(copyLinkTimeout);
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  if (workspace.dismissDetail === dismissLightbox) workspace.dismissDetail = null;
  workspace.cancelDetailTransition();
  workspace.setDetailLocation(null);
  workspace.setDetailLoading(false);
});
function setDetailMetadata(item) {
  workspace.setDetailLocation(
    item?.location || null,
    item?.content?.summary || item?.summary || '',
    item?.id || route.params.id,
    item?.creationDate || '',
    item?.emoji,
  );
}
function eraseDetails() {
  cancelDetailsErase?.();
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  outgoingDetails.value = displayedDetails.value;
  detailsCursor.value = Array.from(outgoingDetails.value).length + detailsFadeWidth;
  erasingDetails.value = true;
  isRevealingDetails.value = false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayedDetails.value = '';
    return Promise.resolve();
  }
  const characters = Array.from(outgoingDetails.value);
  return new Promise(resolve => {
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); cancelDetailsErase = null; resolve(); };
    cancelDetailsErase = finish;
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / 400);
      detailsCursor.value = (characters.length + detailsFadeWidth) * (1 - progress);
      displayedDetails.value = characters.slice(0, Math.ceil(detailsCursor.value)).join('');
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
  });
}
onBeforeUnmount(() => cancelDetailsErase?.());
let trayHeightAnimation = null;
onBeforeUnmount(() => trayHeightAnimation?.cancel());
async function prepareDetails(item) {
  const tray = detailTray.value?.element;
  const previousHeight = tray?.getBoundingClientRect().height;
  trayHeightAnimation?.cancel();
  // Reserve the incoming description's complete layout before framing the map.
  // The invisible suffix keeps that layout stable throughout the text reveal.
  outgoingDetails.value = item?.content?.details || 'No detailed description provided.';
  displayedDetails.value = '';
  erasingDetails.value = false;
  isRevealingDetails.value = false;
  await nextTick();
  workspace.fitDetailText();
  // Read the final, unanimated geometry before restoring the outgoing height.
  const bounds = tray?.isConnected ? tray.getBoundingClientRect() : null;
  const layout = { trayTop: bounds?.top, finished: Promise.resolve() };
  if (!bounds || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return layout;
  const height = bounds.height;
  if (Math.abs(height - previousHeight) < .5) return layout;
  const animation = tray.animate(
    [{ height: `${previousHeight}px`, maxHeight: 'none' }, { height: `${height}px`, maxHeight: 'none' }],
    { duration: detailMotionDuration, easing: 'cubic-bezier(.65, 0, .35, 1)' },
  );
  trayHeightAnimation = animation;
  layout.animation = animation;
  layout.finished = animation.finished.catch(() => {}).then(() => {
    if (trayHeightAnimation === animation) trayHeightAnimation = null;
  });
  return layout;
}
function revealDetails(item) {
  cancelDetailsErase?.();
  erasingDetails.value = false;
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  const text = item?.content?.details || 'No detailed description provided.';
  displayedDetails.value = '';
  detailsCursor.value = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !text.length) {
    displayedDetails.value = text;
    isRevealingDetails.value = false;
    return;
  }
  isRevealingDetails.value = true;
  const characters = Array.from(text);
  const started = performance.now();
  const reveal = now => {
    const progress = Math.min(1, (now - started) / 1000);
    detailsCursor.value = (characters.length + detailsFadeWidth) * progress;
    displayedDetails.value = characters.slice(0, Math.ceil(detailsCursor.value)).join('');
    if (progress >= 1) {
      displayedDetails.value = text;
      isRevealingDetails.value = false;
      detailsRevealFrame = 0;
    } else detailsRevealFrame = requestAnimationFrame(reveal);
  };
  detailsRevealFrame = requestAnimationFrame(reveal);
}
watch(() => route.params.id, async (id) => {
  actionsRefreshVersion.value++;
  const requestVersion = ++suggestionRequestVersion;
  refreshError.value = '';
  isRefreshing.value = false;
  const previousItem = suggestion.value;
  if (restoringSuggestion.value && String(restoringSuggestion.value.id) === String(id)) {
    const restored = restoringSuggestion.value;
    restoringSuggestion.value = null;
    workspace.setDetailLoading(true);
    suggestion.value = restored;
    setDetailMetadata(restored);
    const layout = await prepareDetails(restored);
    if (requestVersion !== suggestionRequestVersion) return;
    await Promise.all([layout.finished, workspace.transitionToDetailLocation(restored.location, layout.trayTop, layout.animation)]);
    if (requestVersion === suggestionRequestVersion) {
      isLoading.value = false;
      workspace.setDetailLoading(false);
      revealDetails(restored);
    }
    return;
  }
  const outgoingTextFinished = previousItem
    ? Promise.all([eraseDetails(), workspace.eraseDetailText()])
    : Promise.resolve();
  workspace.setDetailLoading(true);
  isLoading.value = true;
  workspace.setDetailMarkerTarget(id);
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  isRevealingDetails.value = false;
  representativesRequestVersion++;
  boundariesRequestVersion++;
  errorMessage.value = '';
  lightboxUrl.value = '';
  representatives.value = [];
  representativesLoading.value = false;
  representativesLoaded.value = false;
  representativesError.value = '';
  boundaries.value = [];
  boundariesLoading.value = false;
  boundariesLoaded.value = false;
  boundariesError.value = '';


  // On a direct marker click the detail tray is created by this route change.
  // Wait for it to enter the DOM before calculating the map's upper-half
  // target offset; chevron navigation already has the tray mounted.
  await nextTick();
  if (requestVersion !== suggestionRequestVersion) return;

  let mapTransition = null;

  if (!id) {
    errorMessage.value = 'Invalid idea link';
    isLoading.value = false;
    workspace.setDetailLoading(false);
    return;
  }

  try {
    const item = await getSuggestionById(id);
    if (requestVersion !== suggestionRequestVersion) return;
    await outgoingTextFinished;
    if (requestVersion !== suggestionRequestVersion) return;
    suggestion.value = item;
    workspace.rememberSuggestion(item);
    setDetailMetadata(item);
    const layout = await prepareDetails(item);
    if (requestVersion !== suggestionRequestVersion) return;
    mapTransition = workspace.transitionToDetailLocation(item.location, layout.trayTop, layout.animation);
    await Promise.all([layout.finished, mapTransition]);
    if (requestVersion === suggestionRequestVersion) {
      isLoading.value = false;
      workspace.setDetailLoading(false);
      revealDetails(item);
    }
  } catch (err) {
    if (requestVersion === suggestionRequestVersion) {
      console.error('Failed to load suggestion details:', err);
      await outgoingTextFinished;
      if (mapTransition) await mapTransition;
      if (previousItem && String(previousItem.id) !== String(id)) {
        restoringSuggestion.value = previousItem;
        await router.replace(`/suggestion/${encodeURIComponent(previousItem.id)}`);
      } else {
        errorMessage.value = 'This idea could not be loaded. It may be unavailable, or your connection may be interrupted.';
        isLoading.value = false;
        workspace.setDetailLoading(false);
      }
    }
  }
}, { immediate: true });
</script>
<style>
.detail-pills :first-child {
  margin-left: 0;
}
</style>