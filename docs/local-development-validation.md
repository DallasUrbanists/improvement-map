# Container development validation — October 24, 2026

First milestone implemented against staging `4d9727f`. Verified on Windows with
Docker Desktop Linux/AMD64 containers, Node 24.21.0, and the lockfile's browsers.
macOS, ARM64 and native Linux host onboarding have not been exercised.

| Check | Result |
| --- | --- |
| Shared development image | Built successfully with Node, npm dependencies, Chromium, WebKit and browser system libraries |
| Compose startup | App, Storybook and mock service healthy together; loopback-only published ports |
| `npm run test:local` in the test container | 5 Node checks and 2 Chromium journeys passed with `network_mode: none` |
| Default configuration | No local env file required; legacy credentials ignored; every dependency mock; Maps-only live selection and missing-input failures checked without contacting Google |
| Local upload/submission | Frontend API clients uploaded, downloaded and decoded an actual WebP, created a suggestion and opened its detail; Node checks covered restart persistence and explicit errors |
| Focused GoogleMap/Tabbar stories | 10 light/dark interaction and accessibility cases passed with external networking disabled |
| Existing Browse feature journey | Android/light passed in the isolated container |
| `npm run build:pages` | Application plus static catalog built in the container without external networking |
| `npm run test:storybook:pages` | 2 Pages/PWA packaging and isolation checks passed |
| Staging/release/CI configuration contracts | 24 Node checks passed |
| Storybook selector/tooling | 5 Node checks passed |
| Compose/workflow YAML and Git whitespace | Parsed/configured successfully; `git diff --check` passed |

Local command receipts are under `test-results/local-development-run.log`,
`test-results/local-storybook-offline-run.log`, `test-results/local-browse-run.log`,
`test-results/local-integration-run.log` and `test-results/local-guardrails-final.log`.
Container reports are exported under `test-results/local-development/`.
The map screenshot at
`test-results/local-development/test-results/local-development/storybook-map.png`
was inspected: it shows the attributed recorded geometry and local controls.
All screenshot candidates remain **visual-review-pending**; designs remain Draft.
New environment checks and existing Storybook checks remain advisory.

## Default development command

`npm run dev` now delegates to `docker compose up --no-build --pull never`.
Verified the command with `-- --wait --wait-timeout 120 -d`: app, Storybook and
mock containers became healthy together. The host app's `/__dev` returned every
mode as mock, and the Storybook index returned HTTP 200 at its default port 6006.
Explicit live selectors remain available. Startup never falls back to native Vite.

The prior native entry point is `npm run dev:provider`. All four existing
Playwright server configurations now invoke that explicit command with their test
configuration. Rechecked 10 local/Storybook tooling cases and 9 CI suite checks;
all passed. The Browse Android/light journey passed inside the test container
with external networking disabled. Receipts are
`test-results/default-dev-browse.log` and `test-results/default-dev-ci-suites.log`.

## Milestone review

Review found and corrected one mock proxy issue: Vite deep-merged the live
Overpass path rewrite into the local proxy. The mock now explicitly keeps its
route. The browser startup check sends actual Overpass QL through both app proxy
paths and verifies recorded fixture responses; the running app also returned
HTTP 200 with 125 recorded ways.

The final isolated run passed 5 local Node checks, 2 startup/upload browser
journeys, 10 GoogleMap/Tabbar interaction/accessibility cases, and 5 Storybook
selector checks with external networking disabled. Receipt:
`test-results/container-milestone-final.log`. Compose and both changed workflow
YAML files parsed successfully. Existing widget and advanced-mock limitations
below remain explicit follow-up work.

## CI follow-up

The first PR run exposed a clean-checkout mount failure before the offline tests
started. The test service mounted an unused dependency volume inside its read-only
source bind, requiring a `node_modules` directory that fresh runners do not have.
Removed that mount: the entrypoint already prepares dependencies in its isolated
temporary checkout. A fresh Git archive with no host dependencies passed all 5
Node checks and 2 browser journeys with external networking disabled.

The combined report also encountered container versus host checkout paths and
different test roots once browser jobs produced their evidence. UX now uses the
same `tests` root as regression/unit jobs, with its existing spec selection and
`tests/ux/snapshots` locations preserved. An explicit merge config relocates paths
to the report checkout. Existing suite-partition checks passed; a new regression
case creates real blob reports in two checkout roots, merges HTML and JSON, and
verifies both test results and the `ux/` source prefix. The merger checks and Browse
journey also passed in the isolated offline test container. No assertions or
advisory enforcement were relaxed.

## Storybook permission-guard regression

Storybook run `40145551987` completed with a green advisory job, but its published
step outcomes showed visual checks failing: 84 passed and 292 failed. Component
interactions/accessibility passed 142 cases and Pages isolation passed 2 cases.
The overall job status alone did not establish that the visual checks passed.

The local browser bootstrap attempted to redefine the non-configurable geolocation
property installed by the catalog's permission guard. It now preserves that guard
instead of throwing. The guard still rejects permission requests; it is not
replaced or relaxed. The normal application startup check also verifies the
deterministic mock GPS coordinates.

