<template>
  <div class="submission-view">
    <Teleport to="body" :disabled="draft.step !== 2">
    <Transition :name="stepTransition" appear @before-leave="freezeLeavingStep">
    <component ref="submissionStage" :surface-level="2" :is="draft.step === 1 ? 'div' : draft.step === 2 ? FloatingModal : MapTray" :key="draft.step" class="submission-stage"
      :class="{ 'submission-content-tray': draft.step === 3 || draft.step === 4, 'submission-photo-modal': draft.step === 2 }"
      v-bind="draft.step === 2 ? { open: photoModalOpen, label: currentStepTitle, formFactor: 'tall', position: 'center', blocking: true, theme: isDark ? 'dark' : 'light', footerButtons: photoFooterButtons } : draft.step > 1 ? { title: currentStepTitle, scrollable: false, animate: false } : {}" @close="workspace.closeTray">
    <template v-if="draft.step === 3" #header>
      <h1>{{ currentStepTitle }}</h1>
      <div class="description-feedback" aria-live="polite">
        <p v-if="isGrammarLoading" role="status">Fixing grammar and spelling…</p>
        <p v-if="speechActive" role="status">
          {{ recordingState === 'starting' ? (hasStartedRecording ? 'Resuming recording… Please wait.' : 'Starting microphone… Allow access if prompted, or cancel.') : (recordingState === 'stopping' ? 'Finishing transcription…' : 'Listening…') }}
        </p>
        <p v-if="grammarError" class="description-error" role="alert">{{ grammarError }}</p>
        <p v-if="clarityError" class="description-error" role="alert">{{ clarityError }}</p>
        <p v-if="errors.details" class="description-error" role="alert">{{ errors.details }}</p>
      </div>
    </template>

    <!-- ================= STEP 3: DESCRIBE ================= -->
    <div v-if="draft.step === 3" class="flex flex-grow min-h-0 flex-col">
        <textarea
          id="input-details"
          ref="detailsInput"
          v-model="draft.details"
          @input="onDetailsInput"
          :disabled="isGrammarLoading || isClarityLoading"
          :readonly="speechActive"
          rows="2"
          aria-label="Describe your idea"
          placeholder="Start writing your idea here..."
          class="description-textarea"
          required
        ></textarea>
      <footer class="description-footer">
        <div class="description-text-toolbar">
          <div class="description-record-control">
            <div v-if="speechError && !isMicrophoneAccessBlocked" class="map-ui description-speech-tooltip" role="status">
              <span>{{ speechError }}</span>
              <button type="button" class="map-ui-button" aria-label="Dismiss speech error" @click="speechError = ''">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          <button
            ref="recordButton"
            type="button"
            @click="toggleSpeechRecognition"
            :aria-pressed="speechActive"
            :aria-busy="recordingState === 'starting' || recordingState === 'stopping'"
            :disabled="recordingState === 'stopping' || isGrammarLoading || isClarityLoading"
            class="map-ui-button"
            :class="{ 'is-recording': isRecording }"
          >
            <i :class="recordingState === 'starting' || recordingState === 'stopping' ? 'fa-solid fa-spinner animate-spin mr-1' : (isRecording ? 'fa-solid fa-stop mr-1' : 'fa-solid fa-microphone mr-1')" aria-hidden="true"></i>
            {{ recordingState === 'starting' ? (hasStartedRecording ? 'Please wait' : 'Cancel recording') : (recordingState === 'stopping' ? 'Stopping…' : (isRecording ? 'Stop recording' : (showAutoImprove ? 'Record' : 'Record speech to text'))) }}
          </button>
          </div>
          <div v-if="showAutoImprove" class="description-improve-control">
            <button
              id="auto-improve-trigger"
              ref="autoImproveButton"
              type="button"
              @click="toggleAutoImproveMenu"
              :aria-expanded="isAutoImproveOpen"
              aria-haspopup="menu"
              aria-controls="auto-improve-menu"
              :disabled="isGrammarLoading || isClarityLoading"
              class="map-ui-button h-full"
            >
              <i class="fa-solid fa-wand-magic-sparkles mr-1" aria-hidden="true"></i>
              Auto improve
              <i class="fa-solid fa-chevron-down ml-1 text-xs" aria-hidden="true"></i>
            </button>
            <k-popover
              :opened="isAutoImproveOpen"
              target="#auto-improve-trigger"
              :angle="false"
              @backdropclick="isAutoImproveOpen = false"
              class="map-ui map-menu-popover description-improve-menu min-w-56"
            >
            <div
              id="auto-improve-menu"
              role="menu"
              class="p-1"
            >
              <button type="button" role="menuitem" @click="handleFixGrammarAndSpelling" class="map-ui-button w-full justify-between">
                Fix grammar and spelling
              </button>
              <button type="button" role="menuitem" @click="handleImproveClarity" class="map-ui-button w-full justify-between">
                Improve clarity and structure
              </button>
            </div>
            </k-popover>
          </div>
        </div>

      <div ref="stepThreeNextContainer" data-testid="step-three-navigation" class="submission-navigation">
        <div class="submission-button-row" role="group" aria-label="Description step navigation">
                  <button type="button" class="map-ui-button" @click="prevStep">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Back
          </button>
          <button
            type="button"
            :disabled="!hasEnoughDetailsWords || isGrammarLoading || isClarityLoading"
            class="map-ui-button is-primary"
            @click="validateAndNextStep3"
          >
            Next
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      </footer>

      <Teleport to="body"><k-toast
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
      </k-toast></Teleport>
    </div>

    <!-- ================= STEP 1: LOCATE ================= -->
    <div v-if="draft.step === 1" class="flex-grow flex flex-col">
      <div ref="submitMapFrame" data-testid="submit-map-frame" class="relative flex-grow overflow-hidden">
      </div>

      <!-- Describe Location Modal Dialog -->
      <Teleport to="body"><div
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
              <i class="fa-solid fa-comment-dots" aria-hidden="true"></i>
              Describe Location
            </h3>
            <button
              type="button"
              @click="discardDescModal"
              class="text-zinc-400 hover:text-black dark:hover:text-white p-1"
              aria-label="Close"
            >
              <i class="fa-solid fa-xmark text-base" aria-hidden="true"></i>
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
      </div></Teleport>
    </div>

    <!-- ================= STEP 2: PHOTO ================= -->
    <div v-if="draft.step === 2" class="flex flex-grow min-h-0 flex-col">
      <div class="submission-photo-body" :class="{ 'is-empty': !draft.photos?.length }">
        <div v-if="photoError" class="flex items-center justify-between rounded bg-red-100 p-3 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            <span>{{ photoError }}</span>
          </div>
          <button type="button" @click="photoError = ''" class="text-red-500 hover:text-black dark:hover:text-white" aria-label="Dismiss photo error">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <PhotoSlider
          v-if="draft.photos?.length"
          ref="photoSlider"
          v-model:active-index="activePhotoIndex"
          :photos="draft.photos"
          editable
          edge-to-edge
          fill-available
          @remove="removePhoto"
          @caption-change="updatePhotoCaption"
        />
        <p v-else class="text-sm text-zinc-500 dark:text-zinc-400">
          Photos are optional. Add images to show the location or conditions.
        </p>
        <div data-testid="photo-action-segment" class="submission-photo-actions submission-button-row" role="group" aria-label="Add photos">
          <div v-if="showPhotoLimitTooltip" class="map-ui photo-limit-tooltip" role="status">
            <span>Max 4 photos reached</span>
            <button type="button" class="map-ui-button" aria-label="Dismiss photo limit" @click="showPhotoLimitTooltip = false"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
          <button
            type="button"
            :disabled="isProcessingPhotos"
            :aria-disabled="(draft.photos || []).length >= 4"
            class="map-ui-button"
            @click="openFilePicker"
          >
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
            Upload photos
          </button>
          <button
            type="button"
            :disabled="isProcessingPhotos"
            :aria-disabled="(draft.photos || []).length >= 4"
            class="map-ui-button"
            @click="openCameraPicker"
          >
            <i class="fa-solid fa-camera" aria-hidden="true"></i>
            Take photo
          </button>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept="image/*,.svg"
          multiple
          class="hidden"
          :disabled="(draft.photos || []).length >= 4 || isProcessingPhotos"
          @change="handleFilesSelected"
        />
        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          :disabled="(draft.photos || []).length >= 4 || isProcessingPhotos"
          @change="handleFilesSelected"
        />

      </div>

    </div>

    <Teleport to="body"><k-toast
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
    </k-toast></Teleport>

    <!-- ================= STEP 4: REVIEW & SUBMIT ================= -->
    <div v-if="draft.step === 4" class="flex flex-grow min-h-0 flex-col review-stage">
      <div class="review-body">
      <section class="review-body-section review-description-section" aria-label="Description">
        <button type="button" class="map-ui-button review-description-edit" aria-label="Edit description" @click="goToStep(3)"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Edit</button>
        <div class="review-description-scroll" tabindex="0">
        <p class="whitespace-pre-wrap break-words text-sm">{{ draft.details }}</p>
        </div>
      </section>

      <!-- Review Section: Photos -->
      <section class="review-body-section review-photos-section" aria-label="Photos">
          <h3 class="font-bold mb-4 pr-16">
            <i class="fa-solid fa-camera" aria-hidden="true"></i>
            Photos ({{ (draft.photos || []).length }})
          </h3>
          <button
            type="button"
            @click="goToStep(2)"
            aria-label="Edit photos"
            class="map-ui-button review-photos-edit"
          >
            <i class="fa-solid fa-pen-to-square mr-1" aria-hidden="true"></i>
            Edit
          </button>

        <div v-if="draft.photos?.length" class="review-photo-row">
          <button v-for="(photo, index) in draft.photos" :key="photo.id || index" type="button" class="review-photo-thumbnail" :aria-label="`Open photo ${index + 1}${photo.caption ? ': ' + photo.caption : ''}`" @click="openPhotoLightbox(index)">
            <img :src="photo.dataUrl || photo.url" :alt="photo.caption || `Photo ${index + 1}`" />
            <span v-if="photo.caption" class="review-photo-caption">{{ photo.caption }}</span>
          </button>
        </div>
        <p v-else class="text-xs text-zinc-500">No photos attached.</p>
      </section>

      <Teleport to="body"><div
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
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <button v-if="draft.photos.length > 1" type="button" @click.stop="navigateLightbox(-1)" aria-label="Previous photo" class="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <img
          v-if="draft.photos[lightboxPhotoIndex]"
          :src="draft.photos[lightboxPhotoIndex].dataUrl || draft.photos[lightboxPhotoIndex].url"
          :alt="draft.photos[lightboxPhotoIndex].caption || `Photo ${lightboxPhotoIndex + 1}`"
          class="max-h-[78vh] max-w-full select-none object-contain"
          draggable="false"
        />
        <button v-if="draft.photos.length > 1" type="button" @click.stop="navigateLightbox(1)" aria-label="Next photo" class="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white">
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
        <div class="mt-4 max-w-xl text-center text-sm text-white">
          <p>{{ draft.photos[lightboxPhotoIndex]?.caption || 'No caption' }}</p>
          <p v-if="draft.photos.length > 1" class="mt-2 text-xs text-white/70">{{ lightboxPhotoIndex + 1 }} / {{ draft.photos.length }}</p>
        </div>
      </div></Teleport>

      <!-- Author Name & Email (Required) -->
      <section class="review-body-section space-y-4" aria-label="Your information">
        <div>
          <label for="input-author-name" class="block text-sm font-bold mb-1.5 flex items-center justify-between">
            <span>Your display name <span class="text-red-500">*</span></span>
            <span class="text-xs font-normal text-zinc-600 dark:text-zinc-400">{{ (draft.author?.name || '').length }}/70</span>
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
          <p v-if="errors.authorName" class="text-xs text-red-600 dark:text-red-300 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
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
          <p v-if="errors.authorEmail" class="text-xs text-red-600 dark:text-red-300 mt-1 flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            {{ errors.authorEmail }}
          </p>
        </div>
      </section>

      </div>

      <div data-testid="step-four-navigation" class="submission-navigation">
        <div class="submission-button-row" role="group" aria-label="Review step navigation">
                  <button type="button" class="map-ui-button" @click="prevStep">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            Back
          </button>
          <button type="button" class="map-ui-button submission-publish-button" @click="submitFinalSuggestion">
            Submit
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body"><div
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
    </div></Teleport>

    <Teleport to="body"><div
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
    </div></Teleport>

    <!-- SUBMISSION PROGRESS / STATUS MODAL OVERLAY -->
    <Teleport to="body"><div
      v-if="showSubmissionOverlay"
      class="submission-status-overlay fixed inset-0 z-50 flex flex-col items-center justify-center p-4 text-center"
    >
      <section
        class="map-ui submission-status-panel max-w-md w-full p-6 sm:p-8 flex flex-col items-center"
        aria-labelledby="submission-status-title"
        :aria-busy="submissionStatus === 'submitting'"
      >
        <!-- Status Icon -->
        <div class="mb-6">
          <div v-if="submissionStatus === 'submitting'" class="flex items-center justify-center w-20 h-20">
            <i class="fa-solid fa-spinner fa-spin text-5xl" aria-hidden="true"></i>
          </div>

          <div
            v-else-if="submissionStatus === 'success'"
            class="submission-status-icon w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          >
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </div>

          <div
            v-else-if="submissionStatus === 'failed'"
            class="submission-status-icon is-error w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          >
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          </div>
        </div>

        <!-- Status Title -->
        <h2 id="submission-status-title" class="text-2xl font-bold mb-2">
          {{ submissionStatus === 'success' ? 'Submission complete!' : (submissionStatus === 'failed' ? 'Submission Failed' : 'Submitting Your Idea...') }}
        </h2>

        <!-- Dynamic Progress Description Text -->
        <p v-if="submissionStatus !== 'success'" class="submission-status-message text-sm mb-6 px-2 min-h-[40px] flex items-center justify-center" role="status">
          {{ dynamicProgressMessage }}
        </p>
        <p v-if="submissionThumbnailNotice && submissionStatus !== 'failed'" class="text-sm mb-4" role="status">
          {{ submissionThumbnailNotice }}
        </p>

        <!-- Progress Bar -->
        <div v-if="submissionStatus === 'submitting'" class="w-full mb-6">
          <progress :value="submissionProgress" max="100" aria-label="Submission progress" class="submission-status-progress" />
        </div>

        <!-- Action Buttons -->
        <div class="submission-status-actions w-full flex flex-col gap-3" :class="{ 'mt-4': submissionStatus === 'success' }">
          <button
            v-if="submissionStatus === 'success'"
            type="button"
            @click="isSubmissionPreview ? closeSubmissionPreview() : handleViewSuggestion(createdSuggestionId)"
            class="map-ui-button is-primary"
          >
            <i :class="isSubmissionPreview ? 'fa-solid fa-arrow-left mr-2' : 'fa-solid fa-eye mr-2'" aria-hidden="true"></i>
            {{ isSubmissionPreview ? 'Back to submission' : 'View suggestion' }}
          </button>

          <button
            v-if="submissionStatus === 'failed'"
            type="button"
            @click="handleEditDetails"
            class="map-ui-button is-primary"
          >
            <i class="fa-solid fa-pen-to-square mr-2" aria-hidden="true"></i>
            Edit details
          </button>

          <button
            v-if="submissionStatus === 'failed'"
            type="button"
            @click="submitFinalSuggestion"
            class="map-ui-button"
          >
            <i class="fa-solid fa-rotate-right mr-2" aria-hidden="true"></i>
            Retry submission
          </button>

          <button
            v-if="submissionStatus === 'failed'"
            type="button"
            @click="handleGoHome"
            class="map-ui-button"
          >
            <i class="fa-solid fa-map-location-dot mr-2" aria-hidden="true"></i>
            Go to browse
          </button>
        </div>
      </section>
    </div></Teleport>
    </component>
    </Transition>
    </Teleport>
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
  kPreloader,
  kBadge,
  kToast,
  kPopover,
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
import MapTray from '../components/MapTray.vue';
import FloatingModal from '../components/FloatingModal.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import PhotoSlider from '../components/PhotoSlider.vue';
import { browseMapInitialization, sharedBrowseMap } from '../services/sharedBrowseMap';
import { reverseGeocodeWithGoogle } from '../services/googleMaps';
import { createOptionalLocationThumbnail } from '../services/submissionThumbnail.js';
import { restoreSubmissionPhotoBlob } from '../services/submissionPhoto.js';

