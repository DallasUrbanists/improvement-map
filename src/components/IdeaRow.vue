<template>
  <li class="idea-row">
    <router-link :to="'/suggestion/' + encodeURIComponent(item.id)" class="idea-row-link" :data-suggestion-id="item.id" @click="$event.currentTarget.focus({ preventScroll: true })">
      <span class="idea-thumbnail">
        <img v-if="photo && !failed" :src="photo" alt="" loading="lazy" @error="failed = true" />
        <i v-else class="fa-solid fa-camera" aria-hidden="true"></i>
        <span v-if="typeof item.emoji === 'string' && item.emoji.trim()" class="idea-emoji" aria-hidden="true">{{ item.emoji }}</span>
      </span>
      <span class="idea-row-copy">
        <span :id="summaryId" class="idea-summary">{{ item.content?.summary || 'Public improvement' }}</span>
        <span class="idea-metadata idea-address">{{ workspace.formatBrowseAddress(item.location?.address) || 'Location unavailable' }}</span>
        <span class="idea-metadata">{{ workspace.formatCreationDate(item.creationDate) }}<template v-if="item._formattedDistance"> · {{ item._formattedDistance }} away</template></span>
      </span>
    </router-link>
    <BookmarkButton :item="item" :aria-describedby="summaryId" @changed="(button, previous) => emit('bookmark-changed', button, previous)" />
  </li>
</template>
<script setup>
import { computed, inject, ref, watch, useId } from 'vue';
import BookmarkButton from './BookmarkButton.vue';
import { mapWorkspaceKey } from '../services/mapWorkspace';
const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['bookmark-changed']);
const workspace = inject(mapWorkspaceKey);
const photo = computed(() => { const p = props.item.content?.photos?.[0]; return p?.url || p?.dataUrl || ''; });
const summaryId = 'idea-summary-' + useId();
const failed = ref(false);
watch(photo, () => { failed.value = false; });
</script>
