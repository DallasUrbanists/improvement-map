export const PRESENTATION_PROTOCOL_VERSION = 1;
export const DEFAULT_PRESENTATION_CAMERA = Object.freeze({ latitude: 32.7767, longitude: -96.797, zoom: 13 });
export const DEFAULT_PHOTO_FRAME = Object.freeze({ scale: 1, centerX: 0.5, centerY: 0.5 });
export const PRESENTATION_MODES = Object.freeze(['map', 'photo', 'description']);
export const MAX_MERCATOR_LATITUDE = 85.05112878;

export function createDefaultPresentationState(overrides = {}) {
  return {
    revision: 0,
    ideaEpoch: 0,
    selectedIdeaId: null,
    mode: 'map',
    camera: { ...DEFAULT_PRESENTATION_CAMERA },
    mapStyle: 'streets',
    railVisible: true,
    theme: 'dark',
    albumItemId: null,
    photoFrame: { ...DEFAULT_PHOTO_FRAME },
    captionVisible: true,
    descriptionPage: 0,
    audienceDisplay: { showQr: false, showCode: false },
    ...overrides,
    camera: { ...DEFAULT_PRESENTATION_CAMERA, ...overrides.camera },
    photoFrame: { ...DEFAULT_PHOTO_FRAME, ...overrides.photoFrame },
    audienceDisplay: { showQr: false, showCode: false, ...overrides.audienceDisplay },
  };
}

export function isValidCamera(camera) {
  return Boolean(camera && Number.isFinite(camera.latitude) && Number.isFinite(camera.longitude)
    && Number.isFinite(camera.zoom) && Math.abs(camera.latitude) <= MAX_MERCATOR_LATITUDE
    && camera.longitude >= -180 && camera.longitude <= 180 && camera.zoom >= 1 && camera.zoom <= 20);
}

export function isValidPhotoFrame(frame) {
  return Boolean(frame && Number.isFinite(frame.scale) && frame.scale >= 1 && frame.scale <= 4
    && Number.isFinite(frame.centerX) && frame.centerX >= 0 && frame.centerX <= 1
    && Number.isFinite(frame.centerY) && frame.centerY >= 0 && frame.centerY <= 1);
}

export function validatePresentationState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Number.isSafeInteger(value.revision) && value.revision >= 0
    && Number.isSafeInteger(value.ideaEpoch) && value.ideaEpoch >= 0
    && (value.selectedIdeaId === null || (typeof value.selectedIdeaId === 'string' && /^\d+$/.test(value.selectedIdeaId)))
    && (value.selectedIdeaId !== null || (value.mode === 'map' && value.albumItemId === null && value.descriptionPage === 0))
    && PRESENTATION_MODES.includes(value.mode) && isValidCamera(value.camera)
    && ['streets', 'satellite'].includes(value.mapStyle) && typeof value.railVisible === 'boolean'
    && ['light', 'dark'].includes(value.theme)
    && (value.albumItemId === null || typeof value.albumItemId === 'string')
    && isValidPhotoFrame(value.photoFrame) && typeof value.captionVisible === 'boolean'
    && Number.isSafeInteger(value.descriptionPage) && value.descriptionPage >= 0
    && Boolean(value.audienceDisplay && typeof value.audienceDisplay.showQr === 'boolean'
      && typeof value.audienceDisplay.showCode === 'boolean');
}

export function toWritablePresentationState(state) {
  return {
    selectedIdeaId: state.selectedIdeaId,
    mode: state.mode,
    camera: { ...state.camera },
    mapStyle: state.mapStyle,
    railVisible: state.railVisible,
    theme: state.theme,
    albumItemId: state.albumItemId,
    photoFrame: { ...state.photoFrame },
    captionVisible: state.captionVisible,
    descriptionPage: state.descriptionPage,
    audienceDisplay: { ...state.audienceDisplay },
  };
}

export function normalizePresentationCode(value) {
  const code = String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
  return /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code) ? code : '';
}

export function formatPresentationCode(value) {
  const code = normalizePresentationCode(value);
  return code ? `${code.slice(0, 4)} ${code.slice(4)}` : '';
}

export function createEnrollmentIdentity() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure browser randomness is unavailable.');
  const uuid = () => cryptoApi.randomUUID ? cryptoApi.randomUUID() : randomUuid(cryptoApi);
  const bytes = new Uint8Array(32);
  cryptoApi.getRandomValues(bytes);
  const token = bytesToBase64Url(bytes);
  return { participantId: uuid(), participantToken: token, idempotencyKey: uuid() };
}

function randomUuid(cryptoApi) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : globalThis.Buffer.from(bytes).toString('base64');
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function validatePresentationIdea(idea) {
  const validId = typeof idea?.id === 'string'
    ? /^\d+$/.test(idea.id)
    : typeof idea?.id === 'number' && Number.isSafeInteger(idea.id) && idea.id > 0;
  if (!idea || typeof idea !== 'object' || !validId
    || typeof idea.contentVersion !== 'string'
    || typeof idea.summary !== 'string' || typeof idea.details !== 'string'
    || !Array.isArray(idea.descriptionPages) || !idea.descriptionPages.every(page => typeof page === 'string')
    || !idea.location || typeof idea.location !== 'object' || !Array.isArray(idea.album)) return false;
  let sawStreetmix = false;
  for (const [index, item] of idea.album.entries()) {
    if (!item || typeof item.id !== 'string' || !item.id || !['photo', 'streetmix'].includes(item.kind) || typeof item.url !== 'string') return false;
    if (item.kind === 'streetmix') {
      if (sawStreetmix || index !== idea.album.length - 1 || !safePresentationStreetmixUrl(item.url)
        || typeof item.streetmixId !== 'string' || !item.streetmixId
        || typeof item.thumbnailPath !== 'string' || !item.thumbnailPath.startsWith(`/api/public-improvements/presentation/sessions/`)) return false;
      sawStreetmix = true;
    } else {
      if (sawStreetmix || (item.caption !== undefined && typeof item.caption !== 'string')) return false;
      try {
        const mediaUrl = new URL(item.url);
        if (mediaUrl.protocol !== 'https:' || mediaUrl.username || mediaUrl.password) return false;
      } catch { return false; }
    }
  }
  return true;
}

