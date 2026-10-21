import { computed, reactive } from 'vue';
import {
  createAudienceView, createDefaultPresentationState,
  getAlbumItem, getPresentationAlbum, isStreetmixItem, isValidCamera,
  reduceAudienceView, shouldFollowPresenter, toWritablePresentationState,
  validatePresentationIdea, validatePresentationState,
} from './presentationState.js';
import {
  PresentationApiError, clearActivePresentationCredential, clearPresentationCredentialForRole,
  createReceiverEnrollment, endPresentation, getActivePresentationCredential, joinAudience,
  leavePresentation, loadPresentationIdea, loadPresentationIdeas, pairController,
  rotatePresenterCode as rotatePresenterCodeRequest, saveActivePresentationCredential, syncPresentation, writePresentationState,
} from './presentationApi.js';

const defaultState = () => createDefaultPresentationState();
const session = reactive({
  role: null,
  credential: null,
  status: 'disconnected',
  state: defaultState(),
  content: null,
  participants: [],
  receiver: null,
  localView: null,
  catalog: [],
  catalogLoaded: false,
  lastSuccessAt: 0,
  error: '',
  errorCode: '',
  renderStatus: 'loading',
  renderError: null,
  reportedRevision: -1,
  finder: { query: '', sort: 'newest', filter: 'all', placeQuery: '', placeResults: [], placeError: '' },
  audienceView: createAudienceView(),
  pendingChanges: {},
  pending: false,
});

let pollTimer = null;
let pollInFlight = false;
let pollAbort = null;
let writeInFlight = false;
let writeAbort = null;
let writeEpoch = 0;
let writeTimer = null;
let reconnectDelay = 1000;
let stopped = true;
let receiverSetupSnapshot = null;
let lastRequestRevision = -1;
let lastContentVersion = null;
let localAudienceIdeaEpoch = null;
let callbackRevision = 0;
let latestAppliedEnvelopeSequence = 0;
let inflightChanges = {};

const rolePollInterval = { receiver: 500, audience: 1000, controller: 2000 };
const terminalCodes = new Set(['SESSION_EXPIRED', 'SESSION_ENDED', 'INVALID_SESSION_CREDENTIAL', 'ROLE_FORBIDDEN']);

export const presentationSession = session;
export const writableViewState = computed(() => ({
  ...session.state,
  ...session.pendingChanges,
  camera: { ...session.state.camera, ...session.pendingChanges.camera },
  photoFrame: { ...session.state.photoFrame, ...session.pendingChanges.photoFrame },
  audienceDisplay: { ...session.state.audienceDisplay, ...session.pendingChanges.audienceDisplay },
}));
export const selectedAlbumItem = computed(() => getAlbumItem(session.content, writableViewState.value.albumItemId));
export const audienceFollowing = computed(() => shouldFollowPresenter(session.audienceView, writableViewState.value, ['active', 'reconnecting'].includes(session.status)));
export const audienceDisplayedState = computed(() => {
  const shared = writableViewState.value;
  const view = session.audienceView;
  const following = audienceFollowing.value;
  return {
    ...shared,
    mode: view.mode,
    camera: following && view.mode === 'map' ? shared.camera : view.camera,
    albumItemId: following && view.mode === 'photo' ? shared.albumItemId : view.albumItemId,
    photoFrame: following && view.mode === 'photo' ? shared.photoFrame : view.photoFrame,
    descriptionPage: following && view.mode === 'description' ? shared.descriptionPage : view.descriptionPage,
  };
});

function persistCredential() {
  return !session.credential || saveActivePresentationCredential(session.credential);
}

function clearTimers() {
  if (pollTimer) clearTimeout(pollTimer);
  if (writeTimer) clearTimeout(writeTimer);
  pollTimer = null;
  writeTimer = null;
}

function resetSession() {
  stopped = true;
  clearTimers();
  pollAbort?.abort();
  writeAbort?.abort();
  writeAbort = null;
  writeEpoch++;
  pollAbort = null;
  pollInFlight = false;
  writeInFlight = false;
  session.role = null;
  session.credential = null;
  session.status = 'disconnected';
  session.state = defaultState();
  session.content = null;
  session.participants = [];
  session.receiver = null;
  session.localView = null;
  session.catalog = [];
  session.catalogLoaded = false;
  session.lastSuccessAt = 0;
  session.error = '';
  session.errorCode = '';
  session.reportedRevision = -1;
  session.pendingChanges = {};
  session.pending = false;
  inflightChanges = {};
  session.audienceView = createAudienceView();
  lastRequestRevision = -1;
  lastContentVersion = null;
  localAudienceIdeaEpoch = null;
  receiverSetupSnapshot = null;
}