const router = useRouter();
const workspace = inject(mapWorkspaceKey);
const setSubmitting = inject('setSubmitting', () => {});

// Draft reactive state
const draft = reactive(loadWizardDraft());
const detailsInput = ref(null);
const submissionStage = ref(null);
const photoModalOpen = ref(true);
const photoFooterButtons = computed(() => [
  { label: 'Back', icon: 'arrow-left', onClick: prevStep },
  { label: draft.photos?.length ? 'Next' : 'Skip photos', icon: 'arrow-right', onClick: nextStep },
]);
const stepTransition = ref('map-tray');
let trayHeightAnimation = null;
function freezeLeavingStep(element) {
  if (element.classList.contains('map-tray')) element.style.height = `${element.getBoundingClientRect().height}px`;
  element.inert = true;
}
const stepThreeNextContainer = ref(null);
const recordButton = ref(null);
const autoImproveButton = ref(null);
const isAutoImproveOpen = ref(false);
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
const submitMapFrame = ref(null);
const pinAndContinueTop = ref('calc(75% - 36px)');
const isMapReady = ref(false);
const isLocating = ref(false);

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
const photoSlider = ref(null);
const activePhotoIndex = ref(0);
const showPhotoLimitTooltip = ref(false);
watch(() => draft.photos?.length, () => { showPhotoLimitTooltip.value = false; });
const isPhotoLightboxOpen = ref(false);
const lightboxPhotoIndex = ref(0);
let lightboxPointerStart = null;
const isProcessingPhotos = ref(false);
const isPhotoToastDismissed = ref(false);
const photoError = ref('');

