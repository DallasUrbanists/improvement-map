<template>
  <div v-bind="$attrs" class="map-ui map-toolbar" :data-menu-open="menuOpen" role="group" aria-label="Map view options">
    <button v-if="showMapControls" type="button" class="map-ui-button map-icon-button map-location-button" data-testid="center-on-location-control"
      title="Center on my location" aria-label="Center on my location" :aria-busy="locating" :disabled="recenterDisabled" @click="$emit('center')">
      <i class="fa-solid fa-crosshairs" :class="{ 'animate-spin': locating }" aria-hidden="true"></i>
    </button>
    <span v-if="showMapControls" class="map-toolbar-divider" aria-hidden="true"></span>
    <button v-if="showMapControls" type="button" class="map-ui-button" :aria-pressed="modelValue !== 'list'"
      :aria-label="modelValue === 'list' ? `Show ${modeLabel} map` : `Switch to ${nextModeLabel} view`"
      :title="modelValue === 'list' ? `Show ${modeLabel} map` : `Switch to ${nextModeLabel} view`"
      @click="$emit('update:modelValue', modelValue === 'list' ? mapMode : nextMode)">
      <i :class="['fa-solid', mapMode === 'satellite' ? 'fa-earth-americas' : 'fa-road']" aria-hidden="true"></i>
      <span>{{ modeLabel }}</span>
    </button>
    <button type="button" class="map-ui-button" aria-label="Browse" :aria-pressed="isBrowse && modelValue === 'list'"
      @click="browseList">
      <i class="fa-solid fa-list-ul" aria-hidden="true"></i>
      <span>Browse</span>
    </button>
    <button type="button" class="map-ui-button" :aria-label="route.path === '/submit' ? 'Close' : 'Submit'" :aria-pressed="route.path === '/submit'" @click="exitSubmit ? $emit('exit-submit') : router.push('/submit')">
      <i class="fa-solid fa-plus transition-transform duration-200" :class="{ 'rotate-45': route.path === '/submit' }" aria-hidden="true"></i>
      <span>{{ route.path === '/submit' ? 'Close' : 'Submit' }}</span>
    </button>
    <button :id="menuId" type="button" class="map-ui-button map-icon-button" aria-label="Menu" title="Menu" aria-haspopup="menu" :aria-expanded="menuOpen"
      @click="menuOpen = !menuOpen">
      <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
    </button>
  </div>
  <k-popover :opened="menuOpen" :target="`#${menuId}`" :angle="false" @backdropclick="menuOpen = false" class="map-ui map-menu-popover min-w-48">
    <div class="p-1" role="menu" aria-label="Theme options">
      <button v-for="option in themeOptions" :key="option.value" type="button" role="menuitemradio"
        :aria-checked="(isDark ? 'dark' : 'light') === option.value" class="map-ui-button w-full justify-between"
        @click="selectTheme(option.value)">
        {{ option.label }}
        <i v-if="(isDark ? 'dark' : 'light') === option.value" class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
    </div>
  </k-popover>
</template>

<script setup>
import { computed, ref, useId, watch, onDeactivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { kPopover } from 'konsta/vue';
import { applyTheme, isDark } from '../services/theme';
defineOptions({ inheritAttrs: false });
const props = defineProps({
  modelValue: { type: String, default: 'streets' },
  showMapControls: { type: Boolean, default: true },
  locating: { type: Boolean, default: false },
  mapType: { type: String, default: 'roadmap' },
  recenterDisabled: { type: Boolean, default: false },
  exitSubmit: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'center', 'exit-submit']);
const route = useRoute();
const router = useRouter();
const isBrowse = computed(() => route.path === '/' || route.path === '/browse');
const menuId = `map-menu-${useId()}`;
const menuOpen = ref(false);
const themeOptions = [
  { value: 'light', label: 'Light theme' },
  { value: 'dark', label: 'Dark theme' },
];
function browseList() {
  if (props.showMapControls) emit('update:modelValue', 'list');
  else router.push({ path: '/', query: { view: 'list' } });
}
function selectTheme(theme) {
  applyTheme(theme);
  menuOpen.value = false;
}
watch(() => route.fullPath, () => { menuOpen.value = false; });
onDeactivated(() => { menuOpen.value = false; });
const mapMode = computed(() => props.modelValue === 'list'
  ? (props.mapType === 'hybrid' ? 'satellite' : 'streets') : props.modelValue);
const modeLabel = computed(() => mapMode.value === 'satellite' ? 'Satellite' : 'Streets');
const nextMode = computed(() => mapMode.value === 'satellite' ? 'streets' : 'satellite');
const nextModeLabel = computed(() => nextMode.value === 'satellite' ? 'Satellite' : 'Streets');
</script>
