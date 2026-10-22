import { computed, reactive } from 'vue';
import {
  createAudienceView, createDefaultPresentationState,
  getAlbumItem, getPresentationAlbum, isStreetmixItem, isValidCamera,
  normalizePresentationIdea, reduceAudienceView, shouldFollowPresenter, toWritablePresentationState,
  validatePresentationIdea, validatePresentationState,
} from './presentationState.js';
import {
  PresentationApiError, clearActivePresentationCredential, clearPresentationCredentialIfMatches,
  createReceiverEnrollment, endPresentation, getActivePresentationCredential, joinAudience,
  leavePresentation, loadPresentationIdea, loadPresentationIdeas, pairController,
  rotatePresenterCode as rotatePresenterCodeRequest, saveActivePresentationCredential, syncPresentation, writePresentationState,
  presentationWebSocketIsEnabled,
} from './presentationApi.js';
import { createPresentationSocket } from './presentationSocket.js';

const defaultState = () => createDefaultPresentationState();
const session = reactive({
  role: null,
  credential: null,
  status: 'disconnected',
  transportState: 'stopped',
  transportError: '',
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
  // Revision zero is the initial display state. Never send -1 in receiver presence;
  // the API accepts only nonnegative applied revisions.
  reportedRevision: 0,
  finder: { query: '', sort: 'newest', filter: 'all', placeQuery: '', placeResults: [], placeError: '' },
  audienceView: createAudienceView(),
  inflightChanges: {},
  pendingChanges: {},
  pending: false,
});

let pollTimer = null;
let pollRequest = null;
let transportOwnerGeneration = 0;
let socketClient = null;
let socketDisabledForSession = false;
let writeInFlight = false;
let writeAbort = null;
let writeOwner = 0;
let activeWriteOwner = 0;
let writeTimer = null;
let pollRetryDelay = 1000;
let pollRetryAt = 0;
let writeRetryAt = 0;
let writeRetryDelay = 1000;
let stopped = true;
let receiverSetupSnapshot = null;
let lastRequestRevision = -1;
let lastContentVersion = null;
let localAudienceIdeaEpoch = null;
let optimisticIdeaContent = null;
let sessionEpoch = 0;
let operationGeneration = 0;
const sessionTasks = new Set();
let wakeLock = null;
let wakeLockGeneration = 0;
let wakeLockPending = 0;
let selectionGeneration = 0;
let catalogGeneration = 0;
let setupAbort = null;
const rolePollInterval = { receiver: 500, audience: 1000, controller: 2000 };
const terminalCodes = new Set(['SESSION_EXPIRED', 'SESSION_ENDED', 'INVALID_SESSION_CREDENTIAL', 'ROLE_FORBIDDEN']);

export const presentationSession = session;
export const writableViewState = computed(() => ({
  ...session.state,
  ...session.inflightChanges,
  ...session.pendingChanges,
  camera: { ...session.state.camera, ...session.inflightChanges.camera, ...session.pendingChanges.camera },
  photoFrame: { ...session.state.photoFrame, ...session.inflightChanges.photoFrame, ...session.pendingChanges.photoFrame },
  audienceDisplay: { ...session.state.audienceDisplay, ...session.inflightChanges.audienceDisplay, ...session.pendingChanges.audienceDisplay },
  iconStyle: { ...session.state.iconStyle, ...session.inflightChanges.iconStyle, ...session.pendingChanges.iconStyle },
}));
export const selectedAlbumItem = computed(() => getAlbumItem(session.content, writableViewState.value.albumItemId));
export const audienceFollowing = computed(() => shouldFollowPresenter(session.audienceView, writableViewState.value, session.status === 'active'));
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

function invalidatePoll() {
  const request = pollRequest;
  pollRequest = null;
  if (request) request.abortController.abort();
}

function sessionMatches(credential = session.credential, epoch = sessionEpoch) {
  return !stopped && epoch === sessionEpoch && credential?.sessionId === session.credential?.sessionId
    && credential?.participantId === session.credential?.participantId && credential?.role === session.role;
}

function resetSession() {
  stopPresentationSession();
  session.role = null;
  session.credential = null;
  session.status = 'disconnected';
  session.transportState = 'stopped';
  session.transportError = '';
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
  session.reportedRevision = 0;
  session.pendingChanges = {};
  session.pending = false;
  session.inflightChanges = {};
  session.renderStatus = 'loading';
  session.renderError = null;
  session.audienceView = createAudienceView();
  lastRequestRevision = -1;
  lastContentVersion = null;
  localAudienceIdeaEpoch = null;
  optimisticIdeaContent = null;
  pollRetryAt = 0;
  pollRetryDelay = 1000;
  writeRetryAt = 0;
  writeRetryDelay = 1000;
  receiverSetupSnapshot = null;
}

function terminal(error) {
  return error instanceof PresentationApiError && terminalCodes.has(error.code);
}

function retryableWriteFailure(error) {
  return !(error instanceof PresentationApiError) || error.status === 429 || error.status >= 500;
}

