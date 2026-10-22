<template>
  <section class="remote-subpage remote-ideas-subpage" aria-label="Find ideas">
    <div class="remote-finder">
      <div class="remote-finder-controls">
        <input v-model="finder.query" type="search" aria-label="Search ideas and places" placeholder="Search ideas or places" autocomplete="off" />
        <select v-model="finder.sort" aria-label="Sort ideas"><option value="newest">Newest first</option><option value="nearest">Nearest to TV map</option></select>
      </div>
      <div class="remote-finder-filters" role="group" aria-label="Filter ideas">
        <span class="presentation-muted">{{ ideaResults.length }} {{ ideaResults.length === 1 ? 'idea' : 'ideas' }}</span>
        <label><select v-model="finder.filter" aria-label="Idea filter"><option value="all">All ideas</option><option value="saved">Saved ideas</option><option value="streetmix">Has Streetmix</option></select></label>
      </div>

      <section v-if="placeResults.length" class="remote-place-results" aria-label="Places">
        <h2>Places</h2>
        <button v-for="place in placeResults" :key="place.id" type="button" class="presentation-card remote-idea-result" @click="selectPlace(place)">
          <span><h2>{{ place.displayName }}</h2><p>Move the presentation map to this place</p></span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>
        </button>
      </section>

      <section class="remote-idea-results" aria-label="Public improvement ideas">
        <p v-if="loading" class="presentation-muted" role="status">Loading ideas…</p>
        <p v-else-if="error" class="presentation-error" role="alert">{{ error }}</p>
        <p v-else-if="ideaResults.length === 0" class="presentation-muted">No ideas match these search and filter settings.</p>
        <article v-for="idea in ideaResults" :key="idea.id" class="remote-idea-result">
          <span class="remote-quick-list-emoji" aria-hidden="true">{{ submissionEmoji(idea.emoji) }}</span>
          <span class="remote-idea-result-copy"><h2>{{ idea.summary }}</h2><p>{{ idea.location?.address || idea.location?.description || 'Location not provided' }}</p></span>
          <button type="button" class="presentation-button is-primary" :aria-label="`Present: ${idea.summary}`" @click="present(idea.id)">Present</button>
        </article>
      </section>
      <p v-if="placeError" class="presentation-muted" role="status">{{ placeError }}</p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { bookmarks } from '../services/bookmarks.js';
import { submissionEmoji } from '../services/emojiMapMarker.js';
import { searchAddressWithGoogle, resolveGooglePlace } from '../services/googleMaps.js';
import { enqueuePresentationChanges, ensurePresentationCatalog, presentationSession as session, selectPresentationIdea } from '../services/presentationSession.js';

const router = useRouter();
const finder = session.finder;
const loading = computed(() => !session.catalogLoaded);
let placeTimer = null;
let requestId = 0;
const placeResults = computed(() => finder.placeResults);
const savedIds = computed(() => new Set(bookmarks.value.map(entry => String(entry.suggestion.id))));
function distance(idea) {
  const lat = idea.location?.latitude;
  const lng = idea.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;
  const rad = value => value * Math.PI / 180;
  const dLat = rad(lat - session.state.camera.latitude);
  const dLng = rad(lng - session.state.camera.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(session.state.camera.latitude)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const ideaResults = computed(() => {
  const query = finder.query.trim().toLowerCase();
  let values = [...session.catalog];
  if (query) values = values.filter(idea => `${idea.summary} ${idea.details} ${idea.location?.address || ''} ${idea.location?.description || ''}`.toLowerCase().includes(query));
  if (finder.filter === 'saved') values = values.filter(idea => savedIds.value.has(String(idea.id)));
  if (finder.filter === 'streetmix') values = values.filter(idea => idea.album.some(item => item.kind === 'streetmix'));
  if (finder.sort === 'nearest') values.sort((a, b) => distance(a) - distance(b) || a.summary.localeCompare(b.summary));
  else values.sort((a, b) => Date.parse(b.creationDate || '') - Date.parse(a.creationDate || '') || String(a.id).localeCompare(String(b.id)));
  return values;
});
const error = computed(() => session.catalogLoaded && !session.catalog.length && session.error ? session.error : '');
const placeError = computed(() => finder.placeError || '');
watch(() => finder.query, value => {
  clearTimeout(placeTimer);
  finder.placeError = '';
  const sequence = ++requestId;
  if (value.trim().length < 2) { finder.placeResults = []; return; }
  placeTimer = setTimeout(async () => {
    try {
      const results = await searchAddressWithGoogle(value.trim());
      if (sequence === requestId) finder.placeResults = results;
    } catch { if (sequence === requestId) finder.placeError = 'Places search is unavailable right now.'; }
  }, 350);
}, { immediate: true });

async function selectPlace(place) {
  try {
    const resolved = Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      ? place : await resolveGooglePlace(place.placeId || place.displayName);
    if (!resolved || !Number.isFinite(resolved.latitude) || !Number.isFinite(resolved.longitude)) throw new Error('That place could not be located.');
    enqueuePresentationChanges({ mode: 'map', camera: { latitude: resolved.latitude, longitude: resolved.longitude, zoom: 16 } }, { immediate: true });
    finder.placeError = '';
  } catch (problem) { finder.placeError = problem?.message || 'That place could not be located.'; }
}
async function present(id) {
  try {
    await selectPresentationIdea(id);
    await router.push({ name: 'RemoteController' });
  } catch (problem) { finder.placeError = problem?.message || 'This idea could not be presented.'; }
}
onMounted(async () => {
  try { await ensurePresentationCatalog(); }
  catch (problem) { finder.placeError = problem?.message || 'Ideas could not be loaded.'; }
});
onBeforeUnmount(() => { clearTimeout(placeTimer); requestId++; });
</script>
