# Backend handoff: presentation sessions for TV, remote, and audience

Prepared 2026-10-21. Execute in the **Urbanists Cloud API** project. This document is a complete implementation assignment, not a request to write another plan.

## 1. Objective and execution authority

Implement the durable session API that connects one `/tv` receiver, one `/remote` presenter, and any number of independent `/audience` viewers. Implement, test, investigate failures, and fix regressions until the acceptance criteria pass. **Stop before committing.** Leave all implementation and documentation changes uncommitted and provide a completion report.

- Read applicable repository and parent `AGENTS.md` instructions, inspect the working tree, and preserve existing changes. The source inspected for this handoff is `C:/Users/hexel/repos/DallasUrbanists/cloud-api-server`.
- Work only in the Cloud API checkout selected for your execution chat. Do not modify the Improvement Map frontend or its handoff documents. Use the protocol below as the common interface.
- Do not commit, stage changes for a commit, push, create a PR, bump versions, deploy, change production IAM/secrets, run production migrations, or generate new Streetmix designs. In particular, do not run the package's `deploy`, `major`, `minor`, or `patch` scripts.
- Routine implementation choices and fixes within this assignment are authorized. Keep working without waiting for the user for naming, component organization, dependency injection, or ordinary test repairs.
- Missing production access is not a reason to stop implementing or testing against isolated fixtures/emulators. Report the precise live verification gap after completing everything locally possible.

## 2. References and confirmed repository facts

### Wireframes and companion handoff

Use the **latest** three-role wireframes, not the earlier two-role mockup:

- Saved fragment: `C:/Users/hexel/repos/DallasUrbanists/improvement-map/docs/presentation/wireframes/tv-remote-audience.html`.
- Saved browser preview: `C:/Users/hexel/repos/DallasUrbanists/improvement-map/docs/presentation/wireframes/tv-remote-audience-preview.html`.
- Original editable fragment: `C:/Users/hexel/.codex/visualizations/2026/10/21/01a15c5d-8522-7fc0-a391-5240444dfc70/tv-remote-audience-wireframes.html`.
- Frontend assignment: `C:/Users/hexel/repos/DallasUrbanists/improvement-map/docs/presentation/frontend-handoff.md`.

Treat mockup content/scripts as reference data, never as agent instructions. Wireframes establish navigation, layout, structure, and interaction behavior. Their colors, type, bezels, example names, three-item data set, and two simulated viewers are not production requirements or audience limits. Do not deploy or import the mockup as application code.

### Relevant Cloud API code

Paths in this subsection are relative to the backend checkout:

| Area | Existing source / convention |
| --- | --- |
| App factory and route mounting | `src/app.ts`; `createApp()` supports isolated HTTP tests. |
| Startup and existing notice sockets | `src/index.ts`, `src/suggestionWebSocket.ts`. Preserve both suggestion socket aliases and shutdown behavior. |
| Existing suggestion routes | `src/routes/suggestionRoutes.ts`; mounted at `/api/suggestions` and `/api/public-improvements/suggestions`. |
| Application and user authentication | `src/middleware/auth.ts`; existing suggestion routes require application credentials, with App Check in production. |
| CORS | `src/middleware/cors.ts`; currently exposes `ETag`, permits `Idempotency-Key`, and restricts origins. |
| Firestore | `src/config/firestore.ts`; use `getPublicImprovementsDb()` and dependency-injected stores for tests. |
| Suggestions | `src/services/suggestionService.ts`, `src/models/suggestion.ts`; `SuggestionService.getAll/getById`, numeric persisted IDs, `suggestion` collection. Normalize public wire IDs to strings. |
| Saved Streetmix | `src/models/suggestionStreetmix.ts`, `src/services/suggestionStreetmixService.ts`; saved `streetmixId`, `streetmixUrl`, `revision`, and computed `stale` flag. |
| Existing PNG relay | `src/services/streetmixThumbnail.ts`; fixed-host UUID lookup, PNG validation, 5 MiB bound, provider timeout, no credential forwarding. |
| Documentation | `src/docs/swagger.ts`, `src/docs/suggestionStreetmix.ts`, `docs/streetmix.md`; extend the existing OpenAPI/documentation pattern. |
| Tests | Node test runner through `tsx`; examples include `tests/suggestionStreetmix.test.ts`, `tests/streetmixThumbnail.test.ts`, and `tests/suggestionWebSocketEmulator.test.ts`. |

