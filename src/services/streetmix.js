import { API_BASE_URL, apiHeaders } from './api';

export const streetmixPath = id => `/api/suggestions/${encodeURIComponent(id)}/streetmix`;
// Streetmix sends CORP: same-origin. Fetch through our authenticated PNG relay,
// then use a local blob URL; never send our credentials to Streetmix.
export async function fetchStreetmixThumbnail(id, { signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${streetmixPath(id)}/thumbnail`, {
    headers: await apiHeaders({ Accept: 'image/png' }), cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  if (!response.ok || response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'image/png') throw new Error('Preview unavailable.');
  const image = await response.blob();
  if (!image.size || image.size > 5 * 1024 * 1024) throw new Error('Preview unavailable.');
  return image;
}
export function safeStreetmixUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://streetmix.net' && /^\/-\/\d+$/.test(url.pathname) &&
      !url.username && !url.password && !url.search && !url.hash && url.href === `${url.origin}${url.pathname}` ? url.href : '';
  } catch { return ''; }
}
export function canReplaceStreetmix(suggestion, user, staff) {
  if (!user) return false;
  return staff || [suggestion.author?.uid, suggestion.authorUid, suggestion.authorId, suggestion.userId, suggestion.createdBy].some(id => typeof id === 'string' && id === user.uid) || Boolean(user.emailVerified && user.email && suggestion.author?.email?.toLowerCase() === user.email.toLowerCase());
}
export async function streetmixRequest(path, { operation, signal } = {}) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 120000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: operation ? 'POST' : 'GET',
      headers: await apiHeaders({ Accept: 'application/json', ...(operation ? {
        'Content-Type': 'application/json', 'Idempotency-Key': operation.key,
        ...(operation.etag ? { 'If-Match': operation.etag } : {}),
      } : {}) }),
      ...(operation ? { body: operation.body } : {}),
      signal: signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal,
      cache: 'no-store',
    });
    const body = await response.json();
    const retry = response.headers.get('Retry-After');
    const retryMs = retry === null ? 0 : /^\d+(\.\d+)?$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) || 0;
    return { body, status: response.status, etag: response.headers.get('ETag'), retryMs };
  } finally { clearTimeout(timer); }
}

const storageKey = id => `streetmix-operation-v1:${id}`;
export function readStreetmixOperation(id) {
  try {
    const op = JSON.parse(localStorage.getItem(storageKey(id)));
    const base = streetmixPath(id);
    if (!op || String(op.suggestionId) !== String(id) || typeof op.key !== 'string' || typeof op.body !== 'string') return null;
    if (![base, `${base}/regenerate`].includes(op.path) && !new RegExp(`^${base}/requests/[^/]+/selection$`).test(op.path)) return null;
    const body = JSON.parse(op.body);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'osmWayId')) return null;
    // Only retain fields needed to repeat a phase; never tokens or headers.
    return { suggestionId: id, path: op.path, body: op.body, key: op.key, requestId: op.requestId, etag: op.etag, regeneration: Boolean(op.regeneration) };
  } catch { return null; }
}
export function saveStreetmixOperation(id, op) {
  if (op) localStorage.setItem(storageKey(id), JSON.stringify(op));
  else localStorage.removeItem(storageKey(id));
}