export function normalizePresentationIdea(idea) {
  return validatePresentationIdea(idea) ? { ...idea, id: String(idea.id) } : null;
}

export function safePresentationStreetmixUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://streetmix.net' && /^\/-\/\d+$/.test(url.pathname)
      && !url.search && !url.hash && !url.username && !url.password && url.href === `${url.origin}${url.pathname}`;
  } catch { return false; }
}

export function getPresentationAlbum(idea) {
  return Array.isArray(idea?.album) ? idea.album : [];
}

export function getAlbumItem(idea, id) {
  return getPresentationAlbum(idea).find(item => item.id === id) || null;
}

export function isStreetmixItem(item) {
  return item?.kind === 'streetmix';
}

export function effectiveCaptionVisible(state, item) {
  return Boolean(state.captionVisible && !isStreetmixItem(item));
}

export function normalizeStreetmixFrame(frame, item) {
  return isStreetmixItem(item) ? { ...DEFAULT_PHOTO_FRAME } : { ...DEFAULT_PHOTO_FRAME, ...frame };
}

export function clampPhotoFrame(frame, { minScale = 1, maxScale = 4 } = {}) {
  const scale = Math.min(maxScale, Math.max(minScale, Number(frame?.scale) || 1));
  return {
    scale,
    centerX: Math.min(1, Math.max(0, Number(frame?.centerX ?? 0.5))),
    centerY: Math.min(1, Math.max(0, Number(frame?.centerY ?? 0.5))),
  };
}

export function reduceAudienceView(local, action, shared, idea) {
  const album = getPresentationAlbum(idea);
  const next = { ...local, photoFrame: { ...local.photoFrame } };
  switch (action.type) {
    case 'tab':
      if (PRESENTATION_MODES.includes(action.mode)) next.mode = action.mode;
      break;
    case 'photo':
      next.albumItemId = album[action.index]?.id ?? next.albumItemId;
      next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
      next.photoDetached = true;
      break;
    case 'descriptionPage':
      next.descriptionPage = Math.max(0, Math.min((idea?.descriptionPages?.length || 1) - 1, action.page));
      next.descriptionDetached = true;
      break;
    case 'camera':
      next.camera = { ...action.camera };
      next.mapDetached = true;
      break;
    case 'photoFrame': {
      const item = getAlbumItem(idea, next.albumItemId);
      if (!isStreetmixItem(item)) {
        next.photoFrame = clampPhotoFrame(action.frame);
        next.photoDetached = true;
      }
      break;
    }
    case 'return':
      next.mode = shared.mode;
      next.albumItemId = shared.albumItemId;
      next.photoFrame = { ...shared.photoFrame };
      next.camera = { ...shared.camera };
      next.descriptionPage = shared.descriptionPage;
      next.mapDetached = false;
      next.photoDetached = false;
      next.descriptionDetached = false;
      break;
    case 'newIdea':
      next.ideaEpoch = shared.ideaEpoch;
      next.albumItemId = album[0]?.id ?? null;
      next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
      next.descriptionPage = 0;
      next.camera = { ...shared.camera };
      next.mapDetached = false;
      next.photoDetached = false;
      next.descriptionDetached = false;
      break;
  }
  return next;
}

export function shouldFollowPresenter(local, shared, connected = true) {
  if (!connected || local.mode !== shared.mode) return false;
  if (local.mode === 'map') return !local.mapDetached;
  if (local.mode === 'photo') return !local.photoDetached;
  return !local.descriptionDetached;
}

export function createAudienceView(shared = createDefaultPresentationState(), idea = null) {
  return {
    mode: shared.mode,
    ideaEpoch: shared.ideaEpoch,
    albumItemId: shared.albumItemId || getPresentationAlbum(idea)[0]?.id || null,
    photoFrame: { ...shared.photoFrame },
    camera: { ...shared.camera },
    descriptionPage: shared.descriptionPage,
    mapDetached: false,
    photoDetached: false,
    descriptionDetached: false,
  };
}

export function applyControllerChanges(state, changes, idea = null) {
  const next = { ...state, ...changes, camera: { ...state.camera, ...changes.camera },
    photoFrame: { ...state.photoFrame, ...changes.photoFrame },
    audienceDisplay: { ...state.audienceDisplay, ...changes.audienceDisplay } };
  if (Object.hasOwn(changes, 'selectedIdeaId') && String(changes.selectedIdeaId ?? '') !== String(state.selectedIdeaId ?? '')) {
    next.albumItemId = idea?.album?.[0]?.id || null;
    next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
    next.descriptionPage = 0;
    if (Number.isFinite(idea?.location?.latitude) && Number.isFinite(idea?.location?.longitude)) {
      next.camera = { latitude: idea.location.latitude, longitude: idea.location.longitude, zoom: 16 };
    }
    if (!changes.selectedIdeaId) next.mode = 'map';
    else if (!idea?.album?.length) next.mode = 'description';
  }
  if (Object.hasOwn(changes, 'albumItemId')) {
    next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
  }
  const item = getAlbumItem(idea, next.albumItemId);
  if (isStreetmixItem(item)) next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
  return next;
}
