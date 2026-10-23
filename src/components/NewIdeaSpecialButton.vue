<template>
  <div class="new-idea-special-button" :inert="inert">
    <BigCircleButton
      v-if="state !== 'pin'"
      ref="mainButton"
      class="new-idea-fab"
      :class="{ 'is-morphing': morphing, 'is-morph-circle': morphPhase === 'reverse-expand' }"
      :style="reverseTravelOffset ? { translate: reverseTravelOffset } : undefined"
      :theme="theme"
      :variant="state === 'new' ? variant : 'neutral'"
      :icon="state === 'new' ? 'plus' : 'xmark'"
      :label="state === 'new' ? 'New' : 'Close'"
      @click="state === 'new' ? emit('new') : emit('close')"
    />
    <TextButton
      v-else
      ref="mainButton"
      class="new-idea-fab is-primary is-pin-continue"
      :class="{ 'is-morphing': morphing, 'is-morph-prep': morphPhase === 'travel' && morphing, 'is-morph-circle': morphPhase === 'reverse-expand' }"
      :style="{ top: pinTop }"
      :theme="theme"
      :variant="variant"
      layout="floating"
      label="Set pin and continue"
      :disabled="!pinReady"
      data-testid="pin-and-continue"
      @click="emit('set-pin')"
    />
    <TextButton
      v-if="state === 'pin'"
      class="cancel-pin-button"
      :style="{ top: `calc(${pinTop} + 60px)` }"
      :theme="theme"
      variant="neutral"
      layout="floating"
      label="Cancel pin"
      @click="emit('cancel-pin')"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import BigCircleButton from './BigCircleButton.vue';
import TextButton from './TextButton.vue';

/** New idea map action, including the temporary pin-confirmation and cancel actions. */
defineProps({
  state: { type: String, default: 'new', validator: value => ['new', 'pin', 'close'].includes(value) },
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  variant: { type: String, default: 'primary', validator: value => ['neutral', 'primary', 'secondary'].includes(value) },
  pinTop: { type: String, default: '50%' },
  pinReady: { type: Boolean, default: true },
  inert: Boolean,
  morphing: Boolean,
  morphPhase: { type: String, default: 'idle' },
  reverseTravelOffset: { type: String, default: '' },
});

const mainButton = ref(null);
function getMainButtonElement() { return mainButton.value?.$el || null; }
defineExpose({ getMainButtonElement });
const emit = defineEmits(['new', 'set-pin', 'cancel-pin', 'close']);
</script>
