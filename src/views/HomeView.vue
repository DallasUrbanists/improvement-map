<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Activity Log Header & Live Polling Status -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl sm:text-2xl font-bold font-serif">Recent Live Suggestions</h2>
          <!-- Live Polling Badge -->
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            :class="isPolling ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700 text-slate-300'"
            title="Auto-refreshing every 30 seconds"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live (30s)
          </span>
        </div>
        <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600 mt-0.5">
          Real-time activity log from pedestrian, bike, and transit advocates.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="fetchSuggestions(true)"
          :disabled="isLoading"
          class="btn-st-ghost text-xs gap-1.5 border border-slate-700 dark:border-slate-700 light:border-slate-300"
          title="Refresh activity now"
        >
          <i class="fa-solid fa-arrows-rotate" :class="{ 'animate-spin': isLoading }"></i>
          <span>{{ isLoading ? 'Checking...' : 'Refresh' }}</span>
        </button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading && suggestions.length === 0" class="space-y-4">
      <div v-for="n in 3" :key="n" class="st-card animate-pulse flex flex-col sm:flex-row gap-4 p-4">
        <div class="w-full sm:w-36 h-28 bg-slate-800 rounded-xl"></div>
        <div class="flex-1 space-y-2.5 py-1">
          <div class="h-5 bg-slate-800 rounded w-3/4"></div>
          <div class="h-4 bg-slate-800 rounded w-full"></div>
          <div class="h-4 bg-slate-800 rounded w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage && suggestions.length === 0" class="st-card text-center py-10">
      <div class="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 text-xl">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="text-lg font-bold mb-1">Unable to Load Suggestions</h3>
      <p class="text-sm text-slate-400 mb-4">{{ errorMessage }}</p>
      <button @click="fetchSuggestions(true)" class="btn-st-secondary text-sm">
        Retry Loading
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="suggestions.length === 0" class="st-card text-center py-12">
      <div class="w-14 h-14 rounded-full bg-st-yellow/20 text-st-yellow flex items-center justify-center mx-auto mb-4 text-2xl">
        <i class="fa-solid fa-map-pin"></i>
      </div>
      <h3 class="text-lg font-bold mb-2">No suggestions logged yet</h3>
      <p class="text-sm text-slate-400 max-w-md mx-auto mb-6">
        Be the first advocate in your neighborhood to submit an improvement idea!
      </p>
      <router-link to="/submit" class="btn-st-primary">
        <i class="fa-solid fa-plus-circle mr-2"></i>
        Add First Suggestion
      </router-link>
    </div>

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
