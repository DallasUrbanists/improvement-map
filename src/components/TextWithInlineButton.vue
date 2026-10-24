<template>
  <div class="text-with-inline-button" :data-layout="layout">
    <TextInput
      :theme="theme"
      :placeholder="placeholder"
      :icon="icon"
      :layout="layout"
      :model-value="modelValue"
      :readonly="readonly"
      @update:model-value="$emit('update:modelValue', $event)"
      @focus="$emit('focus', $event)"
    />
    <SquareIconButton
      v-if="buttonIcon && !buttonText"
      :theme="theme"
      :variant="variant"
      :icon="buttonIcon"
      :label="buttonLabel || buttonIcon"
      :layout="layout"
    />
    <TextButton
      v-else-if="buttonText"
      :theme="theme"
      :variant="variant"
      :icon="buttonIcon"
      :label="buttonText"
      :layout="layout"
    />
  </div>
</template>

<script setup>
import TextInput from './TextInput.vue';
import SquareIconButton from './SquareIconButton.vue';
import TextButton from './TextButton.vue';

/** A full-width input joined directly to either an icon-only or labeled action. */
defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'neutral', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  placeholder: { type: String, default: '' },
  /** Current value passed to the joined text input. */
  modelValue: { type: String, default: undefined },
  /** Prevents editing while retaining the current value. */
  readonly: { type: Boolean, default: false },
  /** Optional decorative icon displayed inside the input. */
  icon: { type: String, default: '' },
  /** Optional icon for the action; alone it selects Square Icon Button, with text it leads Text Button. */
  buttonIcon: { type: String, default: '' },
  /** Visible action text; when set, selects Text Button. */
  buttonText: { type: String, default: '' },
  /** Accessible name override for the icon-only action. */
  buttonLabel: { type: String, default: '' },
  /** Floating retains the outer 4px margin and button treatment; tight removes them. */
  layout: { type: String, default: 'floating', validator: value => ['floating', 'tight'].includes(value) },
});
defineEmits(['update:modelValue', 'focus']);
</script>

<style scoped>
.text-with-inline-button {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: calc(100% - 8px);
  margin: 4px;
  border-radius: 8px;
  box-shadow: 0 3px 12px #00000040;
}
.text-with-inline-button[data-layout="tight"] {
  width: 100%;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}
.text-with-inline-button :deep(.text-input) {
  width: auto;
  min-width: 0;
  flex: 1 1 auto;
  margin: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  box-shadow: none !important;
}
.text-with-inline-button :deep(.square-icon-button),
.text-with-inline-button :deep(.text-button) {
  flex-shrink: 0;
  margin: 0;
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  box-shadow: none !important;
}
.text-with-inline-button :deep(.text-input:active),
.text-with-inline-button :deep(.square-icon-button:active),
.text-with-inline-button :deep(.text-button:active) {
  box-shadow: none !important;
}
</style>
