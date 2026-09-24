<template>
  <k-app
    theme="material"
    :dark="isDark"
    :material-touch-ripple="false"
    class="k-md-vibrant min-h-screen flex flex-col font-sans transition-colors duration-200"
    :class="isDark ? 'dark bg-dark-bg text-slate-100' : 'light bg-st-sidewalk text-st-navy'"
  >
    <!-- Global Navbar (hidden when isSubmitting is true) -->
    <Navbar :hideNavbar="isSubmitting" />

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
import { kApp } from 'konsta/vue';
import Navbar from './components/Navbar.vue';
import { isDark, initTheme } from './services/theme';

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
