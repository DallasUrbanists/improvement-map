const DRAFT_STORAGE_KEY = 'improvement_map_wizard_draft_v1';
const THEME_STORAGE_KEY = 'improvement_map_theme';
const CACHE_SUGGESTIONS_KEY = 'improvement_map_cached_suggestions';
const BROWSE_TAB_STORAGE_KEY = 'improvement_map_browse_tab';
const MAP_VIEW_STORAGE_KEY = 'improvement_map_view';
const BROWSE_SORT_STORAGE_KEY = 'improvement_map_browse_sort';
const MARKER_ZOOM_THRESHOLD_KEY = 'improvement_map_marker_zoom_threshold';
const HEATMAP_OPACITY_KEY = 'improvement_map_heatmap_opacity';
const HEATMAP_RADIUS_KEY = 'improvement_map_heatmap_radius';
const MARKER_PULSE_SPEED_KEY = 'improvement_map_marker_pulse_speed';
const MARKER_PULSE_SCALE_KEY = 'improvement_map_marker_pulse_scale';
const MARKER_BOB_AMOUNT_KEY = 'improvement_map_marker_bob_amount';
const MARKER_BOB_SPEED_KEY = 'improvement_map_marker_bob_speed';
const MARKER_PULSE_EASING_KEY = 'improvement_map_marker_pulse_easing';
const MARKER_BOB_EASING_KEY = 'improvement_map_marker_bob_easing';
const MARKER_SPOTLIGHT_SIZE_KEY = 'improvement_map_marker_spotlight_size';
const MARKER_SPOTLIGHT_FEATHER_KEY = 'improvement_map_marker_spotlight_feather';
const BROWSE_LIST_SCROLL_STORAGE_KEY = 'improvement_map_browse_list_scroll';
const AUTHOR_PROFILE_STORAGE_KEY = 'improvement_map_author_profile';
const ACTIVE_INFOWINDOW_SUGGESTION_KEY = 'improvement_map_active_infowindow_suggestion_id';

