<template>
  <div class="h-full min-h-0 overflow-x-hidden overflow-y-auto">
    <k-navbar
      v-if="suggestion"
      medium
      transparent
      :title="suggestion.content?.summary || 'Civic Suggestion'"
      title-class="max-w-[calc(100vw-7rem)] overflow-hidden text-ellipsis"
      title-medium-font-size-ios="text-2xl whitespace-normal break-words !h-auto py-2"
      title-medium-font-size-material="text-2xl whitespace-normal break-words !h-auto py-2"
    >
      <template #left>
        <k-navbar-back-link :show-text="false" @click="goBack" />
      </template>
    </k-navbar>

    <!-- Loading state with Konsta Card & Preloader -->
    <k-card
      v-else-if="isLoading"
      :outline="true"
      :content-wrap="false"
      class="animate-pulse p-8 space-y-4 m-0"
    >
      <div class="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 flex items-center px-4">
        <k-preloader class="w-5 h-5 mr-3" />
      </div>
      <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
      <div class="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      <div class="h-20 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
    </k-card>

    <!-- Error state with Konsta Card & Button -->
    <k-card
      v-else-if="errorMessage"
      :outline="true"
      :content-wrap="false"
      class="text-center py-12 m-0"
    >
      <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3"></i>
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
    <div v-if="suggestion" class="space-y-6">
      <div
        :content-wrap="false"
        class="space-y-6 m-0"
      >
        <LocationMapPreview :location="suggestion.location" class="mb-2" />

        <!-- Title and Subtitle -->
        <div class="flex flex-wrap items-center gap-2 sm:text-sm text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 px-4 py-2">
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-calendar"></i>
            <span>{{ formattedDate }}</span>
          </div>
          <span>•</span>
          <div class="flex items-center gap-1.5">
            <i class="fa-solid fa-user-circle"></i>
            <span class="font-medium text-black dark:text-white">
              {{ suggestion.author?.name || 'Anonymous Contributor' }}
            </span>
          </div>
          <!-- Description Details -->
          <p>
            {{ suggestion.content?.details || 'No detailed description provided.' }}
          </p>
        </div>

        <details v-if="photosList.length" open class="mx-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <summary class="cursor-pointer px-4 py-3 font-bold">Photos ({{ photosList.length }})</summary>
          <div class="space-y-3 px-4 pb-4">
            <k-segmented v-if="photosList.length > 1" raised rounded class="w-auto" aria-label="Photo display">
              <k-segmented-button small rounded :colors="photoDisplayButtonColors" :active="photoView === 'grid'" @click="photoView = 'grid'">Photo grid</k-segmented-button>
              <k-segmented-button small rounded :colors="photoDisplayButtonColors" :active="photoView === 'slides'" @click="photoView = 'slides'">Slides</k-segmented-button>
            </k-segmented>
            <PhotoGrid v-if="photosList.length > 1 && photoView === 'grid'" :photos="photosList" @preview="previewPhoto" />
            <PhotoSlider v-else v-model:active-index="activePhotoIndex" :photos="photosList" @preview="previewPhoto" />
          </div>
        </details>

        <details @toggle="handleBoundariesToggle" class="mx-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
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

        <details @toggle="handleRepresentativesToggle" class="mx-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
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

        <details @toggle="handleRecommendedActionsToggle" class="mx-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
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
    <div
      v-if="lightboxUrl"
      class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      @click="lightboxUrl = ''"
    >
      <div class="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
        <button
          @click="lightboxUrl = ''"
          class="absolute -top-12 right-0 text-white text-2xl p-2 hover:text-zinc-300"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
        <img :src="lightboxUrl" class="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" alt="Full size" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kBlock, kButton, kCard, kNavbar, kNavbarBackLink, kPreloader, kSegmented, kSegmentedButton, kTable, kTableBody, kTableCell, kTableHead, kTableRow } from 'konsta/vue';
import { getSuggestionById, getSuggestionRepresentatives, getSuggestionBoundaries, getSuggestionRecommendedActions } from '../services/api';
import LocationMapPreview from '../components/LocationMapPreview.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import PhotoSlider from '../components/PhotoSlider.vue';
import { applySubmissionShareMetadata } from '../services/submissionShareMetadata';

const route = useRoute();
const router = useRouter();

const suggestion = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const lightboxUrl = ref('');
const representatives = ref([]);
const representativesLoading = ref(false);
const representativesLoaded = ref(false);
const representativesError = ref('');
let representativesRequestVersion = 0;
let suggestionRequestVersion = 0;
const photoDisplayButtonColors = {
  clearBgIos: 'bg-ios-light-surface dark:bg-ios-dark-surface',
  clearBgMaterial: 'bg-md-light-surface-2 dark:bg-md-dark-surface-2',
};
const photoView = ref('grid');
const activePhotoIndex = ref(0);
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

function goBack() {
  if (window.history.length > 2) {
    router.back();
  } else {
    router.push('/browse');
  }
}

watch(() => route.params.id, async (id) => {
  const requestVersion = ++suggestionRequestVersion;
  representativesRequestVersion++;
  boundariesRequestVersion++;
  suggestion.value = null;
  isLoading.value = true;
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

  if (!id) {
    errorMessage.value = 'Invalid suggestion ID';
    isLoading.value = false;
    return;
  }

  try {
    const item = await getSuggestionById(id);
    if (requestVersion === suggestionRequestVersion) suggestion.value = item;
  } catch (err) {
    if (requestVersion === suggestionRequestVersion) {
      console.error('Failed to load suggestion details:', err);
      errorMessage.value = err.message || 'Unable to retrieve suggestion';
    }
  } finally {
    if (requestVersion === suggestionRequestVersion) isLoading.value = false;
  }
}, { immediate: true });
</script>
