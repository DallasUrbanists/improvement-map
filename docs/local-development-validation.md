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
