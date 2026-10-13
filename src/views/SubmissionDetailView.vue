<template>
  <div class="h-full min-h-0 overflow-y-auto">
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

        <div v-if="photosList.length" class="space-y-3 px-4 pb-4">
          <k-segmented v-if="photosList.length > 1" raised rounded class="w-auto" aria-label="Photo display">
            <k-segmented-button small rounded :colors="photoDisplayButtonColors" :active="photoView === 'grid'" @click="photoView = 'grid'">Photo grid</k-segmented-button>
            <k-segmented-button small rounded :colors="photoDisplayButtonColors" :active="photoView === 'slides'" @click="photoView = 'slides'">Slides</k-segmented-button>
          </k-segmented>
          <PhotoGrid v-if="photosList.length > 1 && photoView === 'grid'" :photos="photosList" @preview="previewPhoto" />
          <PhotoSlider v-else v-model:active-index="activePhotoIndex" :photos="photosList" @preview="previewPhoto" />
        </div>
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
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kButton, kCard, kNavbar, kNavbarBackLink, kPreloader, kSegmented, kSegmentedButton } from 'konsta/vue';
import { getSuggestionById } from '../services/api';
import LocationMapPreview from '../components/LocationMapPreview.vue';
import PhotoGrid from '../components/PhotoGrid.vue';
import PhotoSlider from '../components/PhotoSlider.vue';

const route = useRoute();
const router = useRouter();

const suggestion = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const lightboxUrl = ref('');
const photoDisplayButtonColors = {
  clearBgIos: 'bg-ios-light-surface dark:bg-ios-dark-surface',
  clearBgMaterial: 'bg-md-light-surface-2 dark:bg-md-dark-surface-2',
};
const photoView = ref('grid');
const activePhotoIndex = ref(0);

const photosList = computed(() => {
  return suggestion.value?.content?.photos || suggestion.value?.photos || [];
});

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

function goBack() {
  if (window.history.length > 2) {
    router.back();
  } else {
    router.push('/browse');
  }
}

onMounted(async () => {
  const id = route.params.id;
  if (!id) {
    errorMessage.value = 'Invalid suggestion ID';
    isLoading.value = false;
    return;
  }

  try {
    suggestion.value = await getSuggestionById(id);
  } catch (err) {
    console.error('Failed to load suggestion details:', err);
    errorMessage.value = err.message || 'Unable to retrieve suggestion';
  } finally {
    isLoading.value = false;
  }
});
</script>
