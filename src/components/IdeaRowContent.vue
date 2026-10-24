<template>
  <li class="idea-row" :data-theme="theme" :data-variant="variant" :style="colors">
    <router-link :to="'/suggestion/' + encodeURIComponent(id)" class="idea-row-link" :data-suggestion-id="id" @click="$event.currentTarget.focus({ preventScroll: true })">
      <span class="idea-thumbnail">
        <img v-if="photo && !failed" :src="photo" alt="" loading="lazy" @error="failed = true" />
        <span v-else-if="hasEmoji" class="idea-thumbnail-fallback" aria-hidden="true">{{ emoji }}</span>
        <i v-else class="fa-solid fa-camera" aria-hidden="true"></i>
        <span v-if="photo && !failed && hasEmoji" class="idea-emoji" aria-hidden="true">{{ emoji }}</span>
      </span>
      <span class="idea-row-copy">
        <span :id="summaryId" class="idea-summary">{{ summary || 'Public improvement' }}</span>
        <span class="idea-metadata idea-address">{{ addressText || 'Location unavailable' }}</span>
        <span class="idea-metadata">{{ dateText }}<template v-if="distanceText"> · {{ distanceText }} away</template></span>
      </span>
    </router-link>
    <slot name="bookmark" :summary-id="summaryId" />
  </li>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, useId } from 'vue';
import { buttonColors } from '../design/buttonColors.js';
import { surfaceColors } from '../design/surfaceColors.js';
/** Full-width BARS row rendered inside a ul with Vue Router. Supply bookmark content through the scoped slot. No storage or workspace dependency. */
const props = defineProps({
  id: { type: [String, Number], required: true },
  summary: { type: String, default: '' },
  photo: { type: String, default: '' },
  emoji: { type: String, default: '' },
  addressText: String,
  dateText: String,
  distanceText: { type: String, default: '' },
  theme: { type: String, default: undefined, validator: value => value === undefined || ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
});
const hasEmoji = computed(() => props.emoji.trim().length > 0);
const documentTheme = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');
let themeObserver;
onMounted(() => {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  themeObserver = new MutationObserver(() => {
    documentTheme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});
onBeforeUnmount(() => themeObserver?.disconnect());
const activeTheme = computed(() => props.theme || documentTheme.value);
const colors = computed(() => {
  const palette = buttonColors[activeTheme.value]?.[props.variant] || buttonColors.light.neutral;
  return {
    '--idea-row-background': palette.background,
    '--idea-row-foreground': palette.foreground,
    '--idea-row-border': palette.border,
    '--idea-row-hover': palette.hover,
    '--idea-row-focus': palette.focus,
    '--idea-thumbnail-background': surfaceColors[activeTheme.value]?.neutral.level2 || surfaceColors.light.neutral.level2,
    '--idea-emoji-background': surfaceColors[activeTheme.value]?.neutral.level1 || surfaceColors.light.neutral.level1,
  };
});
const summaryId = 'idea-summary-' + useId();
const failed = ref(false);
watch(() => props.photo, () => { failed.value = false; });
</script>

<style scoped>
.idea-row {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--idea-row-border);
  background-color: var(--idea-row-background);
  color: var(--idea-row-foreground);
}
.idea-row-link {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}
.idea-row-link:hover { background-color: var(--idea-row-hover); }
.idea-row-link:focus-visible { outline: 2px solid var(--idea-row-focus); outline-offset: -2px; }
.idea-thumbnail {
  position: relative;
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  background: var(--idea-thumbnail-background);
}
.idea-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.idea-thumbnail-fallback { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 40px; line-height: 1; }
.idea-emoji {
  position: absolute;
  right: 2px;
  bottom: 2px;
  padding: 0 2px;
  background: var(--idea-emoji-background);
  font-size: 18px;
  line-height: 24px;
}
.idea-row-copy { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; gap: 2px; }
.idea-summary {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
}
.idea-metadata { min-width: 0; font-size: 12px; line-height: 16px; }
.idea-address { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style>