function terminal(error) {
  return error instanceof PresentationApiError && terminalCodes.has(error.code);
}

function retryableWriteFailure(error) {
  return !(error instanceof PresentationApiError) || error.status === 429 || error.status >= 500;
}

function onTransportFailure(error) {
  session.error = error?.message || 'The presentation service is unavailable.';
  session.errorCode = error?.code || 'PRESENTATION_UNAVAILABLE';
  if (terminal(error)) {
    clearPresentationCredentialForRole(session.role);
    stopPresentationSession();
    session.credential = null;
    session.status = 'ended';
  } else if (session.lastSuccessAt && Date.now() - session.lastSuccessAt >= 5000) {
    session.status = 'reconnecting';
  }
  reconnectDelay = Math.min(10000, Math.max(error?.retryAfterMs || 0, reconnectDelay * 2));
}

function applyEnvelope(envelope, sequence = ++callbackRevision) {
  if (sequence < latestAppliedEnvelopeSequence) return false;
  if (!envelope?.session || typeof envelope.session.revision !== 'number') return false;
  const revision = envelope.session.revision;
  if (revision < session.state.revision) return false;
  if (envelope.state) {
    if (!validatePresentationState(envelope.state)) throw new Error('The presentation service returned invalid display settings.');
    session.state = envelope.state;
  }
  if (envelope.content !== undefined) {
    if (envelope.content === null) {
      if (session.state.selectedIdeaId === null
        || (session.content?.id !== session.state.selectedIdeaId
          && session.pendingChanges.selectedIdeaId !== session.content?.id
          && inflightChanges.selectedIdeaId !== session.content?.id)) {
        session.content = null;
        lastContentVersion = null;
      }
    } else if (validatePresentationIdea(envelope.content)) {
      session.content = envelope.content;
      lastContentVersion = envelope.content.contentVersion;
    } else {
      throw new Error('The presentation service returned invalid idea content.');
    }
  } else if (session.state.selectedIdeaId === null
    || (session.content?.id !== session.state.selectedIdeaId
      && session.pendingChanges.selectedIdeaId !== session.content?.id
      && inflightChanges.selectedIdeaId !== session.content?.id)) {
    session.content = null;
    lastContentVersion = null;
  }
  if (Array.isArray(envelope.participants)) session.participants = envelope.participants;
  if (envelope.audienceCode) {
    session.credential = { ...session.credential, audienceCode: envelope.audienceCode };
    persistCredential();
  }
  if (Object.hasOwn(envelope, 'receiver')) session.receiver = envelope.receiver;
  session.status = envelope.session.status;
  latestAppliedEnvelopeSequence = sequence;
  session.lastSuccessAt = Date.now();
  session.error = '';
  session.errorCode = '';
  reconnectDelay = 1000;
  lastRequestRevision = revision;
  if (session.role === 'audience' && localAudienceIdeaEpoch !== session.state.ideaEpoch) {
    session.audienceView = reduceAudienceView(session.audienceView, { type: 'newIdea' }, session.state, session.content);
    localAudienceIdeaEpoch = session.state.ideaEpoch;
  }
  if (['ended', 'expired'].includes(session.status)) {
    clearPresentationCredentialForRole(session.role);
    stopPresentationSession();
    session.credential = null;
  }
  return true;
}

async function syncOnce(force = false) {
  if (!session.credential || pollInFlight || stopped) return;
  pollInFlight = true;
  const sequence = ++callbackRevision;
  pollAbort = new AbortController();
  const presence = session.role === 'audience'
    ? { ...(session.audienceView?.mode ? { localView: session.audienceView.mode } : {}) }
    : session.role === 'receiver'
      ? { appliedRevision: session.reportedRevision, viewport: { width: window.innerWidth, height: window.innerHeight }, renderStatus: session.renderStatus, renderError: session.renderError }
      : {};
  try {
    const envelope = await syncPresentation(session.credential, {
      lastRevision: force ? -1 : lastRequestRevision,
      lastContentVersion: force ? null : lastContentVersion,
      presence,
    }, { signal: pollAbort.signal });
    applyEnvelope(envelope, sequence);
    session.pending = Object.keys(session.pendingChanges).length > 0 || writeInFlight;
  } catch (error) {
    if (error?.name !== 'AbortError') onTransportFailure(error);
  } finally {
    pollInFlight = false;
    pollAbort = null;
  }
}

