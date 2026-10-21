import { API_BASE_URL } from './apiBaseUrl.js';
import { PRESENTATION_PROTOCOL_VERSION, createEnrollmentIdentity, normalizePresentationCode } from './presentationState.js';

export const PRESENTATION_API_PATH = '/api/public-improvements/presentation';
const ACTIVE_KEY = 'presentation-active-v1';
const PENDING_PREFIX = 'presentation-pending-v1:';

export class PresentationApiError extends Error {
  constructor(status, body, retryAfterMs = 0) {
    super(typeof body?.message === 'string' ? body.message : `Presentation service returned HTTP ${status}.`);
    this.name = 'PresentationApiError';
    this.status = status;
    this.code = typeof body?.error === 'string' ? body.error : 'PRESENTATION_UNAVAILABLE';
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

function storage() {
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function readJson(key) {
  try {
    const value = storage()?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function writeJson(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return Boolean(storage());
  } catch { return false; }
}

function removeStored(key) {
  try { storage()?.removeItem(key); } catch { /* Private mode can reject storage operations. */ }
}

export function getActivePresentationCredential() {
  const value = readJson(ACTIVE_KEY);
  if (!value || !['receiver', 'controller', 'audience'].includes(value.role)
    || typeof value.sessionId !== 'string' || typeof value.participantId !== 'string'
    || typeof value.participantToken !== 'string') return null;
  return value;
}

export function saveActivePresentationCredential(value) {
  return writeJson(ACTIVE_KEY, value);
}

export function clearActivePresentationCredential() {
  removeStored(ACTIVE_KEY);
  for (const role of ['receiver', 'controller', 'audience']) removeStored(PENDING_PREFIX + role);
}

export function clearPresentationCredentialForRole(role) {
  const value = getActivePresentationCredential();
  if (value?.role === role) removeStored(ACTIVE_KEY);
  removeStored(PENDING_PREFIX + role);
}

function pendingEnrollment(role, code, reuse = true) {
  const key = PENDING_PREFIX + role;
  const pending = readJson(key);
  if (reuse && pending && pending.code === code && pending.body?.participantId && pending.idempotencyKey) return pending;
  const identity = createEnrollmentIdentity();
  const body = {
    protocolVersion: PRESENTATION_PROTOCOL_VERSION,
    participantId: identity.participantId,
    participantToken: identity.participantToken,
    ...(code ? { code } : {}),
  };
  const value = { body, idempotencyKey: identity.idempotencyKey, code, createdAt: Date.now() };
  if (!writeJson(key, value)) throw new Error('Session storage is unavailable; presentation credentials cannot be kept safely in this browser tab.');
  return value;
}

function retryDelay(value) {
  if (!value) return 0;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Math.min(60000, Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(60000, date - Date.now())) : 0;
}

function authHeaders(credential) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credential.participantToken}`,
    'X-Presentation-Participant': credential.participantId,
  };
}

async function request(path, { method = 'GET', body, credential, idempotencyKey, signal, json = true } = {}) {
  const headers = { Accept: json ? 'application/json' : 'image/png' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (credential) Object.assign(headers, authHeaders(credential));
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${API_BASE_URL}${PRESENTATION_API_PATH}${path}`, {
    method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    cache: 'no-store', credentials: 'omit',
  });
  const responseBody = response.status === 204 ? null : json
    ? await response.json().catch(() => null)
    : await response.blob().catch(() => null);
  if (!response.ok) throw new PresentationApiError(response.status, responseBody, retryDelay(response.headers.get('Retry-After')));
  if (json && responseBody && responseBody.protocolVersion !== PRESENTATION_PROTOCOL_VERSION) {
    throw new PresentationApiError(426, { error: 'PROTOCOL_UNSUPPORTED', message: 'This presentation uses a newer protocol. Update the app and try again.' });
  }
  return responseBody;
}

function enrolledCredential(role, result, pending) {
  if (!result || !result.sessionId || result.participantId !== pending.body.participantId || result.role !== role) {
    throw new PresentationApiError(502, { error: 'INVALID_ENROLLMENT_RESPONSE', message: 'The presentation service returned an invalid enrollment response.' });
  }
  const credential = {
    role,
    sessionId: result.sessionId,
    participantId: pending.body.participantId,
    participantToken: pending.body.participantToken,
    expiresAt: result.expiresAt,
    ...(role === 'receiver' ? {
      presenterCode: result.presenterCode,
      presenterCodeExpiresAt: result.presenterCodeExpiresAt,
      audienceCode: result.audienceCode,
    } : role === 'controller' ? { audienceCode: result.audienceCode } : { displayName: result.displayName }),
  };
  if (!saveActivePresentationCredential(credential)) {
    throw new Error('This browser could not safely save the presentation connection. Check session storage and try again.');
  }
  removeStored(PENDING_PREFIX + role);
  return { credential, result };
}

export async function createReceiverEnrollment({ signal } = {}) {
  const pending = pendingEnrollment('receiver', '', true);
  const result = await request('/sessions', { method: 'POST', body: pending.body, idempotencyKey: pending.idempotencyKey, signal });
  return enrolledCredential('receiver', result, pending);
}

export async function pairController(codeInput, { signal } = {}) {
  const code = normalizePresentationCode(codeInput);
  if (!code) throw new Error('Enter the eight-character presenter code.');
  const pending = pendingEnrollment('controller', code, true);
  const result = await request('/pair', { method: 'POST', body: pending.body, idempotencyKey: pending.idempotencyKey, signal });
  return enrolledCredential('controller', result, pending);
}

export async function joinAudience(codeInput, { signal } = {}) {
  const code = normalizePresentationCode(codeInput);
  if (!code) throw new Error('Enter the eight-character audience viewing code.');
  const pending = pendingEnrollment('audience', code, true);
  const result = await request('/audience/join', { method: 'POST', body: pending.body, idempotencyKey: pending.idempotencyKey, signal });
  return enrolledCredential('audience', result, pending);
}

export async function syncPresentation(credential, payload, { signal } = {}) {
  return request(`/sessions/${encodeURIComponent(credential.sessionId)}/sync`, {
    method: 'POST', body: { protocolVersion: PRESENTATION_PROTOCOL_VERSION, ...payload }, credential, signal,
  });
}

export async function writePresentationState(credential, payload, idempotencyKey, { signal } = {}) {
  return request(`/sessions/${encodeURIComponent(credential.sessionId)}/state`, {
    method: 'PUT', body: { protocolVersion: PRESENTATION_PROTOCOL_VERSION, ...payload }, credential, idempotencyKey, signal,
  });
}

export async function loadPresentationIdeas(credential, { signal } = {}) {
  const items = [];
  const seenCursors = new Set();
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await request(`/sessions/${encodeURIComponent(credential.sessionId)}/ideas?${query}`, { credential, signal });
    if (!Array.isArray(page.items) || !Object.hasOwn(page, 'nextCursor') || (page.nextCursor !== null && typeof page.nextCursor !== 'string')) {
      throw new PresentationApiError(502, { error: 'INVALID_CATALOG', message: 'The idea catalog could not be read.' });
    }
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== null && (typeof cursor !== 'string' || seenCursors.has(cursor))) {
      throw new PresentationApiError(502, { error: 'INVALID_CATALOG_CURSOR', message: 'The idea catalog returned an invalid page cursor.' });
    }
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return items;
}

