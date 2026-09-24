<template>
  <k-navbar
    v-if="!hideNavbar"
    title="Improvement Map"
    subtitle="by Dallas Urbanists"
    :center-title="false"
    :transparent="false"
    bg-class="bg-white dark:bg-st-navy border-b border-slate-200 dark:border-st-navy-800 shadow-md"
    inner-class="px-4 h-16 flex items-center justify-between"
    title-class="!text-st-navy dark:!text-white font-serif font-bold text-lg sm:text-xl tracking-tight"
    subtitle-class="!text-amber-600 dark:!text-st-yellow font-bold text-xs uppercase tracking-wider block"
    right-class="flex items-center space-x-1 sm:space-x-2 text-sm font-medium"
    class="sticky top-0 z-40 w-full"
  >
    <template #right>
      <k-link
        component="router-link"
        :link-props="{ to: '/' }"
        :navbar="true"
        class="!text-slate-700 hover:!text-black dark:!text-slate-200 dark:hover:!text-white px-2.5 py-1.5 rounded-lg transition-colors"
      >
        Home
      </k-link>
      <k-link
        component="router-link"
        :link-props="{ to: '/browse' }"
        :navbar="true"
        class="!text-slate-700 hover:!text-black dark:!text-slate-200 dark:hover:!text-white px-2.5 py-1.5 rounded-lg transition-colors"
      >
        Browse
      </k-link>
      <k-link
        component="router-link"
        :link-props="{ to: '/submit' }"
        :navbar="true"
        class="!text-slate-700 hover:!text-black dark:!text-slate-200 dark:hover:!text-white px-2.5 py-1.5 rounded-lg transition-colors"
      >
        Submit
      </k-link>
      <k-link
        id="theme-toggle-btn"
        :navbar="true"
        @click="toggleTheme"
        class="!text-amber-600 dark:!text-st-yellow px-2.5 py-1.5 rounded-lg transition-colors font-semibold"
      >
        {{ isDark ? '☀️' : '🌙' }}
      </k-link>
    </template>
  </k-navbar>
</template>

<script setup>
import { kNavbar, kLink } from 'konsta/vue';
import { isDark, toggleTheme } from '../services/theme';

const props = defineProps({
  hideNavbar: {
    type: Boolean,
    default: false
  }
});
</script>
