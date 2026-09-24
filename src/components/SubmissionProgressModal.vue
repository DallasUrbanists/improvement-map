<template>
  <div
    class="fixed inset-0 z-50 bg-st-navy/95 backdrop-blur-lg flex flex-col items-center justify-center p-4 text-center animate-in fade-in select-none"
  >
    <k-card
      :raised="true"
      :content-wrap="false"
      class="max-w-md w-full p-6 sm:p-8 bg-dark-card border border-slate-700 shadow-2xl flex flex-col items-center"
    >
      <!-- Status Icon -->
      <div class="mb-6">
        <!-- Submitting Spinner with Konsta Preloader -->
        <div v-if="status === 'submitting'" class="relative flex items-center justify-center w-20 h-20">
          <k-preloader class="w-16 h-16 k-color-brand-primary" />
        </div>

        <!-- Success Big Green Checkmark -->
        <div
          v-else-if="status === 'success'"
          class="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400 flex items-center justify-center text-4xl animate-in zoom-in-50 duration-300 shadow-lg shadow-emerald-500/10"
        >
          <i class="fa-solid fa-check"></i>
        </div>

        <!-- Failed Yellow Warning Icon -->
        <div
          v-else-if="status === 'failed'"
          class="w-20 h-20 rounded-full bg-amber-500/20 text-st-yellow border-2 border-st-yellow flex items-center justify-center text-4xl animate-in zoom-in-50 duration-300 shadow-lg shadow-amber-500/10"
        >
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
      </div>

      <!-- Status Title -->
      <h2 class="text-2xl font-bold font-serif mb-2 text-white">
        {{ titleText }}
      </h2>

      <!-- Dynamic Progress Description Text -->
      <p class="text-sm text-slate-300 mb-6 px-2 min-h-[40px] flex items-center justify-center">
        {{ dynamicMessage }}
      </p>

      <!-- Progress Bar (while submitting or completed) with Konsta Progressbar -->
      <div v-if="status === 'submitting' || status === 'success'" class="w-full mb-6">
        <k-progressbar
          :progress="progressPercent / 100"
          class="w-full h-3 rounded-full overflow-hidden"
        />
      </div>

      <!-- Action Buttons with Konsta Button -->
      <div class="w-full flex flex-col gap-3">
        <!-- View Suggestion Button (Success) -->
        <k-button
          v-if="status === 'success'"
          type="button"
          large
          :rounded="true"
          @click="onViewSuggestion"
          class="w-full font-bold shadow-lg"
        >
          <i class="fa-solid fa-eye mr-2"></i>
          View suggestion
        </k-button>

        <!-- Go to Home Button (Failure) -->
        <k-button
          v-if="status === 'failed'"
          type="button"
          large
          :rounded="true"
          @click="onGoHome"
          class="w-full font-bold shadow-lg"
        >
          <i class="fa-solid fa-house mr-2"></i>
          Go to home
        </k-button>

        <!-- Retry Button (Optional fallback for failure) -->
        <k-button
          v-if="status === 'failed'"
          type="button"
          :outline="true"
          :rounded="true"
          @click="$emit('retry')"
          class="w-full text-sm"
        >
          <i class="fa-solid fa-rotate-right mr-2"></i>
          Try Again
        </k-button>
      </div>
    </k-card>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import { kCard, kProgressbar, kPreloader, kButton } from 'konsta/vue';

const props = defineProps({
  status: {
    type: String, // 'submitting' | 'success' | 'failed'
    default: 'submitting'
  },
  progressPercent: {
    type: Number,
    default: 0
  },
  dynamicMessage: {
    type: String,
    default: 'Preparing submission...'
  },
  createdSuggestionId: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['viewSuggestion', 'goHome', 'retry']);

const titleText = computed(() => {
  if (props.status === 'success') return 'Submission complete!';
  if (props.status === 'failed') return 'Submission failed';
  return 'Submitting Suggestion';
});

function handleBeforeUnload(e) {
  if (props.status === 'submitting') {
    e.preventDefault();
    e.returnValue = 'Submission is currently in progress. Leaving this page will cancel your upload.';
    return e.returnValue;
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

function onViewSuggestion() {
  emit('viewSuggestion', props.createdSuggestionId);
}

function onGoHome() {
  emit('goHome');
}
</script>
