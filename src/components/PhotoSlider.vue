<template>
  <div class="space-y-2">
    <div
      ref="photoViewer"
      data-testid="photo-swipe-viewer"
      class="hide-scrollbar flex min-h-0 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
      :class="edgeToEdge ? '-mx-6 w-[calc(100%+3rem)] px-6' : 'w-full'"
      :style="{ ...viewerStyle, scrollPaddingInline: edgeToEdge ? '1.5rem' : '0' }"
      aria-label="Photos; swipe horizontally to browse"
      @scroll.passive="updateActivePhotoIndex"
    >
      <div
        v-for="(photo, index) in photos"
        :key="photo.id || index"
        class="relative flex h-full w-full flex-none snap-start flex-col"
      >
        <div class="relative min-h-0 w-full flex-grow overflow-hidden rounded-t-lg border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
          <img
            :src="photo.dataUrl || photo.url"
            :alt="photo.caption || `Photo ${index + 1}`"
            class="h-full w-full object-contain"
            :class="{ 'cursor-pointer': !editable }"
            @click="!editable && $emit('preview', index)"
          />
          <button
            v-if="editable"
            type="button"
            @click="$emit('remove', index)"
            class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-500 active:scale-90"
            :aria-label="`Remove photo ${index + 1}`"
          >
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
        <input
          v-if="editable"
          type="text"
          :value="photo.caption"
          @input="$emit('caption-change', index, $event.target.value)"
          placeholder="Add photo caption (optional)..."
          :aria-label="`Caption for photo ${index + 1}`"
          class="w-full flex-shrink-0 rounded-b-lg rounded-t-none border border-t-0 border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-black placeholder-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        <p v-else-if="photo.caption" class="shrink-0 rounded-b-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
          {{ photo.caption }}
        </p>
      </div>
    </div>
    <div v-if="photos.length > 1" class="flex items-center justify-center gap-3 text-xs text-zinc-500" aria-label="Photo navigation">
      <button type="button" @click="scrollToPhoto(activeIndex - 1)" :disabled="activeIndex === 0" aria-label="Previous photo" class="px-1 py-1 text-zinc-700 disabled:opacity-40 dark:text-zinc-200">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <div class="flex items-center justify-center gap-2">
        <button
          v-for="(_, index) in photos"
          :key="index"
          type="button"
          @click="scrollToPhoto(index)"
          :aria-label="`Show photo ${index + 1}`"
          :aria-current="activeIndex === index ? 'true' : undefined"
          class="h-2 w-2 rounded-full transition-colors"
          :class="activeIndex === index ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'"
        ></button>
        <span class="ml-1">{{ activeIndex + 1 }} / {{ photos.length }}</span>
      </div>
      <button type="button" @click="scrollToPhoto(activeIndex + 1)" :disabled="activeIndex === photos.length - 1" aria-label="Next photo" class="px-1 py-1 text-zinc-700 disabled:opacity-40 dark:text-zinc-200">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const props = defineProps({
  photos: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  edgeToEdge: { type: Boolean, default: false },
  activeIndex: { type: Number, default: 0 },
});
const emit = defineEmits(['update:activeIndex', 'remove', 'caption-change', 'preview']);
const photoViewer = ref(null);
const viewerStyle = {
  height: 'min(50vh, 28rem)',
  maxHeight: 'calc(100dvh - 17rem)',
};

function photoScrollAdvance(viewer) {
  const firstSlide = viewer.firstElementChild;
  if (!firstSlide) return viewer.clientWidth;
  const gap = Number.parseFloat(window.getComputedStyle(viewer).columnGap) || 0;
  return firstSlide.getBoundingClientRect().width + gap;
}

function updateActivePhotoIndex() {
  const viewer = photoViewer.value;
  if (!viewer || viewer.clientWidth === 0) return;
  emit('update:activeIndex', Math.max(0, Math.min(
    props.photos.length - 1,
    Math.round(viewer.scrollLeft / photoScrollAdvance(viewer)),
  )));
}

function scrollToPhoto(index, behavior = 'smooth') {
  const viewer = photoViewer.value;
  if (!viewer) return;
  const targetIndex = Math.max(0, Math.min(index, props.photos.length - 1));
  viewer.scrollTo({ left: targetIndex * photoScrollAdvance(viewer), behavior });
}

onMounted(() => scrollToPhoto(props.activeIndex, 'auto'));

defineExpose({ scrollToPhoto });
</script>
