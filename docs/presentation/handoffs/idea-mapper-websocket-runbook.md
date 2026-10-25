# Idea Mapper: presentation WebSocket implementation handoff

Prepared and reviewed: 2026-10-22. Status: implementation instructions; no application implementation or runtime verification is claimed by this document.

Review revisions address startup fallback, heartbeat deadlines, socket-only versus shared protocol failures, ordering across transports, CORS retry headers, safe test configuration, and maintenance-triggered snapshot amplification. Use this reviewed contract rather than earlier copies.

Execution repository: `C:\Users\hexel\repos\DallasUrbanists\improvement-map` (Idea Mapper). Backend companion: [Urbanists Cloud API runbook](urbanists-cloud-api-websocket-runbook.md). Both runbooks contain the same proposed wire contract so either can be handed to an agent independently.

## 1. Objective, authority, and completion boundary

Replace continuous TV, remote, and audience HTTP synchronization polling with authenticated WebSocket state delivery, keeping existing HTTPS enrollment and commands, and recover from interruptions without blanking the presentation or requiring re-pairing.

Implement, test, fix related regressions, update documentation, and provide a candid completion report. Stop before committing, pushing, tagging, changing versions, merging, deploying, changing live cloud configuration, or mutating production data. Do not invoke release scripts. This handoff authorizes frontend implementation only; backend implementation belongs to the companion handoff. Do not create or message other tasks unless separately authorized.

Read `AGENTS.md`, `.agents/instructions.md`, and any more-specific instructions before editing. Run `git status --short` and inspect existing changes. Preserve unrelated changes. The earlier experimental reliability edits in this conversation were reverted; do not assume they exist or restore them wholesale. Revalidate source paths and assumptions once, then execute this plan. If implementation has already started, reconcile it rather than duplicating transports.

## 2. Acceptance criteria

- Pairing codes, QR fragments, sessionStorage credentials, role permissions, public content projection, presentation controls, and audience independence retain their current behavior.
- Each browser session owner has at most one current socket and one authoritative synchronization source. HTTP fallback may run while a replacement socket dials; after valid socket readiness, there are no periodic `/sync` requests. HTTPS commands and catalog/media requests remain supported.
- A remote command reaches the TV and following audience without waiting for a poll. On isolated local infrastructure, require eventual visible state within two seconds after a successful command response; report measured latency rather than implying a production guarantee.
- Preserve the last valid presentation during transient disconnects, handshake attempts, fallback transitions, and resynchronization. Do not recreate the whole TV stage or reset local audience exploration on reconnect.
- Reconnection resumes the same participant and session, receives a full authoritative snapshot, and preserves uncertain commands with the same original idempotency key/body. Never replay enrollment merely because a socket closes.
- Transient socket failures automatically recover; unsupported/blocked sockets use bounded HTTP fallback and periodically retry socket support. Auth failures, ended/expired sessions, and protocol incompatibility do not create infinite retries.
- No stale callback from a previous session, socket, poll, or command changes current state. Incoming revisions never roll backward; same-revision presence updates remain possible.
- Screen-awake support for TV/controller is best effort, feature detected, released on teardown, and never required for enrollment. Browser suspension remains recoverable when the page becomes visible.
- Focused tests, meaningful race/failure coverage, frontend regression checks, build, documentation, and quality review are complete. Report blocked cross-project or device checks explicitly.

## 3. Evidence and limits of diagnosis

Confirmed in inspected code:

- `src/services/presentationSession.js` polls receivers every 500 ms, audience every 1,000 ms, controllers every 2,000 ms. Hidden documents stop polling; visibility restoration forces a sync.
- `presentationApi.js` uses a 15-second request timeout. Retry handling currently shares transport delay state and can shorten `Retry-After` values to ten seconds. The inspected API CORS configuration exposes `ETag` only, so cross-origin browser code cannot currently read `Retry-After`; fixing only the frontend delay logic is insufficient.
- `applyEnvelope()` combines a revision check with request callback ordering. Extending that ordering naively to asynchronous socket messages can discard newer state or accept stale presence.
- The API already supports revision conflicts, durable idempotency receipts, full/compact envelopes, and accountless participant capabilities. Reuse these mechanisms.
- The backend has a separate suggestion WebSocket, but the inspected frontend does not use it. It is not a presentation channel.
- The frontend reports `MAP_UNAVAILABLE`, `IMAGE_UNAVAILABLE`, `STREETMIX_UNAVAILABLE`, and `CONTENT_UNAVAILABLE`; the inspected backend presence validator accepts a different set except for `IMAGE_UNAVAILABLE`. This is a concrete interoperability defect to cover with contract tests, not proof of the reported disconnect's cause.

