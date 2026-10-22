import { createDefaultPresentationState, DEFAULT_PHOTO_FRAME } from '../../src/services/presentationState.js';

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const id = suffix => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const defaultApiOrigin = 'https://api.presentation.test';

export const presentationIdeas = [
  {
    id: '101', contentVersion: 'content-101-v1', creationDate: '2026-10-20T12:00:00.000Z', status: 'open',
    summary: 'Safer crossing at Elm Street', details: 'Add a protected crossing and slower turning design.',
    descriptionPages: ['Improve visibility at the crossing.', 'Add a raised pedestrian crossing and protected corners.'],
    location: { latitude: 32.7812, longitude: -96.7932, address: 'Elm Street & Akard Street, Dallas, TX', description: 'Downtown Dallas' },
    emoji: '🚶', album: [{ id: 'photo-101-a', kind: 'photo', url: 'https://images.test/101-a.png', caption: 'The current crossing' }],
  },
  {
    id: '202', contentVersion: 'content-202-v1', creationDate: '2026-10-19T12:00:00.000Z', status: 'open',
    summary: 'Protected bike lane on Main Street', details: 'Create a protected connection through the district.',
    descriptionPages: ['Connect the protected lane to the trail.', 'Use a concrete buffer and clear intersection markings.'],
    location: { latitude: 32.7767, longitude: -96.797, address: 'Main Street, Dallas, TX', description: 'Main Street' },
    album: [
      { id: 'photo-202-a', kind: 'photo', url: 'https://images.test/202-a.png', caption: 'Existing street layout' },
      { id: 'streetmix-202', kind: 'streetmix', url: 'https://streetmix.net/-/24680', streetmixId: '24680', thumbnailPath: '/api/public-improvements/presentation/sessions/fixture/ideas/202/streetmix-thumbnail', stale: false },
    ],
  },
];

export class PresentationTestServer {
  constructor({ clock = () => Date.now(), appOrigin = 'http://localhost:5173', apiOrigin = defaultApiOrigin } = {}) {
    this.clock = clock;
    this.appOrigin = new URL(appOrigin).origin;
    this.apiOrigin = new URL(apiOrigin).origin;
    this.sessions = new Map();
    this.idempotency = new Map();
    this.sequence = 0;
    this.stateAttempts = 0;
    this.stateMutations = 0;
    this.stateKeys = [];
    this.dropNextStateResponse = false;
    this.dropStateResponses = 0;
    this.rateLimitNextStateResponses = 0;
    this.enrollmentRequests = [];
    this.syncRequests = 0;
    this.socketAttempts = 0;
    this.socketAuthFrames = [];
    this.socketPresence = [];
    this.socketConnections = new Set();
  }

  get serverTimeMs() { return this.clock(); }

  newSession(body) {
    this.sequence++;
    const sessionId = id(this.sequence);
    const state = createDefaultPresentationState();
    const participant = { id: body.participantId, token: body.participantToken, role: 'receiver', connected: true, displayName: null, localView: null };
    const session = {
      id: sessionId, status: 'waiting', revision: 0, state,
      expiresAt: new Date(this.serverTimeMs + 10 * 60_000).toISOString(),
      presenterCode: '01234', presenterCodeExpiresAt: new Date(this.serverTimeMs + 10 * 60_000).toISOString(),
      audienceCode: '56789', controllerId: null, receiver: null,
      participants: new Map([[participant.id, participant]]), content: null,
    };
    this.sessions.set(sessionId, session);
    return {
      protocolVersion: 1, sessionId, participantId: participant.id, role: 'receiver',
      expiresAt: session.expiresAt, state: { ...state }, presenterCode: session.presenterCode,
      presenterCodeExpiresAt: session.presenterCodeExpiresAt, audienceCode: session.audienceCode,
    };
  }

  idemKey(request, body) {
    const key = request.headers()['idempotency-key'];
    return key ? `${request.method()}:${key}` : '';
  }

