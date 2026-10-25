# Presentation WebSocket transport

The TV, presenter remote, and audience pages can receive presentation state over
an authenticated WebSocket. Enrollment, pairing, joining, presenter commands,
catalog/detail requests, thumbnails, leaving, and ending a session continue to
use HTTPS. The socket accepts authentication and presence frames only; it never
accepts presentation commands.

## Opt-in and server prerequisites

WebSocket probing is opt-in. Set `VITE_PRESENTATION_WEBSOCKET_ENABLED=true` for
the frontend. The API must support presentation socket protocol version 1 and
have both `PRESENTATION_ENABLED=true` and
`PRESENTATION_WEBSOCKET_ENABLED=true`. Both frontend and backend switches
default to off. The frontend recognizes only the exact string `true`; unset,
empty, and `false` all keep HTTP synchronization enabled.
For cross-origin HTTP fallback and command retries, the API must expose
`Retry-After` through `Access-Control-Expose-Headers` on its responses.

The endpoint is `/api/public-improvements/presentation/ws` on the configured
`VITE_API_BASE_URL` origin. The client derives `ws:` or `wss:` from that origin.
The URL has no query string or fragment and carries no credentials. After the
socket opens, the first text frame contains the existing session ID, participant
ID, and participant token. It does not contain a role, admission code, API key,
Firebase token, or App Check token. Credentials remain in tab-scoped
`sessionStorage`; admission codes continue to be removed from QR fragments
before enrollment.

HTTPS `/sync` remains authoritative while a socket is opening, reconnecting, or
unsupported. A socket takes over only after a protocol-v1 full snapshot passes
validation and is at least as new as the currently applied state. It then stops
periodic sync requests. On a transient close the last presentation remains
mounted, HTTP sync resumes, and the same participant reconnects with the same
session credentials. Enrollment is never replayed because a socket closes.
Socket retry, HTTP sync, and HTTPS write retry deadlines are independent.
Uncertain commands retain their original idempotency key and body; a definitive
revision conflict rebases the command with a new receipt.

The server sends an application heartbeat every 15 seconds. The client answers
with the latest role-specific presence. A ready snapshot and each newer
snapshot are validated atomically; duplicate or older sequence values do not
change display state or extend liveness. If the page is suspended long enough
for liveness to expire, visibility restoration replaces the stale connection
and resynchronizes. Browsers may suspend background timers and network work, so
continuous background execution is not guaranteed. Screen Wake Lock is
feature-detected and best-effort for the TV/controller; audience phones are not
kept awake.

Socket-version incompatibility or a socket policy fault disables socket probes
for the current page session and keeps HTTP fallback available. A shared
presentation DTO protocol mismatch stops session I/O and is shown as a
compatibility error. Terminal session/credential errors stop retries and clear
only the matching active participant credential. Other close codes are not
treated as proof that a credential was revoked.

## Local test runs

The focused HTTP presentation regression command automatically starts a fresh
Vite server on `127.0.0.1:5176` with the mock API origin and WebSockets disabled:

```powershell
npm test -- tests/presentation.spec.js --project=chromium --workers=1
```

Your development server on port 5173 can remain running. Reusing it would inherit
its API URL and flags, causing enrollment to fail when the fixture blocks requests
outside its mock API origin. `PLAYWRIGHT_BASE_URL` overrides the test server address;
the selected port must be free. These tests use five-digit numeric pairing codes,
including a leading zero. They do not contact the local API or Firestore emulator.

The focused connection config starts a fresh Vite server on `127.0.0.1:5175`,
sets the presentation and transport flags explicitly, mocks the API origin, and
blocks unexpected external requests. Its deterministic socket fixture validates
authentication and role projections and pushes snapshots to connected contexts.
These are browser tests against a mocked backend, not a real Cloud API or
Firestore emulator integration.

```powershell
# Socket-enabled Chromium run; the config defaults to on.
npm test -- --config=playwright.presentation.config.js --project=chromium

# Discover selected socket-on tests without starting a server.
npm test -- --config=playwright.presentation.config.js --project=chromium --list

# Fresh-server socket-off run, with the prior task-specific value restored.
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

The off-mode case starts the app with the switch set to `false`, verifies that
HTTP sync works, and observes zero socket attempts. The dedicated suite is
registered as `regression-presentation` and covers Chromium, Mobile Chrome, and
WebKit. The ten-minute idle/interaction soak is excluded from routine runs;
run it explicitly with `PRESENTATION_SOCKET_SOAK=1` and the socket-on mode.

Real backend integration requires the companion API implementation, its local
Firestore emulator fixture, and a local Vite API-origin override. Use synthetic
ideas and generated test credentials in that isolated environment. Do not use
production credentials or production data for mutation testing.
