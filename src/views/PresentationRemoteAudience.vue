<template>
  <section class="remote-subpage" aria-label="Audience controls">
    <header class="remote-subpage-header"><button type="button" class="presentation-button" aria-label="Back to controller" @click="back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button><h1>Audience</h1></header>
    <div class="remote-audience-page">
      <p class="presentation-muted">{{ connectedParticipants.length }} {{ connectedParticipants.length === 1 ? 'person is' : 'people are' }} viewing</p>
      <ul class="remote-audience-roster" aria-label="Connected audience members">
        <li v-for="person in connectedParticipants" :key="person.id" class="presentation-card remote-audience-person">
          <span>{{ person.displayName }}</span><span v-if="person.localView" class="presentation-muted">Viewing {{ localViewName(person.localView) }}</span>
        </li>
        <li v-if="connectedParticipants.length === 0" class="presentation-card remote-audience-person presentation-muted">No audience members are connected.</li>
      </ul>
      <section class="presentation-card remote-audience-access" aria-label="Audience joining information">
        <h2>Audience access</h2>
        <p class="presentation-muted">Share the audience link or code. Presenter pairing uses a separate code.</p>
        <div class="remote-audience-code">{{ formatPresentationCode(session.credential?.audienceCode) || 'Unavailable' }}</div>
        <a v-if="audienceLink" class="presentation-link" :href="audienceLink">{{ audienceLink }}</a>
        <button type="button" class="presentation-button" :disabled="!audienceLink" @click="copyLink">{{ copied ? 'Link copied' : 'Copy audience link' }}</button>
        <label><input type="checkbox" :checked="state.audienceDisplay.showQr" @change="updateDisplay('showQr', $event.target.checked)" /> Show audience QR on TV</label>
        <label><input type="checkbox" :checked="state.audienceDisplay.showCode" @change="updateDisplay('showCode', $event.target.checked)" /> Show viewing code on TV</label>
        <p v-if="message" role="status" class="presentation-muted">{{ message }}</p>
      </section>
    </div>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { formatPresentationCode } from '../services/presentationState.js';
import { presentationLink } from '../services/presentationLinks.js';
import { enqueuePresentationChanges, presentationSession as session, writableViewState } from '../services/presentationSession.js';
const router = useRouter();
const state = writableViewState;
const copied = ref(false);
const message = ref('');
const connectedParticipants = computed(() => session.participants.filter(person => person.connected));
const audienceLink = computed(() => session.credential?.audienceCode ? presentationLink('audience', 'view', session.credential.audienceCode) : '');
function back() { router.push({ name: 'RemoteController' }); }
function localViewName(value) { return ({ map: 'map', photo: 'photos', description: 'description' })[value] || 'presentation'; }
function updateDisplay(field, value) {
  enqueuePresentationChanges({ audienceDisplay: { ...state.value.audienceDisplay, [field]: Boolean(value) } }, { immediate: true });
}
async function copyLink() {
  if (!audienceLink.value) return;
  try { await navigator.clipboard.writeText(audienceLink.value); copied.value = true; message.value = 'Audience link copied to this device.'; setTimeout(() => { copied.value = false; }, 2200); }
  catch { message.value = 'Copy is unavailable in this browser. Select the audience link above to copy it.'; }
}
</script>
