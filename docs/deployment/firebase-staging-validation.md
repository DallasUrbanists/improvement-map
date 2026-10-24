# Frontend staging validation receipt

## Authorized rollout preflight, 2026-10-23

The completed local backend receipt was checked against live health: API
`https://urbanists-cloud-api-staging-kmjlhmx2cq-uc.a.run.app`, full backend SHA
`f819b41ef0a7c429b76fc4e2864a269f14874bc8`, revision
`urbanists-cloud-api-staging-00002-vid`, and exactly `public-improvements-staging`.
All six frontend staging variables and four secret names are populated; both
presentation flags are false and the Environment allows only `staging`.

The rollout uses an isolated worktree/branch so unrelated Google Earth changes
remain in the original checkout. Main remains the default and is not pushed.
Locked installation, 13 staging/release tests, 8 suite-contract tests, 4 critical
Chromium tests, normal/staging preflight builds, release-manifest ancestry,
actionlint and whitespace checks passed. The suite count was corrected from 324
to 328 for the four new origin-link cases; no assertions were removed. All three
Node test files are now enforced by the staging workflow. Audit passed the existing
high/critical policy, with 1 low and 6 moderate findings. Local staging preflight
used test-only browser values; publication must use the GitHub Environment inputs
and the exact clean, tested commit.

Publication and browser evidence will be appended after the authorized rollout.
The sections below retain the earlier implementation receipt as historical context.

## Historical implementation receipt

Date: 2026-10-23. Working tree based on `06c5d9b`, application 5.4.3.
Implementation changes are uncommitted; no implementation/deployed SHA is claimed.
Node 24.21.0, npm 11.19.0, pinned Firebase CLI 15.34.1.

## Repository implementation

Implemented explicit staging Hosting target/site configuration, SPA routing,
noindex and cache headers; mode-aware build validation with a pure core; a
Firebase-independent API guard; metadata written after Workbox; a tested-commit
artifact workflow with deployment-only OIDC, superseded-commit checks, backend
identity and frontend HTTP verification; main-only production dispatch guards;
staging-aware branch/PR/comparison tooling; main-only version commands; tests and
operations documentation. The 311 search link now uses the configured API origin.
The UX Vite wrapper resolves the new configuration factory.

`npm run build` remains `vite build`. Pages `404.html`, release-event main checkout,
release ancestry checks, production credentials, shared Firebase configuration,
and existing application CI event selection/schedule remain in place. The lockfile
adds the pinned CLI; no retained dependency path changed its locked version.

Pre-existing `.agents/README.md`, `.agents/runbooks/`, and backend-runbook
documentation work was preserved. The backend repository was read only for its
receipt and health contract and was not modified.

## Local results

| Check | Outcome |
| --- | --- |
| `npm ci` | Passed; native re2 install-script review warning remains |
| `node --test tests/releases.node.mjs` | 4 passed |
| `node --test tests/staging.node.mjs` | 9 passed, including actual Vite resolution and local Firebase-server responses |
| `node --test tests/ci-suites.node.mjs` | 8 passed |
| `npm run test:critical` | 4 Chromium tests passed, isolated local port 5187 |
| `npm run build` | Passed under normal production configuration |
| Production `BASE_PATH=/improvement-map/` build | Passed; subpath assets/Pages fallback verified; staging metadata absent |
| Staging `BASE_PATH=/` build | Passed with test-only browser values and `https://staging-api.example.invalid`; metadata/source SHA, root assets, Pages fallback and metadata precache exclusion verified |
| actionlint 1.7.12 | All three changed workflows passed syntax/expression checks; optional shellcheck/pyflakes integrations disabled |
| `npm audit --audit-level=high` | Passed; 5 moderate findings in CLI dependencies, no high/critical findings |
| `git diff --check` | Passed |
| `npm run test:ux -- recommended-actions.spec.js` | 16 passed, 12 failed; new API-origin link assertion passed on Android/iPhone in light/dark |

The recommendation failures concern three existing scenarios on all four profiles:
the test cannot find `My actions (1)` as a link, cannot find `Find actions` after
a failed generation, and cannot click the accordion at 880x360 because overlapping
content intercepts it. These selectors/interceptions also reproduced in an archived
`06c5d9b` checkout on Android/light. The baseline harness needed a separate Vite
cache/port and filesystem allowance for shared dependencies; it also reported
map-mock `this.setMap` errors. The first baseline attempt had navigation timeouts.
This is supporting evidence about those scenarios, not a claim that the complete
UX suite is green. No product behavior or screenshot baselines were changed to
make those tests pass.

Local screenshots, traces and error contexts remain under ignored
`test-results/ux/` and `test-results/staging-baseline-confirmed/`; the current UX
HTML report is under `playwright-report/ux/`. Deployment-specific tests and build
checks pass; broader recommendation UX findings remain for separate review.

## Required environment configuration

The backend's `docs/staging-handoff.md`, dated 2026-10-23, confirms the shared project,
dedicated Hosting site contract and frontend deployer
`map-staging-deployer@urbanists-mixer-slides-helper.iam.gserviceaccount.com`.
It explicitly leaves the actual API origin and frontend WIF provider pending
provisioning and records no deployed backend SHA/revision or populated GitHub inputs.
No hostname/provider was invented or substituted with production.

An authorized operator must supply the completed receipt, configure the staging
GitHub Environment variables and four staging-prefixed browser secrets, create or
confirm Hosting/WIF/IAM and isolated backend resources, authorize Auth/App Check,
Maps and upload CORS, then perform the authorized bootstrap/branch protection
sequence. See [operations and exact inputs](firebase-staging.md). Browser keys are
public build configuration; server credentials must never enter Vite or artifacts.

## Verified live rollout

None. No commit, push, merge, cloud provisioning, deployment, GitHub configuration
change or live application-data mutation was performed. No live frontend/backend
commit pair or previous Hosting release is available. The canonical URL
`https://map-staging-143738155808.web.app` is a contract, not verified deployment evidence.

Routing/headers were tested locally and PWA files were inspected locally. Real
Auth/App Check, Maps/search, upload/submission isolation, Android/iPhone live
behavior, PWA updates across two releases, failed-test publication blocking and
two-feature coexistence remain unverified. Backend external-provider parity gaps
in the receipt also remain. Rollback must select the actual previous release on
the dedicated staging Hosting site and verify its compatible backend revision;
no data reset or invented rollback target is proposed.
