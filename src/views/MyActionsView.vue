<template>
  <MapTray title="My actions" @close="workspace.closeTray()" @scroll="workspace.saveViewState">
    <div class="actions-panel">
      <p>Saved in this browser on this device.</p>
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <p role="status">{{ message }}</p>
      <p v-if="!savedActions.length">No saved actions yet. Open a suggestion’s Recommended Actions to add one.</p>
      <section v-for="entry in savedActions.slice(0, limit)" :key="entry.action.key">
        <p class="text-sm">{{ entry.suggestionSummary }}</p>
        <ActionCard :action="entry.action" saved in-my-actions @save="remove(entry.action.key, $event)">
          <router-link @click="$event.currentTarget.focus({ preventScroll: true })" class="action-button" :to="`/suggestion/${encodeURIComponent(entry.suggestionId)}`">View suggestion</router-link>
        </ActionCard>
      </section>
      <p v-if="savedActions.length">Showing {{ Math.min(limit, savedActions.length) }} of {{ savedActions.length }}</p>
      <button v-if="limit < savedActions.length" class="action-button" @click="limit += 10">Show 10 more</button>
    </div>
  </MapTray>
</template>
<script setup>
import { inject, ref, nextTick } from 'vue';
import MapTray from '../components/MapTray.vue';
import ActionCard from '../components/ActionCard.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { savedActions, removeAction, storageNotice } from '../services/localActions';
const workspace = inject(mapWorkspaceKey), limit = ref(10), message = ref('');
async function remove(key) {
  message.value = '';
  const section = document.activeElement?.closest('section');
  const next = section?.nextElementSibling, previous = section?.previousElementSibling;
  if (removeAction(key)) {
    message.value = 'Removed from My actions.';
    await nextTick();
    ([next, previous].find(el => el?.isConnected && el.matches('section'))?.querySelector('button') || document.querySelector('.map-tray-close'))?.focus();
  }
}
</script>
