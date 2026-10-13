<template>
  <div class="flex flex-col h-full">

    <!-- ================= STEP 3: DESCRIBE ================= -->
    <div v-if="draft.step === 3" class="flex flex-grow min-h-0 flex-col">
      <div class="flex flex-grow min-h-0 flex-col gap-5 overflow-y-auto p-6">
      <div>
        <h2 class="text-2xl font-bold">Describe your idea</h2>
      </div>

      <div class="flex min-h-0 flex-grow flex-col">
        <textarea
          id="input-details"
          ref="detailsInput"
          v-model="draft.details"
          @input="onDetailsInput"
          :disabled="isGrammarLoading || isClarityLoading"
          :readonly="speechActive"
          rows="5"
          :placeholder="hasEncounteredBlockedMicrophone ? 'If recording is unavailable, tap the text box and use your keyboard’s microphone for dictation.' : ''"
          class="block min-h-40 w-full flex-grow flex-shrink-0 resize-none overflow-hidden px-4 py-3 rounded rounded-b-none bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-black dark:text-white placeholder-zinc-400 focus:outline-none mb-0"
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
        <p v-if="speechError && !isMicrophoneAccessBlocked" class="text-xs text-red-600 dark:text-red-400" role="status">
          {{ speechError }}
        </p>
        <p v-if="errors.details" class="text-xs text-red-500 mt-1 flex items-center gap-1">
          <i class="fa-solid fa-circle-exclamation"></i>
          {{ errors.details }}
        </p>
      </div>

      </div>

      <div ref="stepThreeNextContainer" data-testid="step-three-navigation" class="sticky bottom-0 z-30 flex-shrink-0 border-t border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
        <k-segmented :raised="!isDark" :outline="isDark" class="w-full" aria-label="Description step navigation">
          <k-segmented-button type="button" class="flex-1 justify-center gap-2 font-bold" @click="prevStep">
            <i class="fa-solid fa-arrow-left"></i>
            Back
          </k-segmented-button>
          <k-segmented-button
            type="button"
            :disabled="isGrammarLoading || isClarityLoading"
            class="flex-1 justify-center gap-2 font-bold"
            @click="validateAndNextStep3"
          >
            Next
            <i class="fa-solid fa-arrow-right"></i>
          </k-segmented-button>
        </k-segmented>
      </div>

      <k-toast
        v-if="isMicrophoneAccessBlocked && !isMicrophoneToastDismissed"
        data-testid="microphone-error-toast"
        :opened="true"
        position="center"
        :style="{ top: '1rem', bottom: 'auto', touchAction: 'none' }"
        role="status"
        aria-live="polite"
        @pointerdown="startToastSwipe"
        @pointerup="dismissToastOnSwipe($event, 'microphone')"
        @pointercancel="cancelToastSwipe"
      >
        <div class="flex items-center gap-2 text-sm">
          <i class="fa-solid fa-microphone-slash text-red-500" aria-hidden="true"></i>
          <span>{{ speechError }}</span>
          <button type="button" class="ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white" aria-label="Dismiss notification" @click="isMicrophoneToastDismissed = true">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      </k-toast>
    </div>

    <!-- ================= STEP 1: LOCATE ================= -->
    <div v-else-if="draft.step === 1" class="flex-grow flex flex-col">
      <div ref="submitMapFrame" data-testid="submit-map-frame" class="relative flex-grow overflow-hidden">
        <div class="absolute inset-0">
          <div ref="mapContainerEl" class="w-full h-full"></div>
          <div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
            <svg ref="pinCrosshair" data-testid="suggestion-location-crosshair" class="h-[50px] w-[50px] drop-shadow" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="17" :fill="pinButtonColor" />
              <g transform="translate(25 25)" fill="none" :stroke="crosshairStrokeColor" stroke-width="3">
                <circle r="9" />
                <path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25" />
                <circle r="2" :fill="crosshairStrokeColor" stroke="none" />
              </g>
            </svg>
          </div>

          <div
            v-if="!hasGoogleMapsKey || googleMapsAuthError"
            class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/95 text-zinc-300 z-20 backdrop-blur-sm"
          >
            <i class="fa-solid fa-triangle-exclamation text-3xl text-amber-500 mb-3"></i>
            <h4 class="text-base font-bold text-white mb-1">Google Maps Setup Required</h4>
            <p class="text-xs text-zinc-300 max-w-sm mb-4 leading-relaxed">
              {{ googleMapsAuthError || 'Set VITE_GOOGLE_MAPS_API_KEY in your .env file and restart Vite (npm run dev).' }}
            </p>
            <div class="text-[11px] text-zinc-400 bg-zinc-800/80 p-3 rounded-xl border border-zinc-700 text-left max-w-sm">
              <div class="font-semibold text-zinc-200 mb-1">Required in Google Cloud Console:</div>
              <ul class="list-disc list-inside space-y-0.5">
                <li><strong>Maps JavaScript API</strong> enabled</li>
                <li><strong>Places API</strong> enabled</li>
                <li><strong>Geocoding API</strong> enabled</li>
                <li>Billing account linked to GCP project</li>
              </ul>
            </div>
          </div>

          <div
            v-else-if="!isMapReady"
            class="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 z-10"
          >
            <k-preloader class="w-8 h-8 mb-2" />
            <span class="text-xs font-semibold">Loading Map...</span>
          </div>
        </div>

        <div class="absolute top-3 left-3 right-3 sm:right-auto sm:w-96 z-30 flex flex-col">
          <div class="relative flex items-center rounded-xl border border-zinc-300 bg-white/95 shadow-xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
            <span class="pl-3 pr-2 text-zinc-400"><i class="fa-solid fa-magnifying-glass"></i></span>
            <input
              ref="mapSearchInput"
              type="text"
              v-model="mapSearchQuery"
              @focus="onMapSearchFocus"
              @blur="onMapSearchBlur"
              @input="onSearchInput"
              placeholder="Search address or neighborhood..."
              aria-label="Search or edit suggestion location"
              class="w-full bg-transparent py-2.5 pr-8 text-xs text-black placeholder-zinc-400 focus:outline-none dark:text-white sm:text-sm"
            />
            <button
              v-if="mapSearchQuery"
              @pointerdown.prevent
              @click="clearMapSearch"
              class="p-2 text-zinc-400 hover:text-black dark:hover:text-white"
              type="button"
              aria-label="Clear search"
            >
              <i class="fa-solid fa-xmark text-sm"></i>
            </button>
            <span v-if="isSearching" class="pr-3 text-zinc-400"><i class="fa-solid fa-spinner animate-spin text-sm"></i></span>
          </div>

          <div v-if="mapSearchResults.length > 0" class="mt-1 max-h-56 divide-y divide-zinc-200 overflow-y-auto rounded-xl border border-zinc-300 bg-white shadow-2xl dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              v-for="item in mapSearchResults"
              :key="item.id"
              type="button"
              @pointerdown.prevent
              @click="selectAddress(item)"
              class="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-xs text-black transition-colors hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800 sm:text-sm"
            >
              <i class="fa-solid fa-location-dot mt-0.5 flex-shrink-0 text-zinc-500"></i>
              <span class="line-clamp-2">{{ item.displayName }}</span>
            </button>
          </div>
        </div>

        <div ref="centerOnLocationButton" data-testid="center-on-location-control" class="absolute bottom-20 left-2 z-30 flex items-center rounded-xl border border-zinc-300 bg-white/95 p-0.5 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
          <k-segmented :raised="!isDark" :outline="isDark" class="w-auto">
            <k-segmented-button
              @click="requestGpsLocation"
              class="px-3 py-1 text-xs font-bold"
              title="Center on my location"
              aria-label="Center on my location"
            >
              <i class="fa-solid fa-crosshairs" :class="{ 'animate-spin': isLocating }"></i>
            </k-segmented-button>
          </k-segmented>
        </div>

        <div class="absolute bottom-8 left-3 right-16 z-30 flex items-center rounded-xl border border-zinc-300 bg-white/95 p-0.5 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
          <k-segmented :raised="!isDark" :outline="isDark" class="w-full" aria-label="Suggestion map options">
            <k-segmented-button :active="currentMapType === 'roadmap'" @click="setMapType('roadmap')" small class="flex-1 justify-center px-2.5 py-1 text-xs font-bold">
              Streets
            </k-segmented-button>
            <k-segmented-button :active="currentMapType === 'hybrid'" @click="setMapType('hybrid')" small class="flex-1 justify-center px-2.5 py-1 text-xs font-bold">
              Satellite
            </k-segmented-button>
          </k-segmented>
        </div>

        <k-button
          type="button"
          data-testid="pin-and-continue"
          @click="nextStep"
          small
          :style="pinButtonStyle"
          :outline="true"
          class="pointer-events-auto absolute left-1/2 z-30 w-auto -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-4 font-bold shadow-lg hover:brightness-110"
        >
          Set pin and continue
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

    <!-- ================= STEP 2: PHOTO ================= -->
    <div v-else-if="draft.step === 2" class="flex flex-grow min-h-0 flex-col">
      <div class="flex-grow min-h-0 space-y-5 overflow-y-auto p-6">
        <div>
          <h2 class="text-2xl font-bold mb-1">Attach photos</h2>
        </div>

        <div v-if="photoError" class="flex items-center justify-between rounded bg-red-100 p-3 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>{{ photoError }}</span>
          </div>
          <button type="button" @click="photoError = ''" class="text-red-500 hover:text-black dark:hover:text-white" aria-label="Dismiss photo error">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div v-if="draft.photos?.length" class="space-y-2">
          <div
            ref="photoViewer"
            data-testid="photo-swipe-viewer"
            class="hide-scrollbar -mx-6 flex min-h-0 w-[calc(100%+3rem)] snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 touch-pan-x"
            :style="photoViewerStyle"
            aria-label="Attached photos; swipe horizontally to browse"
            @scroll.passive="updateActivePhotoIndex"
          >
            <div
              v-for="(photo, index) in draft.photos"
              :key="photo.id || index"
              class="relative flex h-full w-[calc(100vw-3rem)] flex-none snap-start flex-col"
            >
              <div class="relative min-h-0 w-full flex-grow overflow-hidden rounded-t-lg border border-zinc-200 bg-zinc-900 dark:border-zinc-700">
                <img
                  :src="photo.dataUrl || photo.url"
                  :alt="photo.caption || `Photo ${index + 1}`"
                  class="h-full w-full object-contain"
                />
                <button
                  type="button"
                  @click="removePhoto(index)"
                  class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-500 active:scale-90"
                  :aria-label="`Remove photo ${index + 1}`"
                >
                  <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>

              <input
                type="text"
                v-model="photo.caption"
                @input="persistDraft"
                placeholder="Add photo caption (optional)..."
                :aria-label="`Caption for photo ${index + 1}`"
                class="w-full flex-shrink-0 rounded-b-lg rounded-t-none border border-t-0 border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-black placeholder-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div v-if="draft.photos.length > 1" class="flex items-center justify-center gap-3 text-xs text-zinc-500" aria-label="Photo navigation">
            <button
              type="button"
              @click="scrollToPhoto(activePhotoIndex - 1)"
              :disabled="activePhotoIndex === 0"
              aria-label="Previous photo"
              class="px-1 py-1 text-zinc-700 disabled:opacity-40 dark:text-zinc-200"
            >
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="flex items-center justify-center gap-2">
              <button
                v-for="(_, index) in draft.photos"
                :key="index"
                type="button"
                @click="scrollToPhoto(index)"
                :aria-label="`Show photo ${index + 1}`"
                :aria-current="activePhotoIndex === index ? 'true' : undefined"
                class="h-2 w-2 rounded-full transition-colors"
                :class="activePhotoIndex === index ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'"
              ></button>
              <span class="ml-1">{{ activePhotoIndex + 1 }} / {{ draft.photos.length }}</span>
            </div>
            <button
              type="button"
              @click="scrollToPhoto(activePhotoIndex + 1)"
              :disabled="activePhotoIndex === draft.photos.length - 1"
              aria-label="Next photo"
              class="px-1 py-1 text-zinc-700 disabled:opacity-40 dark:text-zinc-200"
            >
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-zinc-500 dark:text-zinc-400">
          Photos are optional. Add images to show the location or conditions.
        </p>
      </div>

      <div data-testid="photo-step-controls" class="sticky bottom-0 z-30 flex-shrink-0 space-y-2 border-t border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
        <k-segmented data-testid="photo-action-segment" :raised="!isDark" :outline="isDark" class="w-full" aria-label="Add photos">
          <k-segmented-button
            type="button"
            :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
            class="flex-1 justify-center gap-2 text-sm font-bold"
            @click="openFilePicker"
          >
            <i class="fa-solid fa-cloud-arrow-up"></i>
            Upload photos
          </k-segmented-button>
          <k-segmented-button
            type="button"
            :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
            class="flex-1 justify-center gap-2 text-sm font-bold"
            @click="openCameraPicker"
          >
            <i class="fa-solid fa-camera"></i>
            Take photo
          </k-segmented-button>
        </k-segmented>

        <input
          ref="fileInput"
          type="file"
          accept="image/*,.svg"
          multiple
          class="hidden"
          :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
          @change="handleFilesSelected"
        />
        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          :disabled="(draft.photos || []).length >= 10 || isProcessingPhotos"
          @change="handleFilesSelected"
        />

        <k-segmented data-testid="photo-navigation-segment" :raised="!isDark" :outline="isDark" class="w-full" aria-label="Photo step navigation">
          <k-segmented-button type="button" class="flex-1 justify-center gap-2 font-bold" @click="prevStep">
            <i class="fa-solid fa-arrow-left"></i>
            Back
          </k-segmented-button>
          <k-segmented-button type="button" class="flex-1 justify-center gap-2 font-bold" @click="nextStep">
            Next
            <i class="fa-solid fa-arrow-right"></i>
          </k-segmented-button>
        </k-segmented>
      </div>
    </div>

    <k-toast
      v-if="isProcessingPhotos && !isPhotoToastDismissed"
      data-testid="photo-processing-toast"
      :opened="true"
      position="center"
      :style="{ top: '1rem', bottom: 'auto', touchAction: 'none' }"
      role="status"
      aria-live="polite"
      @pointerdown="startToastSwipe"
      @pointerup="dismissToastOnSwipe($event, 'photo')"
      @pointercancel="cancelToastSwipe"
    >
      <div class="flex items-center gap-2 text-sm">
        <k-preloader class="h-4 w-4" />
        <span>Compressing & optimizing image(s)...</span>
        <button type="button" class="ml-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white" aria-label="Dismiss notification" @click="isPhotoToastDismissed = true">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    </k-toast>

    <!-- ================= STEP 4: REVIEW & SUBMIT ================= -->
    <div v-else-if="draft.step === 4" class="flex flex-grow min-h-0 flex-col">
      <div class="flex-grow min-h-0 space-y-6 overflow-y-auto p-6">
      <div>
        <h2 class="text-2xl font-bold mb-1">Review submission</h2>
        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Verify your suggestion details before publishing.
        </p>
      </div>

      <!-- Review Section: Location -->
      <k-card
        :outline="true"
        :content-wrap="false"
        class="p-0 rounded !mx-0"
      >
        <div class="flex flex-row justify-stretch items-center px-4 pt-4 pb-2 w-auto">
          <h3 class="font-bold uppercase whitespace-nowrap flex-grow w-auto">
            <i class="fa-solid fa-location-dot"></i>
            Location
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
        <div class="relative overflow-hidden border-y border-zinc-200 dark:border-zinc-700">
          <div class="relative flex items-center border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <input
              type="text"
              :value="draft.location?.address || 'Dallas, TX'"
              readonly
              aria-label="Selected location address"
              class="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none dark:text-zinc-100"
            />
            <button
              type="button"
              @click="centerReviewMap"
              title="Center map on selected location"
              aria-label="Center map on selected location"
              class="ml-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            ><i class="fa-solid fa-crosshairs" aria-hidden="true"></i></button>
          </div>
          <div class="relative aspect-square bg-zinc-100 dark:bg-zinc-800" aria-label="Map preview of selected location">
            <div ref="reviewMapContainer" class="absolute inset-0"></div>
            <div class="absolute left-2 top-2 z-20 rounded-xl border border-zinc-300 bg-white/95 p-0.5 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
              <k-segmented :raised="!isDark" :outline="isDark" class="w-auto" aria-label="Review map view">
                <k-segmented-button :active="reviewMapType === 'roadmap'" @click="setReviewMapType('roadmap')" small class="justify-center px-2.5 py-1 text-xs font-bold">Streets</k-segmented-button>
                <k-segmented-button :active="reviewMapType === 'hybrid'" @click="setReviewMapType('hybrid')" small class="justify-center px-2.5 py-1 text-xs font-bold">Satellite</k-segmented-button>
              </k-segmented>
            </div>
            <div class="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
              <svg ref="reviewCrosshair" :style="reviewCrosshairStyle" class="absolute h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 drop-shadow" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="17" :fill="pinButtonColor" />
                <g transform="translate(25 25)" fill="none" :stroke="crosshairStrokeColor" stroke-width="3">
                  <circle r="9" />
                  <path d="M-25 0H-6 M6 0H25 M0-25V-6 M0 6V25" />
                  <circle r="2" :fill="crosshairStrokeColor" stroke="none" />
                </g>
              </svg>
            </div>
          </div>
          <p class="border-t border-zinc-200 px-3 py-2 text-[11px] font-mono text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            {{ Number(draft.location?.latitude ?? 32.7767).toFixed(5) }}, {{ Number(draft.location?.longitude ?? -96.797).toFixed(5) }}
          </p>
        </div>
        <p v-if="draft.location?.description" class="px-4 py-3 text-xs text-zinc-500">
          <span class="font-semibold text-zinc-600 dark:text-zinc-400">Note:</span> {{ draft.location.description }}
        </p>
      </k-card>

      <!-- Review Section: Photos -->
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
            @click="goToStep(2)"
            :clear="true"
            small
            class="text-xs font-bold w-auto"
          >
            <i class="fa-solid fa-pen-to-square mr-1"></i>
            Edit
          </k-button>
        </div>

        <div v-if="draft.photos && draft.photos.length > 0" class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
          <button
            v-for="(ph, idx) in draft.photos"
            :key="idx"
            type="button"
            @click="openPhotoLightbox(idx)"
            :aria-label="`Preview photo ${idx + 1}${ph.caption ? `: ${ph.caption}` : ''}`"
            class="relative rounded-lg overflow-hidden h-20 bg-zinc-800 border border-zinc-700 text-left"
          >
            <img :src="ph.dataUrl || ph.url" class="w-full h-full object-cover" alt="" />
            <span v-if="ph.caption" class="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white p-1 truncate">
              {{ ph.caption }}
            </span>
          </button>
        </div>
        <p v-else class="text-xs text-zinc-500">No photos attached.</p>
      </k-card>

      <!-- Review Section: Description -->
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
            @click="goToStep(3)"
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
      </k-card>

      <div
        v-if="isPhotoLightboxOpen"
        class="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Photo preview"
        @click.self="closePhotoLightbox"
        @pointerdown="startLightboxSwipe"
        @pointerup="finishLightboxSwipe"
        @pointercancel="lightboxPointerStart = null"
        @keydown.left.prevent="navigateLightbox(-1)"
        @keydown.right.prevent="navigateLightbox(1)"
        tabindex="0"
      >
        <button type="button" @click="closePhotoLightbox" aria-label="Close photo preview" class="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-3 text-white">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <button v-if="draft.photos.length > 1" type="button" @click.stop="navigateLightbox(-1)" aria-label="Previous photo" class="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <img
          v-if="draft.photos[lightboxPhotoIndex]"
          :src="draft.photos[lightboxPhotoIndex].dataUrl || draft.photos[lightboxPhotoIndex].url"
          :alt="draft.photos[lightboxPhotoIndex].caption || `Photo ${lightboxPhotoIndex + 1}`"
          class="max-h-[78vh] max-w-full select-none object-contain"
          draggable="false"
        />
        <button v-if="draft.photos.length > 1" type="button" @click.stop="navigateLightbox(1)" aria-label="Next photo" class="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <div class="mt-4 max-w-xl text-center text-sm text-white">
          <p>{{ draft.photos[lightboxPhotoIndex]?.caption || 'No caption' }}</p>
          <p v-if="draft.photos.length > 1" class="mt-2 text-xs text-white/70">{{ lightboxPhotoIndex + 1 }} / {{ draft.photos.length }}</p>
        </div>
      </div>

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

      </div>

      <div data-testid="step-four-navigation" class="sticky bottom-0 z-30 flex-shrink-0 border-t border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
        <k-segmented :raised="!isDark" :outline="isDark" class="w-full" aria-label="Review step navigation">
          <k-segmented-button type="button" class="flex-1 justify-center gap-2 font-bold" @click="prevStep">
            <i class="fa-solid fa-arrow-left"></i>
            Back
          </k-segmented-button>
          <k-segmented-button type="button" class="flex-1 justify-center gap-2 font-bold" @click="submitFinalSuggestion">
            Submit
            <i class="fa-solid fa-paper-plane"></i>
          </k-segmented-button>
        </k-segmented>
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
            @click="handleEditDetails"
            class="w-full font-bold shadow-lg"
          >
            <i class="fa-solid fa-pen-to-square mr-2"></i>
            Edit details
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
            Retry submission
          </k-button>

          <k-button
            v-if="submissionStatus === 'failed'"
            type="button"
            :outline="true"
            :rounded="true"
            @click="handleGoHome"
            class="w-full text-sm"
          >
            <i class="fa-solid fa-map-location-dot mr-2"></i>
            Go to browse
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
  kToast,
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
import { browseMapInitialization, sharedBrowseMap } from '../services/sharedBrowseMap';
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
const stepThreeNextContainer = ref(null);
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
const hasEncounteredBlockedMicrophone = ref(false);
const isMicrophoneToastDismissed = ref(false);
const isMicrophoneAccessBlocked = computed(() => speechError.value.startsWith('Microphone access is blocked.'));
watch(isMicrophoneAccessBlocked, (isBlocked) => {
  if (isBlocked) {
    hasEncounteredBlockedMicrophone.value = true;
    isMicrophoneToastDismissed.value = false;
  }
});
let toastPointerStart = null;

