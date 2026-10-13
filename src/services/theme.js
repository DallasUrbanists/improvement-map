import { ref } from 'vue';
import { getStoredTheme, setStoredTheme } from './storage';

const THEME_OPTIONS = new Set(['light', 'dark', 'system']);
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

export const selectedTheme = ref(getStoredTheme());
export const isDark = ref(resolveIsDark(selectedTheme.value));

let systemThemeMediaQuery = null;

function resolveIsDark(theme) {
  if (theme === 'system') {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(SYSTEM_THEME_QUERY).matches;
  }
  return theme === 'dark';
}

function applyResolvedTheme(theme) {
  isDark.value = resolveIsDark(theme);

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark.value);
    root.classList.toggle('light', !isDark.value);
  }
}

function onSystemThemeChange() {
  if (selectedTheme.value === 'system') applyResolvedTheme('system');
}

export function initTheme() {
  const saved = getStoredTheme();
  selectedTheme.value = THEME_OPTIONS.has(saved) ? saved : 'dark';
  setStoredTheme(selectedTheme.value);

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !systemThemeMediaQuery) {
    systemThemeMediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    if (systemThemeMediaQuery.addEventListener) {
      systemThemeMediaQuery.addEventListener('change', onSystemThemeChange);
    } else {
      systemThemeMediaQuery.addListener?.(onSystemThemeChange);
    }
  }

  applyResolvedTheme(selectedTheme.value);
}

export function applyTheme(theme) {
  if (!THEME_OPTIONS.has(theme)) return;
  selectedTheme.value = theme;
  setStoredTheme(theme);
  applyResolvedTheme(theme);
}
