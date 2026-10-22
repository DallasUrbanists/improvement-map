<template>
  <div class="presentation-streetmix">
    <div v-if="safeUrl && !useFallback" class="streetmix-frame" inert aria-hidden="true">
      <iframe :src="safeUrl" :title="`Saved Streetmix design for ${ideaTitle}`" sandbox="allow-scripts allow-same-origin"
        referrerpolicy="no-referrer" tabindex="-1" @error="onIframeError"></iframe>
    </div>
    <div v-if="useFallback" class="streetmix-fallback">
      <img v-if="fallbackUrl" :src="fallbackUrl" alt="Saved Streetmix design image" @load="emit('status', 'ready', null)" @error="onFallbackError" />
      <p v-if="fallbackError || !fallbackUrl" class="map-ui" role="status">Streetmix preview image is unavailable.</p>
      <button type="button" class="map-ui map-ui-button" :disabled="loading" @click="loadFallback">{{ loading ? 'Loading…' : 'Retry preview image' }}</button>
    </div>
    <div v-if="!safeUrl" class="map-ui streetmix-error" role="status">This saved design has an invalid link.</div>
    <p v-if="item?.stale" class="map-ui streetmix-stale">Saved design preview may be out of date.</p>
    <button v-if="safeUrl && !useFallback" type="button" class="map-ui map-ui-button streetmix-fallback-button" @click="showFallback">Show preview image</button>
    <span v-if="iframeError" class="sr-only" role="status">Streetmix embed did not load; a preview image can be shown.</span>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { loadStreetmixThumbnail } from '../services/presentationApi.js';
import { safePresentationStreetmixUrl } from '../services/presentationState.js';
import { presentationSession } from '../services/presentationSession.js';

const props = defineProps({ item: { type: Object, required: true }, ideaId: { type: String, required: true }, ideaTitle: { type: String, default: 'selected idea' } });
const emit = defineEmits(['status']);
const safeUrl = computed(() => safePresentationStreetmixUrl(props.item?.url) ? props.item.url : '');
const useFallback = ref(false);
const iframeError = ref(false);
const fallbackUrl = ref('');
const fallbackError = ref(false);
const loading = ref(false);
let abortController = null;
let verificationTimer = null;

function releaseFallback() {
  if (fallbackUrl.value) URL.revokeObjectURL(fallbackUrl.value);
  fallbackUrl.value = '';
}
async function loadFallback() {
  abortController?.abort();
  if (verificationTimer) clearTimeout(verificationTimer);
  verificationTimer = null;
  abortController = new AbortController();
  loading.value = true;
  fallbackError.value = false;
  releaseFallback();
  try {
    const blob = await loadStreetmixThumbnail(presentationSession.credential, props.ideaId, { signal: abortController.signal });
    if (abortController.signal.aborted || !blob.size || blob.size > 5 * 1024 * 1024 || blob.type !== 'image/png') throw new Error('Invalid Streetmix preview image.');
    fallbackUrl.value = URL.createObjectURL(blob);
  } catch {
    if (!abortController.signal.aborted) { fallbackError.value = true; emit('status', 'error', 'STREETMIX_UNAVAILABLE'); }
  } finally { loading.value = false; }
}
function showFallback() { useFallback.value = true; emit('status', 'loading', null); loadFallback(); }
function onIframeError() { iframeError.value = true; emit('status', 'error', 'STREETMIX_UNAVAILABLE'); }
function onFallbackError() { fallbackError.value = true; emit('status', 'error', 'STREETMIX_UNAVAILABLE'); }
watch(() => [props.ideaId, props.item?.id], () => {
  abortController?.abort();
  if (verificationTimer) clearTimeout(verificationTimer);
  releaseFallback();
  useFallback.value = false;
  iframeError.value = false;
  fallbackError.value = false;
  if (safeUrl.value) {
    emit('status', 'loading', null);
    verificationTimer = setTimeout(() => { emit('status', 'error', 'STREETMIX_UNAVAILABLE'); }, 8000);
  } else emit('status', 'error', 'STREETMIX_UNAVAILABLE');
}, { immediate: true });
onBeforeUnmount(() => { abortController?.abort(); if (verificationTimer) clearTimeout(verificationTimer); releaseFallback(); });
</script>

<style scoped>
.presentation-streetmix { position: absolute; inset: 0; overflow: hidden; background: var(--presentation-bg, #f5f3ee); }
.streetmix-frame, iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
.streetmix-fallback { position: absolute; inset: 0; display: grid; place-items: center; background: var(--presentation-bg, #f5f3ee); }
.streetmix-fallback img { width: 100%; height: 100%; object-fit: contain; }
.streetmix-fallback button { position: absolute; right: 1rem; bottom: 1rem; }
.streetmix-fallback p { position: absolute; inset: auto 1rem 4.5rem; padding: .75rem; text-align: center; }
.streetmix-error { position: absolute; inset: 50% auto auto 50%; translate: -50% -50%; padding: .75rem; }
.streetmix-fallback-button { position: absolute; z-index: 3; right: .75rem; bottom: .75rem; opacity: .85; }
.streetmix-stale { position: absolute; top: .5rem; right: .5rem; z-index: 2; padding: .35rem .6rem; font-size: .75rem; }
</style>