function startToastSwipe(event) {
  toastPointerStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
}

function cancelToastSwipe() {
  toastPointerStart = null;
}

function dismissToastOnSwipe(event, toastType) {
  if (!toastPointerStart || toastPointerStart.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - toastPointerStart.x;
  const deltaY = event.clientY - toastPointerStart.y;
  toastPointerStart = null;

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 60) return;
  if (toastType === 'microphone') isMicrophoneToastDismissed.value = true;
  if (toastType === 'photo') isPhotoToastDismissed.value = true;
}
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

// Step 1 Map & Location state
const mapContainerEl = ref(null);
const submitMapFrame = ref(null);
const pinCrosshair = ref(null);
const centerOnLocationButton = ref(null);
const pinAndContinueTop = ref('50%');
const isMapReady = ref(false);
const isLocating = ref(false);
const currentMapType = ref('roadmap');
const pinButtonColor = computed(() => (isDark.value ? '#60a5fa' : '#1e3a8a'));
const crosshairStrokeColor = '#ffffff';
const pinButtonStyle = computed(() => ({
  top: pinAndContinueTop.value,
  backgroundColor: pinButtonColor.value,
  color: isDark.value ? '#0f172a' : '#ffffff',
}));
const mapSearchQuery = ref('');
const mapSearchInput = ref(null);
const isMapSearchEditing = ref(false);
const mapSearchResults = ref([]);
const isSearching = ref(false);
let searchDebounce = null;

