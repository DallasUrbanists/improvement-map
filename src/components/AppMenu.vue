<template>
  <Drawer v-model:open="open" from-direction="left" :theme="theme" :surface-level="surfaceLevel">
    <HeaderBar
      label="Idea Map"
      variant="neutral"
      :theme="theme"
      :surface-level="surfaceLevel"
      :buttons="[{ icon: 'arrow-left-edge', label: 'Close menu' }]"
      :seamless-button-edge="true"
      @button-click="open = false"
    />
    <div class="app-menu__items">
      <MenuItem v-for="item in items" :key="item.label" :theme="theme" :label="item.label" :href="item.href" symbol-type="icon" :icon="item.icon" @click.prevent="$emit('item-click', item)" />
    </div>
  </Drawer>
</template>

<script setup>
import Drawer from './Drawer.vue';
import HeaderBar from './HeaderBar.vue';
import MenuItem from './MenuItem.vue';

defineProps({
  theme: { type: String, default: 'light', validator: value => ['light', 'dark'].includes(value) },
  surfaceLevel: { type: Number, default: 1, validator: value => value === null || (Number.isInteger(value) && value >= 0 && value <= 5) },
});
const open = defineModel('open', { type: Boolean, default: true });
defineEmits(['item-click']);
const items = [
  { label: 'Saved ideas', href: '/bookmarks', icon: 'lightbulb' },
  { label: 'Saved actions', href: '/my-actions', icon: 'square-check' },
  { label: 'Welcome guide', href: '/welcome', icon: 'hand' },
  { label: "What's new", href: '/whats-new', icon: 'burst' },
  { label: 'Map settings', href: '/map-settings', icon: 'gear' },
];
</script>

<style scoped>
.app-menu__items { display: flex; flex-direction: column; }
</style>
