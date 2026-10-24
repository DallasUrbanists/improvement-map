<template>
  <FloatingModal v-model:open="open" label="Browse ideas" :theme="theme" :surface-level="surfaceLevel" @close="$emit('close')">
    <TabNavigation
      v-model:selected-index="sortIndex"
      class="browse-list__navigation"
      :theme="theme"
      :surface-level="surfaceLevel"
      :padded="false"
      :tabs="sortTabs"
      @tab-change="selectSort"
    >
      <template #section>
        <ul class="browse-list" :data-theme="theme" :data-variant="variant">
          <IdeaRowContent
            v-for="item in items"
            :key="item.id"
            :id="item.id"
            :summary="item.summary"
            :photo="item.photo"
            :emoji="item.emoji"
            :address-text="item.addressText"
            :date-text="item.dateText"
            :distance-text="item.distanceText"
            :theme="theme"
            :variant="variant"
            :surface-level="surfaceLevel"
          >
            <template #bookmark="{ summaryId }">
              <BookmarkToggle
                :bookmarked="Boolean(item.bookmarked)"
                :aria-describedby="summaryId"
                @toggle="$emit('bookmark-toggle', { item, bookmarked: !item.bookmarked })"
              />
            </template>
          </IdeaRowContent>
        </ul>
      </template>
    </TabNavigation>
  </FloatingModal>
</template>

<script setup>
import BookmarkToggle from './BookmarkToggle.vue';
import FloatingModal from './FloatingModal.vue';
import IdeaRowContent from './IdeaRowContent.vue';
import TabNavigation from './TabNavigation.vue';

/** Presentational browse list in a modal with parent-controlled sorting and bookmark state. */
defineProps({
  /** Browse rows with id, summary, photo, emoji, addressText, dateText, distanceText and bookmarked. */
  items: { type: Array, default: () => [] },
  theme: { type: String, default: undefined, validator: value => value === undefined || ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Surface level used by the modal, header, tabbar, list section and neutral idea rows. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
});
const open = defineModel('open', { type: Boolean, default: true });
const sortIndex = defineModel('sortIndex', { type: Number, default: 0 });
const emit = defineEmits(['bookmark-toggle', 'close', 'sort-change']);
const sortTabs = [
  { id: 'newest', label: 'Newest', role: 'tab' },
  { id: 'nearby', label: 'Nearby', role: 'tab' },
];

function selectSort({ tab, index }) {
  emit('sort-change', { sort: tab.id, index });
}
</script>

<style scoped>
.browse-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.browse-list__navigation { flex: 0 0 auto; }
</style>
