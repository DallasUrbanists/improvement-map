<template>
  <div class="flex flex-col h-full">

    <!-- ================= STEP 1: DESCRIBE ================= -->
    <div v-if="draft.step === 1" class="space-y-5 p-6 flex-grow min-h-0 overflow-y-auto">
      <div>
        <h2 class="text-2xl font-bold">Describe your idea</h2>
      </div>

      <div>
        <textarea
          id="input-details"
          ref="detailsInput"
          v-model="draft.details"
          @input="onDetailsInput"
          :disabled="isGrammarLoading || isClarityLoading"
          :readonly="speechActive"
          rows="5"
          placeholder=""
          class="block w-full resize-none overflow-hidden px-4 py-3 rounded rounded-b-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none mb-0"
          required
        ></textarea>
        <div class="relative flex items-stretch rounded-b border border-t-0 border-zinc-300 dark:border-zinc-700">
          <button
            ref="recordButton"
            type="button"
            @click="toggleSpeechRecognition"
            :aria-pressed="speechActive"
            :aria-busy="recordingState === 'starting' || recordingState === 'stopping'"
            :disabled="recordingState === 'stopping' || isGrammarLoading || isClarityLoading"
            class="flex-1 gap-2 rounded-t-none px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:focus:ring-offset-zinc-900 cursor-pointer"
            :class="[
              isRecording
                            ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 animate-pulse shadow-lg shadow-red-500/70'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 focus:ring-zinc-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700',
              showAutoImprove ? 'rounded-bl-md rounded-br-none' : 'rounded-bl-md rounded-br-md',
            ]"
          >
            <i :class="recordingState === 'starting' || recordingState === 'stopping' ? 'fa-solid fa-spinner animate-spin mr-1' : (isRecording ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-microphone mr-1')"></i>
            {{ recordingState === 'starting' ? (hasStartedRecording ? 'Please wait' : 'Cancel recording') : (recordingState === 'stopping' ? 'Stopping…' : (isRecording ? 'Stop recording' : (showAutoImprove ? 'Record' : 'Record speech to text'))) }}
          </button>
          <div v-if="showAutoImprove" class="relative border-l border-zinc-300 dark:border-zinc-600">
            <button
              ref="autoImproveButton"
              type="button"
              @click="toggleAutoImproveMenu"
              :aria-expanded="isAutoImproveOpen"
              aria-haspopup="menu"
              aria-controls="auto-improve-menu"
              :disabled="isGrammarLoading || isClarityLoading"
              class="h-full cursor-pointer disabled:cursor-wait disabled:opacity-70 rounded-br-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>
              Auto improve
              <i class="fa-solid fa-chevron-down ml-1 text-xs"></i>
            </button>
            <div
              v-if="isAutoImproveOpen"
              id="auto-improve-menu"
              ref="autoImproveMenu"
              role="menu"
              :style="{ maxHeight: autoImproveMenuMaxHeight === null ? undefined : `${autoImproveMenuMaxHeight}px` }"
              :class="isAutoImproveOpensUp ? 'absolute right-0 bottom-full z-30 mb-1' : 'absolute right-0 top-full z-30 mt-1'"
              class="min-w-56 max-h-48 overflow-y-auto rounded border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <button type="button" role="menuitem" @click="handleFixGrammarAndSpelling" class="w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-70 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Fix grammar and spelling
              </button>
              <button type="button" role="menuitem" @click="handleImproveClarity" class="w-full px-4 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Improve clarity and structure
              </button>
            </div>
          </div>
        </div>
        <p v-if="isGrammarLoading" class="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite">
          <i class="fa-solid fa-spinner animate-spin"></i>
          Fixing grammar and spelling…
        </p>
        <p v-if="grammarError" class="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {{ grammarError }}
        </p>
        <p v-if="clarityError" class="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {{ clarityError }}
        </p>
        <p v-if="speechActive" class="mt-2 text-xs text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite">
          {{ recordingState === 'starting' ? (hasStartedRecording ? 'Resuming recording… Please wait.' : 'Starting microphone… Allow access if prompted, or cancel.') : (recordingState === 'stopping' ? 'Finishing transcription…' : 'Listening…') }}
        </p>
        <p v-if="speechError" class="text-xs text-red-600 dark:text-red-400" role="status">
          {{ speechError }}
        </p>
        <p v-if="speechError" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          If recording is unavailable, tap the text box and use your keyboard’s microphone for dictation.
        </p>
        <p v-if="errors.details" class="text-xs text-red-500 mt-1 flex items-center gap-1">
          <i class="fa-solid fa-circle-exclamation"></i>
          {{ errors.details }}
        </p>
      </div>

      <div ref="stepOneNextContainer" class="pt-4 flex justify-end">
        <k-button
          type="button"
          @click="validateAndNextStep1"
          :disabled="isGrammarLoading || isClarityLoading"
          large
          class="font-bold px-8"
        >
          <span>Next</span>
          <i class="fa-solid fa-arrow-right ml-2"></i>
        </k-button>
      </div>
    </div>

    <!-- ================= STEP 2: LOCATE ================= -->
    <div v-else-if="draft.step === 2" class="flex-grow flex flex-col">
      <!-- Header -->
      <div class="p-6">
        <h2 class="text-2xl font-bold mb-1">Pin Suggestion Location</h2>
        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Drag the map or search an address to set the exact coordinates.
        </p>
      </div>

      <!-- Location description bar -->
      <div class="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700 text-xs flex items-center justify-between gap-2 z-20">
        <div class="truncate flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <i class="fa-solid fa-map-pin text-zinc-500"></i>
          <span class="font-semibold">{{ displayAddress || 'Tap or drag pin to set location' }}</span>
        </div>
        <div v-if="draft.location?.latitude" class="text-[11px] text-zinc-500 font-mono flex-shrink-0">
          {{ Number(draft.location.latitude).toFixed(4) }}, {{ Number(draft.location.longitude).toFixed(4) }}
        </div>
      </div>

      <!-- Google Maps Target Container Wrapper -->
      <div class="relative w-full flex-grow flex flex-col bg-zinc-900">
        <!-- Search Bar Overlay with Autocomplete Dropdown -->
        <div class="absolute top-3 left-3 right-3 z-30 flex flex-col max-w-lg">
          <div class="relative flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded border border-zinc-300 dark:border-zinc-700 shadow-lg">
            <span class="pl-3.5 pr-2 text-zinc-400">
              <i class="fa-solid fa-magnifying-glass"></i>
            </span>
            <input
              type="text"
              v-model="mapSearchQuery"
              @input="onSearchInput"
              placeholder="Search..."
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
            class="mt-1 bg-white dark:bg-zinc-900 rounded border border-zinc-300 dark:border-zinc-700 shadow-2xl max-h-52 overflow-y-auto z-40 divide-y divide-zinc-200 dark:divide-zinc-800"
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

      <!-- Basemap Switcher (Streets / Satellite) with Konsta Segmented -->
      <div
        class="absolute bottom-3 left-3 z-30 flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded border border-zinc-300 dark:border-zinc-700 shadow-lg p-0.5">
        <k-segmented :raised="true" class="w-auto">
          <k-segmented-button :active="currentMapType === 'roadmap'" @click="setMapType('roadmap')" small
            class="text-xs font-bold px-2.5 py-1">
            <i class="fa-solid fa-road mr-1"></i>
            Streets
          </k-segmented-button>
          <k-segmented-button :active="currentMapType === 'hybrid'" @click="setMapType('hybrid')" small
            class="text-xs font-bold px-2.5 py-1">
            <i class="fa-solid fa-earth-americas mr-1"></i>
            Satellite
          </k-segmented-button>
          <k-segmented-button @click="requestGps" small
            class="text-xs font-bold px-2.5 py-1"
            title="Center on my location" aria-label="Center on my location">
            <i class="fa-solid fa-crosshairs mr-1" :class="{ 'animate-spin': isLocating }"></i>
            Recenter
          </k-segmented-button>
        </k-segmented>
      </div>
        
      </div>

      <!-- Back / Next -->
      <div class="p-4 flex items-center justify-between gap-3">
        <k-button
          type="button"
          @click="prevStep"
          :outline="true"
          large
          class="font-bold text-base px-8"
        >
          <i class="fa-solid fa-arrow-left mr-2"></i>
          Back
        </k-button>

        <k-button
          type="button"
          @click="nextStep"
          large
          class="font-bold text-base px-8"
        >
          <span>Next</span>
          <i class="fa-solid fa-arrow-right ml-2"></i>
        </k-button>
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
            class="w-full px-4 py-3 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none mb-5"
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
    </div>

    <!-- ================= STEP 3: PHOTO ================= -->
    <div v-else-if="draft.step === 3" class="p-6 space-y-5 flex-grow min-h-0 overflow-y-auto">
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
      <div v-if="isProcessingPhotos" class="p-3 rounded bg-zinc-100 dark:bg-zinc-800 text-xs flex items-center gap-2">
        <k-preloader class="w-4 h-4" />
        <span>Compressing & optimizing image(s)...</span>
      </div>

      <!-- Error Alert -->
      <div v-if="photoError" class="p-3 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ photoError }}</span>
        </div>
        <button @click="photoError = ''" class="text-red-500 hover:text-black dark:hover:text-white">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>


      <!-- Photos Grid with Konsta Card -->
      <div
        v-if="draft.photos && draft.photos.length > 0"
      >
        <div
          v-for="(photo, index) in draft.photos"
          :key="photo.id || index"
          :content-wrap="false"
          class="rounded-2xl mb-4 flex flex-col gap-2 relative"
        >
          <div class="relative w-full rounded overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
            <img
              :src="photo.dataUrl || photo.url"
              :alt="photo.caption || 'Photo'"
              class="w-full h-full object-contain"
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
        </div>
      </div>

      <div class="pt-4 flex items-center justify-between gap-3">
        <k-button
          type="button"
          @click="prevStep"
          :outline="true"
          large
          class="font-bold text-base px-8 py-3.5 shadow-lg"
        >
          <i class="fa-solid fa-arrow-left mr-2"></i>
          Back
        </k-button>

        <k-button
          type="button"
          @click="nextStep"
          large
          class="font-bold text-base px-8"
        >
          <span>{{ (draft.photos || []).length === 0 ? 'Skip' : 'Next' }}</span>
          <i class="fa-solid fa-arrow-right ml-2"></i>
        </k-button>
      </div>
    </div>

    <!-- ================= STEP 4: REVIEW & SUBMIT ================= -->
    <div v-else-if="draft.step === 4" class="p-6 space-y-6 flex-grow min-h-0 overflow-y-auto">
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
        class="p-4 rounded !mx-0"
      >
        <div class="flex flex-row justify-stretch items-center mb-2 w-auto">
          <h3 class="font-bold uppercase whitespace-nowrap flex-grow w-auto">
            <i class="fa-solid fa-lightbulb"></i>
            DESCRIPTION
          </h3>
          <k-button
            type="button"
            @click="goToStep(1)"
            :clear="true"
            small
            class="text-xs font-bold w-auto"
          >
            <i class="fa-solid fa-pen-to-square mr-1"></i>
            Edit
          </k-button>
        </div>
        <p class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          {{ draft.details || '(No details provided)' }}
        </p>
        <p v-if="draft.location?.description" class="text-xs text-zinc-500 mt-1">
          <span class="font-semibold text-zinc-600 dark:text-zinc-400">Note:</span> {{ draft.location.description }}
        </p>
        <p v-if="draft.location?.latitude" class="text-[11px] text-zinc-400 font-mono mt-1">
          {{ Number(draft.location.latitude).toFixed(5) }}, {{ Number(draft.location.longitude).toFixed(5) }}
        </p>
      </k-card>
          

      <!-- Review Section: Step 2 Locate -->
      <k-card
        :outline="true"
        :content-wrap="false"
        class="p-4 rounded !mx-0"
      >
        <div class="flex flex-row justify-stretch items-center mb-2 w-auto">
          <h3 class="font-bold uppercase whitespace-nowrap flex-grow w-auto">
            <i class="fa-solid fa-location-dot"></i>
            Location
          </h3>
          <k-button
            type="button"
            @click="goToStep(2)"
            :clear="true"
            small
            class="text-xs font-bold w-auto"
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
        class="p-4 rounded !mx-0"
      >
        <div class="flex flex-row justify-stretch items-center mb-2 w-auto">
          <h3 class="font-bold uppercase whitespace-nowrap flex-grow w-auto">
            <i class="fa-solid fa-camera"></i>
            Photos ({{ (draft.photos || []).length }})
          </h3>
          <k-button
            type="button"
            @click="goToStep(3)"
            :clear="true"
            small
            class="text-xs font-bold w-auto"
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
      <div class="pt-2 border-zinc-200 dark:border-zinc-800 space-y-4">
        <div>
          <label for="input-author-name" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Your name <span class="text-red-500">*</span></span>
            <span class="text-xs font-normal text-zinc-400">{{ (draft.author?.name || '').length }}/70</span>
          </label>
          <input
            id="input-author-name"
            type="text"
            v-model="draft.author.name"
            @input="persistDraft"
            maxlength="70"
            placeholder=""
            class="w-full px-4 py-3 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
            required
          />
          <p v-if="errors.authorName" class="text-xs text-red-500 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i>
            {{ errors.authorName }}
          </p>
        </div>

        <div>
          <label for="input-author-email" class="block text-sm font-bold mb-1.5">
            Your email <span class="text-red-500">*</span>
          </label>
          <input
            id="input-author-email"
            type="email"
            v-model="draft.author.email"
            @input="persistDraft"
            class="w-full px-4 py-3 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none"
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
          large
          class="font-bold text-base px-8 py-3.5 shadow-lg"
        >
          <i class="fa-solid fa-arrow-left mr-2"></i>
          Back
        </k-button>

        <k-button
          type="button"
          @click="submitFinalSuggestion"
          large
          class="font-bold text-base px-8 py-3.5 shadow-lg"
        >
          <i class="fa-solid fa-paper-plane mr-2"></i>
          Submit
        </k-button>
      </div>
    </div>

    <div
      v-if="isClarityLoading"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="flex items-center gap-4 rounded-lg border border-zinc-300 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <k-preloader class="h-8 w-8 flex-shrink-0" />
        <div>
          <h2 class="font-bold text-zinc-900 dark:text-white">Improving clarity and structure</h2>
          <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Please wait while we prepare a suggested rewrite.</p>
        </div>
      </div>
    </div>

    <div
      v-if="isRewriteModalOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewrite-modal-title"
    >
      <div class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-zinc-300 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-6">
        <h2 id="rewrite-modal-title" class="mb-4 text-lg font-bold text-zinc-900 dark:text-white">
          Accept rewrite of message?
        </h2>
        <div class="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
          {{ proposedRewrite }}
        </div>
        <div class="mt-5 flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <k-button type="button" :outline="true" @click="discardRewrite" class="font-semibold">
            Discard changes
          </k-button>
          <k-button type="button" @click="applyRewrite" class="font-bold">
            Apply rewrite
          </k-button>
        </div>
      </div>
    </div>

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

