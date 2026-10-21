<template>
  <section class="remote-subpage" aria-label="Style Settings">
    <header class="remote-subpage-header"><button type="button" class="presentation-button" aria-label="Back to controller" @click="back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button><h1>Style Settings</h1></header>
    <div class="remote-settings-list">
      <div class="presentation-card remote-setting-row"><label for="presentation-rail-toggle"><strong>Rail lines</strong><span class="presentation-muted">Show transit rail lines on the presentation map</span></label><input id="presentation-rail-toggle" type="checkbox" :checked="state.railVisible" @change="setRail($event.target.checked)" /></div>
      <div class="presentation-card remote-setting-row"><label for="presentation-theme-toggle"><strong>Presentation theme</strong><span class="presentation-muted">Applies to the TV, remote, and audience screen</span></label><select id="presentation-theme-toggle" :value="state.theme" aria-label="Presentation theme" @change="setTheme($event.target.value)"><option value="light">Light</option><option value="dark">Dark</option></select></div>
      <div class="presentation-card remote-setting-row"><label for="presentation-map-style"><strong>Map imagery</strong><span class="presentation-muted">Choose streets or satellite imagery</span></label><select id="presentation-map-style" :value="state.mapStyle" aria-label="Presentation map imagery" @change="setMapStyle($event.target.value)"><option value="streets">Streets</option><option value="satellite">Satellite</option></select></div>
    </div>
  </section>
</template>
<script setup>
import { useRouter } from 'vue-router';
import { enqueuePresentationChanges, presentationSession as session, writableViewState } from '../services/presentationSession.js';
const router = useRouter();
const state = writableViewState;
function back() { router.push({ name: 'RemoteController' }); }
function setRail(value) { enqueuePresentationChanges({ railVisible: Boolean(value) }, { immediate: true }); }
function setTheme(value) { if (['light', 'dark'].includes(value)) enqueuePresentationChanges({ theme: value }, { immediate: true }); }
function setMapStyle(value) { if (['streets', 'satellite'].includes(value)) enqueuePresentationChanges({ mapStyle: value }, { immediate: true }); }
</script>
