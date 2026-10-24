# Firebase staging operations

The repository supports permanent staging at
`https://map-staging-143738155808.web.app` in project
`urbanists-mixer-slides-helper`, site `map-staging-143738155808`, target `staging`.
Production remains GitHub Pages from main. Both use `npm run build` without Storybook.

See the [local validation receipt](firebase-staging-validation.md) for exact results
and unresolved configuration/live acceptance work.

## Readiness boundaries

Repository checks, environment configuration, and live acceptance are separate
milestones. The completed local backend `docs/staging-handoff.md` (2026-10-23,
inspected read-only) records API origin
`https://urbanists-cloud-api-staging-kmjlhmx2cq-uc.a.run.app`, backend commit
`f819b41ef0a7c429b76fc4e2864a269f14874bc8` and revision
`urbanists-cloud-api-staging-00002-vid`. Live health matched all three and the
isolated database before frontend rollout. All six frontend staging Environment
variables and four required secret names were verified populated; values were not
printed. Frontend WIF provider is
`projects/143738155808/locations/global/workloadIdentityPools/map-staging/providers/github`.
The frontend publication and browser evidence are recorded in the validation
receipt; backend readiness alone does not establish frontend acceptance.
Do not derive a Cloud Run hostname from its service name. Origins ending in
`.invalid` are local fixtures and must never configure a deployment.