After the fix, the full built-catalog browser matrix passed 368 cases, including
all 284 catalog preview checks. Eight drawer cases still failed. Both left/right
failure types reproduced against unmodified staging `b59c437` in narrow/light:
the story play functions close the drawer, while the browser checks expect the
backdrop to remain opaque. Drawer source, stories and assertions were not changed
in this milestone. These existing failures need a separate test-setup correction.
Screenshot candidates remain unapproved.

Local receipts: `test-results/storybook-ci-bootstrap-fix.log`,
`test-results/storybook-staging-drawer-baseline.log`, and
`test-results/storybook-guard-offline-startup.log`.

## Storybook Component tests widget limitation

CLI component tests work. The pinned 10.6.3 widget intermittently failed with
`UniversalStoreFollowerTimeoutError` or stale Starting/running status during live
verification. This corresponds to the reported
[addon startup race](https://github.com/storybookjs/storybook/issues/35864).
The [proposed upstream fix](https://github.com/storybookjs/storybook/pull/36068)
was tried temporarily, but did not establish reliable widget completion here.
It is not included in the image or source. Use the documented CLI checks and
restart Storybook if the widget crashes. No package versions, assertions, baseline
approvals or deployment guards were changed to hide this limitation.

## Storybook CSS update investigation

Measured the installed Storybook 10.6.3 / Vite 6.4.5 on Windows with a headless
Chromium preview of `buttons-text-button--floating`, comparing native port 6009
with Docker port 6006. Three edits per file inserted a unique CSS custom property,
waited for its computed value, and recorded Vite WebSocket messages. Each file was
restored afterward. Separate edits to repository docs and a Node test checked
unrelated reloads. These are local observations, not timing thresholds or a
long-duration stability guarantee.

Two causes were isolated:

- Tailwind's automatic repository scan made unrelated docs/test edits trigger
  full reloads in the native preview. Explicit template sources removed those
  reloads after a server restart. Narrowing sources alone did not eliminate slow
  stylesheet recompilation.
- `src/style.css` imported Tailwind and Konsta as well as ordinary app rules. A
  Vite transform profile attributed 3,448 ms to Tailwind on that entry. Moving the
  framework imports, theme and existing body `@apply` declarations into a separate
  `src/tailwind.css` entry lets ordinary CSS edits bypass that compilation. Both
  production and preview import the framework entry before the app rules.

| Edit | Before | After |
| --- | --- | --- |
| Native `src/style.css` | 2,315 / 3,451 / 3,143 ms | 66 / 66 / 47 ms |
| Docker `src/style.css` | Two exceeded 15 s; one took 14,271 ms | 232 / 1,036 / 555 ms |
| Docker preview-only CSS | 12,637 / 8,485 / 10,841 ms | 547 / 430 / 581 ms |
| Docker component scoped CSS | Not measured before | 569 / 1,051 / 1,085 ms, no full reload |
| Native docs/test edits | Full reload for each of six edits | No reload for those six edits |

Docker timings include the existing 500 ms polling configuration and Windows bind
mount overhead; no polling interval, dependency versions or test-widget behavior
was changed. Timings vary with machine load. Source declarations include the app,
catalog templates, preview scripts and local browser adapters; Konsta registers
its own sources through its theme import.

The test-widget startup limitation above remains unresolved. Server history also
contained a Vite `ENODATA` read error; the timing probes did not reproduce it or
establish its cause. No claim is made that every reconnect is fixed. Experimental
docgen remains enabled: the installed non-server `vue-component-meta` fallback
explicitly sends a full reload from its hot-update hook.

Local timing receipts and the temporary probe are under
`test-results/storybook-hmr-*.log` and `test-results/storybook-hmr-probe.mjs`.
No screenshot baselines or component approvals were changed.

Final validation: production and static Storybook builds passed; Text Button and
Floating Modal interactions/accessibility passed all 14 light/dark cases. Local
validation passed 8 Node checks and 2 Chromium journeys. The native app smoke test
initially exposed an existing Windows bootstrap bug: Vite's forward-slash HTML
filename did not match the platform-native path, so the browser mocks were never
injected. The local plugin now normalizes that filename; a regression check covers
app injection while keeping Vitest's tester HTML untouched. The map screenshot
from the smoke journey remains a candidate, not an approved baseline.

## Remaining plan work

This is the shared container/browser and starter-mock milestone. The mock server
implements the response shapes used by the verified frontend paths; it is not a
complete OpenAPI conformance implementation. Full schema validation, richer civic
and recommendation fixtures, account simulation, Streetmix generation, presentation
HTTP/socket scenarios, and broader mock/live combinations remain follow-up work.
Unsupported endpoints return explicit errors and presentation stays disabled.
Real provider connectivity was not tested; no cloud deployment or credentials
were changed. `npm run dev` now starts the shared container stack; the previous
native Vite entry point is available explicitly as `npm run dev:provider`.
Playwright fixture servers use that explicit entry point. Deployment commands
retain their established behavior.