function onTransportFailure(error, { source = 'poll' } = {}) {
  if (terminal(error)) {
    terminateSession(error);
    return;
  }
  if (error?.code === 'PROTOCOL_UNSUPPORTED') {
    session.error = error.message || 'This presentation uses a newer protocol. Update the app and try again.';
    session.errorCode = error.code;
    session.transportState = 'stopped';
    stopPresentationSession();
    return;
  }
  session.error = error?.message || 'The presentation service is unavailable.';
  session.errorCode = error?.code || 'PRESENTATION_UNAVAILABLE';
  const stale = session.lastSuccessAt > 0 && Date.now() - session.lastSuccessAt >= 5000;
  if (socketClient?.state !== 'live') session.transportState = stale ? 'reconnecting' : 'fallback';
  if (source === 'poll') {
    pollRetryAt = Math.max(pollRetryAt, Date.now() + Math.max(error?.retryAfterMs || 0, pollRetryDelay));
    pollRetryDelay = Math.min(30_000, pollRetryDelay * 2);
  }
}

function terminateSession(error, { clearCredential = true } = {}) {
  const credential = session.credential;
  if (clearCredential) clearPresentationCredentialIfMatches(credential);
  const code = error?.code || 'SESSION_TERMINAL';
  stopPresentationSession();
  if (code === 'SESSION_EXPIRED') session.status = 'expired';
  else if (code === 'SESSION_ENDED') session.status = 'ended';
  else if (code === 'SESSION_TERMINAL') session.status = 'ended';
  else session.status = 'ended';
  session.error = error?.message || 'This presentation connection is no longer active.';
  session.errorCode = code;
  session.transportState = 'stopped';
  session.credential = null;
}

function validEnvelope(envelope, credential, { socket = false } = {}) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || envelope.protocolVersion !== 1 || typeof envelope.serverTime !== 'string'
    || !Number.isFinite(Date.parse(envelope.serverTime)) || !envelope.session
    || envelope.session.id !== credential?.sessionId
    || !['waiting', 'active', 'ended', 'expired'].includes(envelope.session.status)
    || !Number.isFinite(Date.parse(envelope.session.expiresAt))
    || !Number.isSafeInteger(envelope.session.revision) || envelope.session.revision < 0
    || typeof envelope.changed !== 'boolean') return false;
  const allowed = new Set(['protocolVersion', 'serverTime', 'session', 'changed', 'state', 'content', 'participants', 'receiver', 'audienceCode']);
  if (Object.keys(envelope).some(key => !allowed.has(key))) return false;
  if (socket && (envelope.changed !== true || !Object.hasOwn(envelope, 'state') || !Object.hasOwn(envelope, 'content'))) return false;
  if (envelope.state !== null && envelope.state !== undefined) {
    if (!validatePresentationState(envelope.state) || envelope.state.revision !== envelope.session.revision) return false;
  } else if (socket || envelope.changed) return false;
  if (socket && (!Object.hasOwn(envelope, 'participants') || !Object.hasOwn(envelope, 'receiver'))) return false;
  const selectedIdeaId = envelope.state && Object.hasOwn(envelope.state, 'selectedIdeaId')
    ? envelope.state.selectedIdeaId : session.state.selectedIdeaId;
  if (envelope.content !== undefined && envelope.content !== null) {
    if (!validatePresentationIdea(envelope.content) || String(envelope.content.id) !== String(selectedIdeaId)) return false;
  }
  if (socket) {
    if (selectedIdeaId === null && envelope.content !== null) return false;
    if (selectedIdeaId !== null && (!envelope.content || String(envelope.content.id) !== String(selectedIdeaId))) return false;
  }
  if (envelope.participants != null) {
    if (session.role !== 'controller' || !Array.isArray(envelope.participants)) return false;
    for (const person of envelope.participants) {
      if (!person || typeof person !== 'object' || typeof person.id !== 'string' || typeof person.connected !== 'boolean'
        || Object.keys(person).some(key => !['id', 'displayName', 'connected', 'localView', 'lastSeenAt'].includes(key))) return false;
    }
  }
  if (envelope.audienceCode !== undefined && (session.role !== 'controller' || typeof envelope.audienceCode !== 'string')) return false;
  if (session.role !== 'controller' && envelope.audienceCode != null) return false;
  if (session.role === 'audience' && envelope.receiver != null) return false;
  return true;
}

