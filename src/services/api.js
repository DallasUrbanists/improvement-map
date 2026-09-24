/**
 * API client service for Dallas Urbanists Public Improvements Cloud API
 */
import { getCachedSuggestions, setCachedSuggestions } from './storage';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://api.dallasurbanists.org';

// In-memory cache
let suggestionsCache = null;
let suggestionsCacheTimestamp = 0;
const CACHE_TTL_MS = 25000; // 25 seconds TTL

const itemCache = new Map();

// Sample mock items for demo / fallback when offline or CORS blocked during local dev
const SEED_SUGGESTIONS = [
  {
    id: 'demo-sug-1',
    author: { name: 'Elena Rostova', email: 'elena@dallasurbanists.org' },
    content: {
      summary: 'Protected bidirectional bike lane on Main Street',
      details: 'Install concrete jersey barriers and dedicated bike traffic signals connecting Downtown with Deep Ellum to protect cyclists from fast turning traffic.',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=800&q=80',
          caption: 'Existing lack of barrier protection on Main St',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
        }
      ]
    },
    location: {
      latitude: 32.7812,
      longitude: -96.7932,
      address: 'Main St & S Harwood St, Dallas, TX 75201',
      description: 'Between St Paul St and Good Latimer Expy'
    },
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    status: 'open'
  },
  {
    id: 'demo-sug-2',
    author: { name: 'Marcus Vance', email: 'marcus@dallasurbanists.org' },
    content: {
      summary: 'High-visibility raised crosswalk and curb bulb-outs',
      details: 'Pedestrians crossing to the transit center experience dangerous close calls due to wide turn radii. Add curb extensions and raised crosswalks.',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
          caption: 'High pedestrian conflict zone near transit stop',
          timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ]
    },
    location: {
      latitude: 32.7767,
      longitude: -96.7970,
      address: 'Commerce St & S Akard St, Dallas, TX',
      description: 'Opposite Pegasus Plaza entrance'
    },
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    status: 'open'
  },
  {
    id: 'demo-sug-3',
    author: { name: 'Sarah Lin', email: 'sarah.lin@example.com' },
    content: {
      summary: 'Shaded bus shelter and real-time arrival display',
      details: 'This bus stop serves 4 major routes with no tree canopy or shade shelter, leaving riders exposed in 100°F summer heat.',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
          caption: 'Current unshaded bus stop pole',
          timestamp: new Date(Date.now() - 3600000 * 28).toISOString()
        }
      ]
    },
    location: {
      latitude: 32.7885,
      longitude: -96.8045,
      address: 'Ross Ave & N Field St, Dallas, TX',
      description: 'Northwest corner bus stop #402'
    },
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    status: 'open'
  },
  {
    id: 'demo-sug-4',
    author: { name: 'Jamal Washington', email: 'jamal.w@example.com' },
    content: {
      summary: 'Daylighting intersections with bike corrals',
      details: 'Remove 1 car parking space before each pedestrian crosswalk and install public bike parking to ensure sightlines for approaching drivers.',
      photos: []
    },
    location: {
      latitude: 32.7845,
      longitude: -96.7880,
      address: 'Elm St & N Good Latimer Expy, Dallas, TX',
      description: 'Deep Ellum entrance intersection'
    },
    createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
    status: 'open'
  }
];

// Pre-seed itemCache with demo suggestions
SEED_SUGGESTIONS.forEach(item => {
  itemCache.set(item.id, item);
});

/**
 * Normalize suggestion object
 */
function normalizeSuggestion(item) {
  if (!item) return null;
  const id = item.id || item._id || item.docId || String(Math.random());
  const content = item.content || {
    summary: item.summary || 'Civic Improvement Suggestion',
    details: item.details || '',
    photos: item.photos || []
  };
  const location = item.location || {
    latitude: item.latitude,
    longitude: item.longitude,
    address: item.address || '',
    description: item.locationDescription || item.description || ''
  };
  const author = item.author || {
    name: item.authorName || 'Anonymous Contributor',
    email: item.authorEmail || ''
  };
  const createdAt = item.createdAt || item.timestamp || item.created_at || new Date().toISOString();

  return {
    ...item,
    id,
    author,
    content,
    location,
    createdAt
  };
}

