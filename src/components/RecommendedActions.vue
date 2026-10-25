<template>
  <div class="actions-panel recommended-actions-content">
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <ToastNotification v-if="message" :message="message" :theme="theme" :buttons="toastButtons" @dismiss="message = ''" />
      <p v-if="loading" role="status">Loading recommended actions…</p>
      <div v-else-if="error" role="alert"><p>{{ error }}</p><button class="action-button" @click="load">Retry loading</button></div>
      <template v-else-if="loaded">
        <template v-if="!actions.length">
          <p v-if="generating" role="status">Finding relevant actions…</p>
          <p v-else-if="generationError" role="alert">{{ generationError }}</p>
          <p v-else role="status" aria-live="polite">
            {{ generated ? 'No recommendations found.' : 'Not searched for recommendations yet.' }}
          </p>

          <p>
            <PillText :onclick="generate" size="regular" variant="neutral" label="Generate recommended actions" />
            &nbsp;
            <a class="action-idea-link" :href="`${API_BASE_URL}/playground/recommendables?idea=${encodeURIComponent(suggestion.id)}`">or try our 311 search engine</a>
          </p>
        </template>
        <template v-else>
          <p v-if="!filtered.length">All recommendations are hidden. Use Show hidden to review them.</p>
          <TransitionGroup name="action-list" tag="div" class="action-row-list">
            <ActionRow v-for="action in visible" :key="action.key" :theme="theme" :surface-level="surfaceLevel" :action="action" :saved="isSaved(action.key)" :hidden="isHidden(action.key)" @save="toggleSave(action)" @hide="toggleHidden(action, $event)" />
          </TransitionGroup>
          <p v-if="visible.length < filtered.length" class="text-sm">Showing {{ visible.length }} of {{ filtered.length }}</p>
          <button v-if="visible.length < filtered.length" class="action-button" @click="limit += 10">Show 10 more</button>
          <button v-if="hiddenCount" class="action-button hidden-actions-toggle" :aria-pressed="showHidden" @click="toggleShowHidden">{{ showHidden ? 'Hide' : 'Show' }} hidden ({{ hiddenCount }})</button>
        </template>
      </template>
  </div>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue';
import ActionRow from './ActionRow.vue';
import { API_BASE_URL } from '../services/apiBaseUrl.js';
import { getSuggestionRecommendedActions, matchSuggestionRecommendations } from '../services/api';
import { savedActions, storageNotice, isSaved, isHidden, saveAction, removeAction, setHidden, normalizeActions, recommendationInput, cachedActions, cacheActions } from '../services/localActions';
import PillText from './PillText.vue';
import ToastNotification from './ToastNotification.vue';
const props = defineProps({ suggestion: { type: Object, required: true }, theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) }, surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) }, refreshVersion: Number });
const actions = ref([]), loaded = ref(false), loading = ref(false), generating = ref(false), generated = ref(false);
const generationAttempted = ref(false);
const error = ref(''), generationError = ref(''), message = ref(''), showHidden = ref(false), limit = ref(10);
let controller, version = 0;
const hiddenCount = computed(() => actions.value.filter(a => isHidden(a.key)).length);
const filtered = computed(() => actions.value.filter(a => showHidden.value || !isHidden(a.key)));
const visible = computed(() => filtered.value.slice(0, limit.value));
const toastButtons = computed(() => hiddenCount.value && /^Recommendation (?:un)?hidden\.$/.test(message.value)
  ? [{ label: `${showHidden.value ? 'Hide' : 'Show'} hidden (${hiddenCount.value})`, onClick: toggleShowHidden }]
  : []);
function toggleShowHidden() { showHidden.value = !showHidden.value; limit.value = 10; }
function reset() {
  version++; controller?.abort(); actions.value = []; loaded.value = loading.value = generating.value = generated.value = generationAttempted.value = showHidden.value = false;
  error.value = generationError.value = message.value = ''; limit.value = 10;
}
watch(() => [props.suggestion.id, props.refreshVersion], () => { reset(); load(); }, { immediate: true });
onBeforeUnmount(reset);
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
    (target?.querySelector('.menu-item__link, button') || document.querySelector('.toast-notification__link:not(.toast-notification__dismiss)'))?.focus({ preventScroll: true });
  }
}
</script>
<style scoped>
.action-row-list { position: relative; display: block; width: 100%; min-width: 0; }
:deep(.action-list-enter-active), :deep(.action-list-leave-active), :deep(.action-list-move) {
  transition: transform 220ms ease, opacity 180ms ease;
}
:deep(.action-list-enter-from), :deep(.action-list-leave-to) { opacity: 0; }
:deep(.action-list-leave-active) { position: absolute; left: 0; right: 0; }
@media (prefers-reduced-motion: reduce) {
  :deep(.action-list-enter-active), :deep(.action-list-leave-active), :deep(.action-list-move) { transition-duration: 1ms; }
}
.hidden-actions-toggle { margin-top: 1em; }
</style>