function applyEnvelope(envelope, { source = 'poll', epoch = sessionEpoch, ownerGeneration = transportOwnerGeneration } = {}) {
  if (!sessionMatches(session.credential, epoch)) return { valid: false, applied: false };
  const credential = session.credential;
  if (!validEnvelope(envelope, credential, { socket: source === 'socket' })) return { valid: false, applied: false };
  if (source === 'poll' && ownerGeneration !== transportOwnerGeneration) return { valid: true, applied: false };
  if (source === 'poll' && socketClient?.state === 'live') return { valid: true, applied: false };

  const revision = envelope.session.revision;
  if (revision < session.state.revision) return { valid: true, applied: false };
  if (source === 'write') {
    if (envelope.state && revision > session.state.revision) {
      session.state = createDefaultPresentationState(envelope.state);
      if (envelope.content !== undefined && envelope.content !== null) {
        session.content = normalizePresentationIdea(envelope.content);
        lastContentVersion = session.content.contentVersion;
      } else if (session.state.selectedIdeaId === null) {
        session.content = null;
        lastContentVersion = null;
      }
      lastRequestRevision = revision;
      if (optimisticIdeaContent && String(session.state.selectedIdeaId) === String(optimisticIdeaContent.id)) optimisticIdeaContent = null;
      if (session.role === 'audience' && localAudienceIdeaEpoch !== session.state.ideaEpoch) {
        session.audienceView = reduceAudienceView(session.audienceView, { type: 'newIdea' }, session.state, session.content);
        localAudienceIdeaEpoch = session.state.ideaEpoch;
      }
      if (Array.isArray(envelope.participants)) session.participants = envelope.participants;
      if (Object.hasOwn(envelope, 'receiver')) session.receiver = envelope.receiver;
      if (envelope.audienceCode && session.role === 'controller') {
        session.credential = { ...session.credential, audienceCode: envelope.audienceCode };
      }
      if (session.credential.expiresAt !== envelope.session.expiresAt) {
        session.credential = { ...session.credential, expiresAt: envelope.session.expiresAt };
      }
      session.status = envelope.session.status;
      session.lastSuccessAt = Date.now();
      if (['ended', 'expired'].includes(session.status)) {
        terminateSession({
          code: session.status === 'expired' ? 'SESSION_EXPIRED' : 'SESSION_ENDED',
          message: session.status === 'expired' ? 'This presentation session has expired.' : 'This presentation has ended.',
        });
      } else persistCredential();
    }
    return { valid: true, applied: true };
  }

  if (source === 'socket' && session.transportState !== 'live') {
    transportOwnerGeneration++;
    invalidatePoll();
    if (pollTimer !== null) clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (envelope.state) session.state = createDefaultPresentationState(envelope.state);
  const optimisticSelection = session.pendingChanges.selectedIdeaId ?? session.inflightChanges.selectedIdeaId
    ?? session.credential?.pendingMutation?.sentChanges?.selectedIdeaId;
  const preserveOptimisticIdea = optimisticIdeaContent
    && String(optimisticSelection) === String(optimisticIdeaContent.id)
    && String(session.state.selectedIdeaId) !== String(optimisticIdeaContent.id);
  if (preserveOptimisticIdea) {
    session.content = optimisticIdeaContent;
  } else if (envelope.content != null) {
    session.content = normalizePresentationIdea(envelope.content);
    lastContentVersion = session.content.contentVersion;
    if (optimisticIdeaContent && String(session.content.id) === String(optimisticIdeaContent.id)) optimisticIdeaContent = null;
  } else if (session.state.selectedIdeaId === null) {
    session.content = null;
    lastContentVersion = null;
    optimisticIdeaContent = null;
  } else if (session.content?.id !== session.state.selectedIdeaId
    && session.pendingChanges.selectedIdeaId !== session.content?.id
    && session.inflightChanges.selectedIdeaId !== session.content?.id) {
    session.content = null;
    lastContentVersion = null;
  }
  if (Array.isArray(envelope.participants)) session.participants = envelope.participants;
  else if (session.role !== 'controller') session.participants = [];
  if (envelope.audienceCode && session.role === 'controller') {
    session.credential = { ...session.credential, audienceCode: envelope.audienceCode };
  }
  if (Object.hasOwn(envelope, 'receiver')) session.receiver = envelope.receiver;
  session.status = envelope.session.status;
  if (session.credential.expiresAt !== envelope.session.expiresAt) {
    session.credential = { ...session.credential, expiresAt: envelope.session.expiresAt };
  }
  lastRequestRevision = revision;
  session.lastSuccessAt = Date.now();
  if (source === 'poll') {
    pollRetryAt = 0;
    pollRetryDelay = 1000;
    session.transportState = socketClient?.state === 'disabled' ? 'disabled' : 'fallback';
    if (!socketDisabledForSession) session.transportError = '';
    if (['PRESENTATION_UNAVAILABLE', 'RATE_LIMITED', 'NETWORK_ERROR'].includes(session.errorCode)) {
      session.error = '';
      session.errorCode = '';
    }
  }
  if (source === 'socket' && session.transportState !== 'live') session.transportState = 'live';
  if (['ended', 'expired'].includes(session.status)) {
    terminateSession({ code: session.status === 'expired' ? 'SESSION_EXPIRED' : 'SESSION_ENDED', message: session.status === 'expired' ? 'This presentation session has expired.' : 'This presentation has ended.' });
  } else if (session.role === 'audience' && localAudienceIdeaEpoch !== session.state.ideaEpoch) {
    session.audienceView = reduceAudienceView(session.audienceView, { type: 'newIdea' }, session.state, session.content);
    localAudienceIdeaEpoch = session.state.ideaEpoch;
  }
  persistCredential();
  return { valid: true, applied: true };
}

async function syncOnce(force = false) {
  if (!session.credential || pollRequest || stopped || socketClient?.state === 'live') return;
  if (Date.now() < pollRetryAt) {
    schedulePoll(Math.min(60_000, pollRetryAt - Date.now()));
    return;
  }
  const epoch = sessionEpoch;
  const ownerGeneration = transportOwnerGeneration;
  const request = { epoch, ownerGeneration, abortController: new AbortController() };
  pollRequest = request;
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
    }, { signal: request.abortController.signal });
    if (pollRequest !== request || !sessionMatches(session.credential, epoch)) return;
    const applied = applyEnvelope(envelope, { source: 'poll', epoch, ownerGeneration });
    if (!applied.valid) throw new Error('The presentation service returned an invalid state envelope.');
    session.pending = Object.keys(session.pendingChanges).length > 0 || writeInFlight;
  } catch (error) {
    if (pollRequest === request && error?.name !== 'AbortError') onTransportFailure(error);
  } finally {
    if (pollRequest === request) pollRequest = null;
  }
}