const isDescModalOpen = ref(false);
const tempDescription = ref('');

let map = null;
let googleMaps = null;
let mapIdleListener = null;
let mapClickListener = null;
let locationUpdateSequence = 0;
let isSubmitViewActive = false;

// Step 2 Photo state
const fileInput = ref(null);
const cameraInput = ref(null);
const photoViewer = ref(null);
const activePhotoIndex = ref(0);
const reviewMapContainer = ref(null);
const reviewCrosshair = ref(null);
const reviewCrosshairStyle = ref({ left: '50%', top: '50%' });
const reviewMapType = ref('roadmap');
let reviewMapInstance = null;
const isPhotoLightboxOpen = ref(false);
const lightboxPhotoIndex = ref(0);
let lightboxPointerStart = null;
const photoViewerStyle = {
  height: 'min(50vh, 28rem)',
  maxHeight: 'calc(100dvh - 17rem)',
  scrollPaddingInline: '1.5rem',
};
const isProcessingPhotos = ref(false);
const isPhotoToastDismissed = ref(false);
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
      return 'Locate';
    case 2:
      return 'Photo';
    case 3:
      return 'Describe';
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

function updatePinAndContinuePosition() {
  const frame = submitMapFrame.value;
  const crosshair = pinCrosshair.value;
  const locationControl = centerOnLocationButton.value;
  if (!frame || !crosshair || !locationControl) return;

  const frameBounds = frame.getBoundingClientRect();
  const crosshairBounds = crosshair.getBoundingClientRect();
  const locationButton = locationControl.querySelector('button, a') || locationControl;
  const locationButtonTop = locationButton.getBoundingClientRect().top;
  const crosshairCenter = crosshairBounds.top + crosshairBounds.height / 2;
  const midpoint = (crosshairCenter + locationButtonTop) / 2;
  pinAndContinueTop.value = `${midpoint - frameBounds.top}px`;
}

