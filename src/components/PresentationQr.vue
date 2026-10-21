<template>
  <div class="presentation-qr" role="img" :aria-label="`QR code for ${label}`" v-html="svg"></div>
</template>
<script setup>
import { computed } from 'vue';
import { presentationQrSvg } from '../services/presentationQr.js';
const props = defineProps({ value: { type: String, required: true }, label: { type: String, default: 'presentation link' } });
const svg = computed(() => {
  try { return presentationQrSvg(props.value); }
  catch { return ''; }
});
</script>
<style scoped>
.presentation-qr { display: grid; place-items: center; width: min(34vw, 12rem); min-width: 8rem; aspect-ratio: 1; padding: .5rem; border-radius: .75rem; background: white; }
.presentation-qr :deep(svg) { width: 100%; height: 100%; }
</style>
