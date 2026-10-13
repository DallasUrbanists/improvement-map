<template>
  <k-app
    theme="material"
    :dark="isDark"
    :material-touch-ripple="false"
    class="min-h-screen h-screen flex flex-col font-sans overflow-hidden"
  >
    <main class="flex-grow flex flex-col min-h-0 relative overflow-hidden">
      <router-view v-slot="{ Component }">
        <keep-alive include="BrowseView,SubmitView">
          <component :is="Component" class="view-panel" />
        </keep-alive>
      </router-view>
    </main>

    <k-tabbar
      v-if="!isSubmitting"
      :labels="true"
      class="w-full flex-shrink-0 bg-zinc-900 sticky bottom-0 z-30"
    >
      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/' }"
        :active="route.path === '/' || route.path === '/browse'"
        label="Browse"
      />
      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/submit' }"
        :active="route.path === '/submit'"
        label="Submit"
      />
      <k-tabbar-link
        id="theme-menu-btn"
        label="Menu"
        aria-haspopup="menu"
        :aria-expanded="isThemeMenuOpen"
        @click="toggleThemeMenu"
      />
    </k-tabbar>

    <k-popover
      :opened="isThemeMenuOpen"
      target="#theme-menu-btn"
      @backdropclick="isThemeMenuOpen = false"
      class="min-w-48"
    >
      <div role="menu" aria-label="Theme options" class="min-w-48 p-1">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          role="menuitemradio"
          :aria-checked="selectedTheme === option.value"
          class="flex w-full items-center justify-between gap-4 rounded px-3 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          @click="selectTheme(option.value)"
        >
          {{ option.label }}
          <i v-if="selectedTheme === option.value" class="fa-solid fa-check" aria-hidden="true"></i>
        </button>
      </div>
    </k-popover>
  </k-app>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { kApp, kTabbar, kTabbarLink, kPopover } from 'konsta/vue';
import { applyTheme, isDark, initTheme, selectedTheme } from './services/theme';

const route = useRoute();
const isSubmitting = ref(false);
const isThemeMenuOpen = ref(false);
const themeOptions = [
  { value: 'light', label: 'Light theme' },
  { value: 'dark', label: 'Dark theme' },
  { value: 'system', label: 'System theme' },
];

function toggleThemeMenu() {
  isThemeMenuOpen.value = !isThemeMenuOpen.value;
}

function selectTheme(theme) {
  applyTheme(theme);
  isThemeMenuOpen.value = false;
}

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
