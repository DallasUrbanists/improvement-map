<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Wizard Progress Header -->
    <div>
      <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-2">
        <span>Step {{ draft.step }} of 4: {{ currentStepTitle }}</span>
        <k-button
          v-if="draft.step > 1"
          type="button"
          @click="prevStep"
          :clear="true"
          small
          class="text-xs"
        >
          <i class="fa-solid fa-arrow-left mr-1"></i>
          Back
        </k-button>
      </div>

      <!-- Progress Bar with Konsta Progressbar -->
      <div class="w-full mb-2">
        <k-progressbar
          :progress="draft.step / 4"
          class="w-full h-2 rounded-full overflow-hidden"
        />
      </div>

      <div class="grid grid-cols-4 gap-1 text-[11px] sm:text-xs font-semibold text-center mt-2 text-zinc-400">
        <span :class="{ 'text-black dark:text-white font-bold': draft.step >= 1 }">1. Describe</span>
        <span :class="{ 'text-black dark:text-white font-bold': draft.step >= 2 }">2. Locate</span>
        <span :class="{ 'text-black dark:text-white font-bold': draft.step >= 3 }">3. Photo</span>
        <span :class="{ 'text-black dark:text-white font-bold': draft.step >= 4 }">4. Review</span>
      </div>
    </div>

    <!-- WIZARD STEP CONTAINER -->
    <k-card
      :outline="true"
      :content-wrap="false"
      class="p-5 sm:p-7 shadow-sm m-0"
    >
      <!-- ================= STEP 1: DESCRIBE ================= -->
      <div v-if="draft.step === 1" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-1">Describe Your Improvement Idea</h2>
          <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Tell us about the civic, pedestrian, bike, or transit issue and how it can be improved.
          </p>
        </div>

        <div>
          <label for="input-summary" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Summary <span class="text-red-500">*</span></span>
            <span class="text-xs font-normal text-zinc-400">{{ (draft.summary || '').length }}/120</span>
          </label>
          <input
            id="input-summary"
            type="text"
            v-model="draft.summary"
            @input="persistDraft"
            maxlength="120"
            placeholder="e.g., Install protected bike lane on Elm Street"
            class="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
            required
          />
          <p v-if="errors.summary" class="text-xs text-red-500 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i>
            {{ errors.summary }}
          </p>
        </div>

        <div>
          <label for="input-details" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Details & Community Impact <span class="text-red-500">*</span></span>
          </label>
          <textarea
            id="input-details"
            v-model="draft.details"
            @input="persistDraft"
            rows="5"
            placeholder="Explain why this improvement is needed, the current danger/inconvenience, and how it makes the city stronger..."
            class="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
            required
          ></textarea>
          <p v-if="errors.details" class="text-xs text-red-500 mt-1 flex items-center gap-1">
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
      <div v-else-if="draft.step === 2" class="space-y-4">
        <div>
          <h2 class="text-2xl font-bold mb-1">Pin Suggestion Location</h2>
          <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Drag the map or search an address to set the exact coordinates.
          </p>
        </div>

        <!-- Google Maps Target Container Wrapper -->
        <div class="relative w-full h-[55vh] min-h-[360px] max-h-[550px] rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 flex flex-col bg-zinc-900">
          <!-- Search Bar Overlay with Autocomplete Dropdown -->
          <div class="absolute top-3 left-3 right-3 z-30 flex flex-col max-w-lg">
            <div class="relative flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-lg">
              <span class="pl-3.5 pr-2 text-zinc-400">
                <i class="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                v-model="mapSearchQuery"
                @input="onSearchInput"
                placeholder="Search address or street corridor..."
                class="w-full py-2.5 pr-8 bg-transparent text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none"
              />
              <button
                v-if="mapSearchQuery"
                @click="mapSearchQuery = ''; mapSearchResults = []"
                class="p-2 text-zinc-400 hover:text-black dark:hover:text-white"
                type="button"
                aria-label="Clear search"
              >
                <i class="fa-solid fa-xmark text-sm"></i>
              </button>
              <span v-if="isSearching" class="pr-3 text-zinc-400">
                <i class="fa-solid fa-spinner animate-spin text-sm"></i>
              </span>
            </div>

            <!-- Autocomplete Dropdown Menu -->
            <div
              v-if="mapSearchResults.length > 0"
              class="mt-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-2xl max-h-52 overflow-y-auto z-40 divide-y divide-zinc-200 dark:divide-zinc-800"
            >
              <button
                v-for="item in mapSearchResults"
                :key="item.id"
                type="button"
                @click="selectAddress(item)"
                class="w-full text-left px-3.5 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-2.5 text-xs sm:text-sm text-black dark:text-white"
              >
                <i class="fa-solid fa-location-dot text-zinc-500 mt-0.5 flex-shrink-0"></i>
                <span class="line-clamp-2">{{ item.displayName }}</span>
              </button>
            </div>
          </div>

          <!-- Pure Map Canvas Element -->
          <div class="relative w-full flex-1 min-h-[300px] bg-zinc-900 overflow-hidden">
            <div
              ref="mapContainerEl"
              class="w-full h-full min-h-[300px] bg-zinc-900"
              style="height: 100%; width: 100%;"
            ></div>

            <!-- Missing API Key Overlay -->
            <div
              v-if="!hasGoogleMapsKey || googleMapsAuthError"
              class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/95 text-zinc-300 z-20 backdrop-blur-sm"
            >
              <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500 mb-3"></i>
              <h4 class="text-base font-bold text-white mb-1">Google Maps Setup Required</h4>
              <p class="text-xs text-zinc-300 max-w-sm mb-3">
                {{ googleMapsAuthError || 'Set VITE_GOOGLE_MAPS_API_KEY in your .env file.' }}
              </p>
            </div>

            <!-- Loading indicator -->
            <div
              v-else-if="!isMapReady"
              class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 z-10"
            >
              <k-preloader class="w-8 h-8 mb-2" />
              <span class="text-xs font-semibold">Loading Map...</span>
            </div>
          </div>

          <!-- Basemap Switcher (Streets / Satellite) -->
          <div class="absolute top-3 right-3 z-30 flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-xl border border-zinc-300 dark:border-zinc-700 shadow-lg p-0.5">
            <k-segmented :raised="true" class="w-auto">
              <k-segmented-button
                :active="currentMapType === 'roadmap'"
                @click="setMapType('roadmap')"
                small
                class="text-xs font-bold px-2.5 py-1"
              >
                <i class="fa-solid fa-road mr-1"></i>
                Streets
              </k-segmented-button>
              <k-segmented-button
                :active="currentMapType === 'hybrid'"
                @click="setMapType('hybrid')"
                small
                class="text-xs font-bold px-2.5 py-1"
              >
                <i class="fa-solid fa-earth-americas mr-1"></i>
                Satellite
              </k-segmented-button>
            </k-segmented>
          </div>

          <!-- GPS Recenter Button -->
          <div class="absolute bottom-3 right-3 z-30">
            <k-button
              type="button"
              @click="requestGpsLocation"
              :disabled="isLocating"
              :rounded="true"
              class="w-11 h-11 p-0 flex items-center justify-center shadow-xl backdrop-blur-md"
              title="Recenter to current location"
            >
              <i class="fa-solid fa-crosshairs text-lg" :class="{ 'animate-spin': isLocating }"></i>
            </k-button>
          </div>

          <!-- Describe Location Overlay Button -->
          <div class="absolute bottom-3 left-3 z-30">
            <k-button
              type="button"
              @click="openLocationDescModal"
              :rounded="true"
              small
              class="shadow-xl text-xs sm:text-sm font-semibold"
            >
              <i class="fa-solid fa-comment-dots mr-1"></i>
              <span>{{ draft.location?.description ? 'Edit Description' : 'Describe location' }}</span>
            </k-button>
          </div>

          <!-- Location Summary Footer -->
          <div class="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700 text-xs flex items-center justify-between gap-2 z-20">
            <div class="truncate flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <i class="fa-solid fa-map-pin text-zinc-500"></i>
              <span class="font-semibold">{{ displayAddress || 'Tap or drag pin to set location' }}</span>
            </div>
            <div v-if="draft.location?.latitude" class="text-[11px] text-zinc-500 font-mono flex-shrink-0">
              {{ Number(draft.location.latitude).toFixed(4) }}, {{ Number(draft.location.longitude).toFixed(4) }}
            </div>
          </div>
        </div>

        <!-- Describe Location Modal Dialog -->
        <div
          v-if="isDescModalOpen"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          @click.self="discardDescModal"
        >
          <k-card
            :outline="true"
            :content-wrap="false"
            class="max-w-lg w-full p-5 sm:p-6 bg-white dark:bg-zinc-900 text-black dark:text-white shadow-2xl border border-zinc-300 dark:border-zinc-700 rounded-2xl m-0"
          >
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <i class="fa-solid fa-comment-dots"></i>
                Describe Location
              </h3>
              <button
                type="button"
                @click="discardDescModal"
                class="text-zinc-400 hover:text-black dark:hover:text-white p-1"
                aria-label="Close"
              >
                <i class="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Add landmarks, intersection details, or specific physical cues (e.g., "Northwest corner in front of the bakery").
            </p>

            <textarea
              v-model="tempDescription"
              rows="3"
              placeholder="e.g., Along Elm St between Harwood and St Paul, opposite Pegasus Plaza..."
              class="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none mb-5"
              autofocus
            ></textarea>

            <div class="flex items-center justify-end gap-3">
              <k-button
                type="button"
                @click="discardDescModal"
                :outline="true"
                :rounded="true"
                small
                class="text-sm px-4 py-2"
              >
                Discard
              </k-button>
              <k-button
                type="button"
                @click="saveDescModal"
                :rounded="true"
                small
                class="text-sm font-bold px-5 py-2"
              >
                Okay
              </k-button>
            </div>
          </k-card>
        </div>

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
      <div v-else-if="draft.step === 3" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-1">Attach Photos</h2>
          <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Upload up to 10 photos of the location, hazards, or site conditions.
          </p>
        </div>

        <!-- Action Bar: Upload Button & Camera Button -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- File Upload Input Trigger -->
          <label
            class="inline-block cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': (draft.photos || []).length >= 10 || isProcessingPhotos }"
          >
            <k-button
              component="div"
              :rounded="true"
              :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
              class="font-bold text-sm shadow cursor-pointer pointer-events-none"
            >
              <i class="fa-solid fa-cloud-arrow-up mr-2"></i>
              <span>Upload Photos</span>
            </k-button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
              @change="handleFilesSelected"
            />
          </label>

          <!-- Camera Capture Trigger -->
          <label
            class="inline-block cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': (draft.photos || []).length >= 10 || isProcessingPhotos }"
          >
            <k-button
              component="div"
              :outline="true"
              :rounded="true"
              :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
              class="font-semibold text-sm shadow cursor-pointer pointer-events-none"
            >
              <i class="fa-solid fa-camera mr-2"></i>
              <span>Take Photo</span>
            </k-button>
            <input
              ref="cameraInput"
              type="file"
              accept="image/*"
              capture="environment"
              class="hidden"
              :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
              @change="handleFilesSelected"
            />
          </label>

          <!-- Photos Counter Badge with Konsta Badge -->
          <k-badge class="text-xs font-semibold px-3 py-1.5 rounded-full">
            {{ (draft.photos || []).length }} / 10 Photos
          </k-badge>
        </div>

        <!-- Processing Indicator with Konsta Preloader -->
        <div v-if="isProcessingPhotos" class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs flex items-center gap-2">
          <k-preloader class="w-4 h-4" />
          <span>Compressing & optimizing image(s)...</span>
        </div>

        <!-- Error Alert -->
        <div v-if="photoError" class="p-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>{{ photoError }}</span>
          </div>
          <button @click="photoError = ''" class="text-red-500 hover:text-black dark:hover:text-white">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Empty State -->
        <div
          v-if="!draft.photos || draft.photos.length === 0"
          class="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-8 text-center text-zinc-500"
        >
          <div class="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2 text-xl text-zinc-400">
            <i class="fa-solid fa-images"></i>
          </div>
          <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">No photos added yet (optional)</p>
          <p class="text-xs text-zinc-500 max-w-sm mx-auto">
            Adding photos of street conditions, bike lanes, or crosswalks helps local planners understand your idea.
          </p>
        </div>

        <!-- Photos Grid with Konsta Card -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <k-card
            v-for="(photo, index) in draft.photos"
            :key="photo.id || index"
            :outline="true"
            :content-wrap="false"
            class="p-3 rounded-2xl flex flex-col gap-2 relative m-0"
          >
            <div class="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
              <img
                :src="photo.dataUrl || photo.url"
                :alt="photo.caption || 'Photo'"
                class="w-full h-full object-cover"
              />
              <k-badge class="absolute top-2 left-2 text-[11px] font-bold">
                #{{ index + 1 }}
              </k-badge>
              <button
                type="button"
                @click="removePhoto(index)"
                class="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition active:scale-90"
                title="Remove Photo"
              >
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>

            <!-- Caption input -->
            <input
              type="text"
              v-model="photo.caption"
              @input="persistDraft"
              placeholder="Add photo caption (optional)..."
              class="w-full px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-black dark:text-white placeholder-zinc-400 focus:outline-none"
            />
          </k-card>
        </div>

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
      <div v-else-if="draft.step === 4" class="space-y-6">
        <div>
          <h2 class="text-2xl font-bold mb-1">Review Your Submission</h2>
          <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Verify your suggestion details before publishing.
          </p>
        </div>

        <!-- Review Section: Step 1 Describe -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
              <i class="fa-solid fa-pen"></i>
              1. Description
            </h3>
            <k-button
              type="button"
              @click="goToStep(1)"
              :clear="true"
              small
              class="text-xs font-bold"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>
          <p class="font-bold text-base mb-1 text-black dark:text-white">{{ draft.summary || '(No summary provided)' }}</p>
          <p class="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{{ draft.details || '(No details provided)' }}</p>
        </k-card>

        <!-- Review Section: Step 2 Locate -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
              <i class="fa-solid fa-location-dot"></i>
              2. Location
            </h3>
            <k-button
              type="button"
              @click="goToStep(2)"
              :clear="true"
              small
              class="text-xs font-bold"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>
          <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {{ draft.location?.address || 'Dallas, TX' }}
          </p>
          <p v-if="draft.location?.description" class="text-xs text-zinc-500 mt-1">
            <span class="font-semibold text-zinc-600 dark:text-zinc-400">Note:</span> {{ draft.location.description }}
          </p>
          <p v-if="draft.location?.latitude" class="text-[11px] text-zinc-400 font-mono mt-1">
            {{ Number(draft.location.latitude).toFixed(5) }}, {{ Number(draft.location.longitude).toFixed(5) }}
          </p>
        </k-card>

        <!-- Review Section: Step 3 Photo -->
        <k-card
          :outline="true"
          :content-wrap="false"
          class="p-4 rounded-xl m-0"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5">
              <i class="fa-solid fa-camera"></i>
              3. Photos ({{ (draft.photos || []).length }})
            </h3>
            <k-button
              type="button"
              @click="goToStep(3)"
              :clear="true"
              small
              class="text-xs font-bold"
            >
              <i class="fa-solid fa-pen-to-square mr-1"></i>
              Edit
            </k-button>
          </div>

          <div v-if="draft.photos && draft.photos.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            <div
              v-for="(ph, idx) in draft.photos"
              :key="idx"
              class="relative rounded-lg overflow-hidden h-20 bg-zinc-800 border border-zinc-700"
            >
              <img :src="ph.dataUrl || ph.url" class="w-full h-full object-cover" alt="" />
              <div v-if="ph.caption" class="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white p-1 truncate">
                {{ ph.caption }}
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-zinc-500">No photos attached.</p>
        </k-card>

        <!-- Author Name & Email (Required) -->
        <div class="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <h3 class="text-base font-bold text-black dark:text-white">
            Author Contact Information
          </h3>

          <div>
            <label for="input-author-name" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
              <span>Your Name <span class="text-red-500">*</span></span>
              <span class="text-xs font-normal text-zinc-400">{{ (draft.author?.name || '').length }}/70</span>
            </label>
            <input
              id="input-author-name"
              type="text"
              v-model="draft.author.name"
              @input="persistDraft"
              maxlength="70"
              placeholder="e.g. Jane Jacobs"
              class="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
              required
            />
            <p v-if="errors.authorName" class="text-xs text-red-500 mt-1 flex items-center gap-1">
              <i class="fa-solid fa-circle-exclamation"></i>
              {{ errors.authorName }}
            </p>
          </div>

          <div>
            <label for="input-author-email" class="block text-sm font-bold mb-1.5">
              Your Email Address <span class="text-red-500">*</span>
            </label>
            <input
              id="input-author-email"
              type="email"
              v-model="draft.author.email"
              @input="persistDraft"
              placeholder="e.g. jane@strongtowns.org"
              class="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
              required
            />
            <p v-if="errors.authorEmail" class="text-xs text-red-500 mt-1 flex items-center gap-1">
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
            class="font-bold text-base px-8 py-3.5 shadow-lg"
          >
            <i class="fa-solid fa-paper-plane mr-2"></i>
            Submit Suggestion
          </k-button>
        </div>
      </div>
    </k-card>

    <!-- SUBMISSION PROGRESS / STATUS MODAL OVERLAY -->
    <div
      v-if="showSubmissionOverlay"
      class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center select-none"
    >
      <k-card
        :outline="true"
        :content-wrap="false"
        class="max-w-md w-full p-6 sm:p-8 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 shadow-2xl flex flex-col items-center m-0"
      >
        <!-- Status Icon -->
        <div class="mb-6">
          <div v-if="submissionStatus === 'submitting'" class="flex items-center justify-center w-20 h-20">
            <k-preloader class="w-16 h-16" />
          </div>

          <div
            v-else-if="submissionStatus === 'success'"
            class="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500 flex items-center justify-center text-4xl"
          >
            <i class="fa-solid fa-check"></i>
          </div>

          <div
            v-else-if="submissionStatus === 'failed'"
            class="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-500 flex items-center justify-center text-4xl"
          >
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>

        <!-- Status Title -->
        <h2 class="text-2xl font-bold mb-2">
          {{ submissionStatus === 'success' ? 'Submission complete!' : (submissionStatus === 'failed' ? 'Submission Failed' : 'Submitting Your Idea...') }}
        </h2>

        <!-- Dynamic Progress Description Text -->
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6 px-2 min-h-[40px] flex items-center justify-center">
          {{ dynamicProgressMessage }}
        </p>

        <!-- Progress Bar -->
        <div v-if="submissionStatus === 'submitting' || submissionStatus === 'success'" class="w-full mb-6">
          <k-progressbar
            :progress="submissionProgress / 100"
            class="w-full h-3 rounded-full overflow-hidden"
          />
        </div>

        <!-- Action Buttons -->
        <div class="w-full flex flex-col gap-3">
          <k-button
            v-if="submissionStatus === 'success'"
            type="button"
            large
            :rounded="true"
            @click="handleViewSuggestion(createdSuggestionId)"
            class="w-full font-bold shadow-lg"
          >
            <i class="fa-solid fa-eye mr-2"></i>
            View suggestion
          </k-button>

          <k-button
            v-if="submissionStatus === 'failed'"
            type="button"
            large
            :rounded="true"
            @click="handleGoHome"
            class="w-full font-bold shadow-lg"
          >
            <i class="fa-solid fa-map-location-dot mr-2"></i>
            Go to Browse
          </k-button>

          <k-button
            v-if="submissionStatus === 'failed'"
            type="button"
            :outline="true"
            :rounded="true"
            @click="submitFinalSuggestion"
            class="w-full text-sm"
          >
            <i class="fa-solid fa-rotate-right mr-2"></i>
            Try Again
          </k-button>
        </div>
      </k-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, inject, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  kCard,
  kButton,
  kProgressbar,
  kPreloader,
  kBadge,
  kSegmented,
  kSegmentedButton,
} from 'konsta/vue';
import {
  loadWizardDraft,
  saveWizardDraft,
  clearWizardDraft,
  getInitialDraft,
} from '../services/storage';
import {
  requestPhotoUploadUrl,
  uploadPhotoBinary,
  createSuggestion,
} from '../services/api';
import { resizeImage } from '../services/image';
import { isDark } from '../services/theme';
import {
  loadGoogleMaps,
  hasGoogleMapsKey,
  googleMapsAuthError,
  searchAddressWithGoogle,
  resolveGooglePlace,
  reverseGeocodeWithGoogle,
  getMapStyles,
  updateMapTheme,
} from '../services/googleMaps';

