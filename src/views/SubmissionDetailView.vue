<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Back to browse / home -->
    <div class="mb-4">
      <button
        type="button"
        @click="goBack"
        class="inline-flex items-center gap-2 text-sm font-semibold text-st-blue hover:text-white dark:hover:text-white transition-colors touch-target"
      >
        <i class="fa-solid fa-arrow-left"></i>
        <span>Back</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="st-card animate-pulse p-8 space-y-4">
      <div class="h-8 bg-slate-800 rounded w-3/4"></div>
      <div class="h-4 bg-slate-800 rounded w-1/3"></div>
      <div class="h-64 bg-slate-800 rounded-xl"></div>
      <div class="h-20 bg-slate-800 rounded"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="errorMessage" class="st-card text-center py-12">
      <i class="fa-solid fa-triangle-exclamation text-3xl text-rose-400 mb-3"></i>
      <h2 class="text-xl font-bold mb-2">Suggestion Not Found</h2>
      <p class="text-sm text-slate-400 mb-6">{{ errorMessage }}</p>
      <router-link to="/browse" class="btn-st-primary text-sm">
        Browse Other Suggestions
      </router-link>
    </div>

    <!-- Suggestion Details View -->
    <div v-else-if="suggestion" class="space-y-6">
      <div class="st-card p-6 sm:p-8 space-y-6">
        <!-- Title and Category Badge -->
        <div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-st-yellow/20 text-st-yellow text-xs font-bold uppercase tracking-wider mb-3">
            <i class="fa-solid fa-lightbulb"></i>
            Civic Improvement Suggestion
          </div>

          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif leading-tight text-slate-100 dark:text-slate-100 light:text-st-navy">
            {{ suggestion.content?.summary || 'Civic Suggestion' }}
          </h1>

          <div class="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700/60">
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-user-circle text-st-yellow"></i>
              <span class="font-medium text-slate-200 dark:text-slate-200 light:text-st-navy">
                {{ suggestion.author?.name || 'Anonymous Contributor' }}
              </span>
            </div>
            <span>•</span>
            <div class="flex items-center gap-1.5">
              <i class="fa-solid fa-calendar"></i>
              <span>{{ formattedDate }}</span>
            </div>
          </div>
        </div>

        <!-- Description Details -->
        <div class="space-y-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-st-yellow">
            Description & Impact
          </h3>
          <p class="text-base text-slate-200 dark:text-slate-200 light:text-slate-800 whitespace-pre-wrap leading-relaxed">
            {{ suggestion.content?.details || 'No detailed description provided.' }}
          </p>
        </div>

        <!-- Location Information -->
        <div class="space-y-3 p-4 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300">
          <h3 class="text-xs font-bold uppercase tracking-wider text-st-yellow flex items-center gap-1.5">
            <i class="fa-solid fa-location-dot"></i>
            Location
          </h3>

          <div class="text-sm font-semibold text-slate-100 dark:text-slate-100 light:text-st-navy">
            {{ suggestion.location?.address || 'Dallas, TX' }}
          </div>

          <p v-if="suggestion.location?.description" class="text-xs text-slate-400">
            <span class="font-semibold text-slate-300">Location Notes:</span>
            {{ suggestion.location.description }}
          </p>

          <div v-if="suggestion.location?.latitude" class="flex items-center gap-4 text-xs text-slate-400 font-mono">
            <span>Coordinates: {{ Number(suggestion.location.latitude).toFixed(5) }}, {{ Number(suggestion.location.longitude).toFixed(5) }}</span>
            <a
              :href="`https://www.google.com/maps/search/?api=1&query=${suggestion.location.latitude},${suggestion.location.longitude}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-st-blue hover:text-st-yellow inline-flex items-center gap-1"
            >
              <span>Google Maps</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          </div>
        </div>

        <!-- Photos Section (up to 10 photos) -->
        <div v-if="photosList.length > 0" class="space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-st-yellow flex items-center gap-1.5">
            <i class="fa-solid fa-images"></i>
            Photos ({{ photosList.length }})
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              v-for="(photo, index) in photosList"
              :key="index"
              class="rounded-2xl overflow-hidden border border-slate-700 bg-slate-900 shadow-md group"
            >
              <div class="h-60 sm:h-72 w-full bg-slate-950 overflow-hidden relative">
                <img
                  :src="photo.url || photo.dataUrl"
                  :alt="photo.caption || 'Submission Photo'"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                  @click="openLightbox(photo.url || photo.dataUrl)"
                />
              </div>
              <div v-if="photo.caption" class="p-3 bg-slate-900/90 text-xs text-slate-300 border-t border-slate-800">
                <i class="fa-solid fa-quote-left text-st-yellow text-[10px] mr-1.5"></i>
                {{ photo.caption }}
              </div>
            </div>
          </div>
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
          class="absolute -top-12 right-0 text-white text-2xl p-2 hover:text-st-yellow"
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
import { getSuggestionById } from '../services/api';

const route = useRoute();
const router = useRouter();

const suggestion = ref(null);
const isLoading = ref(true);
const errorMessage = ref('');
const lightboxUrl = ref('');

const photosList = computed(() => {
  return suggestion.value?.content?.photos || suggestion.value?.photos || [];
});

const formattedDate = computed(() => {
  const dt = suggestion.value?.createdAt || suggestion.value?.timestamp;
  if (!dt) return 'Recently';
  try {
    return new Date(dt).toLocaleString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return 'Recently';
  }
});

function openLightbox(url) {
  lightboxUrl.value = url;
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
