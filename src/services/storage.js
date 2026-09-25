const DRAFT_STORAGE_KEY = 'improvement_map_wizard_draft_v1';
const THEME_STORAGE_KEY = 'improvement_map_theme';
const CACHE_SUGGESTIONS_KEY = 'improvement_map_cached_suggestions';
const BROWSE_TAB_STORAGE_KEY = 'improvement_map_browse_tab';
const MAP_VIEW_STORAGE_KEY = 'improvement_map_view';
const BROWSE_SORT_STORAGE_KEY = 'improvement_map_browse_sort';
const BROWSE_LIST_SCROLL_STORAGE_KEY = 'improvement_map_browse_list_scroll';
const AUTHOR_PROFILE_STORAGE_KEY = 'improvement_map_author_profile';
const ACTIVE_INFOWINDOW_SUGGESTION_KEY = 'improvement_map_active_infowindow_suggestion_id';

export function getStoredActiveInfoWindowSuggestionId() {
  try {
    return localStorage.getItem(ACTIVE_INFOWINDOW_SUGGESTION_KEY) || null;
  } catch (err) {
    console.warn('Failed to parse active infowindow suggestion id from storage:', err);
    return null;
  }
}

export function setStoredActiveInfoWindowSuggestionId(suggestionId) {
  try {
    if (suggestionId) {
      localStorage.setItem(ACTIVE_INFOWINDOW_SUGGESTION_KEY, String(suggestionId));
    } else {
      localStorage.removeItem(ACTIVE_INFOWINDOW_SUGGESTION_KEY);
    }
  } catch (err) {
    console.warn('Failed to save active infowindow suggestion id to storage:', err);
  }
}

export function removeStoredActiveInfoWindowSuggestionId() {
  try {
    localStorage.removeItem(ACTIVE_INFOWINDOW_SUGGESTION_KEY);
  } catch (err) {
    console.warn('Failed to remove active infowindow suggestion id from storage:', err);
  }
}

export function getStoredAuthorProfile() {
  try {
    const raw = localStorage.getItem(AUTHOR_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
      };
    }
  } catch (err) {
    console.warn('Failed to parse author profile from storage:', err);
  }
  return { name: '', email: '' };
}

export function setStoredAuthorProfile(profile) {
  try {
    localStorage.setItem(AUTHOR_PROFILE_STORAGE_KEY, JSON.stringify({
      name: profile?.name || '',
      email: profile?.email || '',
    }));
  } catch (err) {
    console.warn('Failed to save author profile to storage:', err);
  }
}

export function getInitialDraft() {
  const author = getStoredAuthorProfile();
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
      name: author.name || '',
      email: author.email || '',
    }
  };
}

export function loadWizardDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const initial = getInitialDraft();
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...initial,
        ...parsed,
        author: {
          name: (parsed.author?.name !== undefined && parsed.author?.name !== '') ? parsed.author.name : initial.author.name,
          email: (parsed.author?.email !== undefined && parsed.author?.email !== '') ? parsed.author.email : initial.author.email,
        }
      };
    }
    return initial;
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

export function getStoredBrowseTab() {
  try {
    return localStorage.getItem(BROWSE_TAB_STORAGE_KEY) || 'streets';
  } catch {
    return 'streets';
  }
}

export function setStoredBrowseTab(tab) {
  try {
    localStorage.setItem(BROWSE_TAB_STORAGE_KEY, tab);
  } catch (err) {
    console.warn('Failed to save browse tab to storage:', err);
  }
}

export function getStoredMapView() {
  try {
    const raw = localStorage.getItem(MAP_VIEW_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.lat === 'number' &&
        !isNaN(parsed.lat) &&
        typeof parsed.lng === 'number' &&
        !isNaN(parsed.lng) &&
        typeof parsed.zoom === 'number' &&
        !isNaN(parsed.zoom)
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse map view from storage:', err);
  }
  return null;
}

export function setStoredMapView(view) {
  try {
    if (
      view &&
      typeof view.lat === 'number' &&
      !isNaN(view.lat) &&
      typeof view.lng === 'number' &&
      !isNaN(view.lng) &&
      typeof view.zoom === 'number' &&
      !isNaN(view.zoom)
    ) {
      localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view));
    }
  } catch (err) {
    console.warn('Failed to save map view to storage:', err);
  }
}

export function removeStoredMapView() {
  try {
    localStorage.removeItem(MAP_VIEW_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to remove map view from storage:', err);
  }
}

export function getStoredBrowseSort() {
  try {
    const raw = localStorage.getItem(BROWSE_SORT_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (parsed === 1 || parsed === 2) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse browse sort from storage:', err);
  }
  return 1;
}

export function setStoredBrowseSort(sort) {
  try {
    localStorage.setItem(BROWSE_SORT_STORAGE_KEY, String(sort));
  } catch (err) {
    console.warn('Failed to save browse sort to storage:', err);
  }
}

export function getStoredBrowseListScroll() {
  try {
    const raw = localStorage.getItem(BROWSE_LIST_SCROLL_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse browse list scroll from storage:', err);
  }
  return 0;
}

export function setStoredBrowseListScroll(top) {
  try {
    localStorage.setItem(BROWSE_LIST_SCROLL_STORAGE_KEY, String(top));
  } catch (err) {
    console.warn('Failed to save browse list scroll to storage:', err);
  }
}