  cached(request, body) {
    const key = this.idemKey(request, body);
    if (!key) return null;
    const item = this.idempotency.get(key);
    if (!item) return null;
    if (JSON.stringify(item.body) !== JSON.stringify(body)) return { status: 409, body: { protocolVersion: 1, error: 'IDEMPOTENCY_CONFLICT', message: 'This request could not be repeated.' } };
    return item.result;
  }

  remember(request, body, result) {
    const key = this.idemKey(request, body);
    if (key) this.idempotency.set(key, { body: structuredClone(body), result: structuredClone(result) });
  }

  dropStateResponse(result) {
    if (!this.dropNextStateResponse && this.dropStateResponses <= 0) return result;
    this.dropNextStateResponse = false;
    this.dropStateResponses = Math.max(0, this.dropStateResponses - 1);
    return { ...result, drop: true };
  }

  error(status, code, message) { return { status, body: { protocolVersion: 1, error: code, message } }; }

  currentEnvelope(session, role, { force = true } = {}) {
    const content = session.state.selectedIdeaId === null ? null : session.content;
    return {
      status: 200,
      body: {
        protocolVersion: 1, serverTime: new Date(this.serverTimeMs).toISOString(),
        session: { id: session.id, status: session.status, expiresAt: session.expiresAt, revision: session.revision },
        changed: true, state: force ? structuredClone(session.state) : null,
        content: content ? structuredClone(content) : null,
        participants: role === 'controller' ? [...session.participants.values()].filter(person => person.role === 'audience').map(person => ({ id: person.id, displayName: person.displayName, connected: person.connected, localView: person.localView, lastSeenAt: new Date(this.serverTimeMs).toISOString() })) : null,
        audienceCode: role === 'controller' ? session.audienceCode : undefined,
        receiver: role === 'controller' || role === 'audience' ? null : session.receiver,
      },
    };
  }

  fullSocketEnvelope(session, role) {
    const { body } = this.currentEnvelope(session, role, { force: true });
    body.changed = true;
    body.state = structuredClone(session.state);
    body.content = session.state.selectedIdeaId === null ? null : structuredClone(session.content);
    if (role !== 'controller') delete body.audienceCode;
    return body;
  }

  sendSnapshot(session, connection) {
    if (!connection?.authenticated || connection.closed || connection.session !== session) return false;
    connection.sequence++;
    try {
      connection.route.send(JSON.stringify({
        type: 'snapshot', socketProtocolVersion: 1, sequence: connection.sequence,
        envelope: this.fullSocketEnvelope(session, connection.participant.role),
      }));
      return true;
    } catch { return false; }
  }

  broadcastSnapshot(session) {
    for (const connection of this.socketConnections) this.sendSnapshot(session, connection);
  }

  heartbeat(sessionId, idValue = 'heartbeat-fixture') {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    let sent = 0;
    for (const connection of this.socketConnections) {
      if (!connection.authenticated || connection.session !== session || connection.closed) continue;
      connection.route.send(JSON.stringify({
        type: 'heartbeat', socketProtocolVersion: 1, id: idValue,
        serverTime: new Date(this.serverTimeMs).toISOString(),
      }));
      sent++;
    }
    return sent;
  }

  dropSockets(sessionId, code = 1013) {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    let closed = 0;
    for (const connection of [...this.socketConnections]) {
      if (connection.session !== session || connection.closed) continue;
      connection.closed = true;
      this.socketConnections.delete(connection);
      void connection.route.close({ code, reason: 'Fixture transport interruption' });
      closed++;
    }
    return closed;
  }

