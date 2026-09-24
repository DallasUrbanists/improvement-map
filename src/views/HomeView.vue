<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Hero Section -->
    <k-card :outline="true" class="p-6 sm:p-8 m-0">
      <h1 class="text-3xl sm:text-4xl font-bold mb-3">
        Make Your Streets Safer & More Livable
      </h1>
      <p class="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 mb-6">
        Spot a missing crosswalk, dangerous bike squeeze, or broken sidewalk? Submit on-the-ground civic improvement suggestions in seconds.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <k-button
          component="router-link"
          to="/submit"
          :rounded="true"
          large
          class="font-bold px-6"
        >
          <i class="fa-solid fa-plus-circle mr-2"></i>
          <span>Submit Suggestion</span>
        </k-button>

        <k-button
          component="router-link"
          to="/browse"
          :outline="true"
          :rounded="true"
          large
          class="font-bold px-6"
        >
          <i class="fa-solid fa-map mr-2"></i>
          <span>Explore Map & List</span>
        </k-button>
      </div>
    </k-card>

    <!-- Activity Log Header & Live Polling Status -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl sm:text-2xl font-bold">Recent Suggestions</h2>
          <k-badge class="text-xs font-semibold px-2.5 py-0.5">
            Live (30s)
          </k-badge>
        </div>
        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Real-time activity log from pedestrian, bike, and transit advocates.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <k-button
          type="button"
          @click="fetchSuggestions(true)"
          :disabled="isLoading"
          :outline="true"
          :rounded="true"
          small
          class="text-xs font-medium"
          title="Refresh activity now"
        >
          <i class="fa-solid fa-arrows-rotate mr-1.5" :class="{ 'animate-spin': isLoading }"></i>
          <span>{{ isLoading ? 'Checking...' : 'Refresh' }}</span>
        </k-button>
      </div>
    </div>

    <!-- Loading Skeleton with Konsta Card & Preloader -->
    <div v-if="isLoading && suggestions.length === 0" class="space-y-4">
      <k-card
        v-for="n in 3"
        :key="n"
        :outline="true"
        :content-wrap="false"
        class="animate-pulse flex flex-col sm:flex-row gap-4 p-4 m-0"
      >
        <div class="w-full sm:w-36 h-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
          <k-preloader />
        </div>
        <div class="flex-1 space-y-2.5 py-1">
          <div class="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
          <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
          <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
        </div>
      </k-card>
    </div>

    <!-- Error State -->
    <k-card
      v-else-if="errorMessage && suggestions.length === 0"
      :outline="true"
      class="text-center py-10 m-0"
    >
      <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3 text-xl">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="text-lg font-bold mb-1">Unable to Load Suggestions</h3>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{{ errorMessage }}</p>
      <k-button
        type="button"
        @click="fetchSuggestions(true)"
        :rounded="true"
        class="text-sm font-semibold"
      >
        Retry Loading
      </k-button>
    </k-card>

    <!-- Empty State -->
    <k-card
      v-else-if="suggestions.length === 0"
      :outline="true"
      class="text-center py-12 m-0"
    >
      <div class="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-4 text-2xl">
        <i class="fa-solid fa-map-pin"></i>
      </div>
      <h3 class="text-lg font-bold mb-2">No suggestions logged yet</h3>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
        Be the first advocate in your neighborhood to submit an improvement idea!
      </p>
      <k-button
        component="router-link"
        to="/submit"
        :rounded="true"
        large
        class="font-bold"
      >
        <i class="fa-solid fa-plus-circle mr-2"></i>
        Add First Suggestion
      </k-button>
    </k-card>

    <!-- Live Suggestions List using Konsta Cards -->
    <div v-else class="space-y-4">
      <k-card
        v-for="item in recentSuggestions"
        :key="item.id"
        :outline="true"
        :content-wrap="false"
        class="group flex flex-col sm:flex-row gap-4 p-4 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden m-0"
        @click="$router.push(`/suggestion/${item.id}`)"
      >
        <!-- Photo Thumbnail or Icon Placeholder -->
        <div class="w-full sm:w-36 h-40 sm:h-28 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 relative border border-zinc-200 dark:border-zinc-700">
          <img
            v-if="hasPhoto(item)"
            :src="getPhotoUrl(item)"
            :alt="item.content?.summary || 'Suggestion Photo'"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900">
            <i class="fa-solid fa-camera text-2xl mb-1 text-zinc-400"></i>
            <span class="text-[11px] font-medium uppercase tracking-wider">No Photo</span>
          </div>

          <!-- Distance Badge if computed -->
          <k-badge
            v-if="item._formattedDistance"
            class="absolute top-2 left-2 text-xs font-bold"
          >
            <i class="fa-solid fa-location-arrow text-[10px] mr-1"></i>
            {{ item._formattedDistance }}
          </k-badge>
        </div>

        <!-- Content Details -->
        <div class="flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-base sm:text-lg font-bold line-clamp-2 leading-snug">
                {{ item.content?.summary || 'Civic Improvement Suggestion' }}
              </h3>
            </div>

            <p v-if="item.content?.details" class="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 mb-2">
              {{ item.content?.details }}
            </p>

            <!-- Location address snippet -->
            <div v-if="getLocationText(item)" class="flex items-center text-xs text-zinc-500 dark:text-zinc-400 mb-2 truncate">
              <i class="fa-solid fa-location-dot mr-1.5 flex-shrink-0"></i>
              <span class="truncate">{{ getLocationText(item) }}</span>
            </div>
          </div>

          <!-- Bottom Metadata & Link -->
          <div class="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
            <div class="flex items-center gap-2 truncate">
              <span class="font-medium truncate">
                <i class="fa-solid fa-user-circle mr-1"></i>
                {{ item.author?.name || 'Anonymous' }}
              </span>
              <span>•</span>
              <span>{{ formatDate(item.createdAt || item.timestamp) }}</span>
            </div>

            <k-link
              component="router-link"
              :link-props="{ to: `/suggestion/${item.id}` }"
              class="inline-flex items-center gap-1 font-bold flex-shrink-0 ml-2"
              @click.stop
            >
              <span>View suggestion</span>
              <i class="fa-solid fa-arrow-right text-[11px]"></i>
            </k-link>
          </div>
        </div>
      </k-card>
    </div>

    <!-- View All Link -->
    <div v-if="suggestions.length > 5" class="mt-8 text-center">
      <k-button
        component="router-link"
        to="/browse"
        :clear="true"
        class="font-bold"
      >
        <span>View all {{ suggestions.length }} civic suggestions on map & list</span>
        <i class="fa-solid fa-arrow-right ml-2"></i>
      </k-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { kCard, kButton, kBadge, kPreloader, kLink } from 'konsta/vue';
