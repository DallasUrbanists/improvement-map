<template><div class="sb-workspace"><BrowseView /></div></template>
<script setup>
import { provide, ref, watch } from 'vue';
import BrowseView from '../../src/views/BrowseView.vue';
import { mapWorkspaceKey } from '../../src/services/mapWorkspace.js';
import { ideas } from './fixtures.js';
const props = defineProps({ state: { type: String, default: 'populated' } });
const workspace = {
  isList: ref(true), isLoading: ref(false), listError: ref(''), locationError: ref(''),
  sortedListSuggestions: ref([]), activeSort: ref(1), isLocating: ref(false),
  setSortMode(value) { workspace.activeSort.value = value; },
  closeTray() { workspace.isList.value = false; },
  refreshData() { workspace.listError.value = ''; workspace.sortedListSuggestions.value = structuredClone(ideas); },
  requestGps() { workspace.locationError.value = ''; },
  formatBrowseAddress: address => address, formatCreationDate: () => 'Oct 1',
  saveViewState() {}, getViewState: () => ({ scroll: 0 }),
};
watch(() => props.state, state => {
  workspace.isList.value = true;
  workspace.isLoading.value = state === 'loading';
  workspace.listError.value = state === 'error' ? 'Ideas could not be loaded.' : '';
  workspace.locationError.value = state === 'location-denied' ? 'Location permission denied. Showing newest ideas.' : '';
  workspace.sortedListSuggestions.value = ['populated', 'location-denied'].includes(state) ? structuredClone(ideas) : [];
}, { immediate: true });
provide(mapWorkspaceKey, workspace);
</script>