function schedulePoll(delay = rolePollInterval[session.role] || 2000) {
  if (stopped || !session.credential) return;
  if (pollTimer) clearTimeout(pollTimer);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    pollTimer = setTimeout(() => schedulePoll(delay), 5000);
    return;
  }
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    await syncOnce(false);
    const age = Date.now() - session.lastSuccessAt;
    if (age >= 5000 && session.status !== 'ended' && session.status !== 'expired') session.status = 'reconnecting';
    schedulePoll(session.status === 'reconnecting' ? reconnectDelay : rolePollInterval[session.role]);
  }, delay);
}

async function startPresentationSession(credential, initialState, content = null) {
  stopPresentationSession();
  session.credential = credential;
  session.role = credential.role;
  session.state = defaultState();
  session.content = null;
  session.participants = [];
  session.receiver = null;
  session.catalog = [];
  session.catalogLoaded = false;
  session.reportedRevision = -1;
  session.pendingChanges = {};
  session.pending = false;
  session.finder = { query: '', sort: 'newest', filter: 'all', placeQuery: '', placeResults: [], placeError: '' };
  inflightChanges = credential.role === 'controller' && credential.pendingMutation?.sentChanges
    ? { ...credential.pendingMutation.sentChanges } : {};
  session.pendingChanges = { ...inflightChanges };
  session.pending = Object.keys(session.pendingChanges).length > 0;
  session.audienceView = createAudienceView();
  localAudienceIdeaEpoch = null;
  lastContentVersion = null;
  session.status = initialState?.session?.status || 'waiting';
  if (initialState?.state && validatePresentationState(initialState.state)) session.state = initialState.state;
  else if (initialState && validatePresentationState(initialState)) session.state = initialState;
  if (content && validatePresentationIdea(content)) session.content = content;
  if (initialState?.content && validatePresentationIdea(initialState.content)) session.content = initialState.content;
  if (session.content) lastContentVersion = session.content.contentVersion;
  session.lastSuccessAt = Date.now();
  session.error = '';
  session.errorCode = '';
  stopped = false;
  await syncOnce(true);
  if (Object.keys(session.pendingChanges).length) flushPresentationChanges();
  schedulePoll(rolePollInterval[session.role]);
}

export function stopPresentationSession() {
  stopped = true;
  clearTimers();
  pollAbort?.abort();
  writeAbort?.abort();
  writeAbort = null;
  writeEpoch++;
  writeInFlight = false;
}

export async function restorePresentationSession() {
  const credential = getActivePresentationCredential();
  if (!credential) return false;
  if (session.credential?.sessionId === credential.sessionId && !stopped) return true;
  await startPresentationSession(credential, null);
  return true;
}

export async function startReceiver(snapshot = null) {
  session.error = '';
  receiverSetupSnapshot = snapshot;
  const { credential, result } = await createReceiverEnrollment();
  await startPresentationSession(credential, result);
  return credential;
}

export async function connectController(code) {
  session.error = '';
  const { credential, result } = await pairController(code);
  await startPresentationSession(credential, result);
  let browseSnapshot = receiverSetupSnapshot;
  try {
    if (!browseSnapshot) browseSnapshot = JSON.parse(localStorage.getItem('presentation-browse-snapshot-v1') || 'null');
    localStorage.removeItem('presentation-browse-snapshot-v1');
  } catch { browseSnapshot = null; }
  if (browseSnapshot?.selectedIdeaId || browseSnapshot?.camera) {
    try {
      let selectedIdeaId = null;
      if (browseSnapshot.selectedIdeaId) {
        const idea = await loadPresentationIdea(credential, String(browseSnapshot.selectedIdeaId));
        if (validatePresentationIdea(idea)) {
          session.content = idea;
          selectedIdeaId = idea.id;
        }
      }
      if (selectedIdeaId) enqueuePresentationChanges({ selectedIdeaId }, { immediate: true });
      if (isValidCamera(browseSnapshot.camera)) {
        // The protocol centers the map whenever the selected idea changes. Apply
        // the captured Browse camera as a following mutation so it stays intact.
        if (selectedIdeaId) await new Promise(resolve => setTimeout(resolve, 0));
        enqueuePresentationChanges({ camera: browseSnapshot.camera }, { immediate: true });
      }
    } catch { /* A missing browse selection does not block pairing. */ }
    receiverSetupSnapshot = null;
  }
  return credential;
}

export async function connectAudience(code) {
  session.error = '';
  const { credential, result } = await joinAudience(code);
  await startPresentationSession(credential, result);
  return credential;
}

