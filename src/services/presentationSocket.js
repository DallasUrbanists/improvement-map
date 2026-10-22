import { API_BASE_URL } from './apiBaseUrl.js';
import { PRESENTATION_API_PATH } from './presentationApi.js';
import { PRESENTATION_PROTOCOL_VERSION } from './presentationState.js';

export const PRESENTATION_SOCKET_PROTOCOL_VERSION = 1;
export const PRESENTATION_SOCKET_PATH = `${PRESENTATION_API_PATH}/ws`;
export const PRESENTATION_SOCKET_READY_TIMEOUT_MS = 25_000;
export const PRESENTATION_SOCKET_LIVENESS_MS = 35_000;

const terminalErrors = new Set([
  'SESSION_ENDED', 'SESSION_EXPIRED', 'INVALID_SESSION_CREDENTIAL', 'ROLE_FORBIDDEN',
]);
const retryableCloseCodes = new Set([4000, 1001, 1006, 1011, 1013]);
const renderErrors = new Set([
  'MAP_UNAVAILABLE', 'IMAGE_UNAVAILABLE', 'STREETMIX_UNAVAILABLE', 'CONTENT_UNAVAILABLE',
  'TILE_UNAVAILABLE', 'RENDER_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'UNKNOWN',
]);

const defaultClock = {
  now: () => globalThis.performance?.now?.() ?? Date.now(),
  setTimeout: (...args) => globalThis.setTimeout(...args),
  clearTimeout: timer => globalThis.clearTimeout(timer),
};

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function keysWithOptional(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return required.every(key => Object.hasOwn(value, key))
    && keys.every(key => required.includes(key) || optional.includes(key));
}