  routeWebSocket(route) {
    this.socketAttempts++;
    const connection = { route, session: null, participant: null, authenticated: false, closed: false, sequence: 0 };
    const close = (code, message) => {
      connection.closed = true;
      void route.close({ code, reason: message });
    };
    const sendError = (error, message) => route.send(JSON.stringify({ type: 'error', socketProtocolVersion: 1, error, message }));
    route.onMessage(message => {
      let frame;
      try { frame = JSON.parse(String(message)); } catch { close(1008, 'Invalid frame'); return; }
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) { close(1008, 'Invalid frame'); return; }
      if (!connection.authenticated) {
        this.socketAuthFrames.push({ url: route.url(), frame: structuredClone(frame) });
        const fields = ['type', 'socketProtocolVersion', 'protocolVersion', 'sessionId', 'participantId', 'participantToken'];
        if (frame.socketProtocolVersion !== 1) { sendError('SOCKET_PROTOCOL_UNSUPPORTED', 'Unsupported presentation socket version.'); close(4004, 'Unsupported version'); return; }
        if (frame.protocolVersion !== 1) { sendError('PROTOCOL_UNSUPPORTED', 'Update the app to use this presentation.'); close(4004, 'Unsupported protocol'); return; }
        if (frame.type !== 'authenticate' || Object.keys(frame).sort().join('|') !== fields.sort().join('|')
          || typeof frame.sessionId !== 'string' || typeof frame.participantId !== 'string' || typeof frame.participantToken !== 'string') {
          close(1008, 'Invalid authentication frame'); return;
        }
        const session = this.sessions.get(frame.sessionId);
        const participant = session?.participants.get(frame.participantId);
        if (!participant || participant.token !== frame.participantToken || !participant.connected) {
          sendError('INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
          close(4001, 'Rejected participant credential');
          return;
        }
        if (session.status === 'ended' || session.status === 'expired') {
          const code = session.status === 'expired' ? 'SESSION_EXPIRED' : 'SESSION_ENDED';
          sendError(code, session.status === 'expired' ? 'This presentation has expired.' : 'This presentation has ended.');
          close(4003, 'Presentation is no longer active');
          return;
        }
        connection.session = session;
        connection.participant = participant;
        connection.authenticated = true;
        this.socketConnections.add(connection);
        connection.sequence = 1;
        route.send(JSON.stringify({
          type: 'ready', socketProtocolVersion: 1, sequence: 1,
          envelope: this.fullSocketEnvelope(session, participant.role),
        }));
        return;
      }
      const presenceFields = ['type', 'socketProtocolVersion', 'heartbeatId', 'presence'].sort().join('|');
      if (frame.type !== 'presence' || frame.socketProtocolVersion !== 1
        || Object.keys(frame).sort().join('|') !== presenceFields
        || !(frame.heartbeatId === null || (typeof frame.heartbeatId === 'string' && frame.heartbeatId.length > 0 && frame.heartbeatId.length <= 64))
        || !this.validSocketPresence(connection.participant.role, frame.presence)) {
        close(1008, 'Invalid presence frame');
        return;
      }
      this.socketPresence.push({ role: connection.participant.role, heartbeatId: frame.heartbeatId, presence: structuredClone(frame.presence) });
      if (connection.participant.role === 'receiver') connection.session.receiver = structuredClone(frame.presence);
      if (connection.participant.role === 'audience') connection.participant.localView = frame.presence.localView || null;
    });
    route.onClose(() => {
      connection.closed = true;
      this.socketConnections.delete(connection);
    });
  }