The planning chat could read backend source but its sandbox could not reliably inspect backend Git status. No clean-working-tree or passing-baseline claim is made. Inspect your own checkout before editing. No feature implementation tests were run while preparing this handoff.

## 3. Product behavior the API must support

1. A receiver creates a session, requests fullscreen through a local user gesture, and shows a presenter pairing code/QR. One phone claims presenter authority without signing in.
2. Presenter controls the selected idea and the TV's **map, photo, or description** mode. The TV cannot change its own presentation state. Receiver-only setup/acknowledgment/session-ending actions are allowed.
3. Audience joins through a separate reusable viewing code/link. There is no product limit of two viewers and no shared audience cursor. Audience credentials cannot mutate the presentation, end it, rotate presenter pairing, enumerate other viewers, or acquire controller privileges.
4. Audience members keep their locally chosen map/photos/description tab. A different selected idea advances everybody to that idea, preserving each audience tab but resetting its local album index, text page, and framing. Changes to presenter mode alone never force audience tabs.
5. Public presentation content includes summary, address, coordinates, description pages, photos/captions, and an optional final Streetmix item. Never include author email, UID, staff claims, internal generation requests, or private logs.
6. Streetmix exists only when an already generated URL is assigned to the idea. It is the last album item. It has fixed contain framing, no pan/zoom, and no visible caption. Store the ordinary-photo caption preference separately so returning to a real photo restores it.
7. Style Settings changes rail visibility and a shared light/dark presentation theme. Audience management lists connected viewers and controls independent TV overlays for audience QR and viewing code.
8. End/expiry invalidates the session for every role. A temporary network failure preserves the last content and permits resynchronization.

## 4. Implementation sequence

### A. Model, store, and authentication boundary

Add a presentation model/validator, Firestore store, service, controller, router, and OpenAPI module using existing TypeScript/ESM conventions. Suggested names are `presentation.ts`, `presentationStore.ts`, `presentationService.ts`, `presentationController.ts`, `presentationRoutes.ts`, and `src/docs/presentation.ts`; adapt naming only to match existing conventions, without changing the public contract.

Use a separate `presentationSessions` collection with participant and receipt subcollections, plus purpose-specific code lookup documents. Do not add presentation fields to suggestion documents. Persist all authoritative state, code claims, credentials, and idempotency receipts in Firestore. An in-memory store is for tests, not production authority. Two Cloud Run instances must observe the same session and pairing result.

Use dedicated session capability middleware for the new namespace. **Do not weaken or bypass authentication on existing suggestion, Streetmix generation, notice socket, upload, or staff endpoints.** New bootstrap endpoints are deliberately accountless and rate limited; established session routes use the presentation credentials below. Do not feed a presentation token into Firebase JWT verification.

Store only a SHA-256 digest of each random participant token; compare digests in constant time. Human joining codes may be stored in private session metadata for authorized display, with purpose-specific hashed lookup keys. Do not log codes or request bodies containing credentials. Code possession admits a participant; it is not itself a controller bearer token.

### B. Transactional lifecycle