function schedulePoll(delay = rolePollInterval[session.role] || 2000) {
  if (stopped || !session.credential || socketClient?.state === 'live') return;
  if (pollTimer) clearTimeout(pollTimer);
  const retryWait = Math.max(0, pollRetryAt - Date.now());
  const wait = Math.max(delay, retryWait, 0);
  pollTimer = setTimeout(async () => {
    pollTimer = null;
    if (wait > 60_000 && Date.now() < pollRetryAt) { schedulePoll(60_000); return; }
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') await syncOnce(false);
    if (!stopped && socketClient?.state !== 'live') {
      const stale = session.lastSuccessAt > 0 && Date.now() - session.lastSuccessAt >= 5000;
      if (stale && session.transportState !== 'disabled') session.transportState = 'reconnecting';
      schedulePoll(rolePollInterval[session.role]);
    }
  }, Math.min(wait, 60_000));
}

function currentPresence() {
  if (session.role === 'audience') {
    return session.audienceView?.mode ? { localView: session.audienceView.mode } : {};
  }
  if (session.role === 'receiver') {
    return {
      appliedRevision: session.reportedRevision,
      viewport: { width: globalThis.window?.innerWidth || 0, height: globalThis.window?.innerHeight || 0 },
      renderStatus: session.renderStatus,
      renderError: session.renderError,
    };
  }
  return {};
}

function ensureWakeLock(epoch = sessionEpoch) {
  if (!['receiver', 'controller'].includes(session.role) || stopped || globalThis.document?.visibilityState === 'hidden') return;
  const wakeLockApi = globalThis.navigator?.wakeLock;
  if (!wakeLockApi?.request || wakeLock || wakeLockPending) return;
  const requestGeneration = ++wakeLockGeneration;
  wakeLockPending = requestGeneration;
  Promise.resolve().then(() => wakeLockApi.request('screen')).then(lock => {
    if (wakeLockPending === requestGeneration) wakeLockPending = 0;
    if (requestGeneration !== wakeLockGeneration || !sessionMatches(session.credential, epoch)
      || globalThis.document?.visibilityState === 'hidden') {
      try { void Promise.resolve(lock.release?.()).catch(() => {}); } catch { /* Release is best effort. */ }
      return;
    }
    wakeLock = lock;
    lock.addEventListener?.('release', () => { if (wakeLock === lock) wakeLock = null; }, { once: true });
  }).catch(() => {
    if (wakeLockPending === requestGeneration) wakeLockPending = 0;
    /* Screen-awake support is best effort. */
  });
}

function releaseWakeLock() {
  wakeLockGeneration++;
  wakeLockPending = 0;
  const lock = wakeLock;
  wakeLock = null;
  if (lock) {
    try { void Promise.resolve(lock.release?.()).catch(() => {}); } catch { /* Release is best effort. */ }
  }
}

function makeSocketClient(credential, epoch) {
  return createPresentationSocket({
    credential,
    getPresence: currentPresence,
    onSnapshot: frame => {
      if (!sessionMatches(credential, epoch)) return { valid: false, applied: false };
      return applyEnvelope(frame.envelope, { source: 'socket', epoch });
    },
    onState: (state, detail) => {
      if (!sessionMatches(credential, epoch)) return;
      if (state === 'live') {
        session.transportState = 'live';
        session.transportError = '';
        invalidatePoll();
        if (pollTimer !== null) clearTimeout(pollTimer);
        pollTimer = null;
      } else if (state === 'fallback') {
        session.transportState = socketDisabledForSession ? 'disabled' : 'fallback';
        if (session.lastSuccessAt && Date.now() - session.lastSuccessAt < 5000) session.transportError = '';
        void syncOnce(true);
        schedulePoll(0);
      } else if (state === 'connecting' || state === 'reconnecting' || state === 'suspended') {
        if (socketClient?.state !== 'live') {
          const hasFreshFallback = session.lastSuccessAt > 0 && Date.now() - session.lastSuccessAt < 5000;
          if (state !== 'suspended') session.transportState = hasFreshFallback ? 'fallback' : 'reconnecting';
        }
      }
    },
    onError: error => {
      if (!sessionMatches(credential, epoch)) return;
      if (!session.lastSuccessAt || Date.now() - session.lastSuccessAt >= 5000) {
        session.transportError = error?.message || 'The presentation socket is reconnecting.';
      }
    },
    onTerminal: error => {
      if (sessionMatches(credential, epoch)) terminateSession(error);
    },
    onIncompatible: error => {
      if (!sessionMatches(credential, epoch)) return;
      session.error = error?.message || 'This presentation uses a newer protocol. Update the app and try again.';
      session.errorCode = 'PROTOCOL_UNSUPPORTED';
      stopPresentationSession();
    },
    onDisabled: error => {
      if (!sessionMatches(credential, epoch)) return;
      socketDisabledForSession = true;
      session.transportState = 'disabled';
      session.transportError = error?.message || 'Presentation socket updates are unavailable; using HTTP updates.';
      void syncOnce(true);
      schedulePoll(0);
    },
  });
}

