<template>
  <article class="action-card" :data-action-key="action.key" :aria-label="action.summary">
    <component :is="inMyActions ? 'h2' : 'h3'" class="font-semibold">{{ action.summary }}</component>
    <p v-if="hidden" class="text-sm">Hidden recommendation</p>
    <p v-if="action.expirationDate" class="text-sm">{{ expired ? 'Expired' : 'Expires' }} {{ expiration }}</p>
    <details>
      <summary class="action-details-summary">Details</summary>
      <div class="space-y-2 pb-2 text-sm">
        <p v-if="action.instructions" class="whitespace-pre-line">{{ action.instructions }}</p>
        <p v-if="action.reason"><strong>Why:</strong> {{ action.reason }}</p>
        <p v-if="action.status">Status: {{ action.status }}</p>
        <a v-if="source" :href="source" target="_blank" rel="noopener noreferrer" class="action-button underline">View source</a>
      </div>
    </details>
    <div class="action-card-controls">
      <button type="button" class="action-button" @click="$emit('save')">{{ saved ? (inMyActions ? 'Remove' : 'Remove from My actions') : 'Add to My actions' }}</button>
      <button v-if="!inMyActions" type="button" class="action-button" @click="$emit('hide', $event)">{{ hidden ? 'Unhide' : 'Hide' }}</button>
      <slot />
    </div>
  </article>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({ action: { type: Object, required: true }, saved: Boolean, hidden: Boolean, inMyActions: Boolean });
defineEmits(['save', 'hide']);
const expired = computed(() => Date.parse(props.action.expirationDate) < Date.now());
const expiration = computed(() => new Date(props.action.expirationDate).toLocaleDateString());
const source = computed(() => { try { const url = new URL(props.action.sourceUrl); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } });
</script>