export const DEFAULT_MARKER_SETTINGS = Object.freeze({
  markerZoomThreshold: 1,
  heatmapOpacity: 0,
  heatmapRadius: 8,
  markerPulseSpeed: 0.9,
  markerPulseScale: 1.65,
  markerBobAngle: 12,
  markerBobSpeed: 0.7,
  markerPulseEasing: 'ease-in-out',
  markerBobEasing: 'ease',
  markerSpotlightSize: 120,
  markerSpotlightFeather: 32,
});

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
    return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  } catch {
    return 'system';
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

export function getStoredMarkerZoomThreshold() {
  try {
    const raw = localStorage.getItem(MARKER_ZOOM_THRESHOLD_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 20 ? value : DEFAULT_MARKER_SETTINGS.markerZoomThreshold;
  } catch { return DEFAULT_MARKER_SETTINGS.markerZoomThreshold; }
}

export function setStoredMarkerZoomThreshold(value) {
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) return;
  try { localStorage.setItem(MARKER_ZOOM_THRESHOLD_KEY, String(threshold)); } catch { /* Storage may be unavailable. */ }
}

export function getStoredHeatmapOpacity() {
  try {
    const raw = localStorage.getItem(HEATMAP_OPACITY_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_MARKER_SETTINGS.heatmapOpacity;
  } catch { return DEFAULT_MARKER_SETTINGS.heatmapOpacity; }
}

export function setStoredHeatmapOpacity(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) return;
  try { localStorage.setItem(HEATMAP_OPACITY_KEY, String(value)); } catch { /* Storage may be unavailable. */ }
}

export function getStoredHeatmapRadius() {
  try {
    const raw = localStorage.getItem(HEATMAP_RADIUS_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value >= 8 && value <= 160 ? value : DEFAULT_MARKER_SETTINGS.heatmapRadius;
  } catch { return DEFAULT_MARKER_SETTINGS.heatmapRadius; }
}

export function setStoredHeatmapRadius(value) {
  if (!Number.isInteger(value) || value < 8 || value > 160) return;
  try { localStorage.setItem(HEATMAP_RADIUS_KEY, String(value)); } catch { /* Storage may be unavailable. */ }
}

function getStoredMarkerAnimationValue(key, fallback, min, max) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  } catch { return fallback; }
}
function setStoredMarkerAnimationValue(key, value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return;
  try { localStorage.setItem(key, String(number)); } catch { /* Storage may be unavailable. */ }
}
export const getStoredMarkerPulseSpeed = () => getStoredMarkerAnimationValue(MARKER_PULSE_SPEED_KEY, DEFAULT_MARKER_SETTINGS.markerPulseSpeed, 0.5, 2);
export const setStoredMarkerPulseSpeed = value => setStoredMarkerAnimationValue(MARKER_PULSE_SPEED_KEY, value, 0.5, 2);
export const getStoredMarkerPulseScale = () => getStoredMarkerAnimationValue(MARKER_PULSE_SCALE_KEY, DEFAULT_MARKER_SETTINGS.markerPulseScale, 1, 2);
export const setStoredMarkerPulseScale = value => setStoredMarkerAnimationValue(MARKER_PULSE_SCALE_KEY, value, 1, 2);
export const getStoredMarkerBobAmount = () => getStoredMarkerAnimationValue(MARKER_BOB_AMOUNT_KEY, DEFAULT_MARKER_SETTINGS.markerBobAngle, 0, 12);
export const setStoredMarkerBobAmount = value => setStoredMarkerAnimationValue(MARKER_BOB_AMOUNT_KEY, value, 0, 12);
export const getStoredMarkerBobSpeed = () => getStoredMarkerAnimationValue(MARKER_BOB_SPEED_KEY, DEFAULT_MARKER_SETTINGS.markerBobSpeed, 0.5, 2);
export const setStoredMarkerBobSpeed = value => setStoredMarkerAnimationValue(MARKER_BOB_SPEED_KEY, value, 0.5, 2);
const MARKER_EASING_OPTIONS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];
function getStoredMarkerEasing(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return MARKER_EASING_OPTIONS.includes(value) ? value : fallback;
  } catch { return fallback; }
}
function setStoredMarkerEasing(key, value) {
  if (!MARKER_EASING_OPTIONS.includes(value)) return;
  try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable. */ }
}
export const getStoredMarkerPulseEasing = () => getStoredMarkerEasing(MARKER_PULSE_EASING_KEY, DEFAULT_MARKER_SETTINGS.markerPulseEasing);
export const setStoredMarkerPulseEasing = value => setStoredMarkerEasing(MARKER_PULSE_EASING_KEY, value);
export const getStoredMarkerBobEasing = () => getStoredMarkerEasing(MARKER_BOB_EASING_KEY, DEFAULT_MARKER_SETTINGS.markerBobEasing);
export const getStoredMarkerSpotlightSize = () => getStoredMarkerAnimationValue(MARKER_SPOTLIGHT_SIZE_KEY, DEFAULT_MARKER_SETTINGS.markerSpotlightSize, 48, 480);
export const setStoredMarkerSpotlightSize = value => setStoredMarkerAnimationValue(MARKER_SPOTLIGHT_SIZE_KEY, value, 48, 480);
export const getStoredMarkerSpotlightFeather = () => getStoredMarkerAnimationValue(MARKER_SPOTLIGHT_FEATHER_KEY, DEFAULT_MARKER_SETTINGS.markerSpotlightFeather, 0, 96);
export const setStoredMarkerSpotlightFeather = value => setStoredMarkerAnimationValue(MARKER_SPOTLIGHT_FEATHER_KEY, value, 0, 96);
export const setStoredMarkerBobEasing = value => setStoredMarkerEasing(MARKER_BOB_EASING_KEY, value);

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
