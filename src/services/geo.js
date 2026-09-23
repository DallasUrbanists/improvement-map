import { point, distance } from '@turf/turf';

/**
 * Calculates distance between two coordinates using Turf JS
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @param {'miles'|'kilometers'|'meters'} units
 * @returns {number}
 */
export function calculateDistance(lat1, lon1, lat2, lon2, units = 'miles') {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return Infinity;
  }

  const from = point([lon1, lat1]);
  const to = point([lon2, lat2]);
  return distance(from, to, { units });
}

/**
 * Formats a distance in miles into a readable string (ft or mi)
 * @param {number} miles
 * @returns {string}
 */
export function formatDistance(miles) {
  if (!isFinite(miles) || miles < 0) return '';
  if (miles < 0.1) {
    const feet = Math.round(miles * 5280);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Sorts suggestions by distance from user coordinates using Turf JS
 * @param {Array} suggestions
 * @param {number} userLat
 * @param {number} userLng
 * @returns {Array}
 */
export function sortSuggestionsByDistance(suggestions, userLat, userLng) {
  if (!Array.isArray(suggestions)) return [];
  if (userLat === undefined || userLng === undefined || isNaN(userLat) || isNaN(userLng)) {
    // If no user location, sort by timestamp newest first
    return [...suggestions].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }

  return [...suggestions].map(item => {
    const itemLat = item.location?.latitude ?? item.latitude;
    const itemLng = item.location?.longitude ?? item.longitude;
    const dist = calculateDistance(userLat, userLng, itemLat, itemLng, 'miles');
    return {
      ...item,
      _distanceMiles: dist,
      _formattedDistance: formatDistance(dist)
    };
  }).sort((a, b) => a._distanceMiles - b._distanceMiles);
}

/**
 * Validates coordinate numbers
 */
export function isValidCoordinate(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
