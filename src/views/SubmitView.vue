<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Wizard Progress Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-400 mb-2">
        <span class="text-st-yellow">Step {{ draft.step }} of 4: {{ currentStepTitle }}</span>
        <button
          v-if="draft.step > 1"
          type="button"
          @click="prevStep"
          class="text-st-blue hover:text-white flex items-center gap-1 touch-target text-xs"
        >
          <i class="fa-solid fa-arrow-left"></i>
          Back
        </button>
      </div>

      <!-- Step Indicator Dots / Progress Bar with Konsta Progressbar -->
      <div class="w-full mb-2">
        <k-progressbar
          :progress="draft.step / 4"
          class="w-full h-2.5 rounded-full overflow-hidden"
        />
      </div>

      <div class="grid grid-cols-4 gap-1 text-[11px] sm:text-xs font-semibold text-center mt-2 text-slate-400">
        <span :class="{ 'text-st-yellow font-bold': draft.step >= 1 }">1. Describe</span>
        <span :class="{ 'text-st-yellow font-bold': draft.step >= 2 }">2. Locate</span>
        <span :class="{ 'text-st-yellow font-bold': draft.step >= 3 }">3. Photo</span>
        <span :class="{ 'text-st-yellow font-bold': draft.step >= 4 }">4. Review</span>
      </div>
    </div>

    <!-- WIZARD STEP CONTAINER with Konsta Card -->
    <k-card
      :raised="true"
      :content-wrap="false"
      class="st-card p-5 sm:p-7 shadow-xl m-0"
    >
      <!-- ================= STEP 1: DESCRIBE ================= -->
      <div v-if="draft.step === 1" class="space-y-5 animate-in fade-in">
        <div>
          <h2 class="text-2xl font-bold font-serif mb-1">Describe Your Improvement Idea</h2>
          <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
            Tell us about the civic, pedestrian, bike, or transit issue and how it can be improved.
          </p>
        </div>

        <div>
          <label for="input-summary" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Summary <span class="text-rose-400">*</span></span>
            <span class="text-xs font-normal text-slate-400">{{ (draft.summary || '').length }}/120</span>
          </label>
          <input
            id="input-summary"
            type="text"
            v-model="draft.summary"
            @input="persistDraft"
            maxlength="120"
            placeholder="e.g., Install protected bike lane on Elm Street"
            class="st-input"
            required
          />
          <p v-if="errors.summary" class="text-xs text-rose-400 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i>
            {{ errors.summary }}
          </p>
        </div>

        <div>
          <label for="input-details" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Details & Community Impact <span class="text-rose-400">*</span></span>
          </label>
          <textarea
            id="input-details"
            v-model="draft.details"
            @input="persistDraft"
            rows="5"
            placeholder="Explain why this improvement is needed, the current danger/inconvenience, and how it makes the city stronger..."
            class="st-input"
            required
          ></textarea>
          <p v-if="errors.details" class="text-xs text-rose-400 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i>
            {{ errors.details }}
          </p>
        </div>

        <div class="pt-4 flex justify-end">
          <k-button
            type="button"
            @click="validateAndNextStep1"
            :rounded="true"
            large
            class="font-bold text-base w-full sm:w-auto px-8"
          >
            <span>Next: Choose Location</span>
            <i class="fa-solid fa-arrow-right ml-2"></i>
          </k-button>
        </div>
      </div>

      <!-- ================= STEP 2: LOCATE ================= -->
      <div v-else-if="draft.step === 2" class="space-y-4 animate-in fade-in">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold font-serif mb-1">Pin Suggestion Location</h2>
            <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
              Drag the map or search an address to set the exact coordinates.
            </p>
          </div>
        </div>

        <!-- Location Picker Map Component -->
        <LocationPicker
          v-model="draft.location"
          @update:modelValue="onLocationUpdated"
        />

        <div class="pt-4 flex items-center justify-between gap-3">
          <k-button
            type="button"
            @click="prevStep"
            :outline="true"
            :rounded="true"
            class="text-sm"
          >
            <i class="fa-solid fa-arrow-left mr-2"></i>
            Back
          </k-button>

          <k-button
            type="button"
            @click="nextStep"
            :rounded="true"
            large
            class="font-bold text-base px-8"
          >
            <span>Next: Add Photos</span>
            <i class="fa-solid fa-arrow-right ml-2"></i>
          </k-button>
        </div>
      </div>

      <!-- ================= STEP 3: PHOTO ================= -->
      <div v-else-if="draft.step === 3" class="space-y-5 animate-in fade-in">
        <div>
          <h2 class="text-2xl font-bold font-serif mb-1">Attach Photos (Optional)</h2>
          <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
            Upload up to 10 photos of the location, hazards, or site conditions.
          </p>
        </div>

        <!-- Multi Photo Uploader Component -->
        <PhotoUploader
          v-model="draft.photos"
          :max-photos="10"
          @update:modelValue="onPhotosUpdated"
        />

        <div class="pt-4 flex items-center justify-between gap-3">
          <k-button
            type="button"
            @click="prevStep"
            :outline="true"
            :rounded="true"
            class="text-sm"
          >
            <i class="fa-solid fa-arrow-left mr-2"></i>
            Back
          </k-button>

          <k-button
            type="button"
            @click="nextStep"
            :rounded="true"
            large
            class="font-bold text-base px-8"
          >
            <span>Next: Review & Submit</span>
            <i class="fa-solid fa-arrow-right ml-2"></i>
          </k-button>
        </div>
      </div>

      <!-- ================= STEP 4: REVIEW & SUBMIT ================= -->
      <div v-else-if="draft.step === 4" class="space-y-6 animate-in fade-in">
        <div>
          <h2 class="text-2xl font-bold font-serif mb-1">Review Your Submission</h2>
          <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">
            Verify your suggestion details before publishing to the Dallas Urbanists cloud database.
          </p>
        </div>

        <!-- Review Section: Step 1 Describe with Konsta Card -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider text-st-yellow flex items-center gap-1.5">
              <i class="fa-solid fa-pen"></i>
              1. Description
            </h3>
            <k-button
              type="button"
              @click="goToStep(1)"
              :clear="true"
              small
              inline
              class="text-xs font-bold text-st-blue"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>
          <p class="font-bold text-base mb-1 text-slate-100 dark:text-slate-100 light:text-st-navy">{{ draft.summary || '(No summary provided)' }}</p>
          <p class="text-xs text-slate-300 dark:text-slate-300 light:text-slate-700 whitespace-pre-wrap leading-relaxed">{{ draft.details || '(No details provided)' }}</p>
        </k-card>

        <!-- Review Section: Step 2 Locate with Konsta Card -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider text-st-yellow flex items-center gap-1.5">
              <i class="fa-solid fa-location-dot"></i>
              2. Location
            </h3>
            <k-button
              type="button"
              @click="goToStep(2)"
              :clear="true"
              small
              inline
              class="text-xs font-bold text-st-blue"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>
          <p class="text-sm font-semibold text-slate-200 dark:text-slate-200 light:text-st-navy">
            {{ draft.location?.address || 'Dallas, TX' }}
          </p>
          <p v-if="draft.location?.description" class="text-xs text-slate-400 mt-1">
            <span class="font-semibold text-slate-300">Note:</span> {{ draft.location.description }}
          </p>
          <p v-if="draft.location?.latitude" class="text-[11px] text-slate-500 font-mono mt-1">
            {{ Number(draft.location.latitude).toFixed(5) }}, {{ Number(draft.location.longitude).toFixed(5) }}
          </p>
        </k-card>

        <!-- Review Section: Step 3 Photo with Konsta Card -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl bg-slate-900/60 dark:bg-slate-900/60 light:bg-slate-100 border border-slate-800 dark:border-slate-800 light:border-slate-300 m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider text-st-yellow flex items-center gap-1.5">
              <i class="fa-solid fa-camera"></i>
              3. Photos ({{ (draft.photos || []).length }})
            </h3>
            <k-button
              type="button"
              @click="goToStep(3)"
              :clear="true"
              small
              inline
              class="text-xs font-bold text-st-blue"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>

          <div v-if="draft.photos && draft.photos.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div
              v-for="(ph, idx) in draft.photos"
              :key="idx"
              class="relative rounded-lg overflow-hidden h-20 bg-slate-800 border border-slate-700"
            >
              <img :src="ph.dataUrl || ph.url" class="w-full h-full object-cover" alt="" />
              <div v-if="ph.caption" class="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white p-1 truncate">
                {{ ph.caption }}
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-slate-500">No photos attached.</p>
        </k-card>

        <!-- Author Name & Email (Required) -->
        <div class="pt-2 border-t border-slate-700/60 space-y-4">
          <h3 class="text-base font-bold font-serif text-slate-100 dark:text-slate-100 light:text-st-navy">
            Author Contact Information
          </h3>

          <div>
            <label for="input-author-name" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
              <span>Your Name <span class="text-rose-400">*</span></span>
              <span class="text-xs font-normal text-slate-400">{{ (draft.author.name || '').length }}/70</span>
            </label>
            <input
              id="input-author-name"
              type="text"
              v-model="draft.author.name"
              @input="persistDraft"
              maxlength="70"
              placeholder="e.g. Jane Jacobs"
              class="st-input"
              required
            />
            <p v-if="errors.authorName" class="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <i class="fa-solid fa-circle-exclamation"></i>
              {{ errors.authorName }}
            </p>
          </div>

          <div>
            <label for="input-author-email" class="block text-sm font-bold mb-1.5">
              Your Email Address <span class="text-rose-400">*</span>
            </label>
            <input
              id="input-author-email"
              type="email"
              v-model="draft.author.email"
              @input="persistDraft"
              placeholder="e.g. jane@strongtowns.org"
              class="st-input"
              required
            />
            <p v-if="errors.authorEmail" class="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <i class="fa-solid fa-circle-exclamation"></i>
              {{ errors.authorEmail }}
            </p>
          </div>
        </div>

        <!-- Submit Final Action -->
        <div class="pt-4 flex items-center justify-between gap-3">
          <k-button
            type="button"
            @click="prevStep"
            :outline="true"
            :rounded="true"
            class="text-sm"
          >
            <i class="fa-solid fa-arrow-left mr-2"></i>
            Back
          </k-button>

          <k-button
            type="button"
            @click="submitFinalSuggestion"
            :rounded="true"
            large
            class="font-black text-base px-8 py-3.5 shadow-xl"
          >
            <i class="fa-solid fa-paper-plane mr-2"></i>
            Submit Suggestion
          </k-button>
        </div>
      </div>
    </k-card>

    <!-- SUBMISSION IN PROGRESS / STATUS MODAL -->
    <SubmissionProgressModal
      v-if="showSubmissionOverlay"
      :status="submissionStatus"
      :progress-percent="submissionProgress"
      :dynamic-message="dynamicProgressMessage"
      :created-suggestion-id="createdSuggestionId"
      :error-message="submissionErrorMessage"
      @view-suggestion="handleViewSuggestion"
      @go-home="handleGoHome"
      @retry="submitFinalSuggestion"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue';
