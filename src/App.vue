<template>
  <k-app
    theme="material"
    :dark="presentationRoute ? (presentationSession.state.theme === 'dark') : isDark"
    :material-touch-ripple="false"
    class="h-dvh !min-h-0 flex flex-col font-sans overflow-hidden"
  >
    <main class="flex-grow flex flex-col min-h-0 relative overflow-hidden">
      <MapWorkspace v-if="route.name && route.name !== 'TestDiagram' && !presentationRoute" />
      <router-view v-else />
    </main>
    <AnnouncementDialog v-if="!presentationRoute" :is-submitting="isSubmitting" />
  </k-app>
</template>

<script setup>
import { ref, provide, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { kApp } from 'konsta/vue';
import MapWorkspace from './components/MapWorkspace.vue';
import AnnouncementDialog from './components/AnnouncementDialog.vue';
import { isDark, initTheme } from './services/theme';
import { presentationSession } from './services/presentationSession.js';

const route = useRoute();
const presentationRoute = computed(() => route.meta?.shell === 'presentation');
const isSubmitting = ref(false);
provide('isSubmitting', isSubmitting);
provide('setSubmitting', (val) => {
  isSubmitting.value = val;
});

onMounted(() => {
  initTheme();
});
</script>

<style>
.view-panel {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