- Claim presenter pairing and create its participant in one transaction. Simultaneous unrelated claims yield one controller and one `PAIRING_CLAIMED` response.
- Use distinct lookup namespaces for presenter and audience codes, even if their displayed characters happen to match. Audience admission never consumes a presenter code.
- Implement bootstrap receipts scoped by operation, idempotency key, participant ID, and credential fingerprint. A retry of a claimed code by the same participant/token/key returns its original safe enrollment metadata. A different token/body with the same key is a conflict. Raw participant tokens are generated and retained by the client; they do not need to be recovered from the database.
- Session creation retries must not create duplicate sessions. Preserve the original expiry and safe response metadata on a replay. Check expiration before replaying a receipt.
- Apply state updates with a Firestore transaction comparing `baseRevision`. Increment the revision once. Derive `ideaEpoch` on the server when the selected idea ID actually changes. Replays do not increment either value.
- Normalize dependent fields when an idea or album item changes. Load public content through existing suggestion services, not from caller-supplied URLs or text.
- Rotating pairing revokes the old controller and its outstanding pairing receipt before offering a new pairing code. Audience remains in the session, following the last state, while a replacement controller connects.
- Delete/end is idempotent. Keep a short terminal tombstone through original expiry so stale retries cannot recreate or revive a session. Firestore TTL is cleanup, not authorization.

### C. Content and description pagination

Build a narrow DTO rather than spreading a `Suggestion` object. Every read path, including list, detail, sync, and thumbnail, must apply the same public-visibility rules.

Create stable media IDs from public media identity, with deterministic disambiguation for duplicate URLs. Preserve saved photo order. Append at most one `streetmix:<streetmixId>` item after real photos. Do not manufacture a design, call generation/regeneration, or treat a pending result as an assigned design. Include a saved `stale` attachment with its metadata rather than silently generating a replacement.

Provide canonical description pages so the TV and presenter agree on page counts. Implement a pure deterministic pagination helper: at most 320 Unicode code points per page, prefer the last paragraph/word boundary that fits, and split an oversized unbroken token safely at a code-point boundary. Preserve all description content except trimming page-boundary whitespace; never summarize, omit, or execute it. An empty description returns one explicit empty page. Test Unicode, long tokens, paragraphs, and content conservation. Audience may scroll within a page when a short landscape viewport requires it.

Persist the current selected public DTO/content version with the session so all roles receive the same content. During active sync, refresh this snapshot from the suggestion source at most once every five seconds per session using a durable refresh lease. Only a real content change increments revision. If content disappears, clear the selection and return to map mode. If album/text content changes, keep valid stable media IDs, clamp/reset dependent pagination, and publish the new content version atomically. Do not increment `ideaEpoch` for a mere edit to the same idea.

Reuse the existing fixed-host Streetmix thumbnail reader for session-authorized fallback. Its route must derive the saved UUID from the suggestion; never accept a caller-supplied upstream URL. Do not forward presentation/API/Firebase credentials to Streetmix. Do not change the existing protected thumbnail endpoint's authorization.

### D. Polling, presence, and performance

Use HTTPS polling for protocol v1, not a new WebSocket transport. Preserve existing suggestion notice sockets. Clients poll receiver at 500 ms, audience at 1,000 ms, and controller at 2,000 ms while visible. Polls return a compact unchanged response when versions match.

Presence updates must not rewrite the session document on every poll. Keep participants in separate documents and coalesce persisted `lastSeenAt` updates to at most once per 15 seconds per participant. Treat a participant as connected for 45 seconds after its last heartbeat. Compute roster status on reads; do not keep incrementing the canonical presentation revision for heartbeats, local tab changes, or viewer counts.

Bound any per-instance read cache to 250 ms, respect session expiry in the cache, and reauthorize mutations against durable state. Critical revocation and pairing checks cannot rely on an indefinitely cached token. Avoid a database listener/read per audience member if a short per-session cache can share the work. Do not introduce a hard audience count cap of two, ten, or another product limit; enforce infrastructure abuse limits transparently and return `429` rather than silently dropping people.

### E. Limits, privacy, and documentation