import { useRouter } from 'vue-router';
import { kCard, kButton, kProgressbar } from 'konsta/vue';
import LocationPicker from '../components/LocationPicker.vue';
import PhotoUploader from '../components/PhotoUploader.vue';
import SubmissionProgressModal from '../components/SubmissionProgressModal.vue';
import {
  loadWizardDraft,
  saveWizardDraft,
  clearWizardDraft,
  getInitialDraft
} from '../services/storage';
import {
  requestPhotoUploadUrl,
  uploadPhotoBinary,
  createSuggestion
} from '../services/api';

const router = useRouter();
const setSubmitting = inject('setSubmitting', () => {});

// Draft reactive state
const draft = reactive(loadWizardDraft());

const errors = reactive({
  summary: '',
  details: '',
  authorName: '',
  authorEmail: ''
});

// Submission Progress Overlay State
const showSubmissionOverlay = ref(false);
const submissionStatus = ref('submitting'); // 'submitting' | 'success' | 'failed'
const submissionProgress = ref(0);
const dynamicProgressMessage = ref('');
const createdSuggestionId = ref('');
const submissionErrorMessage = ref('');

const currentStepTitle = computed(() => {
  switch (draft.step) {
    case 1: return 'Describe';
    case 2: return 'Locate';
    case 3: return 'Photo';
    case 4: return 'Review & Submit';
    default: return '';
  }
});

