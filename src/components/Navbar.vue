<template>
  <div>
    <!-- Top Navigation Header -->
    <header
      v-if="!hideNavbar"
      class="sticky top-0 z-40 w-full backdrop-blur-md bg-st-navy/95 border-b border-st-navy-700 text-white shadow-md transition-colors"
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo / Brand -->
          <router-link
            to="/"
            class="flex items-center space-x-3 group focus:outline-none focus:ring-2 focus:ring-st-yellow rounded-lg p-1"
          >
            <div class="w-10 h-10 rounded-xl bg-st-yellow flex items-center justify-center text-st-navy font-black text-xl shadow-inner group-hover:scale-105 transition-transform">
              <i class="fa-solid fa-map-location-dot"></i>
            </div>
            <div>
              <span class="text-xs uppercase tracking-widest text-st-yellow font-bold block leading-tight">Dallas Urbanists</span>
              <span class="font-serif text-lg font-bold tracking-tight text-white group-hover:text-st-yellow transition-colors leading-none">
                Improvement Map
              </span>
            </div>
          </router-link>

          <!-- Desktop Navigation Links -->
          <div class="hidden md:flex items-center space-x-1">
            <router-link
              to="/"
              class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              :class="$route.name === 'Home' ? 'bg-st-blue text-white shadow' : 'text-slate-200 hover:text-white hover:bg-st-navy-800'"
            >
              <i class="fa-solid fa-house"></i>
              Home
            </router-link>

            <router-link
              to="/browse"
              class="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              :class="$route.name === 'Browse' ? 'bg-st-blue text-white shadow' : 'text-slate-200 hover:text-white hover:bg-st-navy-800'"
            >
              <i class="fa-solid fa-compass"></i>
              Browse
            </router-link>

            <router-link
              to="/submit"
              class="ml-2 px-4 py-2 rounded-xl text-sm font-bold bg-st-yellow text-st-navy hover:bg-amber-400 active:scale-95 transition-all shadow-md flex items-center gap-2"
            >
              <i class="fa-solid fa-plus-circle"></i>
              Submit Idea
            </router-link>
          </div>

          <!-- Dark/Light Theme Toggle -->
          <div class="flex items-center gap-2">
            <button
              id="theme-toggle-btn"
              type="button"
              @click="toggleTheme"
              class="touch-target p-2.5 rounded-xl bg-st-navy-800 hover:bg-st-navy-700 text-st-yellow transition-colors flex items-center justify-center border border-st-navy-700 pointer-events-auto"
              :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
              aria-label="Toggle dark and light theme"
            >
              <i v-if="isDark" class="fa-solid fa-sun text-lg pointer-events-none"></i>
              <i v-else class="fa-solid fa-moon text-lg text-slate-100 pointer-events-none"></i>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Mobile Bottom Navigation Bar for One-Thumb Ergonomics -->
    <nav
      v-if="!hideNavbar"
      class="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-st-navy border-t border-st-navy-700 pb-safe shadow-2xl"
    >
      <div class="grid grid-cols-3 h-16">
        <router-link
          to="/"
          class="flex flex-col items-center justify-center transition-colors touch-target"
          :class="$route.name === 'Home' ? 'text-st-yellow font-bold' : 'text-slate-400 hover:text-slate-200'"
        >
          <i class="fa-solid fa-house text-lg mb-1"></i>
          <span class="text-xs">Home</span>
        </router-link>

        <router-link
          to="/browse"
          class="flex flex-col items-center justify-center transition-colors touch-target"
          :class="$route.name === 'Browse' ? 'text-st-yellow font-bold' : 'text-slate-400 hover:text-slate-200'"
        >
          <i class="fa-solid fa-compass text-lg mb-1"></i>
          <span class="text-xs">Browse</span>
        </router-link>

        <router-link
          to="/submit"
          class="flex flex-col items-center justify-center transition-colors touch-target"
          :class="$route.name === 'Submit' ? 'text-st-yellow font-bold' : 'text-slate-400 hover:text-slate-200'"
        >
          <div class="w-8 h-8 rounded-full bg-st-yellow text-st-navy flex items-center justify-center font-bold mb-0.5 shadow-sm">
            <i class="fa-solid fa-plus text-sm"></i>
          </div>
          <span class="text-[11px]">Submit</span>
        </router-link>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { isDark, toggleTheme } from '../services/theme';

const props = defineProps({
  hideNavbar: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
