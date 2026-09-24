<template>
  <k-app
    theme="material"
    :dark="isDark"
    :material-touch-ripple="false"
    class="min-h-screen flex flex-col font-sans"
  >
    <!-- Main View Content -->
    <main class="flex-grow pb-16">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Bottom Tabbar with no title and no subtitle -->
    <k-tabbar
      v-if="!isSubmitting"
      :labels="true"
      :icons="true"
      class="fixed bottom-0 left-0 right-0 z-40 w-full"
    >
      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/' }"
        :active="route.path === '/' || route.path === '/browse'"
        label="Browse"
      >
        <template #icon>
          <i class="fa-solid fa-map-location-dot text-lg"></i>
        </template>
      </k-tabbar-link>

      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/submit' }"
        :active="route.path === '/submit'"
        label="Submit"
      >
        <template #icon>
          <i class="fa-solid fa-circle-plus text-lg"></i>
        </template>
      </k-tabbar-link>

      <k-tabbar-link
        id="theme-toggle-btn"
        :label="isDark ? 'Light' : 'Dark'"
        @click="toggleTheme"
      >
        <template #icon>
          <span class="text-lg leading-none">{{ isDark ? '☀️' : '🌙' }}</span>
        </template>
      </k-tabbar-link>
    </k-tabbar>
  </k-app>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { kApp, kTabbar, kTabbarLink } from 'konsta/vue';
import { isDark, initTheme, toggleTheme } from './services/theme';

const route = useRoute();
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
