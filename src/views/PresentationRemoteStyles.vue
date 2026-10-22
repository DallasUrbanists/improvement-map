<template>
  <section class="remote-subpage remote-styles-subpage" aria-label="Style Settings">
    <div class="remote-settings-list">
      <div class="remote-setting-row"><label for="presentation-rail-toggle"><strong>Rail lines</strong><span class="presentation-muted">Show transit rail lines on the presentation map</span></label><input id="presentation-rail-toggle" type="checkbox" :checked="state.railVisible" @change="setRail($event.target.checked)" /></div>
      <div class="remote-setting-row"><label for="presentation-theme-toggle"><strong>Presentation theme</strong><span class="presentation-muted">Applies to the TV, remote, and audience screen</span></label><select id="presentation-theme-toggle" :value="state.theme" aria-label="Presentation theme" @change="setTheme($event.target.value)"><option value="light">Light</option><option value="dark">Dark</option></select></div>
      <div class="remote-setting-row"><label for="presentation-map-style"><strong>Map imagery</strong><span class="presentation-muted">Choose streets or satellite imagery</span></label><select id="presentation-map-style" :value="state.mapStyle" aria-label="Presentation map imagery" @change="setMapStyle($event.target.value)"><option value="streets">Streets</option><option value="satellite">Satellite</option></select></div>
      <section class="remote-icon-style" aria-labelledby="presentation-icon-style-title">
        <header class="remote-icon-style-heading">
          <h2 id="presentation-icon-style-title">Icon Style</h2>
          <p class="presentation-muted remote-icon-style-description">Changes the icons on the TV map and controller map preview.</p>
        </header>
        <div ref="iconPreviewCard" class="remote-icon-style-preview-card">
          <div ref="iconPreviewElement" class="remote-icon-style-preview" role="img" :aria-label="state.iconStyle.animationEnabled ? 'Animated current idea icon preview' : 'Current idea icon preview'" :style="iconPreviewStyle">
            <span ref="pulsePreviewElement" class="remote-icon-preview-pulse" aria-hidden="true"><span ref="bobPreviewElement" class="remote-icon-preview-bob">{{ previewEmoji }}</span></span>
          </div>
        </div>
        <div class="remote-icon-style-controls">
          <label class="remote-range-setting" for="presentation-icon-size"><span>Icon size</span><output>{{ state.iconStyle.size }}%</output><input id="presentation-icon-size" type="range" min="50" max="400" step="5" :value="state.iconStyle.size" @input="setIconStyle('size', $event.target.valueAsNumber)" /></label>
          <div class="remote-icon-animation-accordion" :class="{ 'is-expanded': isAnimationSettingsExpanded }">
            <div class="remote-icon-animation-toggle">
              <button type="button" class="remote-icon-animation-expander" :disabled="!state.iconStyle.animationEnabled" :aria-label="isAnimationSettingsExpanded ? 'Collapse animation settings' : 'Expand animation settings'" aria-controls="presentation-icon-animation-settings" :aria-expanded="isAnimationSettingsExpanded" @click="toggleAnimationSettings"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
              <label for="presentation-icon-animation"><strong>Icon animation</strong></label>
              <input id="presentation-icon-animation" type="checkbox" :checked="state.iconStyle.animationEnabled" @change="setAnimationEnabled($event.target.checked)" />
            </div>
            <Transition name="remote-icon-animation">
              <div v-show="isAnimationSettingsExpanded" id="presentation-icon-animation-settings" class="remote-icon-animation-controls" role="group" aria-label="Icon animation settings">
                <label class="remote-range-setting" for="presentation-pulse-size"><span>Pulse size</span><output>×{{ Number(state.iconStyle.pulseSize).toFixed(2) }}</output><input id="presentation-pulse-size" type="range" min="1" max="3" step="0.05" :value="state.iconStyle.pulseSize" @input="setIconStyle('pulseSize', $event.target.valueAsNumber)" /></label>
                <label class="remote-range-setting" for="presentation-pulse-speed"><span>Pulse speed</span><output>×{{ Number(state.iconStyle.pulseSpeed).toFixed(1) }}</output><input id="presentation-pulse-speed" type="range" min="0.5" max="3" step="0.1" :value="state.iconStyle.pulseSpeed" @input="setIconStyle('pulseSpeed', $event.target.valueAsNumber)" /></label>
                <label class="remote-range-setting" for="presentation-bobbing-rotation"><span>Bobbing rotation</span><output>{{ state.iconStyle.bobbingRotation }}°</output><input id="presentation-bobbing-rotation" type="range" min="0" max="90" step="1" :value="state.iconStyle.bobbingRotation" @input="setIconStyle('bobbingRotation', $event.target.valueAsNumber)" /></label>
                <label class="remote-range-setting" for="presentation-bobbing-speed"><span>Bobbing speed</span><output>×{{ Number(state.iconStyle.bobbingSpeed).toFixed(1) }}</output><input id="presentation-bobbing-speed" type="range" min="0.5" max="3" step="0.1" :value="state.iconStyle.bobbingSpeed" @input="setIconStyle('bobbingSpeed', $event.target.valueAsNumber)" /></label>
                <label class="remote-range-setting remote-animation-easing-setting" for="presentation-animation-easing"><span>Animation easing</span><select id="presentation-animation-easing" :value="state.iconStyle.animationEasing || 'ease-in-out'" @change="setIconStyle('animationEasing', $event.target.value)"><option v-for="easing in animationEasingOptions" :key="easing.value" :value="easing.value">{{ easing.label }}</option></select></label>
              </div>
            </Transition>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { enqueuePresentationChanges, presentationSession as session, writableViewState } from '../services/presentationSession.js';