function persistDraft() {
  saveWizardDraft(draft);
}

function goToStep(stepNumber) {
  draft.step = stepNumber;
  persistDraft();
}

function prevStep() {
  if (draft.step > 1) {
    draft.step -= 1;
    persistDraft();
  }
}

function nextStep() {
  if (draft.step < 4) {
    draft.step += 1;
    persistDraft();
  }
}

function validateAndNextStep1() {
  errors.summary = '';
  errors.details = '';

  const summaryTrimmed = (draft.summary || '').trim();
  const detailsTrimmed = (draft.details || '').trim();

  if (!summaryTrimmed) {
    errors.summary = 'Summary is required.';
  }
  if (!detailsTrimmed) {
    errors.details = 'Details description is required.';
  }

  if (!errors.summary && !errors.details) {
    nextStep();
  }
}

function onLocationUpdated(loc) {
  draft.location = { ...loc };
  persistDraft();
}

function onPhotosUpdated(photosList) {
  draft.photos = [...photosList];
  persistDraft();
}

function validateStep4() {
  errors.authorName = '';
  errors.authorEmail = '';

  const name = (draft.author.name || '').trim();
  const email = (draft.author.email || '').trim();

  if (!name) {
    errors.authorName = 'Author name is required.';
  } else if (name.length > 70) {
    errors.authorName = 'Author name cannot exceed 70 characters.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    errors.authorEmail = 'Email address is required.';
  } else if (!emailRegex.test(email)) {
    errors.authorEmail = 'Please enter a valid email address.';
  }

  return !errors.authorName && !errors.authorEmail;
}

