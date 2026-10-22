<template>
  <PreviewSection class="recommended-actions-section" title="Recommended actions" button="View all actions" :count="loaded ? filtered.length : undefined" :available="loaded && actions.length > 0" @toggle="onToggle" v-slot="{ full }">
    <div class="actions-panel">
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <p v-if="message" role="status" aria-live="polite">{{ message }}</p>
      <p v-if="loading" role="status">Loading recommended actions…</p>
      <div v-else-if="error" role="alert"><p>{{ error }}</p><button class="action-button" @click="load">Retry loading</button></div>
      <template v-else-if="loaded">
        <template v-if="!actions.length">
          <p>{{ generated ? 'No recommendations found.' : 'No actions yet.' }}</p>

          <button v-if="!generationAttempted" class="action-button recommended-find-actions" :disabled="generating" @click="generate">Find actions</button>
          <p v-if="generating" role="status">Finding relevant actions…</p>
          <p v-if="generationError" role="alert">{{ generationError }}</p>
        </template>
        <template v-else>
          <button v-if="full && hiddenCount" ref="hiddenToggle" class="action-button" :aria-pressed="showHidden" @click="showHidden = !showHidden; limit = 10">{{ showHidden ? 'Hide hidden' : 'Show hidden' }} ({{ hiddenCount }})</button>
          <p v-if="!(full ? filtered : actions.filter(a => !isHidden(a.key))).length">{{ full ? 'All recommendations are hidden. Use Show hidden to review them.' : 'All recommendations are hidden. View all actions to review them.' }}</p>
          <ActionCard v-for="action in (full ? visible : actions.filter(a => !isHidden(a.key)).slice(0, 2))" :key="action.key" :action="action" :saved="isSaved(action.key)" :hidden="isHidden(action.key)" :compact="!full" @save="toggleSave(action)" @hide="toggleHidden(action, $event)" />
          <p v-if="full && visible.length < filtered.length" class="text-sm">Showing {{ visible.length }} of {{ filtered.length }}</p>
          <button v-if="full && visible.length < filtered.length" class="action-button" @click="limit += 10">Show 10 more</button>
        </template>
      </template>
      <a class="action-idea-link" :href="`https://api.dallasurbanists.org/playground/recommendables?idea=${encodeURIComponent(suggestion.id)}`">Go to 311 search</a>
    </div>
  </PreviewSection>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue';
import ActionCard from './ActionCard.vue';
import PreviewSection from './PreviewSection.vue';
import { getSuggestionRecommendedActions, matchSuggestionRecommendations } from '../services/api';
import { savedActions, storageNotice, isSaved, isHidden, saveAction, removeAction, setHidden, normalizeActions, recommendationInput, cachedActions, cacheActions } from '../services/localActions';
const props = defineProps({ suggestion: { type: Object, required: true }, refreshVersion: Number });
const actions = ref([]), loaded = ref(false), loading = ref(false), generating = ref(false), generated = ref(false);
const generationAttempted = ref(false);
const error = ref(''), generationError = ref(''), message = ref(''), showHidden = ref(false), limit = ref(10), hiddenToggle = ref(null);
let controller, version = 0;
const hiddenCount = computed(() => actions.value.filter(a => isHidden(a.key)).length);
const filtered = computed(() => actions.value.filter(a => showHidden.value || !isHidden(a.key)));
const visible = computed(() => filtered.value.slice(0, limit.value));
function reset() {
  version++; controller?.abort(); actions.value = []; loaded.value = loading.value = generating.value = generated.value = generationAttempted.value = showHidden.value = false;
  error.value = generationError.value = message.value = ''; limit.value = 10;
}
watch(() => [props.suggestion.id, props.refreshVersion], reset);
onBeforeUnmount(reset);
function onToggle(event) { if (event.currentTarget.open && !loaded.value && !loading.value) load(); }
async function load() {
  const request = ++version; controller?.abort(); controller = new AbortController(); loading.value = true; error.value = '';
  try {
    const result = await getSuggestionRecommendedActions(props.suggestion.id, { signal: controller.signal });
    if (request !== version) return;
    const attached = normalizeActions(result, props.suggestion.id);
    const cached = cachedActions(props.suggestion.id, JSON.stringify(recommendationInput(props.suggestion)));
    actions.value = attached.length ? attached : cached || [];
    generated.value = !attached.length && cached !== null; loaded.value = true;
  } catch (e) { if (request === version) error.value = e.message; }
  finally { if (request === version) loading.value = false; }
}
async function generate() {
  if (generating.value) return;
  generationAttempted.value = true;
  const request = ++version; controller?.abort(); controller = new AbortController(); generating.value = true; generationError.value = '';
  const suggestion = props.suggestion, input = recommendationInput(suggestion);
  try {
    const result = await matchSuggestionRecommendations(input, { signal: controller.signal });
    if (request !== version) return;
    actions.value = normalizeActions(result, suggestion.id, true); generated.value = true;
    cacheActions(suggestion.id, JSON.stringify(input), actions.value);
    message.value = actions.value.length ? `${actions.value.length} recommendations found.` : '';
  } catch (e) { if (request === version) generationError.value = e.message; }
  finally { if (request === version) generating.value = false; }
}
function toggleSave(action) {
  message.value = '';
  const saved = isSaved(action.key);
  if (saved ? removeAction(action.key) : saveAction(action, props.suggestion)) message.value = saved ? 'Removed from My actions.' : 'Saved to My actions on this device.';
}
async function toggleHidden(action, event) {
  message.value = '';
  const hidden = isHidden(action.key), card = event.target.closest('article');
  const next = card?.nextElementSibling, previous = card?.previousElementSibling;
  if (!setHidden(action.key, !hidden)) return;
  message.value = hidden ? 'Recommendation unhidden.' : 'Recommendation hidden.';
  if (!hidden && !showHidden.value) {
    await nextTick();
    const target = [next, previous].find(el => el?.isConnected && el.matches('article'));
    (target?.querySelector('button') || hiddenToggle.value)?.focus({ preventScroll: true });
  }
}
</script>
