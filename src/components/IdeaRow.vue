<template>
  <IdeaRowContent :id="item.id" :summary="item.content?.summary || 'Public improvement'" :photo="photo" :emoji="item.emoji || ''" :address-text="workspace.formatBrowseAddress(item.location?.address)" :date-text="workspace.formatCreationDate(item.creationDate)" :distance-text="item._formattedDistance || ''">
    <template #bookmark="{ summaryId }"><BookmarkButton :item="item" :aria-describedby="summaryId" @changed="(button, previous) => emit('bookmark-changed', button, previous)" /></template>
  </IdeaRowContent>
</template>
<script setup>
import { computed, inject } from 'vue';
import BookmarkButton from './BookmarkButton.vue';
import IdeaRowContent from './IdeaRowContent.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['bookmark-changed']);
const workspace = inject(mapWorkspaceKey);
const photo = computed(() => {
  const firstPhoto = props.item.content?.photos?.[0];
  return firstPhoto?.url || firstPhoto?.dataUrl || '';
});
</script>