  validSocketPresence(role, presence) {
    if (!presence || typeof presence !== 'object' || Array.isArray(presence)) return false;
    if (role === 'controller') return Object.keys(presence).length === 0;
    if (role === 'audience') return Object.keys(presence).every(key => key === 'localView')
      && (!Object.hasOwn(presence, 'localView') || ['map', 'photo', 'description'].includes(presence.localView));
    if (role === 'receiver') return Number.isSafeInteger(presence.appliedRevision) && presence.appliedRevision >= 0
      && presence.viewport && Number.isFinite(presence.viewport.width) && Number.isFinite(presence.viewport.height)
      && ['loading', 'ready', 'error'].includes(presence.renderStatus)
      && (presence.renderError === null || ['MAP_UNAVAILABLE', 'IMAGE_UNAVAILABLE', 'STREETMIX_UNAVAILABLE', 'CONTENT_UNAVAILABLE', 'TILE_UNAVAILABLE', 'RENDER_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'UNKNOWN'].includes(presence.renderError));
    return false;
  }

  authenticate(request, session) {
    const headers = request.headers();
    const idHeader = headers['x-presentation-participant'];
    const token = /^Bearer (.+)$/.exec(headers.authorization || '')?.[1];
    const participant = session?.participants.get(idHeader);
    if (!participant || participant.token !== token || !participant.connected) return null;
    return participant;
  }

  async dispatch(request) {
    const url = new URL(request.url());
    const path = url.pathname.replace(/\/+$/, '');
    const method = request.method();
    const body = request.postDataJSON() || {};
    if (method === 'OPTIONS') return { status: 204, body: null };
    if (body.protocolVersion !== undefined && body.protocolVersion !== 1) return this.error(426, 'PROTOCOL_UNSUPPORTED', 'Update the app to use this presentation.');

    if (method === 'POST' && path.endsWith('/sessions')) {
      this.enrollmentRequests.push({ method, headers: request.headers(), body: structuredClone(body) });
      const cached = this.cached(request, body); if (cached) return cached;
      if (!body.participantId || !body.participantToken) return this.error(422, 'INVALID_ENROLLMENT', 'A participant could not be created.');
      const result = { status: 201, body: this.newSession(body) };
      this.remember(request, body, result);
      return result;
    }

    if (method === 'POST' && path.endsWith('/pair')) {
      this.enrollmentRequests.push({ method, headers: request.headers(), body: structuredClone(body) });
      const cached = this.cached(request, body); if (cached) return cached;
      const session = [...this.sessions.values()].find(item => item.presenterCode === body.code && Date.parse(item.presenterCodeExpiresAt) > this.serverTimeMs);
      if (!session) return this.error(410, 'PAIRING_EXPIRED', 'This presenter code has expired.');
      if (session.controllerId && session.participants.get(session.controllerId)?.connected) return this.error(409, 'PAIRING_CLAIMED', 'Another presenter is already connected.');
      const participant = { id: body.participantId, token: body.participantToken, role: 'controller', connected: true, displayName: null, localView: null };
      session.participants.set(participant.id, participant);
      session.controllerId = participant.id;
      session.status = 'active';
      session.expiresAt = new Date(this.serverTimeMs + 4 * 60 * 60_000).toISOString();
      session.presenterCode = null;
      session.presenterCodeExpiresAt = null;
      const result = { status: 200, body: { protocolVersion: 1, sessionId: session.id, participantId: participant.id, role: 'controller', expiresAt: session.expiresAt, state: structuredClone(session.state), audienceCode: session.audienceCode } };
      this.remember(request, body, result);
      this.broadcastSnapshot(session);
      return result;
    }

    if (method === 'POST' && path.endsWith('/audience/join')) {
      this.enrollmentRequests.push({ method, headers: request.headers(), body: structuredClone(body) });
      const cached = this.cached(request, body); if (cached) return cached;
      const session = [...this.sessions.values()].find(item => item.audienceCode === body.code);
      if (!session || ['ended', 'expired'].includes(session.status)) return this.error(410, 'SESSION_EXPIRED', 'This viewing code is no longer active.');
      const participant = { id: body.participantId, token: body.participantToken, role: 'audience', connected: true, displayName: `Viewer ${session.participants.size}`, localView: null };
      session.participants.set(participant.id, participant);
      const result = { status: 200, body: { protocolVersion: 1, sessionId: session.id, participantId: participant.id, role: 'audience', displayName: participant.displayName, expiresAt: session.expiresAt, state: structuredClone(session.state), ...(session.content ? { content: structuredClone(session.content) } : {}) } };
      this.remember(request, body, result);
      this.broadcastSnapshot(session);
      return result;
    }

    const syncMatch = path.match(/\/sessions\/([^/]+)\/sync$/);
    if (method === 'POST' && syncMatch) {
      this.syncRequests++;
      const session = this.sessions.get(syncMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      if (session.status === 'ended') return this.error(410, 'SESSION_ENDED', 'This presentation has ended.');
      if (participant.role === 'receiver') session.receiver = body.presence || null;
      if (participant.role === 'audience') participant.localView = body.presence?.localView || null;
      const content = session.state.selectedIdeaId === null ? null : session.content;
      const changed = body.lastRevision !== session.revision;
      const contentChanged = content && body.lastContentVersion !== content.contentVersion;
      const envelope = this.currentEnvelope(session, participant.role, { force: changed });
      envelope.body.changed = changed;
      envelope.body.state = changed ? structuredClone(session.state) : null;
      envelope.body.content = contentChanged ? structuredClone(content) : null;
      if (content === null && changed) envelope.body.content = null;
      if (participant.role !== 'controller') { delete envelope.body.audienceCode; }
      return envelope;
    }

    const ideaMatch = path.match(/\/sessions\/([^/]+)\/ideas\/([^/]+)$/);
    if (method === 'GET' && ideaMatch) {
      const session = this.sessions.get(ideaMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      const idea = presentationIdeas.find(item => item.id === ideaMatch[2]);
      if (!idea) return this.error(404, 'IDEA_UNAVAILABLE', 'This idea is no longer available.');
      if (participant.role !== 'controller' && session.state.selectedIdeaId !== idea.id) return this.error(403, 'ROLE_FORBIDDEN', 'This role can only read the selected idea.');
      return { status: 200, body: { protocolVersion: 1, idea: structuredClone(idea) } };
    }

    const catalogMatch = path.match(/\/sessions\/([^/]+)\/ideas$/);
    if (method === 'GET' && catalogMatch) {
      const session = this.sessions.get(catalogMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      if (participant.role !== 'controller') return this.error(403, 'ROLE_FORBIDDEN', 'Only the presenter can browse ideas.');
      const cursor = url.searchParams.get('cursor');
      const offset = cursor === 'page-2' ? 1 : 0;
      const slice = presentationIdeas.slice(offset, offset + 1);
      return { status: 200, body: { protocolVersion: 1, items: structuredClone(slice), nextCursor: offset === 0 ? 'page-2' : null } };
    }

    const thumbMatch = path.match(/\/sessions\/([^/]+)\/ideas\/([^/]+)\/streetmix-thumbnail$/);
    if (method === 'GET' && thumbMatch) {
      const session = this.sessions.get(thumbMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      if (participant.role !== 'controller' && session.state.selectedIdeaId !== thumbMatch[2]) return this.error(403, 'ROLE_FORBIDDEN', 'This role can only read the selected idea.');
      return { status: 200, binary: pixelPng, contentType: 'image/png' };
    }

    const stateMatch = path.match(/\/sessions\/([^/]+)\/state$/);
    if (method === 'PUT' && stateMatch) {
      this.stateAttempts++;
      this.stateKeys.push(request.headers()['idempotency-key'] || '');
      const session = this.sessions.get(stateMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      if (participant.role !== 'controller') return this.error(403, 'ROLE_FORBIDDEN', 'Only the presenter can change the display.');
      if (this.rateLimitNextStateResponses > 0) {
        this.rateLimitNextStateResponses--;
        return { ...this.error(429, 'RATE_LIMITED', 'Please wait briefly before changing the presentation again.'), headers: { 'Retry-After': '1' } };
      }
      const cached = this.cached(request, body); if (cached) return this.dropStateResponse(cached);
      if (body.baseRevision !== session.revision) {
        return { status: 409, body: { protocolVersion: 1, error: 'REVISION_CONFLICT', message: 'The presentation changed. Try that update again.', current: this.currentEnvelope(session, 'controller').body } };
      }
      const selectedId = body.state?.selectedIdeaId;
      const idea = selectedId === null ? null : presentationIdeas.find(item => item.id === selectedId);
      if (selectedId !== null && !idea) return this.error(404, 'IDEA_UNAVAILABLE', 'This idea is no longer available.');
      const changedIdea = selectedId !== session.state.selectedIdeaId;
      const next = { ...session.state, ...structuredClone(body.state), revision: session.revision + 1, ideaEpoch: session.state.ideaEpoch + (changedIdea ? 1 : 0) };
      if (changedIdea) {
        session.content = idea ? structuredClone(idea) : null;
        next.albumItemId = idea?.album[0]?.id || null;
        next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
        next.descriptionPage = 0;
        if (idea && Number.isFinite(idea.location.latitude) && Number.isFinite(idea.location.longitude)) next.camera = { latitude: idea.location.latitude, longitude: idea.location.longitude, zoom: 16 };
        if (!idea) next.mode = 'map';
        else if (!idea.album.length) next.mode = 'description';
      }
      if (body.state.albumItemId !== session.state.albumItemId && !changedIdea) next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
      const albumItem = idea?.album.find(item => item.id === next.albumItemId);
      if (albumItem?.kind === 'streetmix') next.photoFrame = { ...DEFAULT_PHOTO_FRAME };
      if (next.selectedIdeaId === null) next.mode = 'map';
      session.state = next;
      session.revision = next.revision;
      this.stateMutations++;
      const result = this.currentEnvelope(session, 'controller');
      this.remember(request, body, result);
      this.broadcastSnapshot(session);
      return this.dropStateResponse(result);
    }

    const pairingMatch = path.match(/\/sessions\/([^/]+)\/pairing$/);
    if (method === 'POST' && pairingMatch) {
      const session = this.sessions.get(pairingMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant) return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      if (participant.role !== 'receiver') return this.error(403, 'ROLE_FORBIDDEN', 'Only the TV can issue a pairing code.');
      const code = '01234';
      session.presenterCode = code;
      session.presenterCodeExpiresAt = new Date(this.serverTimeMs + 10 * 60_000).toISOString();
      if (session.controllerId) session.participants.get(session.controllerId).connected = false;
      session.controllerId = null;
      return { status: 200, body: { protocolVersion: 1, presenterCode: code, presenterCodeExpiresAt: session.presenterCodeExpiresAt } };
    }

    const participantMatch = path.match(/\/sessions\/([^/]+)\/participants\/me$/);
    if (method === 'DELETE' && participantMatch) {
      const session = this.sessions.get(participantMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant || participant.role === 'receiver') return this.error(401, 'INVALID_SESSION_CREDENTIAL', 'This presentation connection is no longer valid.');
      participant.connected = false;
      if (participant.role === 'controller') session.controllerId = null;
      return { status: 204, body: null };
    }

    const sessionMatch = path.match(/\/sessions\/([^/]+)$/);
    if (method === 'DELETE' && sessionMatch) {
      const session = this.sessions.get(sessionMatch[1]);
      const participant = this.authenticate(request, session);
      if (!participant || !['receiver', 'controller'].includes(participant.role)) return this.error(403, 'ROLE_FORBIDDEN', 'Only the TV or presenter can end this session.');
      session.status = 'ended';
      for (const item of session.participants.values()) item.connected = false;
      return { status: 204, body: null };
    }
    return this.error(404, 'NOT_FOUND', 'Presentation endpoint not found.');
  }

  async route(route) {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Presentation-Participant',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'ETag, Retry-After',
      'Cache-Control': 'no-store',
    };
    if (url.origin === this.appOrigin) return route.continue();
    if (url.hostname === 'images.test') return route.fulfill({ status: 200, contentType: 'image/png', body: pixelPng, headers: { ...cors, 'Cross-Origin-Resource-Policy': 'cross-origin' } });
    if (url.hostname === 'streetmix.net') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Saved design</title><p>Saved street design</p>', headers: cors });
    if (url.origin !== this.apiOrigin || !url.pathname.startsWith('/api/public-improvements/presentation')) return route.abort('blockedbyclient');
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const result = await this.dispatch(request);
    if (result.drop) return route.abort('connectionreset');
    if (result.binary) return route.fulfill({ status: result.status, contentType: result.contentType, body: result.binary, headers: cors });
    if (result.status === 204) return route.fulfill({ status: 204, headers: cors });
    return route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body), headers: { ...cors, ...(result.headers || {}) } });
  }
}

export function presentationBrowserInit() {
  window.GOOGLE_MAPS_API_KEY = 'workspace-test';
  window.__mapConstructions = 0;
  window.__presentationTransport = [];
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.pathname.includes('/api/public-improvements/presentation')) {
      const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
      window.__presentationTransport.push({ cache: options.cache, credentials: options.credentials,
        hasBearer: headers.has('Authorization'), hasFirebaseAuth: headers.has('X-Firebase-AppCheck') || headers.has('X-Firebase-Auth') });
    }
    return nativeFetch(input, options);
  };
  class Events {
    constructor() { this.listeners = {}; }
    addListener(name, callback) { (this.listeners[name] ||= new Set()).add(callback); return { remove: () => this.listeners[name].delete(callback) }; }
    fire(name) { for (const callback of this.listeners[name] || []) callback(); }
  }
  class LatLng {
    constructor(input, lng) { this.latitude = typeof input === 'object' ? input.lat : input; this.longitude = typeof input === 'object' ? input.lng : lng; }
    lat() { return this.latitude; } lng() { return this.longitude; }
  }
  class MVCArray {
    constructor() { this.values = []; }
    push(value) { this.values.push(value); return this.values.length; }
    getLength() { return this.values.length; }
    getAt(index) { return this.values[index]; }
    removeAt(index) { return this.values.splice(index, 1)[0]; }
  }
  class Map extends Events {
    constructor(div, options) { super(); window.__mapConstructions++; this.div = div; this.center = new LatLng(options.center); this.zoom = options.zoom; this.type = options.mapTypeId; this.controls = Array.from({ length: 13 }, () => new MVCArray()); this.overlayMapTypes = new MVCArray(); this.div.classList.add('fake-map'); setTimeout(() => this.fire('idle'), 0); }
    getCenter() { return this.center; } getZoom() { return this.zoom; } getMapTypeId() { return this.type; }
    panTo(value) { this.setCenter(value); }
    getHeading() { return 0; } getTilt() { return 0; }
    setHeading() {} setTilt() {}
    setOptions() {} setCenter(value) { this.center = new LatLng(value); setTimeout(() => this.fire('idle'), 0); }
    setZoom(value) { this.zoom = value; setTimeout(() => this.fire('idle'), 0); } setMapTypeId(value) { this.type = value; }
    getDiv() { return this.div; } getBounds() { return { toJSON: () => ({}) }; }
  }
  class Marker { constructor(options) { this.options = options; } setMap(map) { this.map = map; } setPosition(value) { this.options.position = value; } setTitle(value) { this.options.title = value; } setLabel(value) { this.options.label = value; } setIcon(value) { this.options.icon = value; } }
  class OverlayView { setMap(map) { this.map = map; if (map) this.onAdd?.(); else this.onRemove?.(); } getPanes() { return { overlayLayer: this.map.div, overlayMouseTarget: this.map.div }; } getProjection() { return { fromLatLngToDivPixel: () => ({ x: 0, y: 0 }), fromLatLngToContainerPixel: () => ({ x: 0, y: 0 }) }; } }
  window.google = { maps: { Map, Marker, OverlayView, LatLng, MapTypeId: { ROADMAP: 'roadmap', HYBRID: 'hybrid' }, ControlPosition: { RIGHT_TOP: 3, BOTTOM_LEFT: 6 }, Point: class {}, Size: class {}, StyledMapType: class {}, SymbolPath: { CIRCLE: 0 }, places: {}, event: { trigger() {}, clearInstanceListeners() {} } } };
}
