<template>
  <div class="min-h-screen flex flex-col transition-colors duration-200" :class="isDark ? 'dark bg-dark-bg text-slate-100' : 'light bg-st-sidewalk text-st-navy'">
    <!-- Global Navbar (hidden when isSubmitting is true) -->
    <Navbar :hideNavbar="isSubmitting" />

    <!-- Main View Content -->
    <main class="flex-grow pb-20 md:pb-6">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue';
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
