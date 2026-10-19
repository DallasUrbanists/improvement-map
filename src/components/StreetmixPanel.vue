<template>
  <details class="detail-accordion streetmix-accordion" @toggle="toggle">
    <summary class="font-bold">Streetmix</summary>
    <div class="actions-panel" :aria-hidden="full || undefined" :inert="full">
      <p v-if="loading" role="status">Loading Streetmix…</p>
      <p v-else-if="statusMessage" role="status">{{ statusMessage }}</p>
      <p v-else-if="selecting">Choose a street for this design.</p>
      <p v-else-if="result">{{ result.selectedStreet?.name || 'Street design ready' }}</p>
      <p v-else>Create a street cross-section.</p>
      <button class="action-button" :disabled="loading" @click="$event.currentTarget.focus({ preventScroll: true }); full = true">{{ result ? 'View design' : selecting ? 'Choose street' : pending || workflow ? 'Continue design' : 'Create design' }}</button>
    </div>
  </details>
  <DetailSheet v-model="full" title="Streetmix">
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
        <button v-if="selectionAllowed && !confirmationPending" class="action-button" :disabled="blocked || selected === ''" @click="confirm(selected)">Use this street</button>
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
      <template v-if="result">
        <p v-if="saved?.stale" role="status">Created for this suggestion’s previous location.</p>
        <a v-if="url" :href="url" target="_blank" rel="noopener noreferrer" class="action-button">Open in Streetmix ↗</a>
        <p v-else role="alert">The saved design link is invalid.</p>
        <template v-if="full && url">
          <p v-if="!frameLoaded" role="status">Loading design… If it does not appear, open it in Streetmix.</p>
          <iframe :key="url" :src="url" title="Generated Streetmix design" class="streetmix-frame" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" @load="frameLoaded = true"></iframe>
        </template>
        <p v-if="result.selectedStreet?.carriagewayOnly">This drawing covers one carriageway only.</p>
        <p v-else-if="result.dividedRoad">Includes opposing carriageways.</p>
        <p v-for="(warning, index) in warnings" :key="index" class="text-sm">{{ readable(warning) }}</p>
        <details v-if="evidence.length" class="streetmix-evidence">
          <summary>Design details</summary>
          <div v-for="([label, value]) in evidence" :key="label"><strong>{{ humanize(label) }}</strong><div class="text-sm">{{ readable(value) }}</div></div>
        </details>
        <template v-if="authorized && !pending && !workflow">
          <button class="action-button" :disabled="blocked" @click="start(true)">Regenerate design</button>
          <p class="text-sm">Creates a new public design.</p>
        </template>
      </template>
    </div>
  </DetailSheet>
</template>
<script setup>
import { computed, ref, watch, useId } from 'vue';
import { kPreloader } from 'konsta/vue';
import DetailSheet from './DetailSheet.vue';
import StreetmixRoadMap from './StreetmixRoadMap.vue';
import { useStreetmix } from '../services/useStreetmix';
const props = defineProps({ suggestion: { type: Object, required: true }, refreshVersion: Number });
const emit = defineEmits(['saved']);
const full = ref(false);
const open = ref(false), selected = ref(''), frameLoaded = ref(false), selectId = useId();
const { saved, result, workflow, pending, loading, busy, error, storageNotice, authorized, selectionAllowed, regeneration, url, expired, selecting, active, blocked, statusMessage, load, check, start, resume, confirm } = useStreetmix(props, emit, open);
const confirmationPending = computed(() => pending.value?.path.endsWith('/selection'));
const selectedRoad = computed(() => workflow.value?.candidates?.find(c => String(c.osmWayId) === String(selected.value)));
const warnings = computed(() => { const value = result.value?.warnings; return Array.isArray(value) ? value : value ? [value] : []; });
const evidence = computed(() => Object.entries(result.value || {}).filter(([key, value]) => value != null && /source|attribution|estimat|evidence|assumption/i.test(key)));
function humanize(value) { const text = value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1); }
function readable(value) { return typeof value === 'string' ? value : Array.isArray(value) ? value.map(readable).join('; ') : value && typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${humanize(k)}: ${readable(v)}`).join('; ') : String(value); }
function roadDetails(c) { return [c.highway, `OSM ${c.osmWayId}`, `${Math.round(c.bearingDegrees)}° bearing`, c.bridge && c.bridge !== 'no' ? 'Bridge' : '', c.tunnel && c.tunnel !== 'no' ? 'Tunnel' : '', c.layer != null ? `Layer ${c.layer}` : ''].filter(Boolean).join(' · '); }
function choose(id) { if (!busy.value && !confirmationPending.value) selected.value = id; }
function toggle(event) { open.value = event.currentTarget.open; }
watch(() => [workflow.value?.requestId, pending.value?.path, pending.value?.body], ([id, path, body], [previousId]) => {
  if (path?.endsWith('/selection')) {
    try { selected.value = JSON.parse(body).osmWayId ?? ''; } catch { selected.value = ''; }
  } else if (id !== previousId) selected.value = '';
});
watch(url, () => { frameLoaded.value = false; });
</script>
