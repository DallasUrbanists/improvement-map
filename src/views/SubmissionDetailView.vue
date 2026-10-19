<template>
  <MapTray class="submission-detail-tray" title="Submission details" :close-disabled="isLoading" :content-disabled="isLoading" @close="goBack">
    <template #header>
      <div class="detail-header-navigation">
        <button type="button" class="map-ui-button" aria-label="Previous idea" data-tooltip="Previous idea" :disabled="isLoading || !workspace.detailNavigation.value.olderId" @click="workspace.navigateDetail('older')">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <button type="button" class="map-ui-button" aria-label="Next idea" data-tooltip="Next idea" :disabled="isLoading || !workspace.detailNavigation.value.newerId" @click="workspace.navigateDetail('newer')">
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
      <div v-if="isLoading" class="detail-loading-message" role="status" aria-live="polite">{{ isRefreshing ? 'Refreshing submission, please wait...' : 'Loading next submission, please wait...' }}</div>
    </template>
    <template #header-actions>
      <div class="detail-copy-link-action" :data-tooltip="copyLinkMessage || 'Copy suggestion link'">
        <button type="button" class="map-ui-button detail-copy-link-button" aria-label="Copy suggestion link" :disabled="isLoading || !suggestion" @click="copySuggestionLink">
          <i class="fa-solid fa-link" aria-hidden="true"></i>
        </button>
        <span v-if="copyLinkMessage" class="detail-copy-link-status" role="status">{{ copyLinkMessage }}</span>
      </div>
      <button type="button" class="map-ui-button detail-refresh-button" aria-label="Refresh submission" :title="isLoading ? 'Refreshing submission…' : 'Refresh submission'" :disabled="isLoading || !suggestion" @click="refreshSuggestion">
        <i class="fa-solid fa-rotate" :class="{ 'fa-spin': isLoading }" aria-hidden="true"></i>
      </button>
    </template>
    <p v-if="refreshError" class="detail-refresh-error" role="alert">{{ refreshError }}</p>
    <div v-if="isLoading && !suggestion" class="detail-loading-content" aria-hidden="true">
      <div class="detail-loading-line detail-loading-line-wide"><span>Suggestion details are loading</span></div>
      <div class="detail-loading-section"><div class="detail-loading-line detail-loading-line-medium"><span>Photos</span></div><div class="detail-loading-photo"></div></div>
      <div class="detail-loading-section"><div class="detail-loading-line detail-loading-line-short"><span>Neighborhoods and districts</span></div></div>
      <div class="detail-loading-section"><div class="detail-loading-line detail-loading-line-short"><span>Representatives</span></div></div>
      <div class="detail-loading-section"><div class="detail-loading-line detail-loading-line-short"><span>Recommended actions</span></div></div>
    </div>

    <!-- Error state with Konsta Card & Button -->
    <k-card
      v-else-if="errorMessage"
      :outline="true"
      :content-wrap="false"
      class="text-center py-12 m-0"
    >
      <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3" aria-hidden="true"></i>
      <h2 class="text-xl font-bold mb-2">Suggestion Not Found</h2>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{{ errorMessage }}</p>
      <k-button
        component="router-link"
        to="/browse"
        :rounded="true"
        class="text-sm font-semibold"
      >
        Browse Other Suggestions
      </k-button>
    </k-card>

    <!-- Suggestion Details View with Konsta Card -->
    <div v-if="suggestion" class="detail-body-sections" :class="{ 'detail-content-obscured': isLoading }">
      <div
        :content-wrap="false"
        class="detail-body-sections"
      >

        <!-- Title and Subtitle -->
        <div class="detail-description text-sm whitespace-pre-wrap break-words px-4 py-2" :class="{ 'detail-description-revealing': isRevealingDetails }">
          <div class="detail-description-inner">
          <!-- Description Details -->
          <p>
            {{ displayedDetails }}
          </p>
          </div>
        </div>

        <details v-if="photosList.length" class="detail-accordion">
          <summary class="cursor-pointer px-4 py-3 font-bold">Photos ({{ photosList.length }})</summary>
          <div class="px-6 pb-6">
            <div class="review-photo-row">
              <button v-for="(photo, index) in photosList" :key="photo.id || index" type="button" class="review-photo-thumbnail" :aria-label="`Open photo ${index + 1}${photo.caption ? ': ' + photo.caption : ''}`" @click="previewPhoto(index)">
                <img :src="photo.dataUrl || photo.url" :alt="photo.caption || `Photo ${index + 1}`" />
                <span v-if="photo.caption" class="review-photo-caption">{{ photo.caption }}</span>
              </button>
            </div>
          </div>
        </details>

        <details @toggle="handleBoundariesToggle" class="detail-accordion">
          <summary class="cursor-pointer px-4 py-3 font-bold">Neighborhoods &amp; Districts</summary>
          <div class="w-full min-w-0 max-w-full overflow-x-auto pb-4">
            <div v-if="boundariesLoading" role="status" aria-live="polite" class="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              <k-preloader class="h-4 w-4" />
              <span>Loading boundaries…</span>
            </div>
            <div v-else-if="boundariesError" role="alert" class="space-y-3 px-4 py-3">
              <p class="text-sm text-red-600 dark:text-red-400">{{ boundariesError }}</p>
              <k-button :rounded="true" class="text-sm font-semibold" @click.stop="loadBoundaries">Retry</k-button>
            </div>
            <p v-else-if="boundariesLoaded && !boundaries.length" class="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No boundaries were found for this suggestion.
            </p>
            <k-block v-else-if="boundaries.length" class="w-full min-w-0 mt-0 !pl-safe !pr-safe">
              <k-table class="min-w-max">
                <k-table-head>
                  <k-table-row header>
                    <k-table-cell header class="h-7 px-4">Entity</k-table-cell>
                    <k-table-cell header class="h-7 px-4">Body</k-table-cell>
                    <k-table-cell header class="h-7 px-4">District</k-table-cell>
                    <k-table-cell header class="h-7 px-4">Description</k-table-cell>
                    <k-table-cell header class="h-7 px-4">When to Contact</k-table-cell>
                  </k-table-row>
                </k-table-head>
                <k-table-body>
                  <k-table-row v-for="boundary in boundaries" :key="boundary.id">
                    <k-table-cell class="whitespace-nowrap align-top py-2 first:px-4 px-4">{{ boundary.entityName || '—' }}</k-table-cell>
                    <k-table-cell class="whitespace-nowrap align-top py-2 px-4">{{ boundary.bodyName || '—' }}</k-table-cell>
                    <k-table-cell class="whitespace-nowrap align-top py-2 px-4">{{ boundary.districtName || '—' }}</k-table-cell>
                    <k-table-cell class="align-top py-2 px-4">{{ boundary.description || '—' }}</k-table-cell>
                    <k-table-cell class="align-top py-2 px-4">{{ boundary.whenToContact || '—' }}</k-table-cell>
                  </k-table-row>
                </k-table-body>
              </k-table>
            </k-block>
          </div>
        </details>

        <details @toggle="handleRepresentativesToggle" class="detail-accordion">
          <summary class="cursor-pointer px-4 py-3 font-bold">Representatives</summary>
          <div class="w-full min-w-0 max-w-full overflow-x-auto pb-4">
            <div v-if="representativesLoading" role="status" aria-live="polite" class="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              <k-preloader class="h-4 w-4" />
              <span>Loading representatives…</span>
            </div>
            <div v-else-if="representativesError" role="alert" class="space-y-3 px-4 py-3">
              <p class="text-sm text-red-600 dark:text-red-400">{{ representativesError }}</p>
              <k-button :rounded="true" class="text-sm font-semibold" @click.stop="loadRepresentatives">Retry</k-button>
            </div>
            <p v-else-if="representativesLoaded && !representatives.length" class="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No current representatives were found for this suggestion.
            </p>
            <k-block v-else-if="representatives.length" class="w-full min-w-0 mt-0 !pl-safe !pr-safe">
              <k-table class="min-w-max">
                <k-table-head>
                  <k-table-row header>
                    <k-table-cell header class="h-7 px-4">Jurisdiction</k-table-cell>
                    <k-table-cell header class="h-7 px-4">Official</k-table-cell>
                    <k-table-cell header class="h-7 px-4">Contact</k-table-cell>
                  </k-table-row>
                </k-table-head>
                <k-table-body>
                  <k-table-row v-for="representative in representatives" :key="representative.id">
                    <k-table-cell class="whitespace-nowrap align-top py-2 first:px-4 px-4">
                      {{ [representative.boundary?.entityName, representative.boundary?.bodyName, representative.boundary?.districtName].filter(Boolean).join(' · ') || 'Jurisdiction unavailable' }}
                    </k-table-cell>
                    <k-table-cell class="whitespace-nowrap align-top py-2 px-4">
                      <strong>{{ representative.name || 'Name unavailable' }}</strong>
                      <br v-if="representative.title" />
                      <span v-if="representative.title">{{ representative.title }}</span>
                    </k-table-cell>
                    <k-table-cell class="align-top py-2 px-4">
                      <div v-if="getRepresentativeContactItems(representative).length" class="space-y-1">
                        <div v-for="contact in getRepresentativeContactItems(representative)" :key="contact.href + contact.label">
                          <a
                            :href="contact.href"
                            :target="contact.external ? '_blank' : undefined"
                            :rel="contact.external ? 'noopener noreferrer' : undefined"
                            class="text-blue-700 underline dark:text-blue-300"
                          >{{ contact.label }}</a>
                        </div>
                      </div>
                      <span v-else class="text-zinc-500 dark:text-zinc-400">Contact information unavailable</span>
                    </k-table-cell>
                  </k-table-row>
                </k-table-body>
              </k-table>
            </k-block>
          </div>
        </details>

        <details @toggle="handleRecommendedActionsToggle" class="detail-accordion">
          <summary class="cursor-pointer px-4 py-3 font-bold">Recommended Actions</summary>
          <div class="px-4 pb-4">
            <div v-if="recommendedActionsLoading" role="status" aria-live="polite" class="flex items-center gap-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              <k-preloader class="h-4 w-4" />
              <span>Loading recommended actions…</span>
            </div>
            <div v-else-if="recommendedActionsError" role="alert" class="space-y-3 py-3">
              <p class="text-sm text-red-600 dark:text-red-400">{{ recommendedActionsError }}</p>
              <k-button :rounded="true" class="text-sm font-semibold" @click.stop="loadRecommendedActions">Retry</k-button>
            </div>
            <p v-else-if="recommendedActionsLoaded && !recommendedActions.length" class="py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No recommended actions are available for this suggestion.
            </p>
            <div v-else-if="recommendedActions.length" class="divide-y divide-zinc-200 dark:divide-zinc-700">
              <article v-for="action in recommendedActions" :key="action.id" class="space-y-2 py-4 first:pt-2 last:pb-1">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <h3 class="font-semibold text-zinc-900 dark:text-zinc-100">{{ action.summary }}</h3>
                  <span class="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {{ formatActionStatus(action.status) }}
                  </span>
                </div>
                <p v-if="action.instructions" class="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{{ action.instructions }}</p>
                <p v-if="action.reason" class="text-sm text-zinc-500 dark:text-zinc-400"><strong>Why:</strong> {{ action.reason }}</p>
                <p v-if="action.expirationDate" class="text-xs text-zinc-500 dark:text-zinc-400">
                  Expires {{ formatActionDate(action.expirationDate) }}
                </p>
              </article>
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- Image Lightbox Modal -->
    <Teleport to="body">    <div
      v-if="lightboxUrl"
      class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" aria-label="Photo preview"
      @click="lightboxUrl = ''"
    >
      <div class="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
        <button
          @click="lightboxUrl = ''"
          aria-label="Close photo preview"
          class="absolute -top-12 right-0 text-white text-2xl p-2 hover:text-zinc-300"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <img :src="lightboxUrl" class="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" alt="Full size" />
      </div>
    </div>
    </Teleport>
  </MapTray>
