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
    <main class="flex-grow flex flex-col min-h-0 relative overflow-hidden">
      <router-view v-slot="{ Component }">
        <transition :name="transitionName">
          <keep-alive include="BrowseView,SubmitView">
            <component :is="Component" class="view-panel" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
  </k-app>
</template>

<script setup>
import { ref, provide, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { kApp, kTabbar, kTabbarLink } from 'konsta/vue';
import { isDark, initTheme, toggleTheme } from './services/theme';

const route = useRoute();
const isSubmitting = ref(false);
const transitionName = ref('slide-left');

const ROUTE_ORDER = {
  '/': 0,
  '/browse': 0,
  '/submit': 1,
};

function getRouteDepth(path) {
  if (path in ROUTE_ORDER) return ROUTE_ORDER[path];
  if (path.startsWith('/suggestion')) return 2;
  return 1;
}

watch(
  () => route.path,
  (toPath, fromPath) => {
    const toDepth = getRouteDepth(toPath);
    const fromDepth = getRouteDepth(fromPath);
    if (toDepth > fromDepth) {
      transitionName.value = 'slide-left';
    } else if (toDepth < fromDepth) {
      transitionName.value = 'slide-right';
    }
  }
);

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

/* Slide Left (moving forward/right in index, e.g. Browse -> Submit) */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  will-change: transform;
}

.slide-left-enter-from {
  transform: translateX(100%);
}

.slide-left-leave-to {
  transform: translateX(-100%);
}

/* Slide Right (moving backward/left in index, e.g. Submit -> Browse) */
.slide-right-enter-from {
  transform: translateX(-100%);
}

.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
