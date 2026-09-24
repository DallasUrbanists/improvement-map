import { ref } from 'vue';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

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

// Standard dark/night mode style configuration for Google Maps JavaScript SDK
export const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }],
  },
];

export const lightMapStyles = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
];

/**
 * Returns the styling array for Google Maps based on theme and map type
 * @param {boolean} isDarkTheme
 * @param {string} mapType 'roadmap' | 'hybrid' | 'satellite' | 'terrain'
 * @returns {Array}
 */
export function getMapStyles(isDarkTheme, mapType = 'roadmap') {
  if (mapType === 'roadmap' && isDarkTheme) {
    return darkMapStyles;
  }
  return lightMapStyles;
}

/**
 * Updates a Google Map instance styling based on theme and map type
 * @param {google.maps.Map} map
 * @param {boolean} isDarkTheme
 * @param {string} mapType 'roadmap' | 'hybrid' | 'satellite' | 'terrain'
 */
export function updateMapTheme(map, isDarkTheme, mapType = 'roadmap') {
  if (!map) return;
  const styles = getMapStyles(isDarkTheme, mapType);
  map.setOptions({ styles });
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
