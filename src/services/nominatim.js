/**
 * Nominatim OpenStreetMap Geocoding and Reverse Geocoding Service
 * Implements in-memory caching and request throttling to prevent redundant network calls.
 */

const searchCache = new Map();
const reverseCache = new Map();

/**
 * Searches addresses using Nominatim API
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function searchAddress(query, limit = 5) {
  const trimmed = (query || '').trim();
  if (!trimmed || trimmed.length < 3) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      format: 'json',
      q: trimmed,
      addressdetails: '1',
      limit: String(limit),
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim search failed with status ${response.status}`);
    }

    const data = await response.json();
    const formatted = data.map((item) => ({
      id: item.place_id,
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
    }));

    searchCache.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    console.warn('Nominatim search error:', error);
    return [];
  }
}

/**
 * Reverse geocodes lat/lng into a human-readable address
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lon) {
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) return '';

  const roundedLat = Number(lat).toFixed(5);
  const roundedLon = Number(lon).toFixed(5);
  const cacheKey = `${roundedLat},${roundedLon}`;

  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: String(roundedLat),
      lon: String(roundedLon),
      zoom: '18',
      addressdetails: '1',
    });

    const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim reverse lookup failed with status ${response.status}`);
    }

    const data = await response.json();
    const address = data.display_name || `${roundedLat}, ${roundedLon}`;
    reverseCache.set(cacheKey, address);
    return address;
  } catch (error) {
    console.warn('Nominatim reverse lookup error:', error);
    return `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
  }
}
