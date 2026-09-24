<template>
  <k-card
    :outline="true"
    :content-wrap="false"
    class="st-card group flex flex-col sm:flex-row gap-4 p-4 hover:border-st-yellow/70 transition-all duration-200 cursor-pointer relative overflow-hidden m-0"
    @click="goToDetail"
  >
    <!-- Photo Thumbnail or Icon Placeholder -->
    <div class="w-full sm:w-36 h-40 sm:h-28 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 relative border border-slate-700/60">
      <img
        v-if="hasPhoto"
        :src="primaryPhotoUrl"
        :alt="suggestion.content?.summary || 'Suggestion Photo'"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
        @error="imageError = true"
      />
      <div v-else class="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-900/60">
        <i class="fa-solid fa-camera text-2xl mb-1 text-slate-500"></i>
        <span class="text-[11px] font-medium uppercase tracking-wider">No Photo</span>
      </div>

      <!-- Distance Badge if computed -->
      <k-badge
        v-if="suggestion._formattedDistance"
        class="absolute top-2 left-2 text-xs font-bold"
      >
        <i class="fa-solid fa-location-arrow text-[10px] mr-1"></i>
        {{ suggestion._formattedDistance }}
      </k-badge>
    </div>

    <!-- Content Details -->
    <div class="flex-1 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <h3 class="text-base sm:text-lg font-bold font-sans line-clamp-2 leading-snug group-hover:text-st-yellow transition-colors">
            {{ suggestion.content?.summary || 'Civic Improvement Suggestion' }}
          </h3>
        </div>

        <p v-if="suggestion.content?.details" class="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600 line-clamp-2 mb-2">
          {{ suggestion.content?.details }}
        </p>

        <!-- Location address snippet -->
        <div v-if="locationText" class="flex items-center text-xs text-slate-400 dark:text-slate-400 light:text-slate-600 mb-2 truncate">
          <i class="fa-solid fa-location-dot text-st-yellow mr-1.5 flex-shrink-0"></i>
          <span class="truncate">{{ locationText }}</span>
        </div>
      </div>

      <!-- Bottom Metadata & Link -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-700/50 dark:border-slate-800 light:border-slate-200 text-xs text-slate-400">
        <div class="flex items-center gap-2 truncate">
          <span class="font-medium text-slate-300 dark:text-slate-300 light:text-slate-700 truncate">
            <i class="fa-solid fa-user-circle mr-1"></i>
            {{ suggestion.author?.name || 'Anonymous' }}
          </span>
          <span>•</span>
          <span>{{ formattedDate }}</span>
        </div>

        <k-link
          component="router-link"
          :link-props="{ to: `/suggestion/${suggestion.id}` }"
          class="inline-flex items-center gap-1 font-bold text-st-yellow group-hover:underline flex-shrink-0 ml-2 touch-target"
          @click.stop
        >
          View
          <i class="fa-solid fa-arrow-right text-[11px] group-hover:translate-x-1 transition-transform"></i>
        </k-link>
      </div>
    </div>
  </k-card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { kCard, kBadge, kLink } from 'konsta/vue';

const props = defineProps({
  suggestion: {
    type: Object,
    required: true
  }
});

const router = useRouter();
const imageError = ref(false);

const photosList = computed(() => {
  return props.suggestion.content?.photos || props.suggestion.photos || [];
});

const hasPhoto = computed(() => {
  return !imageError.value && photosList.value.length > 0 && !!photosList.value[0]?.url;
});

const primaryPhotoUrl = computed(() => {
  if (photosList.value.length > 0) {
    return photosList.value[0].url;
  }
  return '';
});

const locationText = computed(() => {
  const loc = props.suggestion.location;
  if (!loc) return '';
  if (loc.address) return loc.address;
  if (loc.description) return loc.description;
  if (loc.latitude && loc.longitude) {
    return `${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`;
  }
  return '';
});

const formattedDate = computed(() => {
  const dt = props.suggestion.createdAt || props.suggestion.timestamp;
  if (!dt) return 'Recently';
  try {
    const d = new Date(dt);
    const now = new Date();
    const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
});

function goToDetail() {
  router.push(`/suggestion/${props.suggestion.id}`);
}
</script>
