<template>
  <MapTray ref="tray" title="My actions" @close="workspace.closeTray()" @scroll="workspace.saveViewState">
    <div class="actions-panel">
      <p>Saved in this browser.</p>
      <p v-if="storageNotice" role="alert">{{ storageNotice }}</p>
      <p v-if="message" role="status">{{ message }} <button v-if="undoEntry" class="action-button" @click="undo">Undo</button></p>
      <p v-if="!savedActions.length">No saved actions yet. Save an action from an idea’s recommendations.</p>
      <section v-for="entry in savedActions.slice(0, limit)" :key="entry.action.key">
        <router-link class="action-idea-link" :to="`/suggestion/${encodeURIComponent(entry.suggestionId)}`">{{ entry.suggestionSummary }}</router-link>
        <ActionCard :action="entry.action" saved in-my-actions @save="remove(entry.action.key)" />
      </section>
      <p v-if="limit < savedActions.length">Showing {{ Math.min(limit, savedActions.length) }} of {{ savedActions.length }}</p>
      <button v-if="limit < savedActions.length" class="action-button" @click="limit += 10">Show 10 more</button>
    </div>
  </MapTray>
</template>
<script setup>
import { inject, ref, nextTick } from 'vue';
import MapTray from '../components/MapTray.vue';
import ActionCard from '../components/ActionCard.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
import { savedActions, removeAction, restoreAction, storageNotice } from '../services/localActions';
const workspace = inject(mapWorkspaceKey), limit = ref(10), message = ref('');
const undoEntry = ref(null), tray = ref(null);
async function undo() {
  const entry = undoEntry.value;
  if (!entry || !restoreAction(entry)) return;
  undoEntry.value = null; message.value = 'Action restored.';
  await nextTick();
  Array.from(tray.value?.content?.querySelectorAll('[data-action-key]') || []).find(el => el.dataset.actionKey === entry.action.key)?.querySelector('button')?.focus({ preventScroll: true });
}
async function remove(key) {
  const entry = savedActions.value.find(item => item.action.key === key);
  message.value = '';
  const section = document.activeElement?.closest('section');
  const next = section?.nextElementSibling, previous = section?.previousElementSibling;
  if (removeAction(key)) {
    undoEntry.value = entry;
    message.value = 'Action removed.';
    await nextTick();
    ([next, previous].find(el => el?.isConnected && el.matches('section'))?.querySelector('button') || document.querySelector('.map-tray-close'))?.focus();
  }
}
</script>
