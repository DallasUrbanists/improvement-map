<template>
  <Accordion v-if="!hasDesign" v-model:open="expanded" class="streetmix-accordion streetmix-locked" :theme="theme" :surface-level="surfaceLevel" :header="{ label: 'Streetmix' }" :header-text-button="{ label: selecting ? 'Choose street' : 'Create design', disabled: loading }" @header-text-button-click="full = true">
    <div class="streetmix-panel-copy">
      <p>Create a street cross-section for this location.</p>
      <p class="text-sm">About a minute. Creates a public, anonymous design.</p>
    </div>
  </Accordion>
  <Accordion v-else v-model:open="expanded" class="streetmix-accordion streetmix-generated" :theme="theme" :surface-level="surfaceLevel" :header="{ label: 'Streetmix' }" :header-text-button="{ label: 'Open Streetmix' }" @header-text-button-click="openStreetmix">
    <div class="streetmix-preview">
      <template v-if="expanded && !imageFailed">
        <p v-if="!imageLoaded" role="status">Loading design…</p>
        <img v-if="imageUrl" :key="imageUrl" :src="imageUrl" alt="Generated Streetmix design" referrerpolicy="no-referrer" @load="imageLoaded = true" @error="imageFailed = true" />
      </template>
      <p v-else-if="expanded" role="status">Preview unavailable.</p>
    </div>
  </Accordion>
  <DetailSheet v-if="!hasDesign" v-model="full" title="Streetmix">
    <div class="actions-panel streetmix-panel">
      <p v-if="loading" role="status">Loading Streetmix…</p>
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <div v-if="error" role="alert">
        <p>{{ error }}</p>
        <button v-if="!pending" class="action-button" :disabled="blocked" @click="load">Reload design</button>
      </div>
      <p v-if="statusMessage" role="status" aria-live="polite"><k-preloader v-if="active" class="h-4 w-4 inline-block mr-2" aria-hidden="true" />{{ statusMessage }}</p>
      <template v-if="expired || workflow?.status === 'failed'">
        <p v-if="expired">Street selection expired.</p>
        <button v-if="!regeneration || authorized" class="action-button" :disabled="blocked" @click="start(Boolean(saved))">Start again</button>
      </template>
      <template v-else-if="selecting">
        <p>Which street?</p>
        <StreetmixRoadMap v-if="full && workflow.coordinate" :candidates="workflow.candidates || []" :coordinate="workflow.coordinate" :selected="selected" @select="choose" />
        <fieldset class="street-choices" :disabled="busy || confirmationPending">
          <legend>Nearby streets</legend>
          <label v-for="(candidate, index) in workflow.candidates || []" :key="candidate.osmWayId" class="street-choice">
            <input type="radio" :name="selectId" :value="candidate.osmWayId" v-model="selected" />
            <span><strong>{{ index + 1 }} · {{ candidate.name || 'Unnamed street' }}</strong><span class="secondary-copy">{{ Math.round(candidate.distanceMeters) }} m away{{ candidate.bridge && candidate.bridge !== 'no' ? ' · Bridge' : '' }}{{ candidate.tunnel && candidate.tunnel !== 'no' ? ' · Tunnel' : '' }}</span></span>
          </label>
        </fieldset>
        <details v-if="selectedRoad" class="streetmix-evidence"><summary>Street details</summary><p>{{ roadDetails(selectedRoad) }}</p><p v-if="selectedRoad.oppositeOsmWayId">Opposing carriageway: OSM {{ selectedRoad.oppositeOsmWayId }}</p><p>Map bearing may differ from traffic direction.</p></details>
        <p class="secondary-copy">Selection expires after 15 minutes.</p>
        <p v-if="!selectionAllowed">Only the author or staff can confirm a replacement.</p>
      </template>
      <template v-if="pending && !expired && workflow?.status !== 'failed' && (!selecting || confirmationPending)">
        <button v-if="!regeneration || authorized" class="action-button" :disabled="blocked" @click="resume">Resume</button>
      </template>
      <button v-if="workflow?.requestId && !expired && !selecting && workflow.status !== 'failed'" class="action-button" :disabled="blocked" @click="check">Check status</button>
      <template v-if="!loading && !error && !saved && !result && !workflow && !pending">
        <p>Create a street cross-section for this location.</p>
        <button class="action-button" :disabled="blocked" @click="start()">Create design</button>
        <p class="text-sm">About a minute. Creates a public, anonymous design.</p>
      </template>
    </div>
    <template v-if="selecting && selectionAllowed && !confirmationPending" #footer>
      <button type="button" class="streetmix-confirm" :disabled="blocked || selected === ''" @click="confirm(selected)">Use this street</button>
    </template>
  </DetailSheet>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch, useId } from 'vue';