export function buildPresentationSocketUrl(apiBaseUrl = API_BASE_URL) {
  const configured = new URL(String(apiBaseUrl));
  configured.username = '';
  configured.password = '';
  const url = new URL(PRESENTATION_SOCKET_PATH, configured.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : url.protocol === 'http:' ? 'ws:' : url.protocol;
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new TypeError('The presentation API URL must use HTTP or HTTPS.');
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function validatePresentationPresence(role, presence) {
  if (!presence || typeof presence !== 'object' || Array.isArray(presence)) return false;
  if (role === 'controller') return exactKeys(presence, []);
  if (role === 'audience') {
    return keysWithOptional(presence, [], ['localView'])
      && (!Object.hasOwn(presence, 'localView') || ['map', 'photo', 'description'].includes(presence.localView));
  }
  if (role === 'receiver') {
    return exactKeys(presence, ['appliedRevision', 'viewport', 'renderStatus', 'renderError'])
      && Number.isSafeInteger(presence.appliedRevision) && presence.appliedRevision >= 0
      && exactKeys(presence.viewport, ['width', 'height'])
      && Number.isFinite(presence.viewport.width) && presence.viewport.width >= 0
      && Number.isFinite(presence.viewport.height) && presence.viewport.height >= 0
      && ['loading', 'ready', 'error'].includes(presence.renderStatus)
      && (presence.renderError === null || renderErrors.has(presence.renderError));
  }
  return false;
}

function validServerTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validErrorFrame(frame) {
  return keysWithOptional(frame, ['type', 'socketProtocolVersion', 'error', 'message'], ['retryAfterMs'])
    && frame.type === 'error'
    && frame.socketProtocolVersion === PRESENTATION_SOCKET_PROTOCOL_VERSION
    && typeof frame.error === 'string' && frame.error.length > 0
    && typeof frame.message === 'string'
    && (!Object.hasOwn(frame, 'retryAfterMs')
      || (Number.isFinite(frame.retryAfterMs) && frame.retryAfterMs >= 0 && frame.retryAfterMs <= 60_000));
}

function safeCloseCode(code) {
  return Number.isInteger(code) && code >= 1000 && code <= 4999 ? code : 1000;
}

/**
 * Owns one presentation socket at a time. HTTP synchronization remains the
 * session service's responsibility and stays active until onSnapshot confirms
 * that a full, non-stale snapshot has been applied.
 */
export function createPresentationSocket({
  credential,
  getPresence,
  onSnapshot,
  onState = () => {},
  onError = () => {},
  onTerminal = () => {},
  onIncompatible = () => {},
  onDisabled = () => {},
  socketFactory = url => new WebSocket(url),
  urlFactory = buildPresentationSocketUrl,
  clock = defaultClock,
  random = Math.random,
  readyTimeoutMs = PRESENTATION_SOCKET_READY_TIMEOUT_MS,
  livenessTimeoutMs = PRESENTATION_SOCKET_LIVENESS_MS,
  retryMaxMs = 30_000,
} = {}) {
  let active = false;
  let disabled = false;
  let socket = null;
  let attemptGeneration = 0;
  let attemptCount = 0;
  let retryMinimumMs = 0;
  let attemptTimer = null;
  let livenessTimer = null;
  let retryTimer = null;
  let presenceTimer = null;
  let currentAttempt = null;

  const clearTimer = key => {
    if (key === 'attemptTimer') {
      if (attemptTimer !== null) clock.clearTimeout(attemptTimer);
      attemptTimer = null;
    } else if (key === 'livenessTimer') {
      if (livenessTimer !== null) clock.clearTimeout(livenessTimer);
      livenessTimer = null;
    } else if (key === 'retryTimer') {
      if (retryTimer !== null) clock.clearTimeout(retryTimer);
      retryTimer = null;
    } else if (key === 'presenceTimer') {
      if (presenceTimer !== null) clock.clearTimeout(presenceTimer);
      presenceTimer = null;
    }
  };

  const reportState = (state, detail = {}) => {
    try { onState(state, detail); } catch { /* A view callback cannot own transport cleanup. */ }
  };

  function detachCurrent(code = 1000, reason = 'Presentation transport replaced') {
    const old = currentAttempt;
    currentAttempt = null;
    socket = null;
    clearTimer('attemptTimer');
    clearTimer('livenessTimer');
    clearTimer('presenceTimer');
    if (old) {
      if (old.healthyTimer !== null) clock.clearTimeout(old.healthyTimer);
      old.healthyTimer = null;
      old.intentional = true;
      old.generation = -1;
      try {
        if (old.socket.readyState === 0 || old.socket.readyState === 1) old.socket.close(safeCloseCode(code), reason);
      } catch { /* Closing an already-dead browser socket is harmless. */ }
    }
  }

  function scheduleRetry() {
    if (!active || disabled || retryTimer !== null) return;
    attemptCount++;
    const base = Math.min(retryMaxMs, 1000 * (2 ** Math.min(attemptCount - 1, 5)));
    const jittered = base + Math.floor(Math.max(0, Math.min(1, random())) * Math.min(5000, base * 0.25));
    const delay = Math.max(1, retryMinimumMs, jittered);
    retryMinimumMs = 0;
    retryTimer = clock.setTimeout(() => {
      retryTimer = null;
      openAttempt();
    }, delay);
  }

  function retry(reason, { retryAfterMs = 0, closeCode = 1013, closeReason = 'Presentation transport unavailable' } = {}) {
    if (!active) return;
    retryMinimumMs = Math.max(retryMinimumMs, retryAfterMs);
    detachCurrent(closeCode, closeReason);
    try { onError(reason); } catch { /* Keep reconnect scheduling independent. */ }
    reportState('fallback', { reason });
    scheduleRetry();
  }

  function disable(reason, code = 1008) {
    if (!active) return;
    disabled = true;
    clearTimer('retryTimer');
    detachCurrent(code, 'Presentation socket disabled');
    try { onDisabled(reason); } catch { /* HTTP fallback remains available. */ }
    reportState('disabled', { reason });
  }

  function stop(reason, { notify = false } = {}) {
    active = false;
    disabled = true;
    clearTimer('retryTimer');
    detachCurrent(1000, 'Presentation client stopped');
    if (notify) reportState('stopped', { reason });
  }

  function sendPresence(heartbeatId = null, owner = currentAttempt) {
    if (!active || !owner || owner !== currentAttempt || owner.generation !== attemptGeneration
      || owner.socket.readyState !== 1) return 'unavailable';
    let presence;
    try { presence = getPresence(); } catch { return 'invalid'; }
    if (!validatePresentationPresence(credential?.role, presence)) return 'invalid';
    if (heartbeatId !== null && (typeof heartbeatId !== 'string' || !heartbeatId.length || heartbeatId.length > 64)) return 'invalid';
    const frame = { type: 'presence', socketProtocolVersion: PRESENTATION_SOCKET_PROTOCOL_VERSION, heartbeatId, presence };
    try {
      owner.socket.send(JSON.stringify(frame));
      return 'sent';
    } catch {
      retry({ code: 'PRESENTATION_UNAVAILABLE', message: 'Presentation updates are temporarily unavailable.' });
      return 'unavailable';
    }
  }

  function markLive(owner) {
    if (owner !== currentAttempt || owner.live || !owner.snapshotApplied) return;
    owner.live = true;
    owner.lastValidFrameAt = clock.now();
    clearTimer('attemptTimer');
    clearTimer('retryTimer');
    reportState('live');
    owner.healthyTimer = clock.setTimeout(() => {
      if (active && currentAttempt === owner && owner.live) attemptCount = 0;
    }, 30_000);
    if (!owner.initialPresenceSent) {
      const response = sendPresence(null, owner);
      if (response === 'invalid') {
        fault(owner, 'INVALID_PRESENCE', 'The presentation could not report its current view state.');
        return;
      }
      owner.initialPresenceSent = response === 'sent';
    }
    if (owner === currentAttempt) scheduleLiveness(owner);
  }

  function scheduleLiveness(owner) {
    clearTimer('livenessTimer');
    if (!owner.live || owner !== currentAttempt) return;
    const age = clock.now() - owner.lastValidFrameAt;
    const remaining = livenessTimeoutMs - age;
    if (remaining <= 0) {
      retry({ code: 'PRESENTATION_HEARTBEAT_TIMEOUT', message: 'The presentation connection stopped responding.' }, { closeCode: 1013 });
      return;
    }
    livenessTimer = clock.setTimeout(() => scheduleLiveness(owner), remaining);
  }

  function fault(owner, code, message) {
    if (owner !== currentAttempt) return;
    disable({ code, message }, code === 'SOCKET_PROTOCOL_UNSUPPORTED' ? 4004 : 1008);
  }

  function applySnapshot(owner, frame, isReady) {
    let result;
    try { result = onSnapshot(frame); }
    catch (error) {
      fault(owner, 'INVALID_PRESENTATION_SNAPSHOT', error?.message || 'The presentation sent an invalid state snapshot.');
      return;
    }
    if (result && typeof result.then === 'function') {
      fault(owner, 'INVALID_PRESENTATION_SNAPSHOT', 'Presentation snapshot validation must complete synchronously.');
      return;
    }
    const valid = result === true || result?.valid === true;
    if (!valid) {
      fault(owner, 'INVALID_PRESENTATION_SNAPSHOT', 'The presentation sent an invalid state snapshot.');
      return;
    }
    owner.lastValidFrameAt = clock.now();
    if (owner.live) scheduleLiveness(owner);
    const applied = result === true || result?.applied === true;
    if (applied) {
      owner.snapshotApplied = true;
      if (!owner.live) markLive(owner);
    }
    if (isReady && !owner.initialPresenceSent && owner === currentAttempt) {
      const response = sendPresence(null, owner);
      if (response === 'invalid') {
        fault(owner, 'INVALID_PRESENCE', 'The presentation could not report its current view state.');
        return;
      }
      owner.initialPresenceSent = response === 'sent';
    }
  }

  function handleMessage(owner, event) {
    if (owner !== currentAttempt || owner.generation !== attemptGeneration) return;
    if (typeof event.data !== 'string') {
      fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent a non-text frame.');
      return;
    }
    let frame;
    try { frame = JSON.parse(event.data); } catch {
      fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an invalid frame.');
      return;
    }
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
      fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an invalid frame.');
      return;
    }
    if (frame.socketProtocolVersion !== PRESENTATION_SOCKET_PROTOCOL_VERSION) {
      fault(owner, 'SOCKET_PROTOCOL_UNSUPPORTED', 'This presentation socket protocol is not supported.');
      return;
    }

    if (frame.type === 'ready' || frame.type === 'snapshot') {
      if (!exactKeys(frame, ['type', 'socketProtocolVersion', 'sequence', 'envelope'])
        || !Number.isSafeInteger(frame.sequence) || frame.sequence <= 0) {
        fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an invalid state frame.');
        return;
      }
      if (frame.type === 'ready') {
        if (owner.readySeen || owner.sequence !== 0 || frame.sequence !== 1) {
          fault(owner, 'INVALID_SOCKET_SEQUENCE', 'The presentation socket sent an out-of-order ready frame.');
          return;
        }
        owner.readySeen = true;
      } else {
        if (!owner.readySeen) {
          fault(owner, 'INVALID_SOCKET_SEQUENCE', 'The presentation socket sent state before ready.');
          return;
        }
        if (frame.sequence <= owner.sequence) return;
      }
      owner.sequence = frame.sequence;
      applySnapshot(owner, frame, frame.type === 'ready');
      return;
    }

    if (frame.type === 'heartbeat') {
      if (!exactKeys(frame, ['type', 'socketProtocolVersion', 'id', 'serverTime'])
        || typeof frame.id !== 'string' || frame.id.length < 1 || frame.id.length > 64
        || !validServerTime(frame.serverTime) || !owner.readySeen) {
        fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an invalid heartbeat.');
        return;
      }
      const response = sendPresence(frame.id, owner);
      if (response === 'invalid') {
        fault(owner, 'INVALID_PRESENCE', 'The presentation could not report its current view state.');
        return;
      }
      if (response !== 'sent') return;
      owner.lastValidFrameAt = clock.now();
      if (owner.live) scheduleLiveness(owner);
      return;
    }

    if (frame.type === 'error') {
      if (!validErrorFrame(frame)) {
        fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an invalid error frame.');
        return;
      }
      const error = { code: frame.error, message: frame.message, retryAfterMs: frame.retryAfterMs || 0 };
      owner.errorCode = frame.error;
      owner.errorMessage = frame.message;
      if (terminalErrors.has(frame.error)) {
        stop(frame.error);
        try { onTerminal(error); } catch { /* Session teardown has already stopped retries. */ }
      } else if (frame.error === 'PROTOCOL_UNSUPPORTED') {
        stop(frame.error);
        try { onIncompatible(error); } catch { /* The session service owns compatibility UI. */ }
      } else if (frame.error === 'SOCKET_PROTOCOL_UNSUPPORTED' || frame.error === 'PRESENTATION_DISABLED') {
        try { onError(error); } catch { /* Socket incompatibility does not revoke HTTP access. */ }
        disable(error, 4004);
      } else {
        retry(error, { retryAfterMs: error.retryAfterMs, closeCode: 1013 });
      }
      return;
    }

    fault(owner, 'INVALID_SOCKET_FRAME', 'The presentation socket sent an unknown frame.');
  }

  function handleClose(owner, event) {
    if (owner !== currentAttempt || owner.intentional || !active) return;
    const code = event?.code || 1006;
    if (terminalErrors.has(owner.errorCode)) return;
    if (code === 4001 || code === 4003) {
      const error = { code: owner.errorCode || (code === 4001 ? 'INVALID_SESSION_CREDENTIAL' : 'SESSION_TERMINAL'), message: 'This presentation connection is no longer active.' };
      stop(error.code);
      try { onTerminal(error); } catch { /* The caller will expose terminal state. */ }
      return;
    }
    if (code === 4004 && owner.errorCode === 'PROTOCOL_UNSUPPORTED') {
      stop(owner.errorCode);
      try { onIncompatible({ code: owner.errorCode, message: owner.errorMessage || '' }); } catch { /* No automatic retry for shared protocol mismatch. */ }
      return;
    }
    if (retryableCloseCodes.has(code) || code === 1000) {
      retry({ code: owner.errorCode || 'PRESENTATION_UNAVAILABLE', message: owner.errorMessage || 'The presentation connection was interrupted.' }, { closeCode: 1000 });
      return;
    }
    if (code === 4004) {
      disable({ code: 'SOCKET_PROTOCOL_UNSUPPORTED', message: 'This presentation socket protocol is not supported.' }, code);
      return;
    }
    if (code === 1008 || code === 1009 || (code >= 4000 && code < 5000) || (code >= 1000 && code < 1016)) {
      disable({ code: 'PRESENTATION_SOCKET_FAULT', message: 'The presentation socket could not be used; HTTP updates remain available.' }, code);
      return;
    }
    retry({ code: 'PRESENTATION_UNAVAILABLE', message: 'The presentation connection was interrupted.' }, { closeCode: 1013 });
  }

  function openAttempt() {
    if (!active || disabled) return;
    clearTimer('retryTimer');
    detachCurrent(1000, 'New presentation socket attempt');
    const generation = ++attemptGeneration;
    const owner = {
      generation, socket: null, intentional: false, readySeen: false, initialPresenceSent: false,
      snapshotApplied: false, live: false, sequence: 0, lastValidFrameAt: 0,
      errorCode: '', errorMessage: '', healthyTimer: null,
    };
    currentAttempt = owner;
    reportState(attemptCount ? 'reconnecting' : 'connecting');
    attemptTimer = clock.setTimeout(() => {
      if (owner !== currentAttempt) return;
      retry({ code: 'PRESENTATION_SOCKET_TIMEOUT', message: 'The presentation connection timed out.' }, { closeCode: 1013 });
    }, readyTimeoutMs);
    let instance;
    try { instance = socketFactory(urlFactory()); }
    catch {
      retry({ code: 'PRESENTATION_UNAVAILABLE', message: 'The presentation service is unavailable.' });
      return;
    }
    owner.socket = instance;
    socket = instance;
    instance.addEventListener('open', () => {
      if (owner !== currentAttempt || owner.generation !== attemptGeneration) return;
      const authenticate = {
        type: 'authenticate',
        socketProtocolVersion: PRESENTATION_SOCKET_PROTOCOL_VERSION,
        protocolVersion: PRESENTATION_PROTOCOL_VERSION,
        sessionId: credential.sessionId,
        participantId: credential.participantId,
        participantToken: credential.participantToken,
      };
      try { instance.send(JSON.stringify(authenticate)); }
      catch { retry({ code: 'PRESENTATION_UNAVAILABLE', message: 'The presentation service is unavailable.' }); }
    });
    instance.addEventListener('message', event => handleMessage(owner, event));
    instance.addEventListener('error', () => {
      if (owner === currentAttempt && active) retry({ code: 'PRESENTATION_UNAVAILABLE', message: 'The presentation connection was interrupted.' });
    });
    instance.addEventListener('close', event => handleClose(owner, event));
  }

  function start() {
    if (active) return;
    active = true;
    disabled = false;
    attemptCount = 0;
    retryMinimumMs = 0;
    openAttempt();
  }

  function notifyPresenceChanged() {
    if (!active || !currentAttempt?.live || presenceTimer !== null) return;
    presenceTimer = clock.setTimeout(() => {
      presenceTimer = null;
      sendPresence(null, currentAttempt);
    }, 100);
  }

  function notifyVisible() {
    if (!active) return;
    const owner = currentAttempt;
    if (owner?.live && clock.now() - owner.lastValidFrameAt >= livenessTimeoutMs) {
      retry({ code: 'PRESENTATION_HEARTBEAT_TIMEOUT', message: 'The presentation connection stopped responding.' }, { closeCode: 1013 });
      return;
    }
    if (!owner && !disabled && retryTimer === null) openAttempt();
  }

  function suspend() {
    if (!active) return;
    clearTimer('retryTimer');
    detachCurrent(1000, 'Presentation page suspended');
    reportState('suspended');
  }

  function resume() {
    if (!active || disabled) return;
    if (!currentAttempt) openAttempt();
  }

  return {
    start,
    stop,
    suspend,
    resume,
    notifyVisible,
    notifyPresenceChanged,
    retryNow() {
      if (!active) return;
      disabled = false;
      retryMinimumMs = 0;
      attemptCount = 0;
      clearTimer('retryTimer');
      openAttempt();
    },
    get state() { return !active ? 'stopped' : disabled ? 'disabled' : currentAttempt?.live ? 'live' : currentAttempt ? 'connecting' : 'fallback'; },
    get currentSocket() { return socket; },
  };
}