import { submissionEmoji } from '../services/emojiMapMarker.js';
const state = writableViewState;
const previewEmoji = computed(() => submissionEmoji(session.content?.emoji));
const animationSettingsExpanded = ref(true);
const isAnimationSettingsExpanded = computed(() => state.value.iconStyle.animationEnabled && animationSettingsExpanded.value);
const iconPreviewCard = ref(null);
const iconPreviewElement = ref(null);
const pulsePreviewElement = ref(null);
const bobPreviewElement = ref(null);
const previewCardWidth = ref(0);
const iconPreviewStyle = computed(() => {
  const iconStyle = state.value.iconStyle;
  const size = 80 * iconStyle.size / 100;
  const fitScale = previewCardWidth.value > 0 ? Math.min(1, Math.max(0, (previewCardWidth.value - 16) / size)) : 1;
  return {
    width: `${size * fitScale}px`,
    height: `${size * fitScale}px`,
    fontSize: `${38 * iconStyle.size / 100 * fitScale}px`,
  };
});
let entranceAnimation = null;
let pulseAnimation = null;
let bobAnimation = null;
let previewResizeObserver = null;
const animationEasingOptions = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease', label: 'Ease' },
  { value: 'ease-in', label: 'Ease in' },
  { value: 'ease-out', label: 'Ease out' },
  { value: 'ease-in-out', label: 'Ease in and out' },
];

function updatePreviewAnimations() {
  const iconStyle = state.value.iconStyle;
  if (!pulseAnimation || !bobAnimation) return;
  const animate = iconStyle.animationEnabled;
  const pulseScale = animate ? iconStyle.pulseSize : 1;
  const bobAngle = animate ? iconStyle.bobbingRotation : 0;
  pulseAnimation.effect.setKeyframes([
    { transform: 'scale(1)', offset: 0 },
    { transform: `scale(${pulseScale})`, offset: .5 },
    { transform: 'scale(1)', offset: 1 },
  ]);
  pulseAnimation.effect.updateTiming({ duration: 1500 / (animate ? iconStyle.pulseSpeed : 1), easing: iconStyle.animationEasing || 'ease-in-out' });
  bobAnimation.effect.setKeyframes([
    { transform: 'rotate(0deg)', offset: 0 },
    { transform: `rotate(-${bobAngle}deg)`, offset: .25 },
    { transform: 'rotate(0deg)', offset: .5 },
    { transform: `rotate(${bobAngle}deg)`, offset: .75 },
    { transform: 'rotate(0deg)', offset: 1 },
  ]);
  bobAnimation.effect.updateTiming({ duration: 1500 / (animate ? iconStyle.bobbingSpeed : 1), easing: iconStyle.animationEasing || 'ease-in-out' });
}

onMounted(() => {
  previewResizeObserver = new ResizeObserver(([entry]) => { previewCardWidth.value = entry?.contentRect.width || 0; });
  if (iconPreviewCard.value) previewResizeObserver.observe(iconPreviewCard.value);
  entranceAnimation = iconPreviewElement.value?.animate([
    { transform: 'scale(.06)' },
    { transform: 'scale(1.55)', offset: .55 },
    { transform: 'scale(.78)', offset: .78 },
    { transform: 'scale(1.12)', offset: .9 },
    { transform: 'scale(1)' },
  ], { duration: 450, easing: 'ease-out', fill: 'both' }) || null;
  pulseAnimation = pulsePreviewElement.value?.animate([
    { transform: 'scale(1)', offset: 0 },
    { transform: `scale(${state.value.iconStyle.pulseSize})`, offset: .5 },
    { transform: 'scale(1)', offset: 1 },
  ], { duration: 1500 / state.value.iconStyle.pulseSpeed, easing: state.value.iconStyle.animationEasing || 'ease-in-out', iterations: Infinity, delay: 450 }) || null;
  bobAnimation = bobPreviewElement.value?.animate([
    { transform: 'rotate(0deg)', offset: 0 },
    { transform: `rotate(-${state.value.iconStyle.bobbingRotation}deg)`, offset: .25 },
    { transform: 'rotate(0deg)', offset: .5 },
    { transform: `rotate(${state.value.iconStyle.bobbingRotation}deg)`, offset: .75 },
    { transform: 'rotate(0deg)', offset: 1 },
  ], { duration: 1500 / state.value.iconStyle.bobbingSpeed, easing: state.value.iconStyle.animationEasing || 'ease-in-out', iterations: Infinity, delay: 450 }) || null;
  updatePreviewAnimations();
});

watch(() => state.value.iconStyle, updatePreviewAnimations, { deep: true, flush: 'post' });
onBeforeUnmount(() => {
  previewResizeObserver?.disconnect();
  entranceAnimation?.cancel();
  pulseAnimation?.cancel();
  bobAnimation?.cancel();
});
function setRail(value) { enqueuePresentationChanges({ railVisible: Boolean(value) }, { immediate: true }); }
function setTheme(value) { if (['light', 'dark'].includes(value)) enqueuePresentationChanges({ theme: value }, { immediate: true }); }
function setMapStyle(value) { if (['streets', 'satellite'].includes(value)) enqueuePresentationChanges({ mapStyle: value }, { immediate: true }); }
function setIconStyle(field, value) { enqueuePresentationChanges({ iconStyle: { ...state.value.iconStyle, [field]: value } }); }
function setAnimationEnabled(value) {
  const enabled = Boolean(value);
  animationSettingsExpanded.value = enabled;
  setIconStyle('animationEnabled', enabled);
}
function toggleAnimationSettings() {
  if (state.value.iconStyle.animationEnabled) animationSettingsExpanded.value = !animationSettingsExpanded.value;
}
</script>
