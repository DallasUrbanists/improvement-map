<template>
  <div class="sb-stack">
    <h1 class="text-xl font-bold">Current UI foundations · Draft</h1>
    <p>These swatches read production CSS variables. Use the theme toolbar to inspect both modes.</p>
    <div class="sb-tokens"><div v-for="token in tokens" :key="token"><span class="sb-swatch" :style="{ background: `var(${token})` }"></span><code>{{ token }}</code></div></div>
    <h2 class="font-bold">Typography and controls</h2>
    <p>Body: the app's Tailwind sans stack. Map controls: Roboto. Editable text: Courier New.</p>
    <label for="foundation-input">Editable text example</label><input id="foundation-input" value="Describe an improvement" class="p-3 rounded-lg" />
    <MapControlButton>Shared map action</MapControlButton>
    <p>Trays retain the production 12px sides and 72px top clearance. Dialogs retain their native modal and focus behavior. Component stories document local sizing; context controls final layout.</p>
    <p>Touch targets, focus visibility, readable text, reduced motion, and both themes must be reviewed. Existing inconsistencies remain Draft rather than becoming new rules.</p>
    <small>Build {{ commit }} · <a href="../">Return to the app</a></small>
  </div>
</template>
<script setup>
import MapControlButton from '../../src/components/MapControlButton.vue';
const tokens = ['--map-control-bg', '--map-control-text', '--map-control-border', '--map-control-hover', '--map-control-active', '--text-input-bg'];
const commit = __STORYBOOK_COMMIT__;
</script>