/**
 * Final submission handler
 */
async function submitFinalSuggestion() {
  if (!validateStep4()) return;

  // 1. Hide Navbar and show submission overlay
  setSubmitting(true);
  showSubmissionOverlay.value = true;
  submissionStatus.value = 'submitting';
  submissionProgress.value = 10;
  dynamicProgressMessage.value = 'Preparing civic suggestion data...';

  try {
    const uploadedPhotos = [];
    const photosToUpload = (draft.photos || []).filter(p => p.blob || p.url);

    // 2. Upload photos if attached
    if (photosToUpload.length > 0) {
      const stepPercent = 60 / photosToUpload.length;

      for (let i = 0; i < photosToUpload.length; i++) {
        const p = photosToUpload[i];
        submissionProgress.value = Math.round(10 + i * stepPercent);
        dynamicProgressMessage.value = `Requesting signed URL for photo ${i + 1} of ${photosToUpload.length}...`;

        // Request signed URL from API
        const { uploadUrl, publicUrl } = await requestPhotoUploadUrl({
          contentType: 'image/webp',
          filename: p.name || `photo-${i + 1}.webp`
        });

        dynamicProgressMessage.value = `Uploading photo ${i + 1} binary to cloud storage...`;
        await uploadPhotoBinary(uploadUrl, p.blob, 'image/webp');

        uploadedPhotos.push({
          url: publicUrl,
          caption: p.caption || 'Civic improvement photo',
          timestamp: p.timestamp || new Date().toISOString()
        });
      }
    }

    // 3. Post to API server
    submissionProgress.value = 85;
    dynamicProgressMessage.value = 'Submitting suggestion to Dallas Urbanists database...';

    const payload = {
      author: {
        name: draft.author.name.trim(),
        email: draft.author.email.trim()
      },
      content: {
        summary: draft.summary.trim(),
        details: draft.details.trim(),
        ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {})
      },
      location: {
        latitude: draft.location?.latitude || 32.7767,
        longitude: draft.location?.longitude || -96.7970,
        address: draft.location?.address || 'Dallas, TX',
        ...(draft.location?.description ? { description: draft.location.description } : {})
      }
    };

    const created = await createSuggestion(payload);
    createdSuggestionId.value = created.id || created._id || 'new-suggestion';

    // 4. Success State
    submissionProgress.value = 100;
    submissionStatus.value = 'success';
    dynamicProgressMessage.value = 'Submission complete!';

    // Clear local storage draft upon final submission
    clearWizardDraft();
    Object.assign(draft, getInitialDraft());
  } catch (err) {
    console.error('Submission failed:', err);
    submissionStatus.value = 'failed';
    submissionErrorMessage.value = err.message || 'Unknown network error occurred';
    dynamicProgressMessage.value = `Submission failed: ${submissionErrorMessage.value}`;
  }
}

function handleViewSuggestion(id) {
  setSubmitting(false);
  showSubmissionOverlay.value = false;
  if (id) {
    router.push(`/suggestion/${id}`);
  } else {
    router.push('/browse');
  }
}

function handleGoHome() {
  setSubmitting(false);
  showSubmissionOverlay.value = false;
  router.push('/');
}

onMounted(() => {
  // Ensure theme and draft synced
  persistDraft();
});
</script>
