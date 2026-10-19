import { ref } from 'vue';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { createNeighborhoodLabelLayer } from './neighborhoodLabels';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_KEY ||
  import.meta.env.GOOGLE_MAPS_KEY ||
  import.meta.env.VITE_GOOGLE_API_KEY ||
  import.meta.env.GOOGLE_API_KEY ||
  (typeof window !== 'undefined' && (window.__GOOGLE_MAPS_API_KEY__ || window.GOOGLE_MAPS_API_KEY)) ||
  '';

let googleMapsPromise = null;
let optionsConfigured = false;

export const hasGoogleMapsKey = Boolean(
  GOOGLE_MAPS_API_KEY &&
  GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here' &&
  !GOOGLE_MAPS_API_KEY.includes('your_google_maps_api_key')
);

export const googleMapsAuthError = ref('');

// Keep the encoded style below the Maps SDK's legacy 1,000-character limit.
// Broad geometry rules replace redundant fill/stroke rules from the source style.
export const darkMapStyles = [
  { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#24282b' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#d8c394' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#e4d2ab' }] },
  { featureType: 'administrative', elementType: 'geometry.fill', stylers: [{ color: '#000000' }, { lightness: 20 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#000000' }, { lightness: 17 }, { weight: 1.2 }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#4d6059' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#4d6059' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#7f8d89' }] },
  { featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#40534c' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#35473f' }, { weight: 0.2 }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8b9b92' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#000000' }, { lightness: 19 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#24282b' }] },
];

// Custom Google Streets (ROADMAP) style. Keep this shared across the app's
// submit, browse, and location-preview maps so the streets view stays consistent.
export const streetsMapStyles = [
  { featureType: 'all', elementType: 'geometry.fill', stylers: [{ weight: '2.00' }] },
  { featureType: 'all', elementType: 'geometry.stroke', stylers: [{ color: '#9c9c9c' }] },
  { featureType: 'all', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape', elementType: 'all', stylers: [{ color: '#f2f2f2' }] },
  { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'all', stylers: [{ saturation: -100 }, { lightness: 45 }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7b7b7b' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'all', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.arterial', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'all', stylers: [{ color: '#46bcec' }, { visibility: 'on' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8d7d4' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#070707' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
];

// Hybrid maps use satellite imagery with an overlay of roads and place labels.
// Keep that context while removing the POI glyphs that otherwise clutter the imagery.
const satelliteMapStyles = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/**
 * Returns the styling array for Google Maps based on theme and map type
 * @param {boolean} isDarkTheme
 * @param {string} mapType 'roadmap' | 'hybrid' | 'satellite' | 'terrain'
 * @param {number} zoom Streets brighten from 12 to 16; place names dim from 11 to 17.
 * @returns {Array}
 */
export function getMapStyles(isDarkTheme, mapType = 'roadmap', zoom = 16) {
  if (mapType === 'hybrid' || mapType === 'satellite') return satelliteMapStyles;
  if (mapType !== 'roadmap') return [];
  if (!isDarkTheme) return streetsMapStyles;

  const resolvedZoom = Number.isFinite(zoom) ? zoom : 16;
  const streetProgress = Math.min(1, Math.max(0, (resolvedZoom - 12) / 4));
  const placeProgress = Math.min(1, Math.max(0, (17 - resolvedZoom) / 6));
  const colors = {
    all: blendLabelColor([186, 197, 191], [255, 255, 255], streetProgress),
    'administrative.neighborhood': blendLabelColor([216, 195, 148], [243, 223, 178], placeProgress),
    'administrative.locality': blendLabelColor([228, 210, 171], [255, 240, 206], placeProgress),
  };
  return darkMapStyles.map(rule => rule.elementType === 'labels.text.fill' && colors[rule.featureType]
    ? { ...rule, stylers: [{ color: colors[rule.featureType] }] }
    : rule);
}

function blendLabelColor(from, to, progress) {
  return '#' + from.map((channel, index) => Math.round(channel + (to[index] - channel) * progress)
    .toString(16).padStart(2, '0')).join('');
}

const mapThemeBindings = new WeakMap();
const mapZoomControls = new WeakMap();

// Reserve the search bar's height in the right-side control stack.
export function insetMapZoomControls(map, maps) {
  if (mapZoomControls.has(map)) return;
  const control = document.createElement('div');
  control.className = 'map-ui map-zoom-ui';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Map zoom');
  const buttons = [1, -1].map(direction => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-ui-button';
    button.textContent = direction > 0 ? '+' : '−';
    button.setAttribute('aria-label', direction > 0 ? 'Zoom in' : 'Zoom out');
    button.addEventListener('click', () => map.setZoom((map.getZoom() ?? 13) + direction));
    control.appendChild(button);
    return button;
  });
  const sync = () => {
    const type = map.mapTypes?.get(map.getMapTypeId());
    buttons[0].disabled = map.getZoom() >= (map.get('maxZoom') ?? type?.maxZoom ?? 22);
    buttons[1].disabled = map.getZoom() <= (map.get('minZoom') ?? type?.minZoom ?? 0);
  };
  const listeners = ['zoom_changed', 'maptypeid_changed', 'minzoom_changed', 'maxzoom_changed']
    .map(event => map.addListener(event, sync));
  map.controls[maps.ControlPosition.RIGHT_TOP].push(control);
  map.setOptions({ zoomControl: false });
  sync();
  mapZoomControls.set(map, { control, listeners, controls: map.controls[maps.ControlPosition.RIGHT_TOP] });
}

/**
 * Updates a Google Map instance styling based on theme and map type
 * @param {google.maps.Map} map
 * @param {boolean} isDarkTheme
 * @param {string} mapType 'roadmap' | 'hybrid' | 'satellite' | 'terrain'
 */
export function updateMapTheme(map, isDarkTheme, mapType = 'roadmap') {
  if (!map) return;
  let binding = mapThemeBindings.get(map);
  if (!binding) {
    binding = { isDarkTheme };
    const refresh = () => {
      const type = map.getMapTypeId();
      let styles = getMapStyles(binding.isDarkTheme, type, map.getZoom());
      const color = styles.find(rule => rule.featureType === 'administrative.neighborhood'
        && rule.elementType === 'labels.text.fill')?.stylers[0].color;
      binding.layer?.update({ enabled: binding.isDarkTheme && type === 'roadmap', color: color || '#d8c394' });
      if (binding.layer?.visible) {
        styles = styles.map(rule => rule.featureType === 'administrative.neighborhood' && rule.elementType === 'labels.text'
          ? { ...rule, stylers: [{ visibility: 'off' }] } : rule);
      }
      binding.railLayer?.update({ styles, mapType: type });
      // Labels are rendered once, in the managed label layer above all rails.
      // Keeping it in the base tiles too produces conflicting label placements.
      if (binding.railLayer && type !== 'hybrid' && type !== 'satellite') {
        styles = [...styles, { featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'off' }] }];
      }
      const signature = JSON.stringify(styles);
      if (signature !== binding.signature) {
        binding.signature = signature;
        map.setOptions({ styles });
      }
    };
    binding.refresh = refresh;
    mapThemeBindings.set(map, binding);
    binding.listeners = [map.addListener('zoom_changed', refresh), map.addListener('maptypeid_changed', refresh)];
    binding.layer = createNeighborhoodLabelLayer(map, window.google.maps, refresh);
    // Load the catalog once, and share the overlay across theme/map-type updates.
    Promise.all([import('./googleMapsRailOverlay'), import('./railCatalog')])
      .then(([{ createGoogleMapsRailOverlay }, { railCatalog }]) => {
        if (!binding.disposed) {
          binding.railLayer = createGoogleMapsRailOverlay(map, window.google.maps, railCatalog);
          binding.refresh();
        }
      })
      .catch((error) => console.warn('Rail overlay could not be loaded:', error));
  }
  binding.isDarkTheme = isDarkTheme;
  binding.refresh();
}

export function disposeMapTheme(map) {
  const zoom = mapZoomControls.get(map);
  if (zoom) {
    zoom.listeners.forEach(listener => listener.remove());
    for (let i = zoom.controls.getLength() - 1; i >= 0; i--) {
      if (zoom.controls.getAt(i) === zoom.control) zoom.controls.removeAt(i);
    }
    mapZoomControls.delete(map);
  }
  const binding = mapThemeBindings.get(map);
  if (!binding) return;
  binding.disposed = true;
  binding.railLayer?.dispose();
  binding.listeners.forEach(listener => listener.remove());
  binding.layer?.dispose();
  mapThemeBindings.delete(map);
}

// Global authentication failure handler hook for Google Maps JS API
if (typeof window !== 'undefined') {
  window.gm_authFailure = () => {
    const msg =
      'Google Maps Authentication Error: Check that Maps JavaScript API, Places API, and Geocoding API are enabled in Google Cloud Console, and verify billing & HTTP Referrer restrictions.';
    console.error('[Google Maps Auth Failure]', msg);
    googleMapsAuthError.value = msg;
  };
}

const placesCache = new Map();
const reverseCache = new Map();

/**
 * Loads and initializes the Google Maps JavaScript SDK
 * @returns {Promise<typeof google.maps>}
 */
export async function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps?.Map) {
    return window.google.maps;
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = (async () => {
    try {
      if (!optionsConfigured) {
        setOptions({
          key: GOOGLE_MAPS_API_KEY || '',
          v: 'weekly',
        });
        optionsConfigured = true;
      }

      await Promise.all([
        importLibrary('maps'),
        importLibrary('places'),
        importLibrary('geometry'),
        importLibrary('geocoding'),
        importLibrary('marker'),
      ]);

      googleMapsAuthError.value = '';
      return window.google.maps;
    } catch (err) {
      console.warn('Google Maps SDK loading error:', err);
      googleMapsAuthError.value = err?.message || 'Failed to load Google Maps SDK';
      if (typeof window !== 'undefined' && window.google?.maps) {
        return window.google.maps;
      }
      throw err;
    }
  })();

  return googleMapsPromise;
}

/**
 * Searches for address suggestions using Google Maps AutocompleteService / Geocoder
 * @param {string} query
 * @returns {Promise<Array<{ id: string, displayName: string, latitude?: number, longitude?: number }>>}
 */
export async function searchAddressWithGoogle(query) {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  if (placesCache.has(cacheKey)) {
    return placesCache.get(cacheKey);
  }

  try {
    const maps = await loadGoogleMaps();

    // 1. Try AutocompleteService if available
    if (maps.places?.AutocompleteService) {
      const autocomplete = new maps.places.AutocompleteService();
      const predictions = await new Promise((resolve) => {
        autocomplete.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'us' },
          },
          (results, status) => {
            if (status === maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              resolve([]);
            }
          }
        );
      });

      if (predictions.length > 0) {
        const formatted = predictions.slice(0, 5).map((p) => ({
          id: p.place_id,
          displayName: p.description,
          placeId: p.place_id,
        }));
        placesCache.set(cacheKey, formatted);
        return formatted;
      }
    }

    // 2. Fallback to Google Geocoder
    if (maps.Geocoder) {
      const geocoder = new maps.Geocoder();
      const geoResults = await new Promise((resolve) => {
        geocoder.geocode({ address: trimmed }, (results, status) => {
          if (status === maps.GeocoderStatus.OK && results) {
            resolve(results);
          } else {
            resolve([]);
          }
        });
      });

      const formatted = (geoResults || []).slice(0, 5).map((item) => ({
        id: item.place_id || `${item.geometry.location.lat()},${item.geometry.location.lng()}`,
        displayName: item.formatted_address,
        latitude: item.geometry.location.lat(),
        longitude: item.geometry.location.lng(),
        placeId: item.place_id,
      }));

      placesCache.set(cacheKey, formatted);
      return formatted;
    }

    return [];
  } catch (error) {
    console.warn('Google Maps address search error:', error);
    return [];
  }
}

/**
 * Resolves a placeId or address string to { latitude, longitude, address } using Google Geocoder
 * @param {string} placeIdOrAddress
 * @returns {Promise<{ latitude: number, longitude: number, address: string } | null>}
 */
export async function resolveGooglePlace(placeIdOrAddress) {
  if (!placeIdOrAddress) return null;

  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();

    const request = placeIdOrAddress.startsWith('ChIJ') || placeIdOrAddress.length > 20
      ? { placeId: placeIdOrAddress }
      : { address: placeIdOrAddress };

    const results = await new Promise((resolve, reject) => {
      geocoder.geocode(request, (res, status) => {
        if (status === maps.GeocoderStatus.OK && res && res[0]) {
          resolve(res[0]);
        } else {
          // If placeId failed, fallback to address search
          if (request.placeId) {
            geocoder.geocode({ address: placeIdOrAddress }, (res2, status2) => {
              if (status2 === maps.GeocoderStatus.OK && res2 && res2[0]) {
                resolve(res2[0]);
              } else {
                reject(new Error(`Geocode failed: ${status2 || status}`));
              }
            });
          } else {
            reject(new Error(`Geocode failed: ${status}`));
          }
        }
      });
    });

    return {
      latitude: results.geometry.location.lat(),
      longitude: results.geometry.location.lng(),
      address: results.formatted_address,
    };
  } catch (err) {
    console.warn('Resolve Google place error:', err);
    return null;
  }
}

/**
 * Reverse geocodes coordinates to a human-readable street address using Google Geocoder
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocodeWithGoogle(lat, lng) {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return '';

  const roundedLat = Number(lat).toFixed(5);
  const roundedLng = Number(lng).toFixed(5);
  const cacheKey = `${roundedLat},${roundedLng}`;

  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();

    const results = await new Promise((resolve) => {
      geocoder.geocode(
        { location: { lat: Number(lat), lng: Number(lng) } },
        (res, status) => {
          if (status === maps.GeocoderStatus.OK && res && res[0]) {
            resolve(res[0].formatted_address);
          } else {
            resolve(`${roundedLat}, ${roundedLng}`);
          }
        }
      );
    });

    const address = results || `${roundedLat}, ${roundedLng}`;
    reverseCache.set(cacheKey, address);
    return address;
  } catch (error) {
    console.warn('Google reverse geocoding error:', error);
    return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
  }
}
