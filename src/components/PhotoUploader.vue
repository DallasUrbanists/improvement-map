<template>
  <div class="space-y-4">
    <!-- Action Bar: Upload Button & Camera Button -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- File Upload Input Trigger -->
      <label
        class="touch-target btn-st-primary text-sm gap-2 cursor-pointer shadow"
        :class="{ 'opacity-50 pointer-events-none': photos.length >= maxPhotos || isProcessing }"
      >
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>Upload Photos</span>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          :disabled="photos.length >= maxPhotos || isProcessing"
          @change="handleFilesSelected"
        />
      </label>

      <!-- Camera Capture Trigger -->
      <label
        class="touch-target btn-st-outline text-sm gap-2 cursor-pointer shadow"
        :class="{ 'opacity-50 pointer-events-none': photos.length >= maxPhotos || isProcessing }"
      >
        <i class="fa-solid fa-camera text-st-yellow"></i>
        <span>Take Photo</span>
        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          :disabled="photos.length >= maxPhotos || isProcessing"
          @change="handleFilesSelected"
        />
      </label>

      <!-- Photos Counter Badge -->
      <span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
        {{ photos.length }} / {{ maxPhotos }} Photos
      </span>
    </div>

    <!-- Processing Indicator -->
    <div v-if="isProcessing" class="p-3 rounded-xl bg-st-blue/20 border border-st-blue/40 text-st-blue text-xs flex items-center gap-2">
      <i class="fa-solid fa-spinner animate-spin"></i>
      <span>Compressing & optimizing image(s) to WebP format...</span>
    </div>

    <!-- Error Alert -->
    <div v-if="uploadError" class="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>{{ uploadError }}</span>
      </div>
      <button @click="uploadError = ''" class="text-rose-300 hover:text-white">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-if="photos.length === 0"
      class="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center text-slate-400 bg-slate-900/30"
    >
      <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-xl text-slate-400">
        <i class="fa-solid fa-images"></i>
      </div>
      <p class="text-sm font-semibold text-slate-300 mb-1">No photos added yet (optional)</p>
      <p class="text-xs text-slate-500 max-w-sm mx-auto">
        Adding photos of street conditions, bike lanes, or crosswalks helps local planners understand your idea.
      </p>
    </div>

    <!-- Photos Grid (Up to 10 photos) -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(photo, index) in photos"
        :key="photo.id || index"
        class="st-card p-3 bg-slate-900/80 border border-slate-700/80 rounded-2xl flex flex-col gap-2 relative group"
      >
        <!-- Photo Preview and Delete Action -->
        <div class="relative w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
          <img
            :src="photo.dataUrl || photo.url"
            :alt="photo.caption || 'Photo'"
            class="w-full h-full object-cover"
          />

          <!-- Photo Index Number -->
          <div class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-black/70 text-white backdrop-blur-sm">
            #{{ index + 1 }}
          </div>

          <!-- Delete Photo Button -->
          <button
            type="button"
            @click="removePhoto(index)"
            class="touch-target absolute top-2 right-2 w-8 h-8 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition active:scale-90"
            title="Remove Photo"
            aria-label="Remove Photo"
          >
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>

        <!-- Photo Caption Input -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-400 mb-1">
            Caption (optional)
          </label>
          <input
            type="text"
            v-model="photo.caption"
            @input="updateCaption(index, photo.caption)"
            placeholder="e.g., Blocked bike lane curb at rush hour"
            class="st-input py-2 text-xs"
            maxlength="140"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { resizeImage } from '../services/image';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  maxPhotos: {
    type: Number,
    default: 10
  }
});

const emit = defineEmits(['update:modelValue']);

const photos = ref([...props.modelValue]);
const isProcessing = ref(false);
const uploadError = ref('');
const fileInput = ref(null);
const cameraInput = ref(null);

async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  uploadError.value = '';
  const remainingSlots = props.maxPhotos - photos.value.length;

  if (remainingSlots <= 0) {
    uploadError.value = `Maximum limit of ${props.maxPhotos} photos reached.`;
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  isProcessing.value = true;

  try {
    for (const file of filesToProcess) {
      const resized = await resizeImage(file, 1920, 1080, 0.82);
      photos.value.push({
        id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        dataUrl: resized.dataUrl,
        blob: resized.blob,
        name: resized.name,
        width: resized.width,
        height: resized.height,
        sizeKb: Math.round(resized.blob.size / 1024),
        caption: '',
        timestamp: new Date().toISOString()
      });
    }

    emit('update:modelValue', photos.value);
  } catch (err) {
    console.error('Photo optimization error:', err);
    uploadError.value = 'Failed to process one or more images. Please try another image.';
  } finally {
    isProcessing.value = false;
    if (fileInput.value) fileInput.value.value = '';
    if (cameraInput.value) cameraInput.value.value = '';
  }
}

function removePhoto(index) {
  photos.value.splice(index, 1);
  emit('update:modelValue', photos.value);
}

function updateCaption(index, text) {
  photos.value[index].caption = text;
  emit('update:modelValue', photos.value);
}
</script>