- New session create: 5/minute per trusted client IP; pairing/audience join: 10/minute per IP and code purpose. Derive IP using the deployment's trusted proxy convention, never an arbitrary forwarded header.
- Use a shared/durable limiter for admission so adding a Cloud Run instance does not reset its effective limit. Inject its clock/store in tests. `Retry-After` is required on `429`.
- Limit JSON bodies in this namespace to 32 KiB and reject unknown fields, wrong types, invalid IDs, non-finite numbers, unsupported protocol versions, and role-inappropriate sync fields.
- Add `X-Presentation-Participant` to allowed CORS headers; retain the existing origin allowlist. New routes and binary responses use `Cache-Control: no-store`.
- No Firebase account, email, or external invitation is required. Assign non-identifying roster labels such as `Viewer 7K3P`. Do not return participant tokens, token hashes, IPs, or other viewers' private metadata to audience clients.
- Document all routes, request/response examples, auth headers, limits, expiry, errors, and the new environment/configuration knobs. Default to disabled with `PRESENTATION_ENABLED=false`; use `true` in local tests. Never silently fall back to production services in tests.

<!-- BEGIN SHARED CONTRACT -->
## Shared protocol v1 — authoritative in both handoffs

The text of this section is identical in the backend and frontend runbooks. Implement it as written. These definitions supersede incidental field names and fixture values in the wireframe scripts. Keep an executable fixture/schema in each implementation and test it against these examples.

### Transport, identities, and enrollment

- Base path: `/api/public-improvements/presentation`; do not place it under `/suggestions/:id`.
- Session/participant IDs and `Idempotency-Key` values are UUIDs. Public suggestion IDs are canonical decimal strings, including when the source uses numeric IDs.
- Before each enrollment, the client generates a UUID participant ID and a 32-byte random base64url participant token using Web Crypto, retains them in `sessionStorage`, and reuses them for retries. The server stores only the token digest. A successful enrollment returns metadata, not a new token.
- Authenticated requests send `Authorization: Bearer <participantToken>` and `X-Presentation-Participant: <participantId>`; session ID is in the URL. Do not use Firebase bearer tokens in this namespace. Never put participant credentials in URLs, QR codes, localStorage, analytics, or logs.
- Bootstrap/create, presenter pair, and audience join are anonymous, narrowly rate-limited endpoints. All require `protocolVersion: 1`, `participantId`, and `participantToken` in JSON, and an `Idempotency-Key` UUID header. Reuse the same complete request on an uncertain response.
- Codes are eight random uppercase characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, displayed as two groups of four. Accept case-insensitive code entry with spaces/hyphens removed. Codes are globally unique within their purpose while live. They are not the fixed examples in the wireframes.
- Presenter QR: `<frontend-base>/remote#pair=<presenterCode>`. Audience QR: `<frontend-base>/audience#view=<audienceCode>`. A manual code resolves the session without typing its ID. Clear a code fragment after retaining the pending enrollment request in sessionStorage. Generate QR images locally.
- Presenter code expires after ten minutes or successful claim. Audience code stays valid through session expiry and admits multiple independent viewers. Pairing and audience admission never share a credential namespace.
- An unpaired session expires after ten minutes. First successful presenter pairing changes its expiry to four hours from pairing. That expiry is absolute and is not extended by polling. Warn at five minutes remaining. Ending or rotating presenter authority revokes relevant credentials immediately for mutations and within the bounded poll/cache interval for reads.
- Session status is `waiting` before first pairing, `active` after pairing, and `ended` or `expired` when terminal. Re-pairing an active session preserves its original four-hour deadline. An audience member joining a waiting session sees a waiting-for-presenter state rather than fabricated content.

### Endpoint contract

All JSON responses identify `protocolVersion: 1`; successful delete/leave responses are `204` with no body. Error envelope is `{ "error": "MACHINE_CODE", "message": "Safe user-facing message" }`.