<script>
export default {
  name: 'SubmitView',
};
</script>

<script setup>
import { ref, reactive, computed, onMounted, onActivated, onDeactivated, onBeforeUnmount, watch, inject, nextTick } from 'vue';
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
  setStoredAuthorProfile,
} from '../services/storage';
import {
  requestPhotoUploadUrl,
  uploadPhotoBinary,
  createSuggestion,
  fixGrammarAndSpelling,
  improveClarityAndStructure,
  generateSuggestionSummary,
} from '../services/api';
import { resizeImage } from '../services/image';
import { createSpeechRecorder } from '../services/speechRecognition';
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
const detailsInput = ref(null);
const stepOneNextContainer = ref(null);
const recordButton = ref(null);
const autoImproveButton = ref(null);
const autoImproveMenu = ref(null);
const isAutoImproveOpen = ref(false);
const isAutoImproveOpensUp = ref(false);
const autoImproveMenuMaxHeight = ref(null);
const recordingState = ref('idle');
const hasStartedRecording = ref(false);
const speechActive = computed(() => recordingState.value !== 'idle');
const isRecording = computed(() => recordingState.value === 'listening');
const hasEnoughDetailsWords = computed(() => (draft.details || '').trim().split(/\s+/).filter(Boolean).length >= 3);
const showAutoImprove = computed(() => hasEnoughDetailsWords.value && !speechActive.value);
const speechError = ref('');
const isGrammarLoading = ref(false);
const grammarError = ref('');
const isClarityLoading = ref(false);
const clarityError = ref('');
const proposedRewrite = ref('');
const isRewriteModalOpen = ref(false);
const speechRecorder = createSpeechRecorder({
  onState: (state) => {
    recordingState.value = state;
    if (state === 'listening') hasStartedRecording.value = true;
    else if (state === 'idle') hasStartedRecording.value = false;
  },
  onError: (error) => { speechError.value = error; },
  onDiagnostic: (entry) => console.debug('[speech-recognition]', entry),
  onText: (text) => {
    draft.details = text;
    persistDraft();
    nextTick(() => {
      resizeDetailsInput();
      if (!areSpeechTargetsVisible()) {
        recordButton.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
      }
    });
  },
});

