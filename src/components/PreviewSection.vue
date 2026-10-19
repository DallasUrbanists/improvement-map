<template>
  <details class="detail-accordion" @toggle="$emit('toggle', $event)">
    <summary>{{ title }}<span v-if="count != null" class="section-count">{{ count }}</span></summary>
    <div class="actions-panel">
      <div :aria-hidden="full || undefined" :inert="full"><slot :full="false" /></div>
      <button v-if="available" type="button" class="action-button" @click="$event.currentTarget.focus({ preventScroll: true }); full = true">{{ button }}</button>
    </div>
  </details>
  <DetailSheet v-model="full" :title="title"><div class="actions-panel"><slot :full="true" /></div></DetailSheet>
</template>
<script setup>
import { ref } from 'vue';
import DetailSheet from './DetailSheet.vue';
defineProps({ title: String, button: String, count: Number, available: Boolean });
defineEmits(['toggle']);
const full = ref(false);
</script>