Unconfirmed: the user observed reconnection within roughly one minute. No failing live TV trace or successful production log investigation established its cause. Earlier Google Cloud log access failed because authentication required renewal. Do not claim this migration diagnoses or definitively fixes that specific incident. Capture safe timing, close-code, and recovery evidence during verification.

## 4. Shared contract: presentation socket v1

This section is normative for both handoffs. Backend-first implementation supplies the endpoint; frontend can finish against deterministic fixtures before backend integration. Once implemented, the backend's `docs/presentation.md` and executable contract tests are the authoritative published protocol; keep frontend fixtures aligned with them. Any change to names, timing, projection, or error semantics requires an explicit contract revision and matching tests in both projects. Report a required cross-project change and continue unaffected work; do not silently edit the other agent's implementation or invent a different contract.

### Endpoint and versioning

- Endpoint: `/api/public-improvements/presentation/ws` on the configured API origin. Derive `wss:` from `https:` and `ws:` from `http:` with `URL`; do not hardcode production origin or use the frontend origin by accident. No query string, fragment, token, or admission code in the socket URL.
- Existing REST and state DTO `protocolVersion` remain `1`. New socket frames also carry `socketProtocolVersion: 1`; this is separate transport versioning. Every frame is a JSON object with a known `type` and exact permitted fields.
- HTTP remains responsible for create/pair/join, full state PUT commands, code rotation, leave/end, catalog/detail, and thumbnails. The socket accepts authentication and presence only, never presentation commands.

### Frames

Client's first message, sent immediately after opening:

```json
{"type":"authenticate","socketProtocolVersion":1,"protocolVersion":1,"sessionId":"<UUID>","participantId":"<UUID>","participantToken":"<existing token>"}
```

The server determines the role from durable authorization, never a client role field. Do not send API keys, Firebase tokens, or App Check tokens for presentation authentication. No presentation or participant data is sent before successful authorization and listener initialization; safe error/close control frames may reject a handshake before that point.

First server state frame:

```json
{"type":"ready","socketProtocolVersion":1,"sequence":1,"envelope":{"protocolVersion":1,"serverTime":"<ISO timestamp>","session":{"id":"<UUID>","status":"active","expiresAt":"<ISO timestamp>","revision":0},"changed":true,"state":{"revision":0,"ideaEpoch":0,"selectedIdeaId":null,"mode":"map","camera":{"latitude":32.7767,"longitude":-96.797,"zoom":13},"mapStyle":"streets","railVisible":true,"theme":"dark","albumItemId":null,"photoFrame":{"scale":1,"centerX":0.5,"centerY":0.5},"captionVisible":true,"descriptionPage":0,"audienceDisplay":{"showQr":false,"showCode":false},"iconStyle":{"size":100,"animationEnabled":true,"pulseSize":1,"pulseSpeed":1,"bobbingRotation":0,"bobbingSpeed":1,"animationEasing":"ease-in-out"}},"content":null,"participants":null,"receiver":null}}
```

The example contains a complete valid initial state object. Later state frames use `type: "snapshot"`, the same envelope shape, and strictly increasing positive safe-integer `sequence` numbers for that connection; `ready` occurs exactly once with sequence 1. Every ready/snapshot is a full snapshot: `state` is complete, `state.revision === session.revision`, and `content` is the matching current public idea DTO or explicit `null`. A non-null selection requires matching content; no selection requires `content: null`. `changed: true` means a full envelope, not necessarily a higher revision. Build and validate the whole candidate before changing client state. There is no replay cursor or claim that intermediate revisions are delivered. Reconnecting starts sequence numbering again and always supplies the current full state.

