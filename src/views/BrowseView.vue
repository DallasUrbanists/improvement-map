<template>
  <MapTray ref="tray" :open="workspace.isList.value" title="Browse suggestions" @close="workspace.closeTray" @scroll="onListScroll">
    <template #header>
      <div class="tray-sort-controls" role="group" aria-label="Sort suggestions">
        <button type="button" class="map-ui-button" :aria-pressed="activeSort === 1" @click="setSortMode(1)">Sort by new</button>
        <button type="button" class="map-ui-button" :aria-pressed="activeSort === 2" @click="setSortMode(2); requestGps()">
          <i class="fa-solid fa-crosshairs" :class="{ 'animate-spin': isLocating }" aria-hidden="true"></i> Sort by distance
        </button>
      </div>
    </template>
    <div class="suggestion-list-body">
      <!-- Suggestions List -->
      <div v-if="sortedListSuggestions.length > 0" class="">
        <!-- List Card item using Konsta Card -->
        <k-card v-for="item in sortedListSuggestions" :key="item.id" :content-wrap="false"
          class="!mx-0 mb-1 !rounded-none !bg-transparent hover:!bg-zinc-100 dark:hover:!bg-zinc-800 transition-colors flex flex-col sm:flex-row cursor-pointer"
          role="button" tabindex="0" :data-suggestion-id="item.id" @keydown.enter="workspace.openSuggestion(item)" @keydown.space.prevent="workspace.openSuggestion(item)"
          @click="workspace.openSuggestion(item)">
          <!-- Left: Thumbnail and Summary -->
          <div class="flex items-stretch gap-3 flex-1 min-w-0">
            <!-- Photo thumbnail -->
            <div
              class="w-20 sm:w-24 min-h-20 self-stretch bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-200 dark:border-zinc-700 relative">
              <img v-if="getPrimaryPhoto(item) && !failedPhotoIds.has(item.id)" :src="getPrimaryPhoto(item)" :alt="item.content?.summary"
                class="w-full h-full object-cover" loading="lazy" @error="onPhotoError(item.id)" />
              <div v-else
                class="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900">
                <i class="fa-solid fa-camera text-base"></i>
              </div>
            </div>

            <!-- Summary Text and Meta -->
            <div class="min-w-0 flex-1 py-1">
              <h3 class="font-bold text-sm sm:text-base line-clamp-2 leading-snug">
                {{ item.content?.summary || 'Public Improvement' }}
              </h3>
              <div class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                <span v-if="activeSort === 1">
                  <i class="fa-solid fa-clock text-zinc-400"></i>
                  {{ formatCreationDate(item.creationDate) }}
                </span>
                <span v-if="activeSort === 2">
                  <i class="fa-solid fa-location-dot text-zinc-400"></i>
                  {{ item._formattedDistance }},
                  {{ formatBrowseAddress(item.location.address) }}
                </span>
              </div>
            </div>
          </div>
        </k-card>
      </div>

      <!-- Empty State -->
      <k-card v-else :outline="true" :content-wrap="false" class="!m-0 text-center py-12">
        <i class="fa-solid fa-inbox text-3xl text-zinc-400 mb-2"></i>
        <h3 class="text-base font-bold">No suggestions found</h3>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-4">Be the first to add an idea to the map!</p>
        <k-button component="router-link" to="/submit" :rounded="true" class="text-xs font-bold">
          Submit Suggestion
        </k-button>
      </k-card>
    </div>
  </MapTray>
</template>
<script>export default { name: 'BrowseView' };</script>
<script setup>
import { inject, ref, watch, nextTick, onActivated } from 'vue';
import { kCard, kButton } from 'konsta/vue';
import MapTray from '../components/MapTray.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { getStoredBrowseListScroll, setStoredBrowseListScroll } from '../services/storage';
const workspace = inject(mapWorkspaceKey);
const { sortedListSuggestions, activeSort, setSortMode, requestGps, isLocating, failedPhotoIds, onPhotoError, getPrimaryPhoto, formatBrowseAddress, formatCreationDate } = workspace;
const tray = ref(null);
function onListScroll(event) { setStoredBrowseListScroll(event.target.scrollTop); }
async function restoreListScroll() { await nextTick(); if (tray.value?.content) tray.value.content.scrollTop = getStoredBrowseListScroll(); }
watch(workspace.isList, value => { if (value) restoreListScroll(); });
onActivated(restoreListScroll);
</script>