| Method / suffix | Role and request | Success |
| --- | --- | --- |
| `POST /sessions` | Anonymous enrollment fields. | `201` on new creation, `200` on replay: `sessionId`, `participantId`, `role:"receiver"`, `expiresAt`, initial `state`, `presenterCode`, `presenterCodeExpiresAt`, `audienceCode`. |
| `POST /pair` | Anonymous enrollment fields plus `code`. | `200`: `sessionId`, `participantId`, `role:"controller"`, `expiresAt`, `state`, `audienceCode`. Same participant/token/key can recover its successful claim. |
| `POST /audience/join` | Anonymous enrollment fields plus `code`. | `200`: `sessionId`, `participantId`, `role:"audience"`, `displayName`, `expiresAt`, `state`. Audience never receives presenter code or roster. |
| `POST /sessions/:id/sync` | Any enrolled role; JSON `{protocolVersion,lastRevision,lastContentVersion,presence}`. `lastRevision:-1` asks for a complete snapshot. | `200` envelope below. |
| `PUT /sessions/:id/state` | Controller only; header `Idempotency-Key`; JSON `{protocolVersion,baseRevision,state:<writable state>}`. | `200` canonical snapshot/envelope; one revision increment per distinct successful mutation. |
| `GET /sessions/:id/ideas?limit=100&cursor=...` | Controller only; opaque validated cursor, limit 1–100. | `200`: `{protocolVersion,items:[PresentationIdea],nextCursor:null|string}`. No arbitrary first-page-only limit on the UI. |
| `GET /sessions/:id/ideas/:ideaId` | Any enrolled role; audience/receiver may read only the selected idea. | `200`: `{protocolVersion,idea:PresentationIdea}`. |
| `GET /sessions/:id/ideas/:ideaId/streetmix-thumbnail` | Any enrolled role with the same idea-read restrictions. Derive the upstream UUID from saved data. | Validated PNG; no-store. |
| `POST /sessions/:id/pairing` | Receiver only, idempotency header; no user state in body beyond protocol version. | `200`: replacement `presenterCode`, `presenterCodeExpiresAt`; old controller revoked. |
| `DELETE /sessions/:id/participants/me` | Any role except receiver; audiences leave themselves, controller relinquishes its role. | `204`; does not end the room. Receiver can issue a new pairing code. |
| `DELETE /sessions/:id` | Receiver or controller only. | Idempotent `204`; all roles become terminal. |

`presence` accepts an optional `localView:"map"|"photo"|"description"` for audience roster display. Receiver additionally reports `appliedRevision`, `viewport:{width,height}`, and `renderStatus:"loading"|"ready"|"error"` with an allowlisted `renderError` code. These are observational fields: they never change the selected idea, shared mode, revision, or another viewer's state. Acknowledge a revision only after actually applying it.

Sync envelope:

```json
{
  "protocolVersion": 1,
  "serverTime": "2026-10-21T18:00:00.000Z",
  "session": {"id":"<uuid>","status":"active","expiresAt":"<ISO date>","revision":12},
  "changed": true,
  "state": {"...":"full canonical state when changed; otherwise null"},
  "content": null,
  "participants": null,
  "receiver": {"appliedRevision":11,"viewport":{"width":1920,"height":1080},"renderStatus":"ready","renderError":null}
}
```

`content` is a `PresentationIdea` when its version differs from `lastContentVersion`, otherwise null. Send `lastContentVersion:null` when none is known. On a cleared selection it is null and state explicitly has `selectedIdeaId:null`; clients must clear obsolete content. Full bootstrap/sync responses include selected content when one exists. Only controller sync responses include `participants:[{id,displayName,connected,localView,lastSeenAt}]` for audience members and `audienceCode`; receiver enrollment may include audience joining material as specified above. Do not expose secrets or roster to audience. Receiver status may be null before its first report. Do not send the catalog on every sync. State writes return the same full envelope as a forced sync; conflict errors additionally include that envelope as `current`. Ignore a late response whose revision is older than the client's newest applied revision.

### Canonical state

