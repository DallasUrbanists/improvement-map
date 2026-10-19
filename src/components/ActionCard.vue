<template>
  <article class="action-card" :class="{ 'action-expired': expired }" :data-action-key="action.key" :aria-label="action.summary">
    <component :is="inMyActions ? 'h2' : 'h3'" class="font-semibold">{{ action.summary }}</component>
    <p v-if="hidden" class="secondary-copy">Hidden recommendation</p>
    <p v-if="action.expirationDate" class="secondary-copy">{{ expired ? 'Expired' : 'Expires' }} {{ expiration }}</p>
    <p v-if="action.instructions && !compact" class="action-preview">{{ action.instructions }}</p>
    <div class="action-card-controls">
      <button type="button" class="action-button action-primary" @click="$event.currentTarget.focus({ preventScroll: true }); detailsOpen = true">View action</button>
      <button type="button" class="action-button" :aria-pressed="inMyActions ? undefined : saved" :aria-label="inMyActions ? 'Remove' : saved ? 'Remove from My actions' : 'Add to My actions'" @click="$emit('save')">{{ inMyActions ? 'Remove' : saved ? 'Saved' : 'Save' }}</button>
      <button v-if="!inMyActions && !compact" type="button" class="action-button" @click="$emit('hide', $event)">{{ hidden ? 'Unhide' : 'Hide' }}</button>
      <slot />
    </div>
    <DetailSheet v-model="detailsOpen" title="Action details">
      <div class="actions-panel">
        <h3 class="font-semibold">{{ action.summary }}</h3>
        <p v-if="action.expirationDate" class="secondary-copy">{{ expired ? 'Expired' : 'Expires' }} {{ expiration }}</p>
        <p v-if="action.instructions" class="whitespace-pre-line">{{ action.instructions }}</p>
        <a v-if="source" :href="source" target="_blank" rel="noopener noreferrer" class="action-button action-primary">View source ↗</a>
        <p v-if="action.reason"><strong>Why:</strong> {{ action.reason }}</p>
        <p v-if="action.status">Status: {{ action.status }}</p>
      </div>
    </DetailSheet>
  </article>
</template>
<script setup>
import { computed, ref } from 'vue';
import DetailSheet from './DetailSheet.vue';
const props = defineProps({ action: { type: Object, required: true }, saved: Boolean, hidden: Boolean, inMyActions: Boolean, compact: Boolean });
defineEmits(['save', 'hide']);
const detailsOpen = ref(false);
const expired = computed(() => Date.parse(props.action.expirationDate) < Date.now());
const expiration = computed(() => new Date(props.action.expirationDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
const source = computed(() => { try { const url = new URL(props.action.sourceUrl); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } });
</script>
