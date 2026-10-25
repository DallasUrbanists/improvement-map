<template>
  <Drawer v-model:open="open" from-direction="left" :theme="theme" :surface-level="surfaceLevel">
    <HeaderBar
      label="Idea Map"
      variant="neutral"
      :theme="theme"
      :surface-level="surfaceLevel"
      :buttons="[{ icon: 'xmark', label: 'Close menu' }]"
      @button-click="open = false"
    />
    <div class="app-menu__items">
      <MenuItem v-for="item in items" :key="item.label" :theme="theme" :label="item.label" :href="item.href" />
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
const items = [
  { label: 'Saved ideas', href: '/bookmarks' },
  { label: 'Saved actions', href: '/my-actions' },
  { label: 'Welcome guide', href: '/welcome' },
  { label: "What's new", href: '/whats-new' },
  { label: 'Map settings', href: '/map-settings' },
];
</script>

<style scoped>
.app-menu__items { display: flex; flex-direction: column; }
</style>