watch(displayAddress, (address) => {
  if (!isMapSearchEditing.value) mapSearchQuery.value = address;
}, { immediate: true });

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
  stepThreeNextContainer.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
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
  if (step === 3) nextTick(resizeDetailsInput);
  else speechRecorder.cancel();
  if (step === 1) nextTick(updatePinAndContinuePosition);
  if (step === 4) nextTick(initReviewMap);
}, { immediate: true });

onActivated(() => {
  isSubmitViewActive = true;
  document.addEventListener('visibilitychange', cancelHiddenRecording);
  window.addEventListener('pagehide', speechRecorder.cancel);
  if (draft.step === 1) {
    window.addEventListener('resize', updatePinAndContinuePosition);
    nextTick(() => {
      updatePinAndContinuePosition();
      initMap();
    });
  }
});

function deactivateSpeechRecorder() {
  isSubmitViewActive = false;
  speechRecorder.cancel();
  document.removeEventListener('visibilitychange', cancelHiddenRecording);
  window.removeEventListener('pagehide', speechRecorder.cancel);
  window.removeEventListener('resize', updatePinAndContinuePosition);
  removeMapLocationListeners();

  const sharedMap = sharedBrowseMap.value;
  if (sharedMap?.map === map) {
    sharedMap.moveToBrowse();
    sharedMap.setSuggestionMarkersVisible(true);
    map = null;
    googleMaps = null;
    isMapReady.value = false;
  }
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
  if (stepNumber === 1) {
    nextTick(() => {
      initMap();
    });
  }
}

