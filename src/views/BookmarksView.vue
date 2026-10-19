<template>
  <MapTray ref="tray" class="idea-list-tray" title="Bookmarked ideas" @close="workspace.closeTray" @scroll="workspace.saveViewState">
    <p class="idea-notice">Saved in this browser on this device. Most recently bookmarked first.</p>
    <p v-if="bookmarkNotice" class="idea-notice" role="alert">{{ bookmarkNotice }}</p>
    <p class="sr-only" role="status">{{ bookmarkMessage }}</p>
    <ul v-if="items.length" class="idea-list"><IdeaRow v-for="item in items" :key="item.id" :item="item" @bookmark-changed="removed" /></ul>
    <div v-else class="idea-empty"><h2>No bookmarked ideas yet</h2><p>Bookmark an idea in Browse or its Details tray to find it here.</p><router-link class="map-ui-button" to="/?view=list">Browse ideas</router-link></div>
  </MapTray>
</template>
<script setup>
import { computed, inject, nextTick, onMounted, ref } from 'vue';
import MapTray from '../components/MapTray.vue';
import IdeaRow from '../components/IdeaRow.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { bookmarkNotice, bookmarkMessage } from '../services/bookmarks';
const workspace = inject(mapWorkspaceKey), tray = ref(null);
const items = computed(() => workspace.bookmarkedSuggestions.value);
async function removed(button) {
  const row = button.closest('.idea-row');
  const sibling = row.nextElementSibling || row.previousElementSibling;
  const hadFocus = document.activeElement === button;
  await nextTick();
  if (hadFocus) (sibling?.querySelector('button') || tray.value?.content?.querySelector('a'))?.focus({ preventScroll: true });
  workspace.saveViewState();
}
onMounted(async () => { await nextTick(); if (tray.value?.content) tray.value.content.scrollTop = workspace.getViewState()?.scroll || 0; });
</script>
