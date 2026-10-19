<template>
  <MapTray ref="tray" class="idea-list-tray" title="Saved ideas" @close="workspace.closeTray" @scroll="workspace.saveViewState">
    <template #header><h1>Saved ideas <span class="idea-count">{{ items.length }}</span></h1></template>
    <p class="idea-notice">Saved in this browser.</p>
    <div v-if="items.length >= 10 || search" class="saved-search"><label for="saved-idea-search">Search saved ideas</label><input id="saved-idea-search" type="search" v-model="search" placeholder="Idea or address" /></div>
    <div v-if="undoEntry" class="idea-notice undo-notice" role="status">Idea removed.<button class="action-button" @click="undo">Undo</button></div>
    <p v-if="bookmarkNotice" class="idea-notice" role="alert">{{ bookmarkNotice }}</p>
    <p class="sr-only" role="status">{{ bookmarkMessage }}</p>
    <ul v-if="filteredItems.length" class="idea-list"><IdeaRow v-for="item in filteredItems" :key="item.id" :item="item" @bookmark-changed="removed" /></ul>
    <p v-else-if="search" class="idea-notice">No matching ideas.</p>
    <div v-else class="idea-empty"><h2>No saved ideas</h2><p>Tap a bookmark to save an idea.</p><router-link class="map-ui-button" to="/?view=list">Browse ideas</router-link></div>
  </MapTray>
</template>
<script setup>
import { computed, inject, nextTick, onMounted, ref } from 'vue';
import MapTray from '../components/MapTray.vue';
import IdeaRow from '../components/IdeaRow.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { bookmarkNotice, bookmarkMessage, restoreBookmark } from '../services/bookmarks';
const workspace = inject(mapWorkspaceKey), tray = ref(null);
const items = computed(() => workspace.bookmarkedSuggestions.value);
const search = ref(''), undoEntry = ref(null);
const filteredItems = computed(() => items.value.filter(item => [item.content?.summary, item.location?.address].join(' ').toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
async function undo() {
  const entry = undoEntry.value;
  if (!entry || !restoreBookmark(entry)) return;
  undoEntry.value = null;
  await nextTick();
  Array.from(tray.value?.content?.querySelectorAll('[data-suggestion-id]') || []).find(el => el.dataset.suggestionId === entry.suggestion.id)?.focus({ preventScroll: true });
}
async function removed(button, previous) {
  undoEntry.value = previous || null;
  const row = button.closest('.idea-row');
  const sibling = row.nextElementSibling || row.previousElementSibling;
  const hadFocus = document.activeElement === button;
  await nextTick();
  if (hadFocus) (sibling?.querySelector('button') || tray.value?.content?.querySelector('a'))?.focus({ preventScroll: true });
  workspace.saveViewState();
}
onMounted(async () => { await nextTick(); if (tray.value?.content) tray.value.content.scrollTop = workspace.getViewState()?.scroll || 0; });
</script>