const router = useRouter();
const setSubmitting = inject('setSubmitting', () => {});

// Draft reactive state
const draft = reactive(loadWizardDraft());

const errors = reactive({
  summary: '',
  details: '',
  authorName: '',
  authorEmail: '',
});

// Step 2 Map & Location state
const mapContainerEl = ref(null);
const isMapReady = ref(false);
const isLocating = ref(false);
const currentMapType = ref('roadmap');
const mapSearchQuery = ref('');
const mapSearchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

const isDescModalOpen = ref(false);
const tempDescription = ref('');

let map = null;
let marker = null;
let googleMaps = null;

// Step 3 Photo state
const fileInput = ref(null);
const cameraInput = ref(null);
const isProcessingPhotos = ref(false);
const photoError = ref('');

// Step 4 Submission Progress Overlay State
const showSubmissionOverlay = ref(false);
const submissionStatus = ref('submitting');
const submissionProgress = ref(0);
const dynamicProgressMessage = ref('');
const createdSuggestionId = ref('');
const submissionErrorMessage = ref('');

const currentStepTitle = computed(() => {
  switch (draft.step) {
    case 1:
      return 'Describe';
    case 2:
      return 'Locate';
    case 3:
      return 'Photo';
    case 4:
      return 'Review & Submit';
    default:
      return '';
  }
});