function startPresentationSession(credential, initialState, content = null) {
  const previousCredential = session.credential;
  const sameSession = previousCredential?.sessionId === credential?.sessionId
    && previousCredential?.participantId === credential?.participantId
    && previousCredential?.role === credential?.role;
  const preserved = sameSession ? {
    state: session.state, content: session.content, participants: session.participants,
    receiver: session.receiver, catalog: session.catalog, catalogLoaded: session.catalogLoaded,
    reportedRevision: session.reportedRevision, renderStatus: session.renderStatus,
    renderError: session.renderError, pendingChanges: session.pendingChanges,
    audienceView: session.audienceView, status: session.status, lastSuccessAt: session.lastSuccessAt,
    lastContentVersion, localAudienceIdeaEpoch, optimisticIdeaContent,
  } : null;
  stopPresentationSession();
  const epoch = sessionEpoch;
  session.credential = credential;
  session.role = credential.role;
  session.state = preserved?.state || defaultState();
  session.content = preserved?.content || null;
  session.participants = preserved?.participants || [];
  session.receiver = preserved?.receiver || null;
  session.catalog = preserved?.catalog || [];
  session.catalogLoaded = preserved?.catalogLoaded || false;
  session.reportedRevision = preserved?.reportedRevision || 0;
  session.renderStatus = preserved?.renderStatus || 'loading';
  session.renderError = preserved?.renderError || null;
  session.pendingChanges = {};
  session.pending = false;
  session.finder = { query: '', sort: 'newest', filter: 'all', placeQuery: '', placeResults: [], placeError: '' };
  session.inflightChanges = credential.role === 'controller' && credential.pendingMutation?.sentChanges
    ? { ...credential.pendingMutation.sentChanges } : {};
  session.pendingChanges = { ...session.inflightChanges, ...(preserved?.pendingChanges || {}) };
  session.pending = Object.keys(session.pendingChanges).length > 0;
  session.audienceView = preserved?.audienceView || createAudienceView();
  localAudienceIdeaEpoch = preserved?.localAudienceIdeaEpoch ?? null;
  lastContentVersion = preserved?.lastContentVersion ?? null;
  optimisticIdeaContent = preserved?.optimisticIdeaContent ?? null;
  session.status = initialState?.session?.status || preserved?.status || 'waiting';
  if (initialState?.state && validatePresentationState(initialState.state)) session.state = createDefaultPresentationState(initialState.state);
  else if (initialState && validatePresentationState(initialState)) session.state = createDefaultPresentationState(initialState);
  if (content && validatePresentationIdea(content)) session.content = normalizePresentationIdea(content);
  if (initialState?.content && validatePresentationIdea(initialState.content)) session.content = normalizePresentationIdea(initialState.content);
  if (session.content && !lastContentVersion) lastContentVersion = session.content.contentVersion;
  session.lastSuccessAt = preserved?.lastSuccessAt || Date.now();
  session.error = '';
  session.errorCode = '';
  session.transportError = '';
  transportOwnerGeneration++;
  socketDisabledForSession = false;
  pollRetryAt = 0;
  pollRetryDelay = 1000;
  if (!sameSession) {
    writeRetryAt = 0;
    writeRetryDelay = 1000;
  }
  if (!sameSession) lastRequestRevision = session.state.revision;
  stopped = false;
  session.transportState = presentationWebSocketIsEnabled() ? 'connecting' : 'fallback';
  if (presentationWebSocketIsEnabled()) {
    socketClient = makeSocketClient(credential, epoch);
    socketClient.start();
  } else {
    socketClient = null;
  }
  void syncOnce(true);
  schedulePoll(0);
  if (Object.keys(session.pendingChanges).length) void flushPresentationChanges();
  ensureWakeLock(epoch);
}

export function stopPresentationSession() {
  sessionEpoch++;
  operationGeneration++;
  stopped = true;
  clearTimers();
  invalidatePoll();
  socketClient?.stop();
  socketClient = null;
  setupAbort?.abort();
  setupAbort = null;
  for (const controller of sessionTasks) controller.abort();
  sessionTasks.clear();
  writeAbort?.abort();
  writeAbort = null;
  activeWriteOwner = ++writeOwner;
  writeInFlight = false;
  releaseWakeLock();
  session.transportState = 'stopped';
}

export function retryPresentationTransport() {
  if (!session.credential || stopped) return false;
  socketDisabledForSession = false;
  session.transportError = '';
  session.transportState = 'connecting';
  if (!socketClient) socketClient = makeSocketClient(session.credential, sessionEpoch);
  socketClient.retryNow();
  void syncOnce(true);
  schedulePoll(0);
  return true;
}

export async function restorePresentationSession() {
  const credential = getActivePresentationCredential();
  if (!credential) return false;
  if (session.credential?.sessionId === credential.sessionId
    && session.credential?.participantId === credential.participantId
    && session.role === credential.role && !stopped) return true;
  startPresentationSession(credential, null);
  return true;
}

