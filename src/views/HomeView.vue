<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Hero Section using Konsta Card & Buttons -->
    <k-card
      :raised="true"
      :content-wrap="false"
      class="mb-8 p-6 sm:p-8 bg-gradient-to-br from-st-navy-900 to-st-navy text-white relative overflow-hidden border border-st-navy-700 m-0"
    >
      <div class="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-st-blue/10 pointer-events-none blur-2xl"></div>
      <div class="relative z-10 max-w-2xl">
        <k-badge class="mb-3 px-3 py-1 font-bold text-xs uppercase tracking-wider">
          <i class="fa-solid fa-bullhorn mr-1.5"></i>
          Dallas Urbanists Civic Action
        </k-badge>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif leading-tight text-white mb-3">
          Make Your Streets Safer & More Livable
        </h1>
        <p class="text-slate-200 text-sm sm:text-base leading-relaxed mb-6 font-sans">
          Spot a missing crosswalk, dangerous bike squeeze, or broken sidewalk? Submit on-the-ground civic improvement suggestions in seconds.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <router-link
            to="/submit"
            class="k-button k-button-material k-button-fill font-bold text-base px-6 py-3 rounded-full shadow-md inline-flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-plus-circle"></i>
            Submit Suggestion
          </router-link>

          <router-link
            to="/browse"
            class="k-button k-button-material k-button-outline font-semibold text-base px-6 py-3 rounded-full text-white border-white/40 hover:bg-white/10 inline-flex items-center justify-center gap-2"
          >
            <i class="fa-solid fa-map"></i>
            Explore Map & List
          </router-link>
        </div>
      </div>
    </k-card>

    <!-- Activity Log Header & Live Polling Status -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl sm:text-2xl font-bold font-serif">Recent Live Suggestions</h2>
          <!-- Live Polling Badge with Konsta Badge -->
          <k-badge
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            :class="isPolling ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'"
            title="Auto-refreshing every 30 seconds"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live (30s)
          </k-badge>
        </div>
        <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600 mt-0.5">
          Real-time activity log from pedestrian, bike, and transit advocates.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <k-button
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
        class="st-card animate-pulse flex flex-col sm:flex-row gap-4 p-4 m-0"
      >
        <div class="w-full sm:w-36 h-28 bg-slate-800 rounded-xl flex items-center justify-center">
          <k-preloader />
        </div>
        <div class="flex-1 space-y-2.5 py-1">
          <div class="h-5 bg-slate-800 rounded w-3/4"></div>
          <div class="h-4 bg-slate-800 rounded w-full"></div>
          <div class="h-4 bg-slate-800 rounded w-1/2"></div>
        </div>
      </k-card>
    </div>

    <!-- Error State -->
    <k-card
      v-else-if="errorMessage && suggestions.length === 0"
      :outline="true"
      :content-wrap="false"
      class="st-card text-center py-10 m-0"
    >
      <div class="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 text-xl">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="text-lg font-bold mb-1">Unable to Load Suggestions</h3>
      <p class="text-sm text-slate-400 mb-4">{{ errorMessage }}</p>
      <k-button
        @click="fetchSuggestions(true)"
        :rounded="true"
        inline
        class="text-sm font-semibold"
      >
        Retry Loading
      </k-button>
    </k-card>

    <!-- Empty State -->
    <k-card
      v-else-if="suggestions.length === 0"
      :outline="true"
      :content-wrap="false"
      class="st-card text-center py-12 m-0"
    >
      <div class="w-14 h-14 rounded-full bg-st-yellow/20 text-st-yellow flex items-center justify-center mx-auto mb-4 text-2xl">
        <i class="fa-solid fa-map-pin"></i>
      </div>
      <h3 class="text-lg font-bold mb-2">No suggestions logged yet</h3>
      <p class="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Be the first advocate in your neighborhood to submit an improvement idea!
      </p>
      <k-button
        component="router-link"
        to="/submit"
        :rounded="true"
        large
        inline
        class="font-bold"
      >
        <i class="fa-solid fa-plus-circle mr-2"></i>
        Add First Suggestion
      </k-button>
    </k-card>

    <!-- Live Suggestions List -->
    <div v-else class="space-y-4">
      <SubmissionCard
        v-for="item in recentSuggestions"
        :key="item.id"
        :suggestion="item"
      />
    </div>

    <!-- View All Link -->
    <div v-if="suggestions.length > 5" class="mt-8 text-center">
      <router-link
        to="/browse"
        class="inline-flex items-center gap-2 font-bold text-st-blue hover:text-st-yellow transition-colors touch-target"
      >
        View all {{ suggestions.length }} civic suggestions on map & list
        <i class="fa-solid fa-arrow-right"></i>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { kCard, kButton, kBadge, kPreloader } from 'konsta/vue';
import SubmissionCard from '../components/SubmissionCard.vue';
import { getSuggestions } from '../services/api';

const suggestions = ref([]);
const isLoading = ref(false);
const isPolling = ref(true);
const errorMessage = ref('');
let pollInterval = null;

const recentSuggestions = computed(() => {
  // Sort newest first
  return [...suggestions.value].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
});

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
  // Set up 30-second live polling
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
