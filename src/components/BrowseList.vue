<template>
  <Transition name="browse-list">
    <FloatingModal class="browse-list-modal" v-model:open="open" label="Browse ideas" :theme="theme" :surface-level="surfaceLevel" :seamless-button-edge="true" @close="$emit('close')" @scroll="$emit('scroll', $event)">
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
        <slot name="status" />
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
            @click="onIdeaRowClick($event, item)"
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
        <slot v-if="!items.length" name="empty">
          <div class="browse-list__empty" role="status">No ideas to show.</div>
        </slot>
      </template>
    </TabNavigation>
    </FloatingModal>
  </Transition>
</template>

<script setup>
import BookmarkToggle from './BookmarkToggle.vue';
import FloatingModal from './FloatingModal.vue';
import IdeaRowContent from './IdeaRowContent.vue';
import TabNavigation from './TabNavigation.vue';

/** Presentational browse list in a modal with parent-controlled sorting and bookmark state. Row navigation emits idea-click. */
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
const emit = defineEmits(['bookmark-toggle', 'close', 'idea-click', 'scroll', 'sort-change']);
const sortTabs = [
  { id: 'newest', label: 'Newest', role: 'tab' },
  { id: 'nearby', label: 'Nearby', role: 'tab' },
];

function selectSort({ tab, index }) {
  emit('sort-change', { sort: tab.id, index });
}

function onIdeaRowClick(event, item) {
  if (event.target.closest?.('.idea-row-link')) emit('idea-click', { item });
}
</script>

<style scoped>
.browse-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.browse-list__navigation { flex: 0 0 auto; }
.browse-list__empty { padding: 16px; }
.browse-list-enter-active,
.browse-list-leave-active {
  transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out;
}
.browse-list-enter-from,
.browse-list-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .browse-list-enter-active,
  .browse-list-leave-active { transition: none; }
}
</style>