export async function startReceiver(snapshot = null) {
  setupAbort?.abort();
  const controller = new AbortController();
  setupAbort = controller;
  const operation = ++operationGeneration;
  session.error = '';
  receiverSetupSnapshot = snapshot;
  try {
    const { credential, result } = await createReceiverEnrollment({ signal: controller.signal });
    if (operation !== operationGeneration) {
      clearPresentationCredentialIfMatches(credential);
      return null;
    }
    startPresentationSession(credential, result);
    return credential;
  } catch (error) {
    if (operation !== operationGeneration || error?.name === 'AbortError') return null;
    throw error;
  } finally {
    if (setupAbort === controller) setupAbort = null;
  }
}

export async function connectController(code) {
  setupAbort?.abort();
  const controller = new AbortController();
  setupAbort = controller;
  const operation = ++operationGeneration;
  session.error = '';
  let enrolled;
  try {
    enrolled = await pairController(code, { signal: controller.signal });
  } catch (error) {
    if (operation !== operationGeneration || error?.name === 'AbortError') return null;
    throw error;
  } finally {
    if (setupAbort === controller) setupAbort = null;
  }
  const { credential, result } = enrolled;
  if (operation !== operationGeneration) { clearPresentationCredentialIfMatches(credential); return null; }
  startPresentationSession(credential, result);
  const epoch = sessionEpoch;
  let browseSnapshot = receiverSetupSnapshot;
  try {
    if (!browseSnapshot) browseSnapshot = JSON.parse(localStorage.getItem('presentation-browse-snapshot-v1') || 'null');
    localStorage.removeItem('presentation-browse-snapshot-v1');
  } catch { browseSnapshot = null; }
  if (browseSnapshot?.selectedIdeaId || browseSnapshot?.camera) {
    try {
      let selectedIdeaId = null;
      if (browseSnapshot.selectedIdeaId) {
        const controller = new AbortController();
        sessionTasks.add(controller);
        let idea;
        try {
          idea = await loadPresentationIdea(credential, String(browseSnapshot.selectedIdeaId), { signal: controller.signal });
        } finally { sessionTasks.delete(controller); }
        if (!sessionMatches(credential, epoch)) return credential;
        const normalizedIdea = normalizePresentationIdea(idea);
        if (normalizedIdea) {
          session.content = normalizedIdea;
          selectedIdeaId = normalizedIdea.id;
        }
      }
      if (selectedIdeaId) enqueuePresentationChanges({ selectedIdeaId }, { immediate: true });
      if (isValidCamera(browseSnapshot.camera)) {
        // The protocol centers the map whenever the selected idea changes. Apply
        // the captured Browse camera as a following mutation so it stays intact.
        if (selectedIdeaId) await new Promise(resolve => setTimeout(resolve, 0));
        if (!sessionMatches(credential, epoch)) return credential;
        enqueuePresentationChanges({ camera: browseSnapshot.camera }, { immediate: true });
      }
    } catch { /* A missing browse selection does not block pairing. */ }
    receiverSetupSnapshot = null;
  }
  return credential;
}

export async function connectAudience(code) {
  setupAbort?.abort();
  const controller = new AbortController();
  setupAbort = controller;
  const operation = ++operationGeneration;
  session.error = '';
  try {
    const { credential, result } = await joinAudience(code, { signal: controller.signal });
    if (operation !== operationGeneration) {
      clearPresentationCredentialIfMatches(credential);
      return null;
    }
    startPresentationSession(credential, result);
    return credential;
  } catch (error) {
    if (operation !== operationGeneration || error?.name === 'AbortError') return null;
    throw error;
  } finally {
    if (setupAbort === controller) setupAbort = null;
  }
}

export function enqueuePresentationChanges(changes, { immediate = false } = {}) {
  if (session.role !== 'controller' || ['ended', 'expired'].includes(session.status) || !session.credential) return false;
  const merged = { ...session.pendingChanges, ...changes };
  for (const nested of ['camera', 'photoFrame', 'audienceDisplay', 'iconStyle']) {
    if (changes[nested]) merged[nested] = { ...(session.pendingChanges[nested] || session.state[nested]), ...changes[nested] };
  }
  const item = getAlbumItem(session.content, merged.albumItemId ?? session.state.albumItemId);
  if (isStreetmixItem(item)) merged.photoFrame = { scale: 1, centerX: 0.5, centerY: 0.5 };
  session.pendingChanges = merged;
  session.pending = true;
  scheduleWrite(immediate ? 0 : 500);
  return true;
}

function scheduleWrite(delay = 0) {
  if (stopped || !session.credential || session.role !== 'controller' || !Object.keys(session.pendingChanges).length) return;
  if (writeTimer) clearTimeout(writeTimer);
  const deadline = Math.max(writeRetryAt, Date.now() + Math.max(0, delay));
  const wait = Math.max(0, deadline - Date.now());
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (Date.now() < writeRetryAt) scheduleWrite(Math.min(60_000, writeRetryAt - Date.now()));
    else void flushPresentationChanges();
  }, Math.min(wait, 60_000));
}