import { kPreloader } from 'konsta/vue';
import DetailSheet from './DetailSheet.vue';
import Accordion from './Accordion.vue';
import StreetmixRoadMap from './StreetmixRoadMap.vue';
import { useStreetmix } from '../services/useStreetmix';
import { fetchStreetmixThumbnail, safeStreetmixUrl } from '../services/streetmix';
const props = defineProps({ suggestion: { type: Object, required: true }, theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) }, surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) }, refreshVersion: Number });
const emit = defineEmits(['saved']);
const full = ref(false), expanded = ref(false);
const open = computed(() => full.value || expanded.value);
const selected = ref(''), imageLoaded = ref(false), imageFailed = ref(false), selectId = useId();
const { saved, result, workflow, pending, loading, busy, error, storageNotice, authorized, selectionAllowed, regeneration, url, expired, selecting, active, blocked, statusMessage, load, check, start, resume, confirm } = useStreetmix(props, emit, open);
const hasDesign = computed(() => Boolean(saved.value || result.value));
const editorUrl = computed(() => url.value || safeStreetmixUrl(saved.value?.streetmixUrl));
function openStreetmix() { if (editorUrl.value) window.open(editorUrl.value, '_blank', 'noopener,noreferrer'); }
const imageUrl = ref('');
let imageController, imageVersion = 0;
const confirmationPending = computed(() => pending.value?.path.endsWith('/selection'));
const selectedRoad = computed(() => workflow.value?.candidates?.find(c => String(c.osmWayId) === String(selected.value)));
function roadDetails(c) { return [c.highway, `OSM ${c.osmWayId}`, `${Math.round(c.bearingDegrees)}° bearing`, c.bridge && c.bridge !== 'no' ? 'Bridge' : '', c.tunnel && c.tunnel !== 'no' ? 'Tunnel' : '', c.layer != null ? `Layer ${c.layer}` : ''].filter(Boolean).join(' · '); }
function choose(id) { if (!busy.value && !confirmationPending.value) selected.value = id; }
watch(() => [workflow.value?.requestId, pending.value?.path, pending.value?.body], ([id, path, body], [previousId]) => {
  if (path?.endsWith('/selection')) {
    try { selected.value = JSON.parse(body).osmWayId ?? ''; } catch { selected.value = ''; }
  } else if (id !== previousId) selected.value = '';
});
function clearImage() { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = ''; imageLoaded.value = imageFailed.value = false; }
watch([expanded, () => result.value?.streetmixId || saved.value?.streetmixId], async ([visible, id], [, previousId]) => {
  imageController?.abort();
  const version = ++imageVersion;
  if (id !== previousId) clearImage();
  if (!visible || imageUrl.value) return;
  imageFailed.value = false;
  imageController = new AbortController();
  try {
    const image = await fetchStreetmixThumbnail(props.suggestion.id, { signal: imageController.signal });
    if (version === imageVersion) imageUrl.value = URL.createObjectURL(image);
  } catch { if (version === imageVersion) imageFailed.value = true; }
});
onBeforeUnmount(() => { imageVersion++; imageController?.abort(); clearImage(); });
watch(hasDesign, value => {
  if (value && full.value) {
    full.value = false;
    expanded.value = true;
  }
});
</script>