</template>

<script setup>
import { ref, shallowRef, computed, watch, inject, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kBlock, kButton, kCard, kNavbar, kNavbarBackLink, kPreloader, kTable, kTableBody, kTableCell, kTableHead, kTableRow } from 'konsta/vue';
import { getSuggestionById, getSuggestionRepresentatives, getSuggestionBoundaries, getSuggestionRecommendedActions } from '../services/api';
import MapTray from '../components/MapTray.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { applySubmissionShareMetadata } from '../services/submissionShareMetadata';

const route = useRoute();
const router = useRouter();
const workspace = inject(mapWorkspaceKey);

const suggestion = ref(null);
const isLoading = ref(true);
const isRefreshing = ref(false);
const displayedDetails = ref('');
const isRevealingDetails = ref(false);
const restoringSuggestion = shallowRef(null);
let detailsRevealFrame = 0;
const errorMessage = ref('');
const refreshError = ref('');
const copyLinkMessage = ref('');
let copyLinkTimeout = 0;
const lightboxUrl = ref('');
const representatives = ref([]);
const representativesLoading = ref(false);
const representativesLoaded = ref(false);
const representativesError = ref('');
let representativesRequestVersion = 0;
let suggestionRequestVersion = 0;
const boundaries = ref([]);
const boundariesLoading = ref(false);
const boundariesLoaded = ref(false);
const boundariesError = ref('');
let boundariesRequestVersion = 0;
const recommendedActions = ref([]);
const recommendedActionsLoading = ref(false);
const recommendedActionsLoaded = ref(false);
const recommendedActionsError = ref('');
let recommendedActionsRequestVersion = 0;

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