// Step 4 Submission Progress Overlay State
const showSubmissionOverlay = ref(false);
const submissionStatus = ref('submitting');
const submissionProgress = ref(0);
const dynamicProgressMessage = ref('');
const submissionThumbnailNotice = ref('');
const createdSuggestionId = ref('');
const submissionErrorMessage = ref('');
const isSubmissionPreview = ref(false);
const submissionPreviewTimers = [];
const SUBMISSION_PREVIEW_DURATION_MS = 6000;

function closeSubmissionPreview() {
  if (!isSubmissionPreview.value) return;
  submissionPreviewTimers.splice(0).forEach(clearTimeout);
  isSubmissionPreview.value = false;
  showSubmissionOverlay.value = false;
  setSubmitting(false);
}

function handleSubmissionPreviewShortcut(event) {
  if (!import.meta.env.DEV || !isSubmitViewActive || event.repeat || event.isComposing
    || !event.ctrlKey || !event.altKey || event.key !== 'Enter') return;
  event.preventDefault();
  if (showSubmissionOverlay.value) return;
  isSubmissionPreview.value = true;
  showSubmissionOverlay.value = true;
  setSubmitting(true);
  submissionStatus.value = 'submitting';
  submissionProgress.value = 10;
  dynamicProgressMessage.value = 'Preparing suggestion data...';
  const stages = [
    [0.25, 35, 'Preparing location diagram...'],
    [0.5, 65, 'Uploading photos...'],
    [0.75, 85, 'Saving your suggestion...'],
    [1, 100, ''],
  ];
  for (const [fraction, progress, message] of stages) {
    submissionPreviewTimers.push(setTimeout(() => {
      if (!isSubmissionPreview.value) return;
      submissionProgress.value = progress;
      dynamicProgressMessage.value = message;
      if (progress === 100) submissionStatus.value = 'success';
    }, SUBMISSION_PREVIEW_DURATION_MS * fraction));
  }
}