export async function loadPresentationIdea(credential, ideaId, { signal } = {}) {
  const result = await request(`/sessions/${encodeURIComponent(credential.sessionId)}/ideas/${encodeURIComponent(ideaId)}`, { credential, signal });
  return result.idea;
}

export async function loadStreetmixThumbnail(credential, ideaId, { signal } = {}) {
  return request(`/sessions/${encodeURIComponent(credential.sessionId)}/ideas/${encodeURIComponent(ideaId)}/streetmix-thumbnail`, { credential, signal, json: false });
}

export async function rotatePresenterCode(credential, { signal } = {}) {
  const persisted = getActivePresentationCredential();
  const idempotencyKey = credential.pendingPairingRotation || (persisted?.sessionId === credential.sessionId && persisted.pendingPairingRotation)
    || createEnrollmentIdentity().idempotencyKey;
  const pending = { ...credential, pendingPairingRotation: idempotencyKey };
  if (!saveActivePresentationCredential(pending)) {
    throw new Error('This browser could not safely save the replacement pairing request. Check session storage and try again.');
  }
  const result = await request(`/sessions/${encodeURIComponent(credential.sessionId)}/pairing`, {
    method: 'POST', body: { protocolVersion: PRESENTATION_PROTOCOL_VERSION }, credential: pending, idempotencyKey, signal,
  });
  const recovered = { ...pending, ...result };
  delete recovered.pendingPairingRotation;
  if (!saveActivePresentationCredential(recovered)) {
    throw new Error('The new pairing code is ready, but this browser could not save it. Retry pairing from the TV.');
  }
  return result;
}

export async function leavePresentation(credential, { signal } = {}) {
  return request(`/sessions/${encodeURIComponent(credential.sessionId)}/participants/me`, { method: 'DELETE', credential, signal });
}

export async function endPresentation(credential, { signal } = {}) {
  return request(`/sessions/${encodeURIComponent(credential.sessionId)}`, { method: 'DELETE', credential, signal });
}

export function presentationIsEnabled() {
  const configured = import.meta.env.VITE_PRESENTATION_ENABLED;
  return configured === undefined || configured === '' ? Boolean(import.meta.env.DEV) : configured === 'true';
}