Exact top-level fields: authenticate has the six fields shown; ready/snapshot has `type`, `socketProtocolVersion`, `sequence`, `envelope`; heartbeat has the four fields shown; presence has the four fields shown; error has `type`, `socketProtocolVersion`, `error`, `message`, and optional `retryAfterMs`. Validate nested DTOs with the existing protocol-v1 rules and role projection, without introducing stricter REST DTO rules accidentally. Only ready/snapshot carries a sequence. Unknown/malformed types, wrong versions, duplicate ready, non-text input, and impossible sequencing are socket faults; keep the last valid display and use the failure rules below. Ignore duplicate/older snapshot sequence values without applying them or resetting liveness; an increasing sequence with a lower canonical revision must not roll state back.

Preserve existing role projections: only controllers receive audience roster and `audienceCode`; receiver telemetry follows the current receiver projection; audience receives no roster, presenter code, or private participant data. Never spread raw Firestore records into frames. HTTP `/sync` keeps its existing compact/null-content semantics; transport normalization must distinguish them from full socket snapshots.

Server application heartbeat every 15 seconds:

```json
{"type":"heartbeat","socketProtocolVersion":1,"id":"<opaque connection-local ID>","serverTime":"<ISO timestamp>"}
```

Client replies immediately, sends initial presence after ready, and sends coalesced presence when relevant local rendering/view state changes:

```json
{"type":"presence","socketProtocolVersion":1,"heartbeatId":null,"presence":{}}
```

The presence example is unsolicited/initial presence; when replying to a heartbeat, replace `null` with that heartbeat's exact `id` string. Receiver presence: `appliedRevision`, `viewport: {width,height}`, `renderStatus`, `renderError`. Audience: optional `localView`. Controller: `{}`. Presence never advances state revision. Validate IDs as nonempty bounded strings (maximum 64 characters); unsolicited presence uses actual JSON `null`, not the string `"null"`.

After ready, issue a unique heartbeat ID every 15 seconds. Track at most two outstanding IDs and their monotonic issue times; check timeout before issuing the next heartbeat at a deadline. A validated response for an outstanding ID acknowledges that ID and all older IDs. Repeated/obsolete/unknown IDs cannot extend liveness; `heartbeatId: null` and native pong do not acknowledge a heartbeat. Close retryably when the oldest unacknowledged heartbeat reaches 30 seconds old. Thus, with no responses, the first heartbeat at t=15 expires at t=45, measured from ready. Give an already-received timely acknowledgment its turn before a same-tick timeout decision. Validate acknowledgment promptly in memory; slow presence persistence must not delay liveness handling. Reject invalid role/presence payloads before acknowledging them. Native ping/pong may supplement this.

Client liveness uses 35 seconds without any newly validated server frame after ready, measured by a monotonic local clock rather than serverTime. Malformed, duplicate, or obsolete frames do not extend it. Suspend/resume can exceed these budgets: on visibility/pageshow, check age immediately and replace a stale attempt rather than assuming timer callbacks ran while hidden. Reconnection, not uninterrupted background execution, is the guarantee.

Presence timestamps retain the existing maximum persistence frequency of once per 15 seconds and 45-second connected window; actual render/view changes may persist sooner. Both REST and socket validation must accept the union of already-used render errors: `MAP_UNAVAILABLE`, `IMAGE_UNAVAILABLE`, `STREETMIX_UNAVAILABLE`, `CONTENT_UNAVAILABLE`, `TILE_UNAVAILABLE`, `RENDER_FAILED`, `NETWORK_ERROR`, `TIMEOUT`, `UNKNOWN`, plus `null`. Do not rename stored/client codes silently. Reuse existing validation for other fields and nonnegative applied revisions.

Server error frame:

```json
{"type":"error","socketProtocolVersion":1,"error":"PRESENTATION_UNAVAILABLE","message":"Presentation updates are temporarily unavailable.","retryAfterMs":5000}
```

`retryAfterMs` is optional, finite, in the range 0–60,000 ms, and a retry minimum. If a frame can be sent safely, send it before closing. Never place credentials or private records in message/close text. Terminal authorization/lifecycle codes are `SESSION_ENDED`, `SESSION_EXPIRED`, `INVALID_SESSION_CREDENTIAL`, and `ROLE_FORBIDDEN`; they stop all I/O for that participant/session and clear only its active credential and matching pending material. A transport policy/validation error must not masquerade as revoked authority.