function previewPhoto(index) {
  const photo = photosList.value[index];
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
        href: type === 'email' ? 'mailto:' + value : 'tel:' + value,
        external: false,
      });
    }
  };

  getValues(representative.emails, 'email', 'email');
  getValues(representative.phones, 'phone', 'phone');

  const website = representative.webpage_url;
  if (typeof website === 'string' && /^https?:\/\//i.test(website)) {
    items.push({ label: 'Website', href: website, external: true });
  }

  return items;
}

function handleBoundariesToggle(event) {
  if (event.currentTarget.open) loadBoundaries();
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

function formatActionStatus(status) {
  if (!status) return 'Status unavailable';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatActionDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function handleRecommendedActionsToggle(event) {
  if (event.currentTarget.open) loadRecommendedActions();
}

async function loadRecommendedActions() {
  const id = suggestion.value?.id;
  if (!id || recommendedActionsLoading.value || recommendedActionsLoaded.value) return;

  const requestVersion = ++recommendedActionsRequestVersion;
  recommendedActionsLoading.value = true;
  recommendedActionsError.value = '';

  try {
    const result = await getSuggestionRecommendedActions(id);
    if (requestVersion === recommendedActionsRequestVersion) {
      recommendedActions.value = result;
      recommendedActionsLoaded.value = true;
    }
  } catch (error) {
    if (requestVersion === recommendedActionsRequestVersion) {
      recommendedActionsError.value = error.message || 'Unable to load recommended actions.';
    }
  } finally {
    if (requestVersion === recommendedActionsRequestVersion) {
      recommendedActionsLoading.value = false;
    }
  }
}

function handleRepresentativesToggle(event) {
  if (event.currentTarget.open) loadRepresentatives();
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
  refreshError.value = '';
  workspace.setDetailLoading(true);
  closeDetailAccordions();
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  isRevealingDetails.value = false;
  try {
    const item = await getSuggestionById(id, true);
    if (requestVersion !== suggestionRequestVersion) return;
    workspace.updateSuggestionMarker(item);
    suggestion.value = item;
    setDetailMetadata(item);
    await nextTick();
    await workspace.transitionToDetailLocation(item.location);
    if (requestVersion !== suggestionRequestVersion) return;
    revealDetails(item);
  } catch (error) {
    if (requestVersion === suggestionRequestVersion) {
      refreshError.value = error.message || 'Unable to refresh this submission.';
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
    item ? `${formattedDate.value} · ${item.author?.name || 'Anonymous Contributor'}` : '',
    item?.content?.summary || item?.summary || '',
    item?.id || route.params.id,
    item?.creationDate || '',
    item?.emoji,
  );
}
function revealDetails(item) {
  if (detailsRevealFrame) cancelAnimationFrame(detailsRevealFrame);
  const text = item?.content?.details || 'No detailed description provided.';
  displayedDetails.value = '';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !text.length) {
    displayedDetails.value = text;
    isRevealingDetails.value = false;
    return;
  }
  isRevealingDetails.value = true;
  const started = performance.now();
  const reveal = now => {
    const progress = Math.min(1, (now - started) / 1000);
    displayedDetails.value = text.slice(0, Math.max(1, Math.floor(text.length * progress)));
    if (progress >= 1) {
      displayedDetails.value = text;
      isRevealingDetails.value = false;
      detailsRevealFrame = 0;
    } else detailsRevealFrame = requestAnimationFrame(reveal);
  };
  detailsRevealFrame = requestAnimationFrame(reveal);
}
function closeDetailAccordions() {
  document.querySelectorAll('.submission-detail-tray details.detail-accordion[open]').forEach(details => { details.open = false; });
}

watch(() => route.params.id, async (id) => {
  const requestVersion = ++suggestionRequestVersion;
  refreshError.value = '';
  isRefreshing.value = false;
  const previousItem = suggestion.value;
  if (restoringSuggestion.value && String(restoringSuggestion.value.id) === String(id)) {
    const restored = restoringSuggestion.value;
    restoringSuggestion.value = null;
    workspace.setDetailLoading(true);
    closeDetailAccordions();
    suggestion.value = restored;
    setDetailMetadata(restored);
    await nextTick();
    await workspace.transitionToDetailLocation(restored.location);
    if (requestVersion === suggestionRequestVersion) {
      isLoading.value = false;
      workspace.setDetailLoading(false);
      revealDetails(restored);
    }
    return;
  }
  workspace.setDetailLoading(true);
  isLoading.value = true;
  workspace.setDetailMarkerTarget(id);
  closeDetailAccordions();
  const accordionsClosed = previousItem ? new Promise(resolve => setTimeout(resolve, 340)) : Promise.resolve();
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
  recommendedActionsRequestVersion++;
  recommendedActions.value = [];
  recommendedActionsLoading.value = false;
  recommendedActionsLoaded.value = false;
  recommendedActionsError.value = '';

  // On a direct marker click the detail tray is created by this route change.
  // Wait for it to enter the DOM before calculating the map's upper-half
  // target offset; chevron navigation already has the tray mounted.
  await nextTick();
  if (requestVersion !== suggestionRequestVersion) return;

  let mapTransition = null;
  const knownLocation = workspace.findSuggestionLocation(id);
  if (knownLocation) mapTransition = workspace.transitionToDetailLocation(knownLocation);

  if (!id) {
    errorMessage.value = 'Invalid suggestion ID';
    isLoading.value = false;
    workspace.setDetailLoading(false);
    return;
  }

  try {
    const item = await getSuggestionById(id);
    if (requestVersion !== suggestionRequestVersion) return;
    await accordionsClosed;
    if (requestVersion !== suggestionRequestVersion) return;
    suggestion.value = item;
    setDetailMetadata(item);
    await nextTick();
    if (!mapTransition) mapTransition = workspace.transitionToDetailLocation(item.location);
    await mapTransition;
    if (requestVersion === suggestionRequestVersion) {
      isLoading.value = false;
      workspace.setDetailLoading(false);
      revealDetails(item);
    }
  } catch (err) {
    if (requestVersion === suggestionRequestVersion) {
      console.error('Failed to load suggestion details:', err);
      await accordionsClosed;
      if (mapTransition) await mapTransition;
      if (previousItem && String(previousItem.id) !== String(id)) {
        restoringSuggestion.value = previousItem;
        await router.replace(`/suggestion/${encodeURIComponent(previousItem.id)}`);
      } else {
        errorMessage.value = err.message || 'Unable to retrieve suggestion';
        isLoading.value = false;
        workspace.setDetailLoading(false);
      }
    }
  }
}, { immediate: true });
</script>
