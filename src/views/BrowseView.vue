<template>
  <MapTray ref="tray" class="idea-list-tray" :open="workspace.isList.value" title="Browse ideas" @close="workspace.closeTray" @scroll="onListScroll">
    <template #header><h1>Browse ideas <span v-if="!workspace.isLoading.value" class="idea-count">({{ sortedListSuggestions.length }})</span></h1></template>
    <template #controls>
      <div class="tray-sort-controls" role="group" aria-label="Sort ideas">
        <MapControlButton :pressed="activeSort === 1" @click="setSortMode(1)">Newest</MapControlButton>
        <MapControlButton :pressed="activeSort === 2" :aria-busy="isLocating" @click="setSortMode(2)">
          <i class="fa-solid fa-crosshairs" :class="{ 'animate-spin': isLocating }" aria-hidden="true"></i> Nearest to me
        </MapControlButton>
      </div>
      <p v-if="workspace.locationError.value" class="idea-notice" role="status">{{ workspace.locationError.value }} <button type="button" class="map-ui-button" @click="setSortMode(2); workspace.requestGps()">Retry location</button><button type="button" class="map-ui-button" @click="workspace.locationError.value = ''">Dismiss</button></p>
      <p v-else-if="isLocating" class="idea-notice" role="status">Finding your location…</p>
    </template>
    <p v-if="bookmarkNotice" class="idea-notice" role="alert">{{ bookmarkNotice }}</p>
    <p class="sr-only" role="status">{{ bookmarkMessage }}</p>
    <div v-if="workspace.isLoading.value && !sortedListSuggestions.length" class="idea-empty" role="status">Loading ideas…</div>
    <div v-else-if="workspace.listError.value" class="idea-notice" role="alert">
      <p>{{ workspace.listError.value }}</p><button class="map-ui-button" @click="workspace.refreshData()">Retry</button>
    </div>
    <ul v-if="sortedListSuggestions.length" class="idea-list"><IdeaRow v-for="item in sortedListSuggestions" :key="item.id" :item="item" /></ul>
    <div v-else-if="!workspace.isLoading.value && !workspace.listError.value" class="idea-empty">
      <h2>No ideas yet</h2><p>Be the first to add an idea to the map.</p><router-link class="map-ui-button" to="/submit">Submit an idea</router-link>
    </div>
  </MapTray>
</template>
<script>export default { name: 'BrowseView' };</script>
<script setup>
import { inject, ref, watch, nextTick, onActivated } from 'vue';
import MapTray from '../components/MapTray.vue';
import MapControlButton from '../components/MapControlButton.vue';
import IdeaRow from '../components/IdeaRow.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { bookmarkNotice, bookmarkMessage } from '../services/bookmarks';
import { getStoredBrowseListScroll, setStoredBrowseListScroll } from '../services/storage';
const workspace = inject(mapWorkspaceKey);
const { sortedListSuggestions, activeSort, setSortMode, isLocating } = workspace;
const tray = ref(null);
function onListScroll(event) { setStoredBrowseListScroll(event.target.scrollTop); workspace.saveViewState(); }
async function restoreListScroll() { await nextTick(); if (tray.value?.content) tray.value.content.scrollTop = workspace.getViewState()?.scroll ?? getStoredBrowseListScroll(); }
watch(workspace.isList, value => { if (value) restoreListScroll(); });
watch(() => sortedListSuggestions.value.length, restoreListScroll);
onActivated(restoreListScroll);
</script>
