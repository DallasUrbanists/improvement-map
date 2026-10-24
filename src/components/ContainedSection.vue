<template>
  <div class="contained-section" :class="{ 'contained-section--padded': padded }" :data-theme="theme" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :style="sectionStyle" v-html="content"></div>
</template>

<script setup>
import { computed } from 'vue';
import { buttonColors } from '../design/buttonColors.js';

/** Full-width content section for use inside a larger container. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Surface depth, where 0 is deepest and 5 is closest to the viewer. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Adds interior spacing to the section content. */
  padded: { type: Boolean, default: true },
  /** HTML owned by the containing application or story. */
  content: { type: String, default: '' },
});

const sectionStyle = computed(() => {
  const surface = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 1] || buttonColors.light.neutralByLevel[1];
  return {
    '--contained-section-background': props.surfaceLevel === null ? 'transparent' : surface.background,
    '--contained-section-border': surface.border,
  };
});
</script>

<style scoped>
.contained-section {
  box-sizing: border-box;
  width: 100%;
  background: var(--contained-section-background);
  color: inherit;
}
.contained-section--padded { padding: 12px; }
.contained-section:not(:last-child) { border-bottom: 1px solid var(--contained-section-border); }
.contained-section :deep(p:first-child) { margin-top: 0; }
.contained-section :deep(p:last-child) { margin-bottom: 0; }
</style>