const currentStepTitle = computed(() => {
  switch (draft.step) {
    case 1:
      return 'Locate';
    case 2:
      return 'Attach photos';
    case 3:
      return 'Describe your idea';
    case 4:
      return 'Review submission';
    default:
      return '';
  }
});

function updatePinAndContinuePosition() {
  const frame = submitMapFrame.value;
  const locationControl = document.querySelector('.map-workspace .map-list-fab');
  if (!frame || !locationControl) return;

  const frameBounds = frame.getBoundingClientRect();
  const locationButton = locationControl.querySelector('button, a') || locationControl;
  const locationButtonTop = locationButton.getBoundingClientRect().top;
  const mapCenter = frameBounds.top + frameBounds.height / 2;
  const midpoint = (mapCenter + locationButtonTop) / 2;
  workspace.pinContinueTop.value = `${midpoint - frameBounds.top}px`;
}


function persistDraft() {
  if (draft.author) {
    setStoredAuthorProfile(draft.author);
  }
  saveWizardDraft(draft);
}

function resizeDetailsInput(animate = true) {
  if (!detailsInput.value) return;
  const textarea = detailsInput.value;
  const scrollTop = textarea.scrollTop;
  const currentHeight = textarea.getBoundingClientRect().height;
  // Measure the content without animating the temporary measurement height.
  textarea.style.transition = 'none';
  textarea.style.height = '0px';
  const contentHeight = textarea.scrollHeight;
  if (animate === false) {
    textarea.style.height = `${contentHeight}px`;
    void textarea.offsetHeight;
    textarea.style.transition = '';
    textarea.scrollTop = scrollTop;
    return;
  }
  textarea.style.height = `${currentHeight}px`;
  void textarea.offsetHeight;
  textarea.style.transition = '';
  textarea.style.height = `${contentHeight}px`;
  textarea.scrollTop = scrollTop;
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

function focusDescriptionInput() {
  nextTick(() => {
    if (isSubmitViewActive && draft.step === 3) detailsInput.value?.focus({ preventScroll: true });
  });
}

watch(() => draft.step, (step, previousStep) => {
  if (previousStep != null) stepTransition.value = step > previousStep ? 'submit-step-forward' : 'submit-step-back';
  const changingContentTray = [3, 4].includes(step) && [3, 4].includes(previousStep);
  const previousHeight = changingContentTray ? submissionStage.value?.element?.getBoundingClientRect().height : null;
  trayHeightAnimation?.cancel();
  trayHeightAnimation = null;
  isAutoImproveOpen.value = false;
  if (step === 3) { nextTick(() => resizeDetailsInput(!changingContentTray)); focusDescriptionInput(); }
  else speechRecorder.cancel();
  if (changingContentTray && previousHeight != null) nextTick(() => {
    const tray = submissionStage.value?.element;
    if (!tray || draft.step !== step || !isSubmitViewActive || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nextHeight = tray.getBoundingClientRect().height;
    const animation = tray.animate(
      [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }],
      { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' },
    );
    trayHeightAnimation = animation;
    animation.finished.then(() => {
      if (trayHeightAnimation === animation) trayHeightAnimation = null;
    }).catch(() => {});
  });
  if (step === 1) nextTick(() => { updatePinAndContinuePosition(); if (isSubmitViewActive) initMap(); });
  else { removeMapLocationListeners(); locationUpdateSequence++; }
}, { immediate: true });

onActivated(() => {
  isSubmitViewActive = true;
  photoModalOpen.value = true;
  nextTick(resizeDetailsInput);
  window.addEventListener('resize', resizeDetailsInput);
  focusDescriptionInput();
  workspace.registerSubmission({ draft, updateCoordinates, requestGpsLocation, dismissNested, saveDraft: persistDraft, editLocation: () => goToStep(1), nextStep });
  initMap();
  document.addEventListener('visibilitychange', cancelHiddenRecording);
  window.addEventListener('pagehide', speechRecorder.cancel);
  window.addEventListener('resize', updatePinAndContinuePosition);
  if (import.meta.env.DEV) window.addEventListener('keydown', handleSubmissionPreviewShortcut);
  if (draft.step === 1) {
    nextTick(() => {
      updatePinAndContinuePosition();
      initMap();
    });
  }
});

function deactivateSpeechRecorder() {
  closeSubmissionPreview();
  window.removeEventListener('keydown', handleSubmissionPreviewShortcut);
  isSubmitViewActive = false;
  photoModalOpen.value = false;
  trayHeightAnimation?.cancel();
  trayHeightAnimation = null;
  window.removeEventListener('resize', resizeDetailsInput);
  isAutoImproveOpen.value = false;
  speechRecorder.cancel();
  document.removeEventListener('visibilitychange', cancelHiddenRecording);
  window.removeEventListener('pagehide', speechRecorder.cancel);
  window.removeEventListener('resize', updatePinAndContinuePosition);
  removeMapLocationListeners();

  locationUpdateSequence++;
  map = null;
  googleMaps = null;
  isMapReady.value = false;

}

onDeactivated(deactivateSpeechRecorder);
watch(sharedBrowseMap, context => { if (context && isSubmitViewActive) initMap(); });
onBeforeUnmount(() => {
  deactivateSpeechRecorder();
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
  if (draft.step === 1 && map) {
    const center = map.getCenter();
    if (center) {
      map.setCenter(center);
      draft.location.latitude = center.lat();
      draft.location.longitude = center.lng();
    }
  }
  if (draft.step === 2 && (draft.photos || []).length > 4) {
    photoError.value = 'Maximum 4 photos allowed. Remove extra photos to continue.';
    return;
  }
  if (draft.step < 4) {
    draft.step += 1;
    persistDraft();
  }
}

function validateAndNextStep3() {
  errors.details = '';

  if (!hasEnoughDetailsWords.value) {
    errors.details = 'Describe your idea in at least three words.';
  } else {
    nextStep();
  }
}

// ---------------- MAP & LOCATION LOGIC ---------------- //
function bindMapLocationListeners() {
  if (!map || mapIdleListener) return;

  mapIdleListener = map.addListener('idle', () => {
    const center = map?.getCenter();
    if (!center || draft.step !== 1 || !isSubmitViewActive) return;
    if (Number(draft.location?.latitude) === center.lat() && Number(draft.location?.longitude) === center.lng() && draft.location?.address) return;
    updateCoordinates(center.lat(), center.lng());
  });

  mapClickListener = map.addListener('click', (event) => {
    if (draft.step === 1 && isSubmitViewActive && event.latLng) map?.panTo(event.latLng);
  });
}

function removeMapLocationListeners() {
  mapIdleListener?.remove();
  mapClickListener?.remove();
  mapIdleListener = null;
  mapClickListener = null;
}

async function initMap() {
  let context = sharedBrowseMap.value;
  if (!context && browseMapInitialization.value === 'loading') {
    await new Promise(resolve => {
      const stop = watch([sharedBrowseMap, browseMapInitialization], ([value, state]) => {
        if (value || state !== 'loading') { stop(); resolve(); }
      });
    });
    context = sharedBrowseMap.value;
  }
  if (!isSubmitViewActive || !context) return;
  map = context.map;
  googleMaps = context.googleMaps;
  isMapReady.value = true;
  if (draft.step === 1) {
    bindMapLocationListeners();
    const center = map.getCenter();
    if (center && (draft.location?.latitude == null || draft.location?.longitude == null)) {
      await updateCoordinates(center.lat(), center.lng());
    }
  }
}

function dismissNested() {
  if (isSubmissionPreview.value) { closeSubmissionPreview(); return true; }
  if (isPhotoLightboxOpen.value) { closePhotoLightbox(); return true; }
  if (isRewriteModalOpen.value) { discardRewrite(); return true; }
  if (isDescModalOpen.value) { discardDescModal(); return true; }
  if (isAutoImproveOpen.value) { isAutoImproveOpen.value = false; return true; }
  return false;
}

async function updateCoordinates(lat, lng, knownAddress = '') {
  if (!isSubmitViewActive || draft.step !== 1) return;
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
  persistDraft();
}

function requestGpsLocation() {
  if (!navigator.geolocation) return;
  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      isLocating.value = false;
      if (!isSubmitViewActive || draft.step !== 1) return;
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
  if ((draft.photos || []).length >= 4) { showPhotoLimitTooltip.value = true; return; }
  if (isProcessingPhotos.value) return;
  fileInput.value?.click();
}

function openCameraPicker() {
  if ((draft.photos || []).length >= 4) { showPhotoLimitTooltip.value = true; return; }
  if (isProcessingPhotos.value) return;
  cameraInput.value?.click();
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

function updatePhotoCaption(index, caption) {
  draft.photos[index].caption = caption;
  persistDraft();
}

async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  photoError.value = '';
  isPhotoToastDismissed.value = false;
  draft.photos = draft.photos || [];
  const currentCount = draft.photos.length;
  const remainingSlots = 4 - currentCount;

  if (remainingSlots <= 0) {
    photoError.value = 'Maximum 4 photos allowed.';
    event.target.value = '';
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) photoError.value = 'Maximum 4 photos allowed. Only the first available photos were added.';
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
      photoSlider.value?.scrollToPhoto(activePhotoIndex.value);
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
  nextTick(() => photoSlider.value?.scrollToPhoto(activePhotoIndex.value, 'auto'));
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
  if ((draft.photos || []).length > 4) {
    photoError.value = 'Maximum 4 photos allowed. Remove extra photos to continue.';
    goToStep(2);
    return;
  }
  if (!validateStep4()) return;

  setSubmitting(true);
  showSubmissionOverlay.value = true;
  submissionStatus.value = 'submitting';
  submissionThumbnailNotice.value = '';
  submissionProgress.value = 10;
  dynamicProgressMessage.value = 'Preparing suggestion data...';

  try {
    const uploadedPhotos = [];
    const location = {
      latitude: Number(draft.location?.latitude ?? 32.7767),
      longitude: Number(draft.location?.longitude ?? -96.7970),
    };

    if (!import.meta.env.DEV) {
      dynamicProgressMessage.value = 'Preparing location diagram renderer…';
      const [{ fetchLocationData }, { generateVersionTwoLocationDiagram }, { railCatalog }] = await Promise.all([
        import('../services/liveLocationData'),
        import('../services/locationDiagramVersionTwo'),
        import('../services/railCatalog'),
      ]);
      dynamicProgressMessage.value = 'Generating location thumbnail…';
      const thumbnail = await createOptionalLocationThumbnail({
        acquire: () => fetchLocationData({ lat: location.latitude, lon: location.longitude }, {
          onProgress: (message) => { dynamicProgressMessage.value = message; },
        }),
        render: ({ data }) => generateVersionTwoLocationDiagram(data, { ...data.center, railCatalog }).svg,
        upload: async (svg) => {
          submissionProgress.value = 15;
          dynamicProgressMessage.value = 'Uploading location thumbnail…';
          const thumbnailType = 'image/svg+xml';
          const { uploadUrl, publicUrl } = await requestPhotoUploadUrl({
            contentType: thumbnailType, filename: 'location-diagram.svg',
          });
          await uploadPhotoBinary(uploadUrl, new Blob([svg], { type: thumbnailType }), thumbnailType);
          return { url: publicUrl, caption: 'Location diagram', timestamp: new Date().toISOString() };
        },
        onUnavailable: () => {
          submissionThumbnailNotice.value = 'The map preview was unavailable. Your location and any added photos are included.';
          dynamicProgressMessage.value = 'Map preview unavailable; continuing submission…';
        },
      });
      if (thumbnail) uploadedPhotos.push(thumbnail);
    }

    const photosToUpload = (draft.photos || []).filter((p) => p.blob || p.url || p.dataUrl);

    if (photosToUpload.length > 0) {
      const stepPercent = 60 / photosToUpload.length;

      for (let i = 0; i < photosToUpload.length; i++) {
        const p = photosToUpload[i];
        submissionProgress.value = Math.round(15 + i * stepPercent);
        dynamicProgressMessage.value = `Uploading photo ${i + 1} of ${photosToUpload.length}...`;

        const photoBlob = await restoreSubmissionPhotoBlob(p);

        const { uploadUrl, publicUrl } = await requestPhotoUploadUrl({
          contentType: 'image/webp',
          filename: p.name || `photo-${i + 1}.webp`,
        });

        await uploadPhotoBinary(uploadUrl, photoBlob, 'image/webp');

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
    workspace.refreshData().catch(error => console.warn('Could not refresh suggestions:', error));

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
