const DRAFT_STORAGE_KEY = 'improvement_map_wizard_draft_v1';
const THEME_STORAGE_KEY = 'improvement_map_theme';
const CACHE_SUGGESTIONS_KEY = 'improvement_map_cached_suggestions';

export function getInitialDraft() {
  return {
    step: 1,
    summary: '',
    details: '',
    location: {
      latitude: null,
      longitude: null,
      address: '',
      description: '',
    },
    photos: [], // array of { id, dataUrl, name, caption, sizeKb }
    author: {
      name: '',
      email: '',
    }
  };
}

export function loadWizardDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getInitialDraft(), ...parsed };
    }
  } catch (err) {
    console.warn('Failed to parse wizard draft from storage:', err);
  }
  return getInitialDraft();
}

export function saveWizardDraft(draftData) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
  } catch (err) {
    console.warn('Failed to save wizard draft to storage:', err);
  }
}

export function clearWizardDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear wizard draft from storage:', err);
  }
}

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.warn('Failed to set theme in storage:', err);
  }
}

export function getCachedSuggestions() {
  try {
    const raw = localStorage.getItem(CACHE_SUGGESTIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load cached suggestions:', err);
  }
  return null;
}

export function setCachedSuggestions(data) {
  try {
    localStorage.setItem(CACHE_SUGGESTIONS_KEY, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
  } catch (err) {
    console.warn('Failed to cache suggestions:', err);
  }
}
