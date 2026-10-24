<template>
  <div class="accordion" :data-locked="locked" :data-open="open" :data-surface-level="surfaceLevel === null ? 'transparent' : surfaceLevel" :style="accordionStyle">
    <div class="accordion__header-row">
      <SquareIconButton
        class="accordion__toggle"
        :class="{ 'accordion__toggle--locked': locked, 'accordion__toggle--open': open }"
        layout="tight"
        :theme="theme"
        :variant="header.variant || 'neutral'"
        icon="caret-right"
        :label="open ? `Collapse ${header.label}` : `Expand ${header.label}`"
        :aria-expanded="open"
        :aria-disabled="locked"
        @click="toggle"
      />
      <HeaderBar
        class="accordion__header"
        :theme="theme"
        :variant="header.variant || 'neutral'"
        :label="header.label"
        :subtitle="header.subtitle || ''"
        :buttons="header.buttons || []"
        @button-click="$emit('header-button-click', $event)"
      />
      <TextButton
        v-if="headerTextButton"
        class="accordion__text-button"
        layout="tight"
        :theme="theme"
        :variant="headerTextButton.variant || header.variant || 'neutral'"
        :icon="headerTextButton.icon || ''"
        :label="headerTextButton.label"
        :disabled="headerTextButton.disabled"
        @click.stop="$emit('header-text-button-click', headerTextButton)"
      />
    </div>
    <Transition
      name="accordion-section"
      @before-enter="beforeEnter"
      @enter="enterSection"
      @before-leave="beforeLeave"
      @leave="leaveSection"
    >
      <ContainedSection v-if="open" :theme="theme" :surface-level="surfaceLevel" :padded="padded" :content="content" />
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ContainedSection from './ContainedSection.vue';
import HeaderBar from './HeaderBar.vue';
import SquareIconButton from './SquareIconButton.vue';
import TextButton from './TextButton.vue';
import { textColors } from '../design/textColors.js';
import { buttonColors } from '../design/buttonColors.js';

/** A header and collapsible contained section, with optional independent header action. */
const props = defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  /** Surface depth, where 0 is deepest and 5 is closest to the viewer. */
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
  /** Locks the caret while leaving header actions usable. */
  locked: Boolean,
  /** Header Bar configuration: label, subtitle, variant and any number of Square Icon Buttons. */
  header: { type: Object, default: () => ({ label: 'Section' }) },
  /** Optional Text Button rendered at the right edge of the header row. */
  headerTextButton: { type: Object, default: null },
  padded: { type: Boolean, default: true },
  content: { type: String, default: '' },
});
const open = defineModel('open', { type: Boolean, default: true });
defineEmits(['header-button-click', 'header-text-button-click']);

const accordionStyle = computed(() => {
  const palette = buttonColors[props.theme]?.neutralByLevel[props.surfaceLevel ?? 1] || buttonColors.light.neutralByLevel[1];
  return {
    '--accordion-background': open.value && !props.locked && props.surfaceLevel !== null ? palette.background : 'transparent',
    '--accordion-border': palette.border,
    '--accordion-muted-caret': textColors.muted[props.theme]?.neutral[`level${props.surfaceLevel}`] || textColors.muted.light.neutral.level1,
  };
});

function beforeEnter(element) {
  element.style.height = '0px';
  element.style.overflow = 'hidden';
}

function runHeightTransition(element, height, done, finalHeight = '') {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    element.style.height = finalHeight || height;
    element.style.overflow = '';
    done();
    return;
  }
  let finished = false;
  let fallback;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    element.removeEventListener('transitionend', onEnd);
    window.clearTimeout(fallback);
    element.style.removeProperty('transition');
    element.style.removeProperty('overflow');
    done();
  };
  const onEnd = event => {
    if (event.target === element && event.propertyName === 'height') cleanup();
  };
  element.style.overflow = 'hidden';
  element.style.transition = 'height 220ms ease';
  element.addEventListener('transitionend', onEnd);
  fallback = window.setTimeout(cleanup, 260);
  requestAnimationFrame(() => { element.style.height = height; });
}

function enterSection(element, done) {
  runHeightTransition(element, `${element.scrollHeight}px`, () => {
    element.style.height = 'auto';
    done();
  });
}

function beforeLeave(element) {
  element.style.height = `${element.getBoundingClientRect().height}px`;
  element.style.overflow = 'hidden';
}

function leaveSection(element, done) {
  runHeightTransition(element, '0px', () => {
    element.style.height = '';
    done();
  });
}

function toggle() {
  if (!props.locked) open.value = !open.value;
}
</script>

<style scoped>
.accordion {
  width: 100%;
  background: var(--accordion-background);
  border-top: 1px solid var(--accordion-border);
  border-bottom: 1px solid var(--accordion-border);
  transition: background-color 180ms ease;
}
.accordion__header-row {
  display: flex;
  align-items: stretch;
  width: 100%;
}
.accordion__header { flex: 1 1 auto; min-width: 0; }
.accordion__toggle { border: 0; background: transparent; }
.accordion__toggle:hover:not(:disabled), .accordion__toggle:active:not(:disabled) { background: transparent; box-shadow: none; }
.accordion__toggle :deep(i) { transform: rotate(0deg); transition: transform 180ms ease; }
.accordion__toggle--open :deep(i) { transform: rotate(90deg); }
.accordion__header { border-bottom: 0; }
.accordion__header.header-bar { background: transparent; }
.accordion__toggle--locked :deep(i) { color: var(--accordion-muted-caret); }
.accordion__text-button { flex: 0 0 auto; }
.accordion[data-locked="true"] :deep(.contained-section) { background: transparent; }
.accordion-section-enter-active, .accordion-section-leave-active { overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  .accordion, .accordion__toggle :deep(i) { transition: none; }
}
</style>
