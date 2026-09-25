<template>
  <k-app
    theme="material"
    :dark="isDark"
    :material-touch-ripple="false"
    class="min-h-screen h-screen flex flex-col font-sans overflow-hidden"
  >
    <!-- Bottom Tabbar with no title and no subtitle -->
    <k-tabbar
      v-if="!isSubmitting"
      :labels="true"
      :top="true"
      class="w-full bg-zinc-900 sticky top-0 z-30 flex-shrink-0"
    >
      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/' }"
        :active="route.path === '/' || route.path === '/browse'"
        label="Browse"
      >
      </k-tabbar-link>

      <k-tabbar-link
        component="router-link"
        :link-props="{ to: '/submit' }"
        :active="route.path === '/submit'"
        label="Submit"
      >
      </k-tabbar-link>

      <k-tabbar-link
        id="theme-toggle-btn"
        @click="toggleTheme"
      >
        <template #icon>
          <span class="text-lg leading-none">{{ isDark ? '☀️' : '🌙' }}</span>
        </template>
      </k-tabbar-link>
    </k-tabbar>
    <!-- Main View Content -->
    <main class="flex-grow flex flex-col min-h-0 overflow-y-auto scrollable">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
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