export function enqueuePresentationChanges(changes, { immediate = false } = {}) {
  if (session.role !== 'controller' || session.status === 'ended' || !session.credential) return false;
  const merged = { ...session.pendingChanges, ...changes };
  for (const nested of ['camera', 'photoFrame', 'audienceDisplay']) {
    if (changes[nested]) merged[nested] = { ...(session.pendingChanges[nested] || session.state[nested]), ...changes[nested] };
  }
  const item = getAlbumItem(session.content, merged.albumItemId ?? session.state.albumItemId);
  if (isStreetmixItem(item)) merged.photoFrame = { scale: 1, centerX: 0.5, centerY: 0.5 };
  session.pendingChanges = merged;
  session.pending = true;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { writeTimer = null; flushPresentationChanges(); }, immediate ? 0 : 500);
  return true;
}

async function flushPresentationChanges() {
  if (writeInFlight || session.role !== 'controller' || !session.credential || !Object.keys(session.pendingChanges).length) return;
  const epoch = writeEpoch;
  const requestCredential = session.credential;
  const abortController = new AbortController();
  writeAbort = abortController;
  writeInFlight = true;
  const requestRecord = requestCredential.pendingMutation || null;
  const queuedChanges = { ...session.pendingChanges };
  session.pendingChanges = {};
  const sentChanges = requestRecord?.sentChanges || queuedChanges;
  if (requestRecord) {
    for (const [field, value] of Object.entries(sentChanges)) {
      if (JSON.stringify(queuedChanges[field]) === JSON.stringify(value)) delete queuedChanges[field];
    }
    session.pendingChanges = queuedChanges;
  }
  inflightChanges = sentChanges;
  const sentEpoch = requestRecord?.sentEpoch ?? session.state.ideaEpoch;
  const body = requestRecord?.body || {
    baseRevision: session.state.revision,
    state: toWritablePresentationState({ ...session.state, ...sentChanges,
      camera: { ...session.state.camera, ...sentChanges.camera },
      photoFrame: { ...session.state.photoFrame, ...sentChanges.photoFrame },
      audienceDisplay: { ...session.state.audienceDisplay, ...sentChanges.audienceDisplay },
    }),
  };
  const key = requestRecord?.key || globalThis.crypto.randomUUID();
  const savedRecord = { key, body, sentChanges, sentEpoch };
  session.credential = { ...session.credential, pendingMutation: savedRecord };
  try {
    if (!persistCredential()) {
      session.credential = requestCredential;
      session.pendingChanges = { ...sentChanges, ...session.pendingChanges };
      inflightChanges = {};
      session.pending = true;
      session.error = 'This browser could not safely save the display update. Check session storage and try again.';
      session.errorCode = 'SESSION_STORAGE_UNAVAILABLE';
      return;
    }
    let result;
    try {
      result = await writePresentationState(requestCredential, body, key, { signal: abortController.signal });
    } catch (error) {
      if (epoch !== writeEpoch) return;
      if (error instanceof PresentationApiError && error.code === 'REVISION_CONFLICT' && error.body?.current) {
        applyEnvelope(error.body.current);
        const relevant = { ...sentChanges };
        if (session.state.ideaEpoch !== sentEpoch) {
          for (const field of ['camera', 'albumItemId', 'photoFrame', 'descriptionPage']) delete relevant[field];
        }
        session.pendingChanges = { ...relevant, ...session.pendingChanges };
        session.credential = { ...session.credential, pendingMutation: null };
        persistCredential();
        writeInFlight = false;
        return flushPresentationChanges();
      }
      if (error instanceof PresentationApiError) throw error;
      // The same body and idempotency key are retried after uncertain delivery.
      result = await writePresentationState(requestCredential, body, key, { signal: abortController.signal });
    }
    if (epoch !== writeEpoch) return;
    applyEnvelope(result);
    session.credential = { ...session.credential, pendingMutation: null };
    persistCredential();
    inflightChanges = {};
    session.pending = Object.keys(session.pendingChanges).length > 0;
  } catch (error) {
    if (epoch !== writeEpoch) return;
    if (error?.name !== 'AbortError' && !retryableWriteFailure(error) && !terminal(error)) {
      session.credential = { ...session.credential, pendingMutation: null };
      persistCredential();
      session.pendingChanges = {};
      inflightChanges = {};
      session.pending = false;
      if (error.code === 'IDEA_UNAVAILABLE') {
        const rejectedId = sentChanges.selectedIdeaId ?? session.state.selectedIdeaId;
        session.catalog = session.catalog.filter(idea => idea.id !== String(rejectedId));
        session.content = null;
        lastContentVersion = null;
      }
      const message = error.message;
      const code = error.code;
      void syncOnce(true).finally(() => { session.error = message; session.errorCode = code; });
      return;
    }
    const relevant = { ...sentChanges, ...session.pendingChanges };
    if (session.state.ideaEpoch !== sentEpoch) {
      for (const field of ['camera', 'albumItemId', 'photoFrame', 'descriptionPage']) delete relevant[field];
    }
    session.pendingChanges = relevant;
    inflightChanges = {};
    session.pending = true;
    if (error?.name !== 'AbortError') onTransportFailure(error);
    if (error?.name !== 'AbortError' && !terminal(error) && !stopped) {
      const delay = error?.retryAfterMs || reconnectDelay;
      writeTimer = setTimeout(() => { writeTimer = null; flushPresentationChanges(); }, Math.min(10000, delay));
    }
  } finally {
    if (epoch === writeEpoch) {
      writeInFlight = false;
      if (writeAbort === abortController) writeAbort = null;
    }
  }
  if (epoch === writeEpoch && !stopped && !writeInFlight && Object.keys(session.pendingChanges).length && !writeTimer) {
    writeTimer = setTimeout(() => { writeTimer = null; flushPresentationChanges(); }, 0);
  }
}

