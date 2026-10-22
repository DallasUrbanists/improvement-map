import { test, expect } from '@playwright/test';
import {
  buildPresentationSocketUrl, createPresentationSocket, validatePresentationPresence,
} from '../src/services/presentationSocket.js';
import { parsePresentationRetryAfter } from '../src/services/presentationApi.js';

class FakeClock {
  nowValue = 0;
  nextId = 0;
  timers = new Map();
  now = () => this.nowValue;
  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.timers.set(id, { id, at: this.nowValue + delay, callback });
    return id;
  };
  clearTimeout = id => this.timers.delete(id);
  advance(milliseconds) {
    const target = this.nowValue + milliseconds;
    while (true) {
      const next = [...this.timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!next || next.at > target) break;
      this.timers.delete(next.id);
      this.nowValue = next.at;
      next.callback();
    }
    this.nowValue = target;
  }
}

class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = FakeSocket.CONNECTING;
  listeners = new Map();
  sent = [];
  constructor(url) { this.url = url; }
  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(callback);
    this.listeners.set(name, listeners);
  }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); }
  open() { this.readyState = FakeSocket.OPEN; this.emit('open'); }
  receive(frame) { this.emit('message', { data: JSON.stringify(frame) }); }
  close(code = 1000, reason = '') {
    const wasOpen = this.readyState !== FakeSocket.CLOSED;
    this.readyState = FakeSocket.CLOSED;
    if (wasOpen) this.emit('close', { code, reason });
  }
  serverClose(code = 1013, reason = '') { this.close(code, reason); }
  send(raw) { this.sent.push(JSON.parse(raw)); }
}

function harness({ presence = {}, role = 'controller', onSnapshot = () => ({ valid: true, applied: true }), readyTimeoutMs } = {}) {
  const clock = new FakeClock();
  const sockets = [];
  const states = [];
  const errors = [];
  const terminals = [];
  const disabled = [];
  const client = createPresentationSocket({
    credential: { role, sessionId: 'session-id', participantId: 'participant-id', participantToken: 'secret-token' },
    getPresence: () => presence,
    onSnapshot,
    onState: (state, detail) => states.push({ state, detail }),
    onError: error => errors.push(error),
    onTerminal: error => terminals.push(error),
    onDisabled: error => disabled.push(error),
    urlFactory: () => 'wss://api.example.test/api/public-improvements/presentation/ws',
    socketFactory: url => { const socket = new FakeSocket(url); sockets.push(socket); return socket; },
    clock,
    random: () => 0,
    ...(readyTimeoutMs ? { readyTimeoutMs } : {}),
  });
  return { client, clock, sockets, states, errors, terminals, disabled };
}

const ready = {
  type: 'ready', socketProtocolVersion: 1, sequence: 1,
  envelope: { protocolVersion: 1 },
};

function authenticate(h) {
  h.client.start();
  const socket = h.sockets[0];
  socket.open();
  expect(socket.sent[0]).toEqual({
    type: 'authenticate', socketProtocolVersion: 1, protocolVersion: 1,
    sessionId: 'session-id', participantId: 'participant-id', participantToken: 'secret-token',
  });
  socket.receive(ready);
  return socket;
}

test('socket URL follows the configured API origin and keeps credentials out of the URL', { tag: '@unit' }, () => {
  expect(buildPresentationSocketUrl('https://user:pass@api.example.test/base?secret=x#fragment'))
    .toBe('wss://api.example.test/api/public-improvements/presentation/ws');
  expect(buildPresentationSocketUrl('http://api.example.test')).toBe('ws://api.example.test/api/public-improvements/presentation/ws');
});

test('authenticates once, reports initial presence, and stays live through two minutes of heartbeats', { tag: '@unit' }, () => {
  const presence = { appliedRevision: 3, viewport: { width: 1280, height: 720 }, renderStatus: 'ready', renderError: 'TILE_UNAVAILABLE' };
  const h = harness({ role: 'receiver', presence });
  const socket = authenticate(h);
  expect(h.client.state).toBe('live');
  expect(socket.sent[1]).toEqual({ type: 'presence', socketProtocolVersion: 1, heartbeatId: null, presence });
  for (let second = 15; second <= 120; second += 15) {
    h.clock.advance(15_000);
    socket.receive({ type: 'heartbeat', socketProtocolVersion: 1, id: `hb-${second}`, serverTime: '2026-10-22T18:00:00.000Z' });
    expect(socket.sent.at(-1)).toEqual({ type: 'presence', socketProtocolVersion: 1, heartbeatId: `hb-${second}`, presence });
  }
  expect(h.client.state).toBe('live');
  expect(h.sockets).toHaveLength(1);
  expect(h.errors).toHaveLength(0);
  h.client.stop();
  expect(h.clock.timers.size).toBe(0);
});

test('duplicate snapshots do not refresh liveness, and transient close falls back before retry', { tag: '@unit' }, () => {
  const h = harness();
  const socket = authenticate(h);
  h.clock.advance(30_000);
  socket.receive({ type: 'snapshot', socketProtocolVersion: 1, sequence: 1, envelope: { protocolVersion: 1 } });
  h.clock.advance(5_000);
  expect(h.client.state).toBe('fallback');
  expect(h.states.some(({ state }) => state === 'fallback')).toBe(true);
  h.clock.advance(1_000);
  expect(h.sockets).toHaveLength(2);
  h.client.stop();
});

