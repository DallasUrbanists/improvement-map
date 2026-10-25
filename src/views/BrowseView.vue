<template>
  <BrowseList
    ref="browseList"
    class="idea-list-tray"
    :open="workspace.isList.value"
    :items="browseItems"
    :sort-index="sortIndex"
    :theme="isDark ? 'dark' : 'light'"
    @update:sort-index="sortIndex = $event"
    @sort-change="changeSort"
    @bookmark-toggle="onBookmarkToggle"
    @close="workspace.closeTray"
    @scroll="onListScroll"
  >
    <template #status>
      <p v-if="bookmarkNotice" class="idea-notice" role="alert">{{ bookmarkNotice }}</p>
      <p class="sr-only" role="status">{{ bookmarkMessage }}</p>
      <p v-if="workspace.isLoading.value && !browseItems.length" class="idea-empty" role="status">Loading ideas…</p>
      <div v-else-if="workspace.listError.value" class="idea-notice" role="alert">
        <p>{{ workspace.listError.value }}</p><button class="map-ui-button" @click="workspace.refreshData()">Retry</button>
      </div>
      <p v-else-if="workspace.locationError.value" class="idea-notice" role="status">
        {{ workspace.locationError.value }}
        <button type="button" class="map-ui-button" @click="setSortMode(2); workspace.requestGps()">Retry location</button>
        <button type="button" class="map-ui-button" @click="workspace.locationError.value = ''">Dismiss</button>
      </p>
      <p v-else-if="isLocating" class="idea-notice" role="status">Finding your location…</p>
    </template>
    <template #empty>
      <div v-if="!workspace.isLoading.value && !workspace.listError.value" class="idea-empty">
        <h2>No ideas yet</h2><p>Be the first to add an idea to the map.</p><router-link class="map-ui-button" to="/submit">Submit an idea</router-link>
      </div>
    </template>
  </BrowseList>
</template>
<script>export default { name: 'BrowseView' };</script>
<script setup>
import { computed, inject, ref, watch, nextTick, onActivated } from 'vue';
import BrowseList from '../components/BrowseList.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { bookmarkNotice, bookmarkMessage, bookmarks, toggleBookmark } from '../services/bookmarks';
import { isDark } from '../services/theme';
import { getStoredBrowseListScroll, setStoredBrowseListScroll } from '../services/storage';

const workspace = inject(mapWorkspaceKey);
const { sortedListSuggestions, activeSort, setSortMode, isLocating } = workspace;
const sortIndex = ref(activeSort.value - 1);
const browseItems = computed(() => {
  const savedIds = new Set(bookmarks.value.map(entry => entry.suggestion.id));
  return sortedListSuggestions.value.map(item => ({
    id: item.id,
    summary: item.content?.summary || 'Public improvement',
    photo: workspace.getPrimaryPhoto(item),
    emoji: item.emoji || '',
    addressText: workspace.formatBrowseAddress(item.location?.address),
    dateText: workspace.formatCreationDate(item.creationDate),
    distanceText: item._formattedDistance || '',
    bookmarked: savedIds.has(String(item.id)),
    source: item,
  }));
});

function changeSort({ index }) {
  sortIndex.value = index;
  setSortMode(index + 1);
}
function onBookmarkToggle({ item }) { toggleBookmark(item.source); }
function onListScroll(event) {
  setStoredBrowseListScroll(event.target.scrollTop);
  workspace.saveViewState();
}
async function restoreListScroll() {
  await nextTick();
  if (!workspace.isList.value) return;
  const content = document.querySelector('.idea-list-tray .floating-modal__content');
  if (content) content.scrollTop = workspace.getViewState()?.scroll ?? getStoredBrowseListScroll();
}

watch(workspace.isList, value => { if (value) restoreListScroll(); });
watch(() => sortedListSuggestions.value.length, restoreListScroll);
watch(activeSort, value => { sortIndex.value = value - 1; });
watch(workspace.locationError, value => { if (value) sortIndex.value = activeSort.value - 1; });
onActivated(restoreListScroll);
</script>