const displayAddress = computed(() => {
  if (draft.location?.address) return draft.location.address;
  if (draft.location?.latitude) {
    return `${Number(draft.location.latitude).toFixed(4)}, ${Number(draft.location.longitude).toFixed(4)}`;
  }
  return '';
});

function persistDraft() {
  saveWizardDraft(draft);
}

function goToStep(stepNumber) {
  draft.step = stepNumber;
  persistDraft();
  if (stepNumber === 2) {
    nextTick(() => {
      initMap();
    });
  }
}

function prevStep() {
  if (draft.step > 1) {
    draft.step -= 1;
    persistDraft();
    if (draft.step === 2) {
      nextTick(() => {
        initMap();
      });
    }
  }
}

function nextStep() {
  if (draft.step < 4) {
    draft.step += 1;
    persistDraft();
    if (draft.step === 2) {
      nextTick(() => {
        initMap();
      });
    }
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

// ---------------- MAP & LOCATION LOGIC ---------------- //
async function initMap() {
  try {
    googleMaps = await loadGoogleMaps();
    if (!mapContainerEl.value || !googleMaps) return;

    const initialLat = draft.location?.latitude || 32.7767;
    const initialLng = draft.location?.longitude || -96.7970;
    const initialPos = { lat: Number(initialLat), lng: Number(initialLng) };

    map = new googleMaps.Map(mapContainerEl.value, {
      center: initialPos,
      zoom: 15,
      mapTypeId: googleMaps.MapTypeId.ROADMAP,
      styles: getMapStyles(isDark.value, currentMapType.value),
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });

    marker = new googleMaps.Marker({
      position: initialPos,
      map,
      draggable: true,
      animation: googleMaps.Animation?.DROP,
      title: 'Suggestion Location',
    });

    marker.addListener('dragend', async () => {
      const pos = marker.getPosition();
      if (!pos) return;
      await updateCoordinates(pos.lat(), pos.lng());
    });

    map.addListener('click', async (e) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition({ lat, lng });
      await updateCoordinates(lat, lng);
    });

    isMapReady.value = true;
  } catch (err) {
    console.warn('Map initialization warning:', err);
    isMapReady.value = true;
  }
}

async function updateCoordinates(lat, lng, knownAddress = '') {
  draft.location = draft.location || {};
  draft.location.latitude = Number(lat);
  draft.location.longitude = Number(lng);

  if (knownAddress) {
    draft.location.address = knownAddress;
  } else {
    try {
      const rev = await reverseGeocodeWithGoogle(lat, lng);
      if (rev) {
        draft.location.address = rev;
      }
    } catch {
      // fallback
    }
  }
  persistDraft();
}

function setMapType(type) {
  currentMapType.value = type;
  if (!map || !googleMaps) return;
  if (type === 'hybrid') {
    map.setMapTypeId(googleMaps.MapTypeId.HYBRID);
    map.setOptions({ styles: getMapStyles(isDark.value, 'hybrid') });
  } else {
    map.setMapTypeId(googleMaps.MapTypeId.ROADMAP);
    map.setOptions({ styles: getMapStyles(isDark.value, 'roadmap') });
  }
}

watch(isDark, (darkMode) => {
  if (!map || !googleMaps) return;
  updateMapTheme(map, darkMode, currentMapType.value);
});

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = mapSearchQuery.value.trim();
  if (q.length < 2) {
    mapSearchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    mapSearchResults.value = await searchAddressWithGoogle(q);
    isSearching.value = false;
  }, 350);
}