const errors = reactive({
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
  if (draft.author) {
    setStoredAuthorProfile(draft.author);
  }
  saveWizardDraft(draft);
}

function resizeDetailsInput() {
  if (!detailsInput.value) return;
  detailsInput.value.style.height = 'auto';
  const styles = window.getComputedStyle(detailsInput.value);
  const borders = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
  detailsInput.value.style.height = `${detailsInput.value.scrollHeight + borders}px`;
}

function areSpeechTargetsVisible() {
  if (!detailsInput.value || !recordButton.value) return true;

  const visualViewport = window.visualViewport;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
  const scrollContainer = detailsInput.value.closest('.overflow-y-auto');
  const scrollBounds = scrollContainer?.getBoundingClientRect();
  const visibleTop = Math.max(viewportTop, scrollBounds ? scrollBounds.top + scrollContainer.clientTop : viewportTop);
  const visibleBottom = Math.min(
    viewportBottom,
    scrollBounds ? scrollBounds.top + scrollContainer.clientTop + scrollContainer.clientHeight : viewportBottom,
  );
  const textareaBottom = detailsInput.value.getBoundingClientRect().bottom;
  const buttonBounds = recordButton.value.getBoundingClientRect();

  return textareaBottom >= visibleTop
    && textareaBottom <= visibleBottom
    && buttonBounds.top >= visibleTop
    && buttonBounds.bottom <= visibleBottom;
}

function onDetailsInput() {
  resizeDetailsInput();
  persistDraft();
}

function toggleAutoImproveMenu() {
  isAutoImproveOpen.value = !isAutoImproveOpen.value;
  if (isAutoImproveOpen.value) {
    isAutoImproveOpensUp.value = false;
    autoImproveMenuMaxHeight.value = null;
  }
}

async function handleFixGrammarAndSpelling() {
  isAutoImproveOpen.value = false;
  grammarError.value = '';
  isGrammarLoading.value = true;

  try {
    draft.details = await fixGrammarAndSpelling(draft.details || '');
    persistDraft();
    await nextTick();
    resizeDetailsInput();
    if (!areSpeechTargetsVisible()) {
      recordButton.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
    }
  } catch (error) {
    grammarError.value = error instanceof Error ? error.message : 'Could not fix grammar and spelling. Please try again.';
  } finally {
    isGrammarLoading.value = false;
  }
}

async function handleImproveClarity() {
  isAutoImproveOpen.value = false;
  clarityError.value = '';
  proposedRewrite.value = '';
  isClarityLoading.value = true;

  try {
    proposedRewrite.value = await improveClarityAndStructure(draft.details || '');
    isRewriteModalOpen.value = true;
  } catch (error) {
    clarityError.value = error instanceof Error ? error.message : 'Could not improve clarity and structure. Please try again.';
  } finally {
    isClarityLoading.value = false;
  }
}

function discardRewrite() {
  isRewriteModalOpen.value = false;
  proposedRewrite.value = '';
}

async function applyRewrite() {
  draft.details = proposedRewrite.value;
  persistDraft();
  isRewriteModalOpen.value = false;
  proposedRewrite.value = '';
  await nextTick();
  resizeDetailsInput();
  stepOneNextContainer.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
}

function updateAutoImproveMenuPosition() {
  if (!autoImproveButton.value || !autoImproveMenu.value) return;

  const buttonBounds = autoImproveButton.value.getBoundingClientRect();
  const scrollContainer = autoImproveButton.value.closest('.overflow-y-auto');
  const scrollBounds = scrollContainer?.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
  const visibleTop = Math.max(viewportTop, scrollBounds?.top ?? viewportTop);
  const visibleBottom = Math.min(viewportBottom, scrollBounds?.bottom ?? viewportBottom);
  const spaceAbove = Math.max(0, buttonBounds.top - visibleTop);
  const spaceBelow = Math.max(0, visibleBottom - buttonBounds.bottom);
  const opensUp = spaceBelow < autoImproveMenu.value.scrollHeight + 8 && spaceAbove > spaceBelow;

  isAutoImproveOpensUp.value = opensUp;
  autoImproveMenuMaxHeight.value = Math.max(0, (opensUp ? spaceAbove : spaceBelow) - 8);
}

watch(isAutoImproveOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', updateAutoImproveMenuPosition, true);
    window.addEventListener('resize', updateAutoImproveMenuPosition);
    nextTick(updateAutoImproveMenuPosition);
  } else {
    window.removeEventListener('scroll', updateAutoImproveMenuPosition, true);
    window.removeEventListener('resize', updateAutoImproveMenuPosition);
  }
});

