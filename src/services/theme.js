import { ref } from 'vue';
import { getStoredTheme, setStoredTheme } from './storage';

export const isDark = ref(getStoredTheme() !== 'light');

export function initTheme() {
  const saved = getStoredTheme();
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

export function toggleTheme() {
  const next = isDark.value ? 'light' : 'dark';
  applyTheme(next);
}

export function applyTheme(theme) {
  isDark.value = theme === 'dark';
  setStoredTheme(theme);
  
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }
}