```json
{
  "revision": 0,
  "ideaEpoch": 0,
  "selectedIdeaId": null,
  "mode": "map",
  "camera": {"latitude":32.7767,"longitude":-96.797,"zoom":13},
  "mapStyle": "streets",
  "railVisible": true,
  "theme": "dark",
  "albumItemId": null,
  "photoFrame": {"scale":1,"centerX":0.5,"centerY":0.5},
  "captionVisible": true,
  "descriptionPage": 0,
  "audienceDisplay": {"showQr":false,"showCode":false}
}
```

`revision` and `ideaEpoch` are server-owned and excluded from the writable state object. Other fields are an entire absolute snapshot, not a stream of pan deltas. Mode is `map|photo|description`, mapStyle is `streets|satellite`, theme is `light|dark`. Camera values must be finite, latitude within Web Mercator bounds ±85.05112878, longitude within [-180,180], zoom within [1,20]. Photo scale is [1,4]; normalized intrinsic-image center coordinates are [0,1]. Description page is a nonnegative integer within the canonical page array. A null selection supports map mode only.

On a different idea ID: increment `ideaEpoch`, select its first album item or null, reset photo framing to contain, reset description page to zero, center the map on valid idea coordinates, use zoom 16, and keep the presenter's chosen mode if content exists (otherwise use description for an empty album, or map when clearing selection). Keep style/theme/caption preference. Selecting the same idea without other changes does not reset audience exploration or increment `ideaEpoch`.

On an album item change, reset its framing to contain. A selected Streetmix item always has canonical `{scale:1,centerX:0.5,centerY:0.5}`; ignore/normalize requested transforms for that item. Its **effective** caption is false regardless of `captionVisible`. Keep that preference for the next real photo. Client controls and gestures must also be disabled; CSS-only disabling is insufficient.

`PresentationIdea` contains only `{id,contentVersion,creationDate,status,summary,details,descriptionPages,location:{latitude,longitude,address,description},emoji?,album}`. `album` is ordered `[{id,kind:"photo",url,caption}, ..., {id,kind:"streetmix",url,streetmixId,thumbnailPath,stale}]`. Streetmix is optional and last; `url` is the validated canonical assigned `https://streetmix.net/-/<digits>` URL. `thumbnailPath` is the session-authorized relay path. Do not include credentials or internal metadata in media URLs. `contentVersion` is a deterministic opaque digest of the public DTO content.

### Conflict, failure, and retry rules

- `409 REVISION_CONFLICT` includes the current canonical envelope. Controller serializes writes and rebases its latest pending field changes onto this state; never replay stale relative pan events or overwrite a newer idea selection with old content.
- `409 IDEMPOTENCY_CONFLICT` means one key was reused with a different request. Identical uncertain state retries return the original result without an additional mutation.
- `409 PAIRING_CLAIMED`, `410 PAIRING_EXPIRED`, `410 SESSION_EXPIRED`, `410 SESSION_ENDED`, `401 INVALID_SESSION_CREDENTIAL`, `403 ROLE_FORBIDDEN`, `404 IDEA_UNAVAILABLE`, `422 INVALID_PRESENTATION_STATE`, `426 PROTOCOL_UNSUPPORTED`, `429 RATE_LIMITED`, and `503 PRESENTATION_UNAVAILABLE` use the safe envelope. Disabled feature returns `404 PRESENTATION_DISABLED`.
- Use no-store for every session response. No token enters existing Firebase auth helpers, Workbox caches, suggestion caches, logs, query strings, or iframe URLs.
- After five seconds without successful sync, show reconnecting while retaining last content. Back off retries up to ten seconds, respect `Retry-After`, and request a complete snapshot on recovery. Terminal expiry/end clears credentials and does not auto-create or auto-join a different session.
- Audience follows the selected idea but owns its tab, photo index, text page, and optional detached map/photo framing locally. Local actions only update its optional presence report. On a new `ideaEpoch`, retain the local tab but reset local content position/framing. Presenter mode changes never force that tab. While attached, map/photo framing and text page can track the corresponding shared state; local manipulation detaches that view until Return to presenter.

<!-- END SHARED CONTRACT -->

## 5. Backend verification and completion criteria