function prevStep() {
  if (draft.step > 1) {
    draft.step -= 1;
    persistDraft();
    if (draft.step === 1) {
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
  }
}

function validateAndNextStep3() {
  errors.details = '';

  const detailsTrimmed = (draft.details || '').trim();

  if (!detailsTrimmed) {
    errors.details = 'Details description is required.';
  } else {
    nextStep();
  }
}

// ---------------- MAP & LOCATION LOGIC ---------------- //
function bindMapLocationListeners() {
  if (!map || mapIdleListener) return;

  mapIdleListener = map.addListener('idle', () => {
    const center = map?.getCenter();
    if (!center) return;
    updateCoordinates(center.lat(), center.lng());
  });

  mapClickListener = map.addListener('click', (event) => {
    if (event.latLng) map?.panTo(event.latLng);
  });
}

function removeMapLocationListeners() {
  mapIdleListener?.remove();
  mapClickListener?.remove();
  mapIdleListener = null;
  mapClickListener = null;
}

async function initMap() {
  try {
    if (!mapContainerEl.value) return;

    let sharedMap = sharedBrowseMap.value;
    if (!sharedMap && browseMapInitialization.value === 'loading') {
      await new Promise((resolve) => {
        let stopWatching = () => {};
        const checkReady = ([context, state]) => {
          if (context || state !== 'loading') {
            stopWatching();
            resolve();
          }
        };
        stopWatching = watch([sharedBrowseMap, browseMapInitialization], checkReady);
        checkReady([sharedBrowseMap.value, browseMapInitialization.value]);
      });
      sharedMap = sharedBrowseMap.value;
    }
    if (!isSubmitViewActive) return;

    if (sharedMap?.map && sharedMap.googleMaps) {
      map = sharedMap.map;
      googleMaps = sharedMap.googleMaps;
      sharedMap.setSuggestionMarkersVisible(false);
      sharedMap.moveTo(mapContainerEl.value);
      currentMapType.value = map.getMapTypeId() === googleMaps.MapTypeId.HYBRID ? 'hybrid' : 'roadmap';
    } else {
      googleMaps = await loadGoogleMaps();
      if (!googleMaps || !isSubmitViewActive || !mapContainerEl.value) return;

      if (!map) {
        const initialLat = draft.location?.latitude ?? 32.7767;
        const initialLng = draft.location?.longitude ?? -96.7970;
        map = new googleMaps.Map(mapContainerEl.value, {
          center: { lat: Number(initialLat), lng: Number(initialLng) },
          zoom: 15,
          mapTypeId: googleMaps.MapTypeId.ROADMAP,
          styles: getMapStyles(isDark.value, currentMapType.value),
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
      }
    }

    bindMapLocationListeners();
    isMapReady.value = true;

    if (sharedMap?.map === map) {
      const center = map.getCenter();
      if (center) await updateCoordinates(center.lat(), center.lng());
      nextTick(() => googleMaps.event?.trigger(map, 'resize'));
    }
  } catch (err) {
    console.warn('Map initialization warning:', err);
    isMapReady.value = true;
  }
}

async function updateCoordinates(lat, lng, knownAddress = '') {
  const updateSequence = ++locationUpdateSequence;
  draft.location = draft.location || {};
  draft.location.latitude = Number(lat);
  draft.location.longitude = Number(lng);

  if (knownAddress) {
    draft.location.address = knownAddress;
  } else {
    draft.location.address = '';
    try {
      const rev = await reverseGeocodeWithGoogle(lat, lng);
      if (updateSequence !== locationUpdateSequence) return;
      if (rev) draft.location.address = rev;
    } catch {
      // fallback
    }
  }
  if (updateSequence !== locationUpdateSequence) return;
  if (!isMapSearchEditing.value) mapSearchQuery.value = displayAddress.value;
  persistDraft();
}

function setMapType(type) {
  currentMapType.value = type;
  const sharedMap = sharedBrowseMap.value;
  if (sharedMap?.map === map) {
    sharedMap.setMapType(type);
    return;
  }
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

function onMapSearchFocus() {
  isMapSearchEditing.value = true;
  nextTick(() => mapSearchInput.value?.select());
}

function onMapSearchBlur() {
  isMapSearchEditing.value = false;
  if (searchDebounce) clearTimeout(searchDebounce);
  mapSearchResults.value = [];
  isSearching.value = false;
  mapSearchQuery.value = displayAddress.value;
}

function clearMapSearch() {
  mapSearchQuery.value = '';
  mapSearchResults.value = [];
  isSearching.value = false;
  mapSearchInput.value?.focus();
}

function onSearchInput() {
  isMapSearchEditing.value = true;
  if (searchDebounce) clearTimeout(searchDebounce);
  const q = mapSearchQuery.value.trim();
  if (q.length < 2) {
    mapSearchResults.value = [];
    isSearching.value = false;
    return;
  }

  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    const results = await searchAddressWithGoogle(q);
    if (!isMapSearchEditing.value || mapSearchQuery.value.trim() !== q) return;
    mapSearchResults.value = results;
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
    isMapSearchEditing.value = false;
    if (map) {
      const pos = { lat: Number(lat), lng: Number(lng) };
      map.setCenter(pos);
      map.setZoom(16);
    }
    await updateCoordinates(lat, lng, item.displayName);
  } else {
    isMapSearchEditing.value = false;
    mapSearchQuery.value = displayAddress.value;
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
      if (map) {
        map.setCenter({ lat, lng });
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
function openFilePicker() {
  fileInput.value?.click();
}

function openCameraPicker() {
  cameraInput.value?.click();
}

function photoScrollAdvance(viewer) {
  const firstSlide = viewer.firstElementChild;
  if (!firstSlide) return viewer.clientWidth;
  const gap = Number.parseFloat(window.getComputedStyle(viewer).columnGap) || 0;
  return firstSlide.getBoundingClientRect().width + gap;
}

async function initReviewMap() {
  const container = reviewMapContainer.value;
  if (!container || draft.step !== 4 || !hasGoogleMapsKey) return;
  const maps = await loadGoogleMaps();
  if (!maps || container !== reviewMapContainer.value || draft.step !== 4) return;
  const position = {
    lat: Number(draft.location?.latitude ?? 32.7767),
    lng: Number(draft.location?.longitude ?? -96.797),
  };
  const reviewMap = new maps.Map(container, {
    center: position,
    zoom: 16,
    mapTypeId: reviewMapType.value === 'hybrid' ? maps.MapTypeId.HYBRID : maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    gestureHandling: 'cooperative',
    clickableIcons: false,
    styles: getMapStyles(isDark.value, 'roadmap'),
  });
  reviewMapInstance = reviewMap;
  const crosshairOverlay = new maps.OverlayView();
  crosshairOverlay.onAdd = () => {};
  crosshairOverlay.draw = () => {
    const point = crosshairOverlay.getProjection()?.fromLatLngToContainerPixel(position);
    if (!point) return;
    reviewCrosshairStyle.value = { left: `${point.x}px`, top: `${point.y}px` };
  };
  crosshairOverlay.onRemove = () => {};
  crosshairOverlay.setMap(reviewMap);
}

function setReviewMapType(type) {
  reviewMapType.value = type;
  reviewMapInstance?.setMapTypeId(type);
}

function centerReviewMap() {
  if (!reviewMapInstance) return;
  reviewMapInstance.panTo({
    lat: Number(draft.location?.latitude ?? 32.7767),
    lng: Number(draft.location?.longitude ?? -96.797),
  });
}

function openPhotoLightbox(index) {
  lightboxPhotoIndex.value = index;
  isPhotoLightboxOpen.value = true;
  nextTick(() => document.querySelector('[role="dialog"][aria-label="Photo preview"]')?.focus());
}

function closePhotoLightbox() {
  isPhotoLightboxOpen.value = false;
  lightboxPointerStart = null;
}

function navigateLightbox(direction) {
  const count = draft.photos?.length || 0;
  if (count < 2) return;
  lightboxPhotoIndex.value = (lightboxPhotoIndex.value + direction + count) % count;
}

function startLightboxSwipe(event) {
  lightboxPointerStart = { x: event.clientX, y: event.clientY };
}

function finishLightboxSwipe(event) {
  if (!lightboxPointerStart) return;
  const dx = event.clientX - lightboxPointerStart.x;
  const dy = event.clientY - lightboxPointerStart.y;
  lightboxPointerStart = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) navigateLightbox(dx < 0 ? 1 : -1);
}

function updateActivePhotoIndex() {
  const viewer = photoViewer.value;
  if (!viewer || viewer.clientWidth === 0) return;
  activePhotoIndex.value = Math.min(
    draft.photos.length - 1,
    Math.round(viewer.scrollLeft / photoScrollAdvance(viewer)),
  );
}

function scrollToPhoto(index) {
  const viewer = photoViewer.value;
  if (!viewer) return;
  const targetIndex = Math.max(0, Math.min(index, draft.photos.length - 1));
  viewer.scrollTo({ left: targetIndex * photoScrollAdvance(viewer), behavior: 'smooth' });
}

async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  photoError.value = '';
  isPhotoToastDismissed.value = false;
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
      await nextTick();
      activePhotoIndex.value = draft.photos.length - 1;
      scrollToPhoto(activePhotoIndex.value);
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
  if (draft.photos.length === 0) {
    activePhotoIndex.value = 0;
  } else if (index < activePhotoIndex.value) {
    activePhotoIndex.value -= 1;
  } else if (index === activePhotoIndex.value) {
    activePhotoIndex.value = Math.min(index, draft.photos.length - 1);
  }

  persistDraft();
  nextTick(() => {
    if (photoViewer.value) {
      photoViewer.value.scrollTo({
        left: activePhotoIndex.value * photoScrollAdvance(photoViewer.value),
        behavior: 'auto',
      });
    }
  });
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
    const location = {
      latitude: Number(draft.location?.latitude ?? 32.7767),
      longitude: Number(draft.location?.longitude ?? -96.7970),
    };

    dynamicProgressMessage.value = 'Preparing location diagram renderer…';
    const [{ fetchLocationData }, { generateLocationDiagram }, { railCatalog }] = await Promise.all([
      import('../services/liveLocationData'),
      import('../services/locationDiagram'),
      import('../services/railCatalog'),
    ]);
    dynamicProgressMessage.value = 'Generating location thumbnail…';
    const { data, administrativeBoundary } = await fetchLocationData({
      lat: location.latitude,
      lon: location.longitude,
    }, {
      onProgress: (message) => { dynamicProgressMessage.value = message; },
    });
    const { svg } = generateLocationDiagram(data, {
      ...data.center,
      administrativeBoundary,
      railCatalog,
    });
    submissionProgress.value = 15;
    dynamicProgressMessage.value = 'Uploading location thumbnail…';
    const thumbnailType = 'image/svg+xml';
    const { uploadUrl: thumbnailUploadUrl, publicUrl: thumbnailUrl } = await requestPhotoUploadUrl({
      contentType: thumbnailType,
      filename: 'location-diagram.svg',
    });
    await uploadPhotoBinary(thumbnailUploadUrl, new Blob([svg], { type: thumbnailType }), thumbnailType);
    uploadedPhotos.push({
      url: thumbnailUrl,
      caption: 'Location diagram',
      timestamp: new Date().toISOString(),
    });

    const photosToUpload = (draft.photos || []).filter((p) => p.blob || p.url || p.dataUrl);

    if (photosToUpload.length > 0) {
      const stepPercent = 60 / photosToUpload.length;

      for (let i = 0; i < photosToUpload.length; i++) {
        const p = photosToUpload[i];
        submissionProgress.value = Math.round(15 + i * stepPercent);
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
        ...location,
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

function handleEditDetails() {
  setSubmitting(false);
  showSubmissionOverlay.value = false;
}

function handleGoHome() {
  setSubmitting(false);
  showSubmissionOverlay.value = false;
  router.push('/');
}

onMounted(() => {
  persistDraft();
});
</script>
