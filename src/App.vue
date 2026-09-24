<template>
  <k-app
    theme="material"
    :dark="isDark"
    :material-touch-ripple="false"
    class="min-h-screen flex flex-col font-sans"
  >
    <!-- Navbar using strictly Konsta UI components -->
    <k-navbar
      v-if="!isSubmitting"
      title="Improvement Map"
      :center-title="false"
      class="sticky top-0 z-40 w-full"
    >
      <template #right>
        <k-link
          component="router-link"
          :link-props="{ to: '/' }"
          :navbar="true"
        >
          Home
        </k-link>
        <k-link
          component="router-link"
          :link-props="{ to: '/browse' }"
          :navbar="true"
        >
          Browse
        </k-link>
        <k-link
          component="router-link"
          :link-props="{ to: '/submit' }"
          :navbar="true"
        >
          Submit
        </k-link>
        <k-link
          id="theme-toggle-btn"
          :navbar="true"
          @click="toggleTheme"
        >
          {{ isDark ? '☀️' : '🌙' }}
        </k-link>
      </template>
    </k-navbar>

    <!-- Main View Content -->
    <main class="flex-grow pb-6">
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
import { kApp, kNavbar, kLink } from 'konsta/vue';
import { isDark, initTheme, toggleTheme } from './services/theme';

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