async function flushPresentationChanges() {
  if (writeInFlight || session.role !== 'controller' || !session.credential || !Object.keys(session.pendingChanges).length) return;
  if (Date.now() < writeRetryAt) { scheduleWrite(writeRetryAt - Date.now()); return; }
  const epoch = sessionEpoch;
  const owner = ++writeOwner;
  activeWriteOwner = owner;
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
  session.inflightChanges = sentChanges;
  const sentEpoch = requestRecord?.sentEpoch ?? session.state.ideaEpoch;
  const body = requestRecord?.body || {
    baseRevision: session.state.revision,
    state: toWritablePresentationState({ ...session.state, ...sentChanges,
      camera: { ...session.state.camera, ...sentChanges.camera },
      photoFrame: { ...session.state.photoFrame, ...sentChanges.photoFrame },
      audienceDisplay: { ...session.state.audienceDisplay, ...sentChanges.audienceDisplay },
      iconStyle: { ...session.state.iconStyle, ...sentChanges.iconStyle },
    }),
  };
  const key = requestRecord?.key || globalThis.crypto.randomUUID();
  const savedRecord = { key, body, sentChanges, sentEpoch };
  session.credential = { ...session.credential, pendingMutation: savedRecord };
  try {
    if (!persistCredential()) {
      session.credential = requestCredential;
      session.pendingChanges = { ...sentChanges, ...session.pendingChanges };
      session.inflightChanges = {};
      session.pending = true;
      session.error = 'This browser could not safely save the display update. Check session storage and try again.';
      session.errorCode = 'SESSION_STORAGE_UNAVAILABLE';
      return;
    }
    let result;
    try {
      result = await writePresentationState(requestCredential, body, key, { signal: abortController.signal });
    } catch (error) {
      if (epoch !== sessionEpoch || activeWriteOwner !== owner) return;
      if (error instanceof PresentationApiError && error.code === 'REVISION_CONFLICT' && error.body?.current) {
        const applied = applyEnvelope(error.body.current, { source: 'write', epoch });
        if (!applied.valid) throw new Error('The presentation service returned an invalid conflict snapshot.');
        const relevant = { ...sentChanges };
        if (session.state.ideaEpoch !== sentEpoch) {
          for (const field of ['camera', 'albumItemId', 'photoFrame', 'descriptionPage']) delete relevant[field];
        }
        session.pendingChanges = { ...relevant, ...session.pendingChanges };
        session.credential = { ...session.credential, pendingMutation: null };
        persistCredential();
        session.inflightChanges = {};
        writeInFlight = false;
        activeWriteOwner = 0;
        if (writeAbort === abortController) writeAbort = null;
        return flushPresentationChanges();
      }
      if (error instanceof PresentationApiError) throw error;
      // The same body and idempotency key are retried after uncertain delivery.
      result = await writePresentationState(requestCredential, body, key, { signal: abortController.signal });
    }
    if (epoch !== sessionEpoch || activeWriteOwner !== owner) return;
    const applied = applyEnvelope(result, { source: 'write', epoch });
    if (!applied.valid) throw new Error('The presentation service returned an invalid command result.');
    if (!sessionMatches(requestCredential, epoch)) return;
    session.credential = { ...session.credential, pendingMutation: null };
    persistCredential();
    session.inflightChanges = {};
    session.pending = Object.keys(session.pendingChanges).length > 0;
    writeRetryAt = 0;
    writeRetryDelay = 1000;
    if (session.errorCode === 'PRESENTATION_UNAVAILABLE' || session.errorCode === 'RATE_LIMITED') {
      session.error = '';
      session.errorCode = '';
    }
  } catch (error) {
    if (epoch !== sessionEpoch || activeWriteOwner !== owner) return;
    if (terminal(error)) {
      terminateSession(error);
      return;
    }
    if (error?.code === 'PROTOCOL_UNSUPPORTED') {
      onTransportFailure(error, { source: 'write' });
      return;
    }
    if (error?.name !== 'AbortError' && !retryableWriteFailure(error) && !terminal(error)) {
      session.credential = { ...session.credential, pendingMutation: null };
      persistCredential();
      session.inflightChanges = {};
      session.pending = Object.keys(session.pendingChanges).length > 0;
      if (error.code === 'IDEA_UNAVAILABLE') {
        const rejectedId = sentChanges.selectedIdeaId ?? session.state.selectedIdeaId;
        session.catalog = session.catalog.filter(idea => idea.id !== String(rejectedId));
        if (String(session.content?.id) === String(rejectedId)
          && String(session.pendingChanges.selectedIdeaId) !== String(session.content?.id)) {
          session.content = null;
          optimisticIdeaContent = null;
          lastContentVersion = null;
        }
      }
      session.error = error.message;
      session.errorCode = error.code;
      if (!socketClient || socketClient.state !== 'live') void syncOnce(true);
      if (Object.keys(session.pendingChanges).length) scheduleWrite(0);
      return;
    }
    const relevant = { ...sentChanges, ...session.pendingChanges };
    if (session.state.ideaEpoch !== sentEpoch) {
      for (const field of ['camera', 'albumItemId', 'photoFrame', 'descriptionPage']) delete relevant[field];
    }
    session.pendingChanges = relevant;
    session.inflightChanges = {};
    session.pending = true;
    if (error?.name !== 'AbortError') onTransportFailure(error, { source: 'write' });
    if (error?.name !== 'AbortError' && !terminal(error) && !stopped) {
      writeRetryAt = Math.max(writeRetryAt, Date.now() + Math.max(error?.retryAfterMs || 0, writeRetryDelay));
      writeRetryDelay = Math.min(30_000, writeRetryDelay * 2);
      scheduleWrite(writeRetryAt - Date.now());
    }
  } finally {
    if (epoch === sessionEpoch && activeWriteOwner === owner) {
      writeInFlight = false;
      activeWriteOwner = 0;
      if (writeAbort === abortController) writeAbort = null;
    }
  }
  if (epoch === sessionEpoch && !stopped && !writeInFlight && Object.keys(session.pendingChanges).length && !writeTimer) {
    scheduleWrite(0);
  }
}

