<template>
  <details class="detail-accordion" @toggle="onToggle">
    <summary class="font-bold">Recommended Actions<span v-if="loaded"> ({{ actions.length }})</span></summary>
    <div class="actions-panel">
      <router-link class="action-button" to="/my-actions">My actions ({{ savedActions.length }})</router-link>
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <p role="status" aria-live="polite">{{ message }}</p>
      <p v-if="loading" role="status">Loading recommended actions…</p>
      <div v-else-if="error" role="alert"><p>{{ error }}</p><button class="action-button" @click="load">Retry loading</button></div>
      <template v-else-if="loaded">
        <template v-if="!actions.length">
          <p>{{ generated ? 'No matching recommendations were found.' : 'No recommended actions are available for this suggestion.' }}</p>
          <p class="text-sm">Urbanists Cloud finds relevant actions for this suggestion. Results are kept on this device.</p>
          <button class="action-button" :disabled="generating" @click="generate">{{ generating ? 'Generating…' : 'Generate recommended actions' }}</button>
          <p v-if="generating" role="status">Finding relevant actions…</p>
          <p v-if="generationError" role="alert">{{ generationError }}</p>
        </template>
        <template v-else>
          <button ref="hiddenToggle" class="action-button" :aria-pressed="showHidden" @click="showHidden = !showHidden; limit = 10">{{ showHidden ? 'Hide hidden' : 'Show hidden' }} ({{ hiddenCount }})</button>
          <p v-if="!filtered.length">All recommendations are hidden. Use Show hidden to review them.</p>
          <ActionCard v-for="action in visible" :key="action.key" :action="action" :saved="isSaved(action.key)" :hidden="isHidden(action.key)" @save="toggleSave(action)" @hide="toggleHidden(action, $event)" />
          <p class="text-sm">Showing {{ visible.length }} of {{ filtered.length }}</p>
          <button v-if="visible.length < filtered.length" class="action-button" @click="limit += 10">Show 10 more</button>
        </template>
      </template>
    </div>
  </details>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue';
import ActionCard from './ActionCard.vue';
import { getSuggestionRecommendedActions, matchSuggestionRecommendations } from '../services/api';
import { savedActions, storageNotice, isSaved, isHidden, saveAction, removeAction, setHidden, normalizeActions, recommendationInput, cachedActions, cacheActions } from '../services/localActions';
const props = defineProps({ suggestion: { type: Object, required: true }, refreshVersion: Number });
const actions = ref([]), loaded = ref(false), loading = ref(false), generating = ref(false), generated = ref(false);
const error = ref(''), generationError = ref(''), message = ref(''), showHidden = ref(false), limit = ref(10), hiddenToggle = ref(null);
let controller, version = 0;
const hiddenCount = computed(() => actions.value.filter(a => isHidden(a.key)).length);
const filtered = computed(() => actions.value.filter(a => showHidden.value || !isHidden(a.key)));
const visible = computed(() => filtered.value.slice(0, limit.value));
function reset() {
  version++; controller?.abort(); actions.value = []; loaded.value = loading.value = generating.value = generated.value = showHidden.value = false;
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
  const request = ++version; controller?.abort(); controller = new AbortController(); generating.value = true; generationError.value = '';
  const suggestion = props.suggestion, input = recommendationInput(suggestion);
  try {
    const result = await matchSuggestionRecommendations(input, { signal: controller.signal });
    if (request !== version) return;
    actions.value = normalizeActions(result, suggestion.id, true); generated.value = true;
    cacheActions(suggestion.id, JSON.stringify(input), actions.value);
    message.value = `${actions.value.length} recommendations found.`;
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