/**
 * Fetch all suggestions with caching and fallback
 * @param {boolean} forceRefresh
 * @returns {Promise<Array>}
 */
export async function getSuggestions(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && suggestionsCache && (now - suggestionsCacheTimestamp) < CACHE_TTL_MS) {
    return suggestionsCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/api/public-improvements/suggestions`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : (payload.data || payload.items || payload.suggestions || []);
    
    const normalized = items.map(normalizeSuggestion);

    // Merge with any demo seeds if empty
    const result = normalized.length > 0 ? normalized : SEED_SUGGESTIONS;

    suggestionsCache = result;
    suggestionsCacheTimestamp = now;
    setCachedSuggestions(result);

    // Populate itemCache
    result.forEach(item => {
      itemCache.set(item.id, item);
    });

    return result;
  } catch (error) {
    console.warn('API getSuggestions error (falling back to storage/seed cache):', error.message);
    const cached = getCachedSuggestions();
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      suggestionsCache = cached.data;
      return cached.data;
    }
    suggestionsCache = SEED_SUGGESTIONS;
    return SEED_SUGGESTIONS;
  }
}

/**
 * Fetch a single suggestion by ID
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getSuggestionById(id) {
  if (!id) throw new Error('Suggestion ID is required');

  if (itemCache.has(id)) {
    return itemCache.get(id);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/api/public-improvements/suggestions/${encodeURIComponent(id)}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Suggestion not found (HTTP ${response.status})`);
    }

    const data = await response.json();
    const item = normalizeSuggestion(data.data || data);
    itemCache.set(id, item);
    return item;
  } catch (error) {
    console.warn(`Error fetching suggestion ${id}, checking cached pool:`, error.message);
    const pool = await getSuggestions(false);
    const found = pool.find(item => String(item.id) === String(id));
    if (found) {
      itemCache.set(id, found);
      return found;
    }
    const seedFound = SEED_SUGGESTIONS.find(item => String(item.id) === String(id));
    if (seedFound) {
      itemCache.set(id, seedFound);
      return seedFound;
    }
    throw error;
  }
}

/**
 * Request signed GCS upload URL from API
 * @param {Object} param0
 * @returns {Promise<{ uploadUrl: string, publicUrl: string }>}
 */
export async function requestPhotoUploadUrl({ contentType = 'image/webp', filename = 'photo.webp' }) {
  const response = await fetch(`${API_BASE_URL}/api/public-improvements/suggestions/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contentType,
      filename,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.data?.uploadUrl) {
    throw new Error(data.message || data.error || `Failed to generate upload URL (HTTP ${response.status})`);
  }

  return data.data; // { uploadUrl, publicUrl }
}

/**
 * Upload image binary directly to Google Cloud Storage
 * @param {string} uploadUrl
 * @param {Blob} blob
 * @param {string} contentType
 * @returns {Promise<void>}
 */
export async function uploadPhotoBinary(uploadUrl, blob, contentType = 'image/webp') {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Direct GCS upload failed with HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Create a new civic suggestion
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function createSuggestion(payload) {
  const response = await fetch(`${API_BASE_URL}/api/public-improvements/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const resultData = await response.json();
  if (!response.ok) {
    throw new Error(resultData.message || resultData.error || `API returned HTTP ${response.status}`);
  }

  const newDoc = normalizeSuggestion(resultData.data || resultData);

  // Invalidate cache and prepend to local list
  if (suggestionsCache) {
    suggestionsCache = [newDoc, ...suggestionsCache];
  }
  itemCache.set(newDoc.id, newDoc);

  return newDoc;
}
