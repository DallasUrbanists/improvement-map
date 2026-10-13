<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
    <button
      v-for="(photo, index) in photos"
      :key="photo.id || index"
      type="button"
      @click="$emit('preview', index)"
      :aria-label="`Preview photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ''}`"
      class="relative rounded-lg overflow-hidden h-20 bg-zinc-800 border border-zinc-700 text-left"
    >
      <img :src="photo.dataUrl || photo.url" class="w-full h-full object-cover" alt="" />
      <span v-if="photo.caption" class="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white p-1 truncate">
        {{ photo.caption }}
      </span>
    </button>
  </div>
</template>

<script setup>
defineProps({ photos: { type: Array, default: () => [] } });
defineEmits(['preview']);
</script>