Distinguish versions: `SOCKET_PROTOCOL_UNSUPPORTED` means only the socket version is incompatible, disables further socket probes for this running session, and leaves compatible REST fallback/commands available. Existing `PROTOCOL_UNSUPPORTED` means the shared REST/state DTO version is incompatible; stop session I/O, preserve the last display, and expose the compatibility error without an automatic reload or credential deletion. `PRESENTATION_DISABLED` disables socket probes for this running session, allowing REST to establish whether the underlying presentation API is still available. A new session, explicit transport retry, or reload may retry socket support. Other unavailable/rate-limited failures are retryable.

Close codes: `4000` authentication timeout (retryable); `4001` rejected credential (terminal for that participant); `4003` ended/expired session (terminal; machine error distinguishes them); `4004` unsupported version; `1008` invalid frame/policy; `1009` oversized input; `1013` transient unavailable, overload, slow consumer, or heartbeat timeout; `1001` server shutdown; `1000` intentional client teardown. Codes `4000`, `1001`, `1006`, `1011`, and `1013`, handshake timeout, constructor failure, and network failures retry with fallback. No reconnect after locally intentional teardown, regardless of its close event. An unsolicited remote `1000` is not proof the session ended; recover via fallback/retry. A known terminal machine error wins over its subsequent close event. A bare `4003` terminates generically without guessing expired versus ended. A bare `4004` is socket-only incompatibility; a preceding `PROTOCOL_UNSUPPORTED` error instead stops all incompatible session I/O. Codes `1008`/`1009` and unrecognized application close codes disable socket probes for the running session and expose a socket fault while retaining REST fallback and credentials. Never infer revocation from an unknown close or HTTP upgrade failure. Do not reuse suggestion-socket code `4002` or its 30-minute auth renewal as presentation expiry policy.

### Recovery and rollout defaults

- Authenticate within five seconds of server upgrade; initialize listeners/send ready within 15 seconds after auth. Client opening/auth/ready attempts have a bounded total deadline of 25 seconds. Do not label an open socket as connected before ready.
- Socket reconnect delays: exponential one to 30 seconds with bounded jitter (never a zero-delay loop); honor larger explicit retry minima without clipping or subtracting jitter. Reset attempt count after 30 seconds of healthy readiness, not immediately on every open/ready. Keep separate retry deadlines for socket attempts, HTTP sync, and HTTPS writes. A socket retry delay must not pause otherwise healthy commands/polling; healthy heartbeats must not erase a write Retry-After. Honor an explicit wider server limit if one is documented; do not bypass it by switching transports. REST Retry-After must be readable across origins through Access-Control-Expose-Headers.
- Start HTTP synchronization immediately on session start while the first socket dials; do not leave a new TV waiting up to 25 seconds for a handshake failure. On any subsequent transient socket loss start fallback promptly, subject to that channel's active retry minimum. A candidate socket may dial while fallback runs, but only one transport is the authoritative metadata source; hand over atomically after a valid, non-stale ready snapshot is applied. Invalidate/abort old polls without canceling HTTPS commands. Failed upgrades may hide HTTP status from browser JavaScript: do not assume access to handshake status or headers. Unsupported endpoints and absent WebSocket APIs must still yield working fallback without tight loops.
- New frontend switch: `VITE_PRESENTATION_WEBSOCKET_ENABLED`; new backend switch: `PRESENTATION_WEBSOCKET_ENABLED`. Default both off, keep `VITE_PRESENTATION_ENABLED`/`PRESENTATION_ENABLED` unchanged. Backend socket requires both backend switches. Test new path explicitly with switches on. Backend off/new frontend on must fall back; old frontend/new backend on must keep working.
- No new production database, Redis requirement, sticky-session dependency, media streaming, offline command authority, or arbitrary extension of the existing four-hour session deadline.

### Ordering, authority, and lifecycle invariants

