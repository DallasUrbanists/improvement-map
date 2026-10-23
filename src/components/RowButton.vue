<template>
  <TextButton
    class="row-button"
    :theme="theme"
    :variant="variant"
    :layout="'tight'"
    :icon="icon"
    :disabled="disabled"
    :label="label"
    @click="$emit('click', $event)"
  />
</template>

<script setup>
import TextButton from './TextButton.vue';

/** Full-width, left-aligned row action based on the Text Button Tight treatment. */
defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  /** Font Awesome solid icon name; an empty string omits the leading icon. */
  icon: { type: String, default: '' },
  disabled: Boolean,
  /** Visible button label, accessible name and native hover tooltip. */
  label: { type: String, required: true },
});

defineEmits(['click']);
</script>

<style scoped>
.row-button {
  box-sizing: border-box;
  width: 100%;
  flex: 0 0 100%;
  border: 0;
  border-bottom: 1px solid var(--text-button-border);
  justify-content: flex-start;
}

.row-button :deep(i) {
  box-sizing: border-box;
  width: 24px;
  flex: 0 0 24px;
  text-align: center;
}

.row-button :deep(.text-button__label) {
  flex: 1 1 auto;
  text-align: left;
}
</style>