import { getSuggestions } from '../services/api';

const suggestions = ref([]);
const isLoading = ref(false);
const errorMessage = ref('');
let pollInterval = null;

const recentSuggestions = computed(() => {
  return [...suggestions.value].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
});

function hasPhoto(item) {
  const photos = item.content?.photos || item.photos || [];
  return photos.length > 0 && Boolean(photos[0]?.url || photos[0]?.dataUrl);
}

function getPhotoUrl(item) {
  const photos = item.content?.photos || item.photos || [];
  return photos[0]?.url || photos[0]?.dataUrl || '';
}

function getLocationText(item) {
  const loc = item.location;
  if (!loc) return '';
  if (loc.address) return loc.address;
  if (loc.description) return loc.description;
  if (loc.latitude && loc.longitude) {
    return `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`;
  }
  return '';
}

function formatDate(isoStr) {
  if (!isoStr) return 'Recently';
  try {
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

async function fetchSuggestions(force = false) {
  if (isLoading.value && !force) return;
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const data = await getSuggestions(force);
    suggestions.value = data;
  } catch (err) {
    console.error('Failed to fetch suggestions:', err);
    errorMessage.value = err.message || 'Error loading live suggestions';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchSuggestions(false);
  pollInterval = setInterval(() => {
    fetchSuggestions(true);
  }, 30000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
</script>