export async function selectPresentationIdea(ideaId) {
  if (String(ideaId) === String(session.state.selectedIdeaId)) return true;
  const idea = await loadPresentationIdea(session.credential, String(ideaId));
  if (!validatePresentationIdea(idea)) throw new Error('This idea is not available for presentation.');
  session.content = idea;
  enqueuePresentationChanges({ selectedIdeaId: idea.id }, { immediate: true });
  return true;
}

export async function clearPresentedIdea() {
  session.content = null;
  enqueuePresentationChanges({ selectedIdeaId: null, albumItemId: null, descriptionPage: 0, mode: 'map' }, { immediate: true });
}

export async function ensurePresentationCatalog({ refresh = false } = {}) {
  if (session.catalogLoaded && !refresh) return session.catalog;
  const ideas = await loadPresentationIdeas(session.credential);
  session.catalog = ideas.filter(validatePresentationIdea);
  session.catalogLoaded = true;
  if (session.state.selectedIdeaId && !session.catalog.some(item => item.id === session.state.selectedIdeaId)) {
    enqueuePresentationChanges({ selectedIdeaId: null }, { immediate: true });
  }
  return session.catalog;
}

export async function chooseAlbumItem(itemId) {
  const item = getAlbumItem(session.content, itemId);
  if (!item) return false;
  enqueuePresentationChanges({ albumItemId: item.id, photoFrame: { scale: 1, centerX: 0.5, centerY: 0.5 } }, { immediate: true });
  return true;
}

export function reportReceiverRender(revision, status, errorCode = null) {
  if (session.role !== 'receiver' || Number(revision) !== session.state.revision) return;
  session.renderStatus = status;
  session.renderError = ['MAP_UNAVAILABLE', 'IMAGE_UNAVAILABLE', 'STREETMIX_UNAVAILABLE', 'CONTENT_UNAVAILABLE'].includes(errorCode) ? errorCode : null;
  if (status === 'ready' || status === 'error') session.reportedRevision = Math.max(session.reportedRevision, Number(revision) || 0);
}

export function setLocalAudienceView(action) {
  if (session.role !== 'audience') return;
  session.audienceView = reduceAudienceView(session.audienceView, action, writableViewState.value, session.content);
}

export async function rotatePresenterCode() {
  const result = await rotatePresenterCodeRequest(session.credential);
  session.credential = { ...session.credential, presenterCode: result.presenterCode, presenterCodeExpiresAt: result.presenterCodeExpiresAt };
  delete session.credential.pendingPairingRotation;
  persistCredential();
  return result;
}

export async function leaveOrEndPresentation({ end = false } = {}) {
  const credential = session.credential;
  if (!credential) {
    clearActivePresentationCredential();
    resetSession();
    return;
  }
  stopPresentationSession();
  try {
    if (end && ['receiver', 'controller'].includes(credential.role)) await endPresentation(credential);
    else if (credential.role !== 'receiver') await leavePresentation(credential);
  } finally {
    clearActivePresentationCredential();
    resetSession();
  }
}

export async function loadInitialFromCodeFragment(role) {
  const fragment = window.location.hash.slice(1);
  const params = new URLSearchParams(fragment);
  const key = role === 'audience' ? 'view' : 'pair';
  const code = params.get(key);
  if (!code) return '';
  // Retain the admission code only in this task's in-memory value. Credentials
  // and idempotency material remain in sessionStorage before the POST begins.
  params.delete(key);
  const remainder = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${location.search}${remainder ? `#${remainder}` : ''}`);
  return code;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session.credential && !stopped) {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      syncOnce(true).finally(() => schedulePoll(rolePollInterval[session.role]));
    }
  });
}