test('a stale ready snapshot sends presence without taking ownership, then a fresh snapshot hands over', { tag: '@unit' }, () => {
  let snapshots = 0;
  const h = harness({ onSnapshot: () => ({ valid: true, applied: ++snapshots > 1 }) });
  const socket = authenticate(h);
  expect(h.client.state).toBe('connecting');
  expect(socket.sent[1]).toEqual({ type: 'presence', socketProtocolVersion: 1, heartbeatId: null, presence: {} });

  socket.receive({ type: 'heartbeat', socketProtocolVersion: 1, id: 'candidate-hb', serverTime: '2026-10-22T18:00:15.000Z' });
  expect(socket.sent[2]).toEqual({ type: 'presence', socketProtocolVersion: 1, heartbeatId: 'candidate-hb', presence: {} });
  expect(h.client.state).toBe('connecting');

  socket.receive({ type: 'snapshot', socketProtocolVersion: 1, sequence: 2, envelope: { protocolVersion: 1 } });
  expect(h.client.state).toBe('live');
  expect(socket.sent.filter(frame => frame.type === 'presence' && frame.heartbeatId === null)).toHaveLength(1);
  h.client.stop();
});

test('socket-only incompatibility disables probes while terminal errors stop the session', { tag: '@unit' }, () => {
  const unsupported = harness();
  const socket = authenticate(unsupported);
  socket.receive({ type: 'error', socketProtocolVersion: 1, error: 'SOCKET_PROTOCOL_UNSUPPORTED', message: 'Update the socket client.' });
  expect(unsupported.client.state).toBe('disabled');
  expect(unsupported.disabled[0].code).toBe('SOCKET_PROTOCOL_UNSUPPORTED');
  unsupported.clock.advance(60_000);
  expect(unsupported.sockets).toHaveLength(1);

  const terminal = harness();
  authenticate(terminal).receive({ type: 'error', socketProtocolVersion: 1, error: 'SESSION_EXPIRED', message: 'This presentation has expired.' });
  expect(terminal.client.state).toBe('stopped');
  expect(terminal.terminals[0].code).toBe('SESSION_EXPIRED');
  terminal.clock.advance(120_000);
  expect(terminal.sockets).toHaveLength(1);

  const incompatible = harness();
  authenticate(incompatible).receive({ type: 'error', socketProtocolVersion: 1, error: 'PROTOCOL_UNSUPPORTED', message: 'Update the app.' });
  expect(incompatible.client.state).toBe('stopped');
  expect(incompatible.disabled).toHaveLength(0);
});

test('ready deadline and explicit Retry-After bound retries without a zero-delay loop', { tag: '@unit' }, () => {
  const delayed = harness({ readyTimeoutMs: 5000 });
  delayed.client.start();
  delayed.clock.advance(4999);
  expect(delayed.sockets).toHaveLength(1);
  delayed.clock.advance(1);
  expect(delayed.client.state).toBe('fallback');
  delayed.clock.advance(999);
  expect(delayed.sockets).toHaveLength(1);
  delayed.clock.advance(1);
  expect(delayed.sockets).toHaveLength(2);
  delayed.client.stop();

  const limited = harness();
  authenticate(limited).receive({
    type: 'error', socketProtocolVersion: 1, error: 'PRESENTATION_UNAVAILABLE',
    message: 'Try later.', retryAfterMs: 10_000,
  });
  limited.clock.advance(9999);
  expect(limited.sockets).toHaveLength(1);
  limited.clock.advance(1);
  expect(limited.sockets).toHaveLength(2);
  limited.client.stop();
});

test('terminal and policy close codes differ from transient or unknown-close recovery', { tag: '@unit' }, () => {
  const transient = harness();
  authenticate(transient).serverClose(1000, 'remote closed');
  expect(transient.client.state).toBe('fallback');
  transient.clock.advance(1000);
  expect(transient.sockets).toHaveLength(2);
  transient.client.stop();

  const policy = harness();
  authenticate(policy).serverClose(1008, 'policy');
  expect(policy.client.state).toBe('disabled');
  policy.clock.advance(60_000);
  expect(policy.sockets).toHaveLength(1);

  const revoked = harness();
  authenticate(revoked).serverClose(4001, 'rejected');
  expect(revoked.client.state).toBe('stopped');
  expect(revoked.terminals[0].code).toBe('INVALID_SESSION_CREDENTIAL');
});

test('rejects invalid role presence before acknowledging a server heartbeat', { tag: '@unit' }, () => {
  const h = harness({ role: 'controller', presence: { privateRoster: [] } });
  const socket = authenticate(h);
  const sendsBefore = socket.sent.length;
  socket.receive({ type: 'heartbeat', socketProtocolVersion: 1, id: 'hb-1', serverTime: '2026-10-22T18:00:00.000Z' });
  expect(socket.sent).toHaveLength(sendsBefore);
  expect(h.client.state).toBe('disabled');
  expect(validatePresentationPresence('controller', {})).toBe(true);
  expect(validatePresentationPresence('receiver', { appliedRevision: 0, viewport: { width: 1, height: 1 }, renderStatus: 'error', renderError: 'NETWORK_ERROR' })).toBe(true);
});

test('Retry-After preserves a 120 second delay and parses HTTP dates against controlled time', { tag: '@unit' }, () => {
  const now = Date.parse('2026-10-22T18:00:00.000Z');
  expect(parsePresentationRetryAfter('120', now)).toBe(120_000);
  expect(parsePresentationRetryAfter('Thu, 22 Oct 2026 18:02:00 GMT', now)).toBe(120_000);
  expect(parsePresentationRetryAfter('not a date', now)).toBe(0);
});