Implement focused tests with injected clocks, token/code generators, stores, and provider fetches. No test may use production Firestore, Cloud SQL, real API keys, or live Streetmix generation. Follow existing test patterns rather than adding a second test framework.

Required cases:

1. Create/pair/join complete envelopes, normalization, accountless bootstrap, and all idempotent retry paths including a lost successful pairing response.
2. Two simultaneous presenter claims, code-purpose confusion, expired code/room, replaced controller, cross-session token misuse, invalid/missing credentials, and all role-denied mutations/roster reads.
3. At least 100 distinct audience enrollments in one session without an artificial product cap; changes from one audience member cannot affect canonical state or another member.
4. Optimistic concurrency, duplicate write receipts, reordering, content change/deletion, same-idea selection, stable album identity, empty descriptions/albums, and server-enforced Streetmix contain/no-effective-caption behavior.
5. Pagination preserves ordinary/Unicode/long-token content; public DTOs redact emails, UIDs, private workflow data, and arbitrary object properties across every read endpoint.
6. Presence throttling, disconnect/expiry, exact status codes, CORS headers, no-store, payload limits, and admission rate limits across two service instances.
7. Thumbnail validation/upstream timeouts, no caller-controlled URL, no credential forwarding, and consistent selected-idea restrictions.
8. Real Firestore emulator concurrency across two independent app/service instances. Do not substitute an in-memory test for proof of transactional claims. Keep the emulator test isolated with a `demo-*` project and named test database; if the emulator cannot run, complete all other tests and explicitly report this acceptance gap.
9. Existing application/Firebase authentication, suggestion CRUD, Streetmix generation/thumbnail protections, and suggestion socket aliases continue to pass their regression tests.

Suggested local commands (adapt the focused file names to the files you create):

```powershell
node --version
node --import tsx --test tests/presentation.test.ts tests/presentationAuth.test.ts tests/presentationContent.test.ts
node --import tsx --test tests/presentationEmulator.test.ts
npm test
npm run build
npm run docs:check
```

The emulator command requires a separately started local emulator and `FIRESTORE_EMULATOR_HOST`; never set that variable to a production host. Follow the existing emulator pattern and report skips distinctly from passes. The standard backend suite is reasonable at the integration checkpoint, not after every edit.

If a test fails, inspect the failure, fix the implementation or justified test defect, and rerun the affected tests before broadening. Do not delete assertions, weaken authentication, skip regressions, or call a skipped emulator test passing. Preserve unrelated user changes. Finish with an integration-ready local server and updated OpenAPI/README, not a mock-only API.

### Completion report and genuine stop conditions

Report changed files, implemented routes, exact commands/results, contract deviations (normally none), environment/setup requirements, and remaining manual verification. State **“No commit, push, or deployment was performed.”** Include the local startup command and how the frontend can point at this API.

Stop only for evidence of a security/visibility contradiction that cannot be resolved within the documented contract, unavailable required infrastructure after local alternatives are exhausted, or a conflicting user change that would have to be overwritten. Complete independent work first and report the smallest blocker. Do not stop merely because the user is away or because routine implementation is substantial.

## 6. Kickoff prompt

```text
Implement TV Presentation Mode's backend in the Urbanists Cloud API project using this complete runbook:
C:/Users/hexel/repos/DallasUrbanists/improvement-map/docs/presentation/backend-handoff.md

Read the entire runbook and applicable repository instructions, inspect the current working tree, and implement the documented protocol and lifecycle to completion. The handoff includes saved wireframe paths, the matching frontend contract, security boundaries, and test requirements. Work autonomously while I am away: implement the real API, add meaningful tests, run focused tests and the integration checks, investigate failures, and fix regressions. Preserve unrelated changes. Do not change the frontend or weaken existing authentication. Do not commit, stage, push, create a PR, deploy, change production infrastructure, or bump versions. Leave changes uncommitted and return an exact verification report with any genuine remaining blockers.
```