export async function selectPresentationIdea(ideaId) {
  if (String(ideaId) === String(session.state.selectedIdeaId)) return true;
  const credential = session.credential;
  const epoch = sessionEpoch;
  const requestGeneration = ++selectionGeneration;
  const controller = new AbortController();
  sessionTasks.add(controller);
  try {
    const loaded = await loadPresentationIdea(credential, String(ideaId), { signal: controller.signal });
    if (!sessionMatches(credential, epoch) || requestGeneration !== selectionGeneration) return false;
    const idea = normalizePresentationIdea(loaded);
    if (!idea) throw new Error('This idea is not available for presentation.');
    optimisticIdeaContent = idea;
    session.content = idea;
    enqueuePresentationChanges({ selectedIdeaId: idea.id }, { immediate: true });
    socketClient?.notifyPresenceChanged();
    return true;
  } finally {
    sessionTasks.delete(controller);
  }
}

export async function clearPresentedIdea() {
  selectionGeneration++;
  optimisticIdeaContent = null;
  session.content = null;
  enqueuePresentationChanges({ selectedIdeaId: null, albumItemId: null, descriptionPage: 0, mode: 'map' }, { immediate: true });
}

export async function ensurePresentationCatalog({ refresh = false } = {}) {
  if (session.catalogLoaded && !refresh) return session.catalog;
  const credential = session.credential;
  const epoch = sessionEpoch;
  const requestGeneration = ++catalogGeneration;
  const controller = new AbortController();
  sessionTasks.add(controller);
  try {
    const ideas = await loadPresentationIdeas(credential, { signal: controller.signal });
    if (!sessionMatches(credential, epoch) || requestGeneration !== catalogGeneration) return session.catalog;
    session.catalog = ideas.map(normalizePresentationIdea).filter(Boolean);
    session.catalogLoaded = true;
    if (session.state.selectedIdeaId && !session.catalog.some(item => item.id === session.state.selectedIdeaId)) {
      enqueuePresentationChanges({ selectedIdeaId: null }, { immediate: true });
    }
    return session.catalog;
  } finally {
    sessionTasks.delete(controller);
  }
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
  session.renderError = ['MAP_UNAVAILABLE', 'IMAGE_UNAVAILABLE', 'STREETMIX_UNAVAILABLE', 'CONTENT_UNAVAILABLE', 'TILE_UNAVAILABLE', 'RENDER_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'UNKNOWN'].includes(errorCode) ? errorCode : null;
  if (status === 'ready' || status === 'error') session.reportedRevision = Math.max(session.reportedRevision, Number(revision) || 0);
  socketClient?.notifyPresenceChanged();
}

export function setLocalAudienceView(action) {
  if (session.role !== 'audience') return;
  session.audienceView = reduceAudienceView(session.audienceView, action, writableViewState.value, session.content);
  socketClient?.notifyPresenceChanged();
}

export async function rotatePresenterCode() {
  const credential = session.credential;
  const epoch = sessionEpoch;
  const controller = new AbortController();
  sessionTasks.add(controller);
  try {
    const result = await rotatePresenterCodeRequest(credential, { signal: controller.signal });
    if (!sessionMatches(credential, epoch)) return null;
    session.credential = { ...session.credential, presenterCode: result.presenterCode, presenterCodeExpiresAt: result.presenterCodeExpiresAt };
    delete session.credential.pendingPairingRotation;
    persistCredential();
    return result;
  } finally {
    sessionTasks.delete(controller);
  }
}

export async function leaveOrEndPresentation({ end = false } = {}) {
  const credential = session.credential;
  if (!credential) {
    clearActivePresentationCredential();
    resetSession();
    return;
  }
  stopPresentationSession();
  const completionGeneration = operationGeneration;
  try {
    if (end && ['receiver', 'controller'].includes(credential.role)) await endPresentation(credential);
    else if (credential.role !== 'receiver') await leavePresentation(credential);
  } finally {
    if (completionGeneration === operationGeneration) {
      clearPresentationCredentialIfMatches(credential);
      resetSession();
    }
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
    if (!session.credential) return;
    if (document.visibilityState === 'hidden') {
      releaseWakeLock();
      return;
    }
    socketClient?.notifyVisible();
    ensureWakeLock(sessionEpoch);
    if (socketClient?.state !== 'live' && !stopped) {
      if (pollTimer !== null) clearTimeout(pollTimer);
      pollTimer = null;
      void syncOnce(true);
      schedulePoll(0);
    }
  });
  globalThis.addEventListener?.('online', () => {
    if (!session.credential || stopped) return;
    socketClient?.notifyVisible();
    if (socketClient?.state !== 'live') {
      void syncOnce(true);
      schedulePoll(0);
    }
  });
  globalThis.addEventListener?.('pagehide', () => {
    if (session.credential && !stopped) stopPresentationSession();
  });
  globalThis.addEventListener?.('pageshow', () => {
    if (session.credential && stopped) void restorePresentationSession();
  });
}