- Canonical state/content ordering uses revision; socket sequence orders same-revision metadata only within that connection. A socket snapshot does not acknowledge any pending command: only the matching HTTPS result/idempotency receipt can do so. Keep optimistic candidate idea content separate from authoritative socket content.
- While socket-ready, its ordered snapshots own nonterminal status, expiry, receiver telemetry, and roster. A matching HTTPS write/conflict result can advance canonical state at a higher revision and settle only its matching write; it cannot replace same-revision socket metadata with an older HTTP snapshot. During fallback, use a single-flight HTTP sync generation as metadata owner. On socket loss retain current metadata until fresh fallback data arrives; ignore metadata from HTTP requests begun under an older ownership generation. Recognized current-session terminal authorization errors override nonterminal metadata and cannot be resurrected by later frames.
- A candidate ready with a revision below already-applied state cannot take ownership or stop fallback. Wait within its readiness budget for a catch-up snapshot, or retry; sequence and revision are different clocks. Heartbeats can show transport responsiveness but do not erase write/storage/render errors or prove that a command was applied on the TV.
- All application work is scoped to participant/session plus local generation, not only sessionId. Renewed sockets reset sequence tracking; late callbacks/errors from prior sessions, prior participants, disposed polls, and old sockets have no effect. Permit a brief dialing/fallback handover; at most one current socket per browser session owner. Do not promise one socket globally per participant, since reload/new tabs can overlap.
- Reconnect never grants new membership. A socket close alone does not revoke, call leave/end, or delete a pending mutation. Preserve absolute server expiry and role-specific projections. No new end-to-end TV acknowledgment UI is included; command commit and actual TV rendering remain distinct and are tested separately.
- Backend-only maintenance events (content-refresh lease acquisition/release and raw heartbeat timestamps absent from a role's DTO) must not produce identical full snapshots. Deduplicate the public role projection excluding serverTime, sequence, and other transport bookkeeping; retain actual state/content/status/expiry/roster/telemetry changes, and compute 45-second connected-window transitions even without a new DB write.

## 5. Relevant frontend code and ordered work

1. **Capture a baseline.** Read `presentationSession.js`, `presentationApi.js`, `presentationState.js`, `apiBaseUrl.js`, `presentationLinks.js`, TV/remote/audience views, `tests/presentation.spec.js`, `tests/presentationState.spec.js`, `tests/fixtures/presentationServer.js`, and `tests/ux/presentation.spec.js`. Note baseline failures before edits. Check local Playwright's WebSocket routing support from installed code; do not upgrade dependencies merely to get a mock API.
2. **Isolate socket mechanics.** Add a small `src/services/presentationSocket.js` (or equivalent) that owns URL construction, handshake/frame validation, generation guards, heartbeat response, liveness deadline, reconnect scheduling, and idempotent teardown. Inject socket factory, clock, and randomness where helpful for meaningful deterministic tests. Keep Vue state/credentials owned by the existing session service. Avoid a general-purpose messaging framework or new socket library when native WebSocket suffices.
3. **Centralize transport ownership.** In `presentationSession.js`, distinguish authoritative session status (`waiting/active/ended/expired`) from transport state (`connecting/live/fallback/reconnecting/stopped`). Keep current view-facing status compatible. A socket reconnect attempt must not show a warning when HTTP fallback is actively delivering fresh updates. One epoch identifies a session; a separate generation identifies socket attempts. Stop aborts polls/writes, clears every timer, removes owned listeners, closes the socket, releases wake lock, and invalidates every late callback. Repeated restore and rapid role/session switches must not leak work. Check role and participantId as well as sessionId when deciding whether restore is already active. Apply epoch checks to enrollment, catalog/detail loads, idea selection, code rotation, forced recovery requests, and error/finally handlers too, not just socket callbacks. Pagehide/pageshow and back-forward cache restoration need explicit suspend/dispose/resume ownership without calling leave/end for ordinary navigation.
4. **Apply snapshots safely.** Unify validation/application while retaining transport-specific full/compact semantics. Verify session ID, frame type/version/sequence, envelope revision matching state revision, state/idea validation, and selected idea/content consistency before mutation. Track sequence only within its connection. Across socket, HTTP poll, write success, and conflict replies, compare canonical revision first; never use a newer request-start counter to reject a higher revision. Lower revisions cannot replace state/content or metadata. Ignore stale connection callbacks entirely. Same-revision socket snapshots may update presence. Delayed metadata from overlapping HTTP requests must not overwrite newer socket metadata; follow the shared ownership-generation rules, including same-revision waiting-to-active and expiry changes. Separate optimistic loaded idea content from the authoritative snapshot so ready cannot erase an unsent selection. Track socket liveness independently of the old five-second poll-age heuristic; an idle healthy socket only emits heartbeats every 15 seconds. Heartbeats must not clear persistent command, storage, or render errors.
5. **Preserve command durability.** Retain `flushPresentationChanges()`, pendingMutation storage, original idempotency key/body replay, optimistic merged controls, and conflict rebasing. Socket updates can arrive before a PUT response or after a newer queued local edit: neither may drop pending edits, roll back acknowledged state, or clear a different write's receipt. A rejected write must not be silently retried as a different operation. Distinguish uncertain delivery from a definitive REVISION_CONFLICT: uncertain retries reuse the exact key/body; a rebased operation after a definitive conflict requires a fresh key/body. A cached idempotent success may contain an older revision: settle that specific receipt while keeping newer socket state. Review the existing recursive conflict retry/finally path: each request needs its own ownership token, or use an equivalent serial loop, so an outer finally cannot clear a newer request's in-flight flag/abort controller. Do not discard newer queued edits when an earlier write is rejected. Test persistence failure as well as network failure. Separate poll, socket, and write retry clocks; healthy heartbeats must not erase write rate limits. Respect REST `Retry-After` even above ten seconds and when the user interacts/foregrounds the page. Audit `presentationApi.js` parsing as well as timers: its current 60-second parser clamp must not cause early retry for a valid longer HTTP delay (test 120 seconds and an HTTP-date using controlled time). Preserve the full retry deadline and use bounded timer slices if necessary; malformed values use bounded backoff.
6. **Fallback without gaps.** Keep existing role polling intervals initially; reduce load by turning them off while socket is ready. Poll immediately during initial dialing and until a non-stale ready snapshot is validated/applied, then abort obsolete in-flight polls with ownership-generation guards. Never abort a command PUT merely because the transport changes. A hanging fallback fetch cannot block socket handover or the new fallback scheduler; a disposed request's finally must not reset a successor's in-flight flag. On socket loss resume bounded polling without blanking; continue socket attempts with backoff. Leave a functioning HTTP fallback running if socket reattempts fail. Hidden pages may send low-frequency fallback heartbeats when allowed; do not promise background execution. `online`, visibility restoration, and page restoration should resynchronize promptly without duplicate sockets/timers or bypassing retry minima.
7. **Presence and awake behavior.** Reuse `reportReceiverRender()` and local audience reducers. Coalesce rapid presence updates; heartbeat acknowledgment cannot be starved by coalescing. Report latest status on ready and each heartbeat. Reset render telemetry when changing sessions. Feature-detect Screen Wake Lock for visible receiver/controller, catch denial/unsupported behavior, reacquire on visible when appropriate, release on stop, and release locks resolving after an obsolete session. Do not keep audience phones awake by default or introduce permission prompts to make pairing work.
8. **Preserve views.** Update TV connection text and remote/audience indicators only as needed to accurately reflect shared transport health. Keep last content mounted, remote subroutes running, independent audience tabs/pages/frames, styling, controls, and render-error feedback. Refresh credential `expiresAt` from authoritative envelopes after first pairing so the initial ten-minute enrollment deadline does not produce a false warning. Do not change unrelated Browse/Submit UX. Ask before genuinely ambiguous design changes; record `needs-intent-confirmation` with evidence.
9. **Feature/config documentation.** Add the new switch to `.env.example` without enabling production. Define it as opt-in only when its value is exactly `"true"`; unset, empty, and `"false"` all mean off. This is independent from the existing presentation-enabled default in development. Document endpoint, first-frame credentials, fallback behavior, reconnect semantics, server prerequisites, browser limits, and how to run local socket integration. Update README/test-maintenance references and suite ownership for new tests/helpers so CI selection includes them. Do not alter existing suggestion notification behavior.

## 6. Tests and execution sequence

Add deterministic browser tests in `tests/presentationConnection.spec.js` plus focused state/transport tests. Extend the existing presentation fixture with socket behavior matching this contract; do not replace all fetches or bypass auth/role projections. Use separate browser contexts for TV, controller, and at least two audiences. Prefer supported Playwright WebSocket routing; if a real local ws harness needs a new dependency, declare it in this project's devDependencies and lockfile instead of borrowing the sibling project's node_modules. Record what remains mocked.

Create a narrowly scoped `playwright.presentation.config.js` for the new socket-enabled connection tests, with explicit fresh Vite startup (`reuseExistingServer: false`, strict dedicated loopback port such as 5175), no HMR, and process environment overriding local .env files with `VITE_PRESENTATION_ENABLED=true` plus `VITE_PRESENTATION_WEBSOCKET_ENABLED=true` in socket-on mode (false in socket-off mode). Scope `testMatch` to connection tests and provide Chromium, Mobile Chrome, and WebKit projects with documented names. Tests use config baseURL, not hardcoded localhost:5173. The existing presentation fixture only passes local app traffic through on port 5173; parameterize the harness's exact allowed app origin so 5175 assets work without broadening production request access. Explicitly mock/intercept the presentation API/socket origin; block unexpected external requests. Do not let a reused flag-off dev server produce a misleading pass.

Keep original polling/UX regression tests on their existing configs with the new switch explicitly off; execute at least one separate fresh-server flag-off run that asserts zero socket attempts. Use `PRESENTATION_SOCKET_TEST_MODE=on|off` in that config (default on), map it to explicit Vite switch values, and select tests using `@socket-on`/`@socket-off` title tags; both selections must discover nonzero tests and exercise real app startup. Clear/restore the task-specific variable after each invocation. Use off mode for the no-socket-attempt assertion, not a mock that simply omits opening a socket. Register the new connection configuration in the normal suite runner and CI change selection as its own suite (e.g. `regression-presentation`) instead of merely adding an enabled-only spec to the default-off regression-app suite. Update relevant script/CI/report expectations, assert test discovery, and ensure the default suite selection remains compatible with existing workflows.

Required cases:

| Area | Required assertions |
| --- | --- |
| Happy path | Pair, ready full snapshot, map/photo/description/styles/camera, audience following and independent views, no periodic sync while ready; no sockets at flag off. |
| First-minute stability | Advance controlled time through at least two minutes of heartbeats and idle state; assert no false reconnect. Also run one real 10-minute idle-and-interaction local soak with continuous state sampling and no unintentional close. Put the soak behind an explicit documented opt-in, with a timeout above ten minutes and retries disabled; do not multiply it across every ordinary browser/project run. |
| Recovery | Dropped socket, server shutdown/restart, lost network, half-open connection/no heartbeat, delayed ready, listener failure, blocked/unsupported endpoint, repeated flapping, fallback-to-socket recovery; last display remains mounted and latest state converges. |
| Races | Old ready/snapshot/poll/error/finally after new participant or session; candidate ready behind an in-flight PUT revision; polling/socket handover with a hung old request; stale same-revision status/expiry/roster; conflicting PUT/socket arrival order; recursive conflict-finally ownership; old idea load after new selection; duplicate/invalid frames; compact HTTP content:null versus full socket content:null. |
| Commands | Lost successful PUT response, reload with pendingMutation, repeated retry uses identical key/body, revision conflict after idea change, latest local edits during in-flight write, Retry-After above ten seconds, terminal session during write retry. |
| Lifecycle | Route/unmount/end/leave, remote subpages, multiple restore calls, visibility/online storms, waking with an in-flight attempt, fake wake-lock denial/release/late resolution; no leaked listeners/timers/connections. |
| Security/compatibility | Wrong role, expired/revoked credentials, no credentials in URL/localStorage/logs; terminal error followed by generic close; bare 4001/4003/4004, socket-only versus shared protocol error, unsolicited 1000; absent WebSocket API; malformed frames; cross-origin Retry-After read through actual exposed headers; render-error union accepted by fixtures/real backend; all flag combinations. |

During edits, run only relevant checks, from the execution root:

```powershell
npm run test:unit -- tests/presentationState.spec.js
npm test -- tests/presentation.spec.js --project=chromium
npm test -- --config=playwright.presentation.config.js --project=chromium
```

The new config's default is socket-on. Also run the explicit socket-off check in a fresh process/server; preserve any existing task variable value:

```powershell
$previousSocketTestMode = $env:PRESENTATION_SOCKET_TEST_MODE
try {
  $env:PRESENTATION_SOCKET_TEST_MODE = 'off'
  npm test -- --config=playwright.presentation.config.js --project=chromium
} finally {
  if ($null -eq $previousSocketTestMode) {
    Remove-Item Env:PRESENTATION_SOCKET_TEST_MODE -ErrorAction SilentlyContinue
  } else {
    $env:PRESENTATION_SOCKET_TEST_MODE = $previousSocketTestMode
  }
}
```

Assert the command's exit code and actual selected test count; restoring the environment must not hide a failed check. Run the equivalent discovery (`--list`) in each mode.

Include any new `@unit` spec explicitly. Before default-on commands ensure the task mode is unset or explicitly on; do not inherit an off-mode shell accidentally. Add the dedicated connection suite's files, config, supported project names, and source/helper dependencies to the appropriate registry/runner/CI code; the current registry/runner assumes only the existing regression or UX configs and needs a deliberate small extension. Do not leave socket coverage undiscovered in normal regression selection. Record a `--list` discovery result for each enabled/disabled selection.

At the integration checkpoint, run sequentially to avoid shared report/server collisions:

```powershell
npm run test:suite -- ux-presentation
npm run test:suite -- regression-app
npm test -- --config=playwright.presentation.config.js
npm run test:critical
npm run test:unit
npm run build
```

The presentation UX suite covers Android/iPhone, light/dark. Add focused connection coverage on Mobile Chrome and WebKit using an appropriate existing config or a narrowly scoped new project; do not assume `iphone-light` exists in the regression config. Preserve the existing test registration/audit expectations. Run `npm run test:ux` if shared UI changed; use affected Browse/Submit/recovery/guardrail journeys if touched. Run diagram regression only if shared map/diagram code changed or evidence warrants it. Do not repeatedly run the full suite after small edits, skip failing tests, lower assertions, or regenerate screenshot baselines to hide regressions.

Run one cross-project local smoke against the actual backend with flags on and an isolated local Firestore emulator: pair, change content, disconnect/reconnect, re-pair/revoke controller, leave, end, expire, and verify error reporting without poll traffic. Backend owns the isolated emulator startup/seeding fixture; use its documented local API origin and unique demo project/database, and start Vite with the local API base URL plus both frontend switches explicitly set. Use synthetic suggestions and generated test credentials only; do not run mock-route tests and label them a real backend smoke. Never use real production suggestions or credentials for mutation testing. If backend/emulator is unavailable, finish mock-backed code and tests, document exact unverified checks, and do not declare integration complete. Separate component implementation readiness from full cross-project acceptance so neither agent waits indefinitely for the other.

For every failure, preserve the first useful trace/log, determine whether introduced, baseline, or environmental, fix related code and add a regression case, rerun the affected check, then rerun the relevant checkpoint after the final fix. Do not modify unrelated features to silence baseline failures. Use distinct ignored evidence directories; redact first authentication frames, sessionStorage, QR codes, and participant tokens from traces/screenshots/reports before sharing.

## 7. Self-review and final report

Review the final diff as a maintainer unfamiliar with this conversation. Check bounded timers/retries, cleanup, pending-command correctness, role isolation, full/compact snapshot handling, listener disposal, accessibility of status text, lack of credential logging, unchanged public APIs, and flag-off behavior. Inspect `git diff --check` and the working tree. Remove only task-created temporary artifacts; preserve user changes. No commits or deployments.

Report changed files and why; implemented wire contract/version; exact commands, counts/outcomes, and skipped reasons; soak duration and observed latency/recovery; browser/emulator coverage; regressions fixed; documentation/config changes; remaining risks. Explicitly distinguish mocked verification from real backend/device evidence. Provide a pass/fail/not-run checklist for the acceptance criteria. Do not mark complete if a required check is missing; identify the smallest remaining prerequisite.

Escalate only for a material contract contradiction, a necessary permission/environment dependency, a security/design decision outside this scope, or a failing dependency that requires backend work. Continue independent work. Missing production access is not a reason to request deployment or production credentials. Do not silently weaken requirements or claim the user's original incident was reproduced when it was not.