function toggleSpeechRecognition() {
  if (speechActive.value) {
    speechRecorder.stop();
    return;
  }
  isAutoImproveOpen.value = false;
  speechRecorder.start(draft.details || '');
}

function cancelHiddenRecording() {
  if (document.hidden) speechRecorder.cancel();
}

watch(hasEnoughDetailsWords, (hasEnoughWords) => {
  if (!hasEnoughWords) isAutoImproveOpen.value = false;
});

watch(() => draft.step, (step) => {
  if (step === 1) nextTick(resizeDetailsInput);
  else speechRecorder.cancel();
}, { immediate: true });

onActivated(() => {
  document.addEventListener('visibilitychange', cancelHiddenRecording);
  window.addEventListener('pagehide', speechRecorder.cancel);
});

function deactivateSpeechRecorder() {
  speechRecorder.cancel();
  document.removeEventListener('visibilitychange', cancelHiddenRecording);
  window.removeEventListener('pagehide', speechRecorder.cancel);
}

onDeactivated(deactivateSpeechRecorder);
onBeforeUnmount(() => {
  deactivateSpeechRecorder();
  window.removeEventListener('scroll', updateAutoImproveMenuPosition, true);
  window.removeEventListener('resize', updateAutoImproveMenuPosition);
});

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
  errors.details = '';

  const detailsTrimmed = (draft.details || '').trim();

  if (!detailsTrimmed) {
    errors.details = 'Details description is required.';
  } else {
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

    submissionProgress.value = 80;
    dynamicProgressMessage.value = 'Generating suggestion summary...';
    const details = draft.details.trim();
    let summary = details.slice(0, 120);
    try {
      summary = await generateSuggestionSummary(details);
    } catch (error) {
      console.warn('Summary generation failed; using description excerpt:', error);
    }

    submissionProgress.value = 85;
    dynamicProgressMessage.value = 'Submitting suggestion...';

    const payload = {
      author: {
        name: draft.author.name.trim(),
        email: draft.author.email.trim(),
      },
      content: {
        summary,
        details,
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
