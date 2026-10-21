<template>
  <div class="remote-description-preview" aria-live="polite">
    <h2>{{ title }}</h2>
    <p>{{ text }}</p>
  </div>
</template>
<script setup>
defineProps({ title: { type: String, default: '' }, text: { type: String, default: '' } });
</script>