async function selectAddress(item) {
  mapSearchQuery.value = item.displayName;
  mapSearchResults.value = [];

  let lat = item.latitude;
  let lng = item.longitude;

  if (lat === undefined || lng === undefined) {
    const resolved = await resolveGooglePlace(item.placeId || item.displayName);
    if (resolved) {
      lat = resolved.latitude;
      lng = resolved.longitude;
    }
  }

  if (lat !== undefined && lng !== undefined) {
    if (map && marker) {
      const pos = { lat: Number(lat), lng: Number(lng) };
      marker.setPosition(pos);
      map.setCenter(pos);
      map.setZoom(16);
    }
    await updateCoordinates(lat, lng, item.displayName);
  }
}

function requestGpsLocation() {
  if (!navigator.geolocation) return;
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      isLocating.value = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (map && marker) {
        const p = { lat, lng };
        marker.setPosition(p);
        map.setCenter(p);
        map.setZoom(16);
      }
      await updateCoordinates(lat, lng);
    },
    (err) => {
      isLocating.value = false;
      console.warn('Geolocation error:', err);
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function openLocationDescModal() {
  tempDescription.value = draft.location?.description || '';
  isDescModalOpen.value = true;
}

function discardDescModal() {
  isDescModalOpen.value = false;
}

function saveDescModal() {
  draft.location = draft.location || {};
  draft.location.description = tempDescription.value.trim();
  isDescModalOpen.value = false;
  persistDraft();
}

// ---------------- PHOTO LOGIC ---------------- //
async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  photoError.value = '';
  draft.photos = draft.photos || [];
  const currentCount = draft.photos.length;
  const remainingSlots = 10 - currentCount;

  if (remainingSlots <= 0) {
    photoError.value = 'Maximum 10 photos allowed.';
    event.target.value = '';
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  isProcessingPhotos.value = true;

  try {
    for (const file of filesToProcess) {
      const processed = await resizeImage(file);
      draft.photos.push({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl: processed.dataUrl,
        blob: processed.blob,
        caption: '',
        name: file.name,
      });
    }
    persistDraft();
  } catch (err) {
    photoError.value = 'Failed to process images: ' + (err.message || 'Unknown error');
  } finally {
    isProcessingPhotos.value = false;
    event.target.value = '';
  }
}

function removePhoto(index) {
  draft.photos.splice(index, 1);
  persistDraft();
}

// ---------------- STEP 4 & SUBMIT LOGIC ---------------- //
function validateStep4() {
  errors.authorName = '';
  errors.authorEmail = '';

  const name = (draft.author?.name || '').trim();
  const email = (draft.author?.email || '').trim();

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

async function submitFinalSuggestion() {
  if (!validateStep4()) return;

  setSubmitting(true);
  showSubmissionOverlay.value = true;
  submissionStatus.value = 'submitting';
  submissionProgress.value = 10;
  dynamicProgressMessage.value = 'Preparing suggestion data...';

  try {
    const uploadedPhotos = [];
    const photosToUpload = (draft.photos || []).filter((p) => p.blob || p.url || p.dataUrl);

    if (photosToUpload.length > 0) {
      const stepPercent = 60 / photosToUpload.length;

      for (let i = 0; i < photosToUpload.length; i++) {
        const p = photosToUpload[i];
        submissionProgress.value = Math.round(10 + i * stepPercent);
        dynamicProgressMessage.value = `Uploading photo ${i + 1} of ${photosToUpload.length}...`;

        // If blob is missing (e.g. restored from localStorage draft), reconstitute from dataUrl
        let photoBlob = p.blob;
        if (!photoBlob && p.dataUrl && p.dataUrl.startsWith('data:')) {
          try {
            const res = await fetch(p.dataUrl);
            photoBlob = await res.blob();
          } catch (e) {
            console.warn('Failed to convert dataUrl to blob:', e);
          }
        }

        const { uploadUrl, publicUrl } = await requestPhotoUploadUrl({
          contentType: 'image/webp',
          filename: p.name || `photo-${i + 1}.webp`,
        });

        if (photoBlob) {
          await uploadPhotoBinary(uploadUrl, photoBlob, 'image/webp');
        }

        uploadedPhotos.push({
          url: publicUrl,
          caption: p.caption || '',
          timestamp: new Date().toISOString(),
        });
      }
    }

    submissionProgress.value = 85;
    dynamicProgressMessage.value = 'Submitting suggestion...';

    const payload = {
      author: {
        name: draft.author.name.trim(),
        email: draft.author.email.trim(),
      },
      content: {
        summary: draft.summary.trim(),
        details: draft.details.trim(),
        ...(uploadedPhotos.length > 0 ? { photos: uploadedPhotos } : {}),
      },
      location: {
        latitude: draft.location?.latitude || 32.7767,
        longitude: draft.location?.longitude || -96.7970,
        address: draft.location?.address || 'Dallas, TX',
        ...(draft.location?.description ? { description: draft.location.description } : {})
      },
    };

    const created = await createSuggestion(payload);
    createdSuggestionId.value = created.id || created._id || 'mock-sug-12345';

    submissionProgress.value = 100;
    submissionStatus.value = 'success';
    dynamicProgressMessage.value = 'Submission complete!';

    clearWizardDraft();
    Object.assign(draft, getInitialDraft());
  } catch (err) {
    console.error('Submission failed:', err);
    submissionStatus.value = 'failed';
    submissionErrorMessage.value = err.message || 'Unknown network error';
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
  persistDraft();
  if (draft.step === 2) {
    initMap();
  }
});
</script>