The backend operator supplies the non-secret receipt described in
[the backend runbook](cloud-api-staging-runbook.md#11-frontend-handoff-receipt):
actual API origin, frontend WIF provider and deployer email, backend commit/revision,
previous revision, isolated resource identities, flags, parity gaps, and populated
GitHub inputs. Confirm health includes `revision` with the actual Cloud Run revision;
the frontend verifier requires it, `status=ok`, `service=urbanists-cloud-api-server`,
`environment=staging`, a full `buildCommit`, and exactly
`databases=["public-improvements-staging"]`. Metadata identifies configuration;
successful writes and effective IAM isolation require separate evidence.

## GitHub and cloud configuration

An authorized operator creates/reuses Hosting, WIF/deployer, staging backend stores,
and browser keys. This repository does not provision them. WIF must restrict numeric
repository/owner IDs, staging branch, staging Environment subject and the intended
`deploy-staging.yml` workflow. Review effective IAM; do not use Owner/Editor.
Keep the existing shared Firebase project/accounts, Auth domains, App Check
enforcement and providers; authorize the canonical hostname without disrupting
production. Configure Maps referrer restrictions and signed-upload bucket CORS.

Restrict the GitHub Environment `staging` to staging deployments. Keep main as
default. Populate these inputs from the receipt and approved browser configuration:

| Environment variable | Required value |
| --- | --- |
| `STAGING_API_ORIGIN` | Actual approved HTTPS origin from receipt, without a path |
| `GCP_PROJECT_ID` | `urbanists-mixer-slides-helper` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Actual frontend provider resource name from receipt |
| `GCP_SERVICE_ACCOUNT` | Receipt-confirmed `map-staging-deployer@urbanists-mixer-slides-helper.iam.gserviceaccount.com` |
| `VITE_PRESENTATION_ENABLED` | `false` initially |
| `VITE_PRESENTATION_WEBSOCKET_ENABLED` | `false` initially |

| Environment secret | Public build variable |
| --- | --- |
| `STAGING_API_KEY` | `VITE_API_KEY` |
| `STAGING_GOOGLE_MAPS_API_KEY` | `VITE_GOOGLE_MAPS_API_KEY` |
| `STAGING_FIREBASE_API_KEY` | `VITE_FIREBASE_API_KEY` |
| `STAGING_RECAPTCHA_SITE_KEY` | `VITE_RECAPTCHA_SITE_KEY` |

Missing staging inputs fail, including empty secrets; production repository secret
names are never referenced. All `VITE_*` inputs are browser-visible. Never pass
server credentials, service-account JSON, passwords or access tokens through Vite.
The Google auth action supplies short-lived ADC through OIDC; do not configure
legacy Firebase tokens or downloaded service-account keys.

## Build and deployment behavior

The staging workflow accepts only staging pushes and manual dispatch selecting
staging. Checks use read-only permissions, Node 24, locked dependencies, Chromium
critical tests, release/staging Node tests and production's high/critical audit
policy. Its only audit exception is the existing narrow advisory-service timeout/5xx
exception. Release notes are read with complete history/tags and read-only
credentials; staging never creates GitHub releases.

Vite validates its actual resolved mode/env-file/process configuration and base.
Staging requires `BASE_PATH=/`, `VITE_DEPLOY_ENV=staging`, approved
`STAGING_API_ORIGIN` matching `VITE_API_BASE_URL`, all four browser inputs,
explicit feature flags, production Vite semantics, no App Check debug token, and full tested `BUILD_COMMIT`
matching checked-out HEAD. CLI base overrides cannot bypass validation.
Non-staging builds retain production defaults and subpath support.

After Workbox finishes, the build writes `dist/build-info.json` with only
`environment`, `buildCommit`, and normalized `apiBaseUrl`. Metadata is excluded
from precache and navigation fallback and handled with NetworkOnly. No product
banner is added. GitHub Pages still receives `404.html`.

The deployment job downloads the artifact for that exact tested SHA, installs the
pinned project-local Firebase CLI before authentication, validates cloud inputs,
checks artifact metadata before publication, skips superseded source, then
authenticates immediately before cloud operations.
Only this job gets `id-token: write`. It verifies backend identity, checks the
current staging SHA again immediately before publication, and runs only:

```sh
npx --no-install firebase deploy --project urbanists-mixer-slides-helper --only hosting:staging --non-interactive
```

This command requires an explicitly authorized rollout. The permanent live
channel belongs to the staging site. Staging concurrency is separate from Pages
and does not cancel active deployments.

After publication, HTTP checks compare cache-busted metadata with the artifact,
direct `/`, `/submit` and a synthetic `/suggestion/:id` route with this build's HTML,
static assets and headers, and the backend pair before/after publication. The
summary records frontend SHA, backend SHA/revision and HTTP outcome even on failure.
A post-publication failure does not automatically roll back Hosting.

All responses get `X-Robots-Tag: noindex, nofollow`. The first header rule
revalidates every request, including rewritten routes, HTML, service-worker files,
manifest, metadata and unversioned public files. The later rule overrides only
fingerprinted `/assets/` files with one-year immutable caching. Local tests use
the pinned Firebase server dependency to verify effective overlapping rules and
rewrites. Verify deployed headers again; local tests are not CDN evidence.
See [Firebase headers](https://firebase.google.com/docs/hosting/full-config#headers)
and [multisite targets](https://firebase.google.com/docs/hosting/multisites).

## Branches and promotion

Ordinary feature/fix/refactor/docs/test/chore/release branches start from staging;
hotfixes start from main. Issue naming and labels remain. Missing staging fails
before issue changes. Fetch staging after authorized bootstrap; main is never
substituted. Feature/refactor finish commands retain focused tests, build and
clean-tree checks and create draft PRs explicitly against staging without merging.

Local comparison prefers `origin/staging` for ordinary work and `origin/main` for
main, staging and `hotfix/*`, falling back only to the corresponding local ref.
`node scripts/ci-test-matrix.js --local <base>` honors an explicit base; detached
work requires it. CI PRs still compare event-derived base/head SHAs.

Prepare bootstrap review against main. Merging triggers production Pages and
requires production-release authority. After authorized bootstrap merge, create
staging from updated main and protect it. Dispatch requires the workflow on the
default branch. Test multiple features together, then promote the entire tested
batch through a regular merge PR from staging to main. Avoid squash merges for
recurring promotion. Deploy compatible production backend changes first through
its existing process. Merge main hotfixes back into staging. Version/tag commands
are main-only (`preversion` enforces the branch).

## Validation and live acceptance

The frontend currently has no sign-in UI; existing-account sign-in is not an
acceptance requirement for this app. Its public flow still uses production-mode
App Check. As explicitly approved on 2026-10-23, an OSM acquisition failure or
timeout skips only the optional location diagram. The success view reports that
the preview is unavailable; location, entered description and user photos remain
in the submission. Rendering, App Check, signed uploads and save failures still
reject normally. User cancellation is never treated as an OSM outage.

```sh
npm ci
node --test tests/staging.node.mjs tests/releases.node.mjs
node --test tests/ci-suites.node.mjs
npm run test:critical
npm run build
```

Also build a production subpath (`BASE_PATH=/improvement-map/`) and staging root
with test-only browser values, current HEAD SHA and a labeled fixture origin.
Clear inherited App Check debug configuration for that isolated build. Inspect
metadata, HTML paths and service worker; metadata must not enter precache. Never
deploy fixture artifacts. Validate workflows with actionlint. No shared UI change
is involved, so the comprehensive UX matrix is not the development feedback loop.

After an authorized real rollout, record a dated acceptance receipt with:

- Canonical URL, tested frontend SHA, backend SHA/revision, previous Hosting
  release and compatible backend rollback revision.
- Direct navigation/refresh on `/`, `/submit`, and a seeded suggestion.
- Maps/search, existing-account sign-in, real App Check, suggestions/images, and
  browser API requests to the approved staging origin.
- Explicitly authorized synthetic submission/upload with backend-operator
  confirmation of staging-only persistence; preserve shared Auth users/claims.
- Android and iPhone evidence, PWA updates across two deployments and separate
  origin storage, effective headers and fresh build metadata.
- Failed-test publication blocking and two distinct staged features coexisting
  at the recorded frontend/backend pair.
- Unavailable integrations and production-parity gaps.

HTTP routes and read-only smoke do not prove authenticated writes, upload CORS,
App Check, Maps or PWA updating. Live rollout is complete only with real evidence.

## Rollback

An authorized operator pauses staging publication and restores the previous
release for Hosting site `map-staging-143738155808` in Firebase release history.
Record its SHA; verify backend compatibility, metadata, headers and PWA updating.
Revert the faulty staging commit through review before resuming publication.
Preserve application data and shared users. The concrete previous Hosting release
is an operator receipt output; no rollback target is invented here.
