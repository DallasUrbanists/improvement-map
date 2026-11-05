# Firebase Hosting staging implementation runbook

Prepared: 2026-10-23. Status: implementation handoff; no repository implementation or live rollout is claimed.

Execution repository: `C:\Users\hexel\repos\DallasUrbanists\improvement-map`.

Inspected frontend baseline: `06c5d9b`, version `5.4.3`. Paths below are relative to this repository unless stated otherwise.

Backend companion: [Cloud API staging developer runbook](../../docs/deployment/cloud-api-staging-runbook.md).

## 1. Objective, decisions, and completion boundary

Implement a permanent shared Firebase Hosting staging frontend deployed from staging, connected to the isolated staging Cloud API. Keep production on GitHub Pages from main.

```text
ordinary feature branches -> PR -> staging -> shared remote testing
                                     |
                                     +-> release PR -> main -> production
```

Multiple features coexist in staging. Promotion includes the entire tested staged batch. Use the existing Firebase project and login accounts; application data lives in separate backend stores. Use the permanent `.web.app` site URL, without custom DNS or per-PR preview environments.

Track these milestones separately:

1. Repository implementation verified locally.
2. GitHub/cloud configuration completed.
3. Deployed staging validated against the real staging backend.

Do not report the environment complete until milestone 3 passes. Preparing this document does not authorize deployment. Follow the actual execution request; when rollout is authorized, perform the authorized staging steps without repeatedly asking permission. Production deployment and production data mutation require their own authority.

## 2. Acceptance criteria

- A staging push deploys the tested frontend commit after checks pass.
- The site has a persistent URL and working direct navigation/refresh on app routes.
- Missing staging configuration fails; it cannot silently fall back to production API settings or keys.
- Existing authentication, Maps, App Check, uploads, and PWA behavior work under production build conditions.
- Production Pages retains its current release behavior, with manual deployment restricted to main.
- Ordinary branch tooling targets staging, while hotfixes target main.
- Two distinct features can coexist remotely; the tested frontend/backend SHAs are recorded.
- A previous staging Hosting release can be restored without resetting application data.

## 3. Read instructions and preserve current work

Read root `AGENTS.md`, `.agents/instructions.md`, and applicable descendant instructions. Inspect:

```text
git status --short
git branch --show-current
git log -3 --oneline
```

Preserve unrelated work. Do not reset, stash, overwrite, or remove another task's changes. Revalidate the following facts once and reconcile narrow differences before implementation:

| Area | Current relevant code |
| --- | --- |
| Production deployment | `.github/workflows/deploy.yml` |
| Application CI | `.github/workflows/usability.yml` |
| Vite base/PWA/Pages fallback | `vite.config.js` |
| API origin | `src/services/apiBaseUrl.js` |
| API headers | `src/services/api.js` |
| Shared Auth/App Check | `src/services/firebase.js` |
| Branch creation | `scripts/create-branch.js` |
| Finish commands | `scripts/finish-branch.js` |
| Test selection | `scripts/ci-test-matrix.js` |
| Suite contracts | `tests/ci-suites.node.mjs` |
| Release manifest/checks | `scripts/releaseManifest.js`, `tests/releases.node.mjs` |

Confirmed observations:

- Production runs on main pushes, manual dispatch, and release events.
- Tests record a commit and the build checks out that commit.
- The build command is `npm run build`. Storybook and `build:pages` have been removed; do not restore them.
- Vite accepts `BASE_PATH`; the router uses history mode and the Vite base.
- The PWA uses automatic service-worker updates and runtime caching.
- The API helper defaults to `https://api.dallasurbanists.org`.
- Shared Firebase configuration is intentionally fixed to the existing project.
- Branch creation explicitly starts from main; finish commands omit an explicit PR base.
- Local test selection defaults to `origin/main`; CI PR selection already derives the event's base/head.
- Application CI already handles PR events.

The historical project brief is not authority to redesign current UX. This task does not need new product UI components or a styling migration.

## 4. Hosting and backend contract

| Setting | Value |
| --- | --- |
| Project | `urbanists-mixer-slides-helper` |
| Hosting site | `map-staging-143738155808` |
| Hosting target | `staging` |
| Canonical URL | `https://map-staging-143738155808.web.app` |
| Hosting channel | Permanent live channel of the staging site |
| Branch | `staging` |
| GitHub Environment | `staging` |
| Base path | `/` |
| Build marker | `VITE_DEPLOY_ENV=staging` |
| API origin | Exact generated origin from the backend receipt |

Firebase's live channel here belongs to the staging site; it is not the production application. Use the backend receipt for the API URL and cloud identity inputs. Do not guess generated hostnames or insert production placeholders.

The backend developer/cloud operator owns common cloud resources, identities, Hosting site creation, Auth/App Check hostname authorization, and browser-key provisioning. This agent owns repository Hosting configuration, workflow implementation, branch tooling, tests, and frontend documentation. Do not independently create duplicate cloud resources or edit the backend repository.

## 5. Add Firebase Hosting configuration

Create root `firebase.json` and `.firebaserc`:

- Define only the explicit staging Hosting target and map it to the agreed site/project.
- Publish only `dist/`.
- Rewrite app routes to `/index.html`, while existing assets remain directly accessible.
- Set `X-Robots-Tag: noindex, nofollow` on staging responses.
- Revalidate HTML, service-worker files, manifests, and build metadata.
- Give generated fingerprinted assets long-lived immutable caching; keep unversioned public files out of that policy.
- Verify effective response headers, including rewrite responses and overlapping header rules.

Preserve the Pages plugin generating `404.html`. Do not replace production's routing behavior with Firebase-specific assumptions.

Use a pinned, project-local Firebase CLI. The staging deploy command is:

```text
firebase deploy --project urbanists-mixer-slides-helper --only hosting:staging --non-interactive
```

Do not use an unqualified deploy command or a temporary preview channel. Configuration references: [Hosting behavior](https://firebase.google.com/docs/hosting/full-config) and [multiple-site deployment targets](https://firebase.google.com/docs/hosting/multisites).

Ignore generated `.firebase/` caches and `gha-creds-*.json`; keep the explicit Firebase configuration files tracked. Credentials and cache files must not enter published artifacts. Do not broaden ignore rules to hide application source or configuration.

## 6. Validate the actual staging build configuration

Add a small validator used by the real build path, with a pure testable core. When `VITE_DEPLOY_ENV=staging`:

1. Require `BASE_PATH=/`.
2. Require an explicit HTTPS API origin matching approved `STAGING_API_ORIGIN`.
3. Reject production API aliases, localhost, embedded credentials, and unexpected URL path/query/fragment components.
4. Require the API, Maps, Firebase browser, and reCAPTCHA inputs.
5. Reject App Check debug-token configuration in deployed staging.
6. Preserve existing production behavior when the staging marker is absent.

Resolve variables with the same Vite mode/env-file precedence used by the build. Do not validate one set of values and build with another. CI must explicitly supply the staging marker and inputs.

Add a runtime guard in `apiBaseUrl.js` so a staging build cannot fall back to production. Keep that helper independent of Firebase/Auth imports because capability-based presentation clients rely on the separation.

All `VITE_*` values are public browser configuration. Never pass service-account credentials, SQL passwords, server provider secrets, or Google access tokens through Vite. Shared Firebase browser configuration may remain unchanged for the selected shared-user setup.

## 7. Add non-secret deployment metadata

After the staging app build, write `dist/build-info.json`:

```json
{
  "environment": "staging",
  "buildCommit": "<tested frontend commit SHA>",
  "apiBaseUrl": "<approved staging API origin>"
}
```

- Use the actual tested SHA and resolved origin; never include keys/tokens.
- Keep metadata out of service-worker precaching and navigation fallback.
- Use a cache-busting request to verify the deployed file.
- Do not add a product banner or redesign merely to expose build information.
- Preserve existing release-manifest ancestry checks; staging must not create or publish GitHub releases.

A post-build metadata writer avoids accidentally precaching the metadata during Workbox generation. Ensure service-worker navigation handling also excludes the metadata URL.

## 8. Add the staging deployment workflow

Create `.github/workflows/deploy-staging.yml` with pushes to staging and manual dispatch selecting staging. Do not deploy feature PRs, tags, release events, arbitrary manual refs, or `pull_request_target` code.

Required sequence:

1. Apply an explicit event/ref guard.
2. Check out the event commit and record its full SHA.
3. Use Node 24, consistent with the project's engine requirement; install locked dependencies.
4. Install the required Playwright browser and run `npm run test:critical`.
5. Run `node --test tests/releases.node.mjs`.
6. Apply production's dependency-audit policy, including only its existing narrow advisory-service outage exception.
7. Fetch complete history/tags, then run `scripts/releaseManifest.js` with read-only repository credentials.
8. Validate resolved staging configuration and build with `npm run build`.
9. Write deployment metadata.
10. Authenticate using GitHub OIDC and Workload Identity Federation immediately before cloud operations.
11. Verify backend health reports `environment=staging` and `public-improvements-staging`; record its backend SHA/revision.
12. Deploy only `hosting:staging` in the explicit project.
13. Verify frontend metadata, representative direct routes, and headers.
14. Publish the canonical URL, frontend SHA, backend SHA, and validation outcome in the workflow summary.

Build/deploy the same tested commit. If jobs are split, pass the recorded SHA explicitly instead of checking out the latest branch independently.

Use the `staging` Environment, a staging-specific concurrency group, and `cancel-in-progress: false`. Skip a superseded commit immediately before publication. Keep staging concurrency separate from production Pages.

Grant OIDC only to the deployment job; use read-only permissions for tests/build checks. Pin the Firebase CLI and use reviewed action versions. Use ADC via [Google's authentication action](https://github.com/google-github-actions/auth), not a downloaded service-account JSON key or legacy Firebase token. Install tools before authentication so credential lifetime is spent on deployment work.

## 9. GitHub Environment inputs

Configure these variables in the frontend staging Environment:

| Variable | Value/purpose |
| --- | --- |
| `STAGING_API_ORIGIN` | Exact backend receipt origin |
| `GCP_PROJECT_ID` | `urbanists-mixer-slides-helper` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Frontend WIF provider resource name |
| `GCP_SERVICE_ACCOUNT` | Frontend deployer service-account email |
| `VITE_PRESENTATION_ENABLED` | Explicit feature flag, initially `false` |
| `VITE_PRESENTATION_WEBSOCKET_ENABLED` | Explicit feature flag, initially `false` |

Use staging-prefixed secret names and map them to the build environment:

| Secret | Build variable |
| --- | --- |
| `STAGING_API_KEY` | `VITE_API_KEY` |
| `STAGING_GOOGLE_MAPS_API_KEY` | `VITE_GOOGLE_MAPS_API_KEY` |
| `STAGING_FIREBASE_API_KEY` | `VITE_FIREBASE_API_KEY` |
| `STAGING_RECAPTCHA_SITE_KEY` | `VITE_RECAPTCHA_SITE_KEY` |

Map `STAGING_API_ORIGIN` to `VITE_API_BASE_URL`, and explicitly set `VITE_DEPLOY_ENV=staging` and `BASE_PATH=/`.

Staging-prefixed names prevent missing Environment secrets from silently resolving to production repository secrets with the same names. Require all inputs before build. Never print their values.

Restrict the Environment to staging deployments. Keep main as the default branch. Enable presentation frontend/backend flags together only when testing that feature.

## 10. Preserve and guard production deployment

Modify `.github/workflows/deploy.yml` narrowly:

- Permit main push deployments and manual dispatch from main only.
- Preserve release-event behavior, which explicitly checks out main. A release event's tag ref must not make the main-only manual guard reject it.
- Preserve commit pinning, Pages setup, release notes, current build command, and production Environment.
- Never deploy Firebase from the production workflow.

Review these combinations:

| Event/ref | Expected result |
| --- | --- |
| Push to main | Production Pages |
| Dispatch selecting main | Production Pages |
| Dispatch selecting staging/feature | No production deploy |
| Existing release event | Existing main-source production behavior |
| Push to staging | Firebase staging only |

Do not change production credentials or require the new staging variables in production builds.

## 11. Branch and test-selection tooling

Preserve existing branch naming and issue association.

### Branch creation

- Ordinary feature, fix, refactor, docs, test, chore, and release branches start from staging.
- Hotfix branches start from main.
- Missing staging produces a clear bootstrap error; do not silently use main.

### Finish commands

- Existing feature/refactor finish commands create draft PRs with explicit `--base staging`.
- Keep focused tests and clean-tree checks; do not merge or enable auto-merge.

### Local test comparison

- Main, staging, and `hotfix/*` compare against main for local batch/hotfix review.
- Ordinary work branches compare against staging.
- Preserve an explicit comparison-base argument.
- Prefer the remote-tracking ref; use the corresponding local ref only if needed.
- Never substitute main for missing staging.
- Require an explicit base for detached/unidentified local work.

### CI and release documentation

- Add staging pushes to existing application CI.
- Preserve event-derived PR base/head selection and existing release/schedule behavior.
- Do not add schedules or restore removed Storybook CI.
- Document ordinary PRs to staging, regular merge promotion PRs to main, and main hotfixes merged back to staging.
- Keep version/tag commands main-only; do not invoke them during staging setup.

Update `.env.example`, relevant developer/release documentation, and the agent-material index as needed. Do not replace the current working instructions with the historical brief.

## 12. Focused tests and local checks

Add meaningful tests for configuration and branch behavior. Use fixtures/temporary repositories; do not create real issues or PRs from tests.

Cover:

- Approved staging origin accepted; missing, production, or mismatched origins rejected.
- Missing staging credentials rejected without production fallback.
- Staging API helper cannot fall back to production; non-staging behavior remains compatible.
- Root-base staging and production subpath builds remain valid.
- Ordinary branches use staging; hotfixes use main; missing staging fails clearly.
- Finish command receives an explicit PR base.
- Explicit comparison-base overrides remain honored.
- Production dispatch guards preserve release events.
- Metadata contains the tested SHA/origin and no secret inputs.

Run focused tests during development. At the integration checkpoint:

```text
npm ci
node --test tests/releases.node.mjs
node --test tests/ci-suites.node.mjs
npm run test:critical
npm run build
```

Also build with representative staging inputs at `/`; use test-only browser values for local artifact checks. Validate workflow syntax with an available workflow validator and review permissions, branch guards, dependencies, and exact-SHA flow. Do not claim a live check was performed based on static inspection.

Follow repository guidance for UX integration checks if shared behavior changes. Do not repeatedly run the comprehensive audit matrix or regenerate screenshot baselines to hide failures.

## 13. Bootstrap and authorized live rollout

Prerequisites:

- Backend receipt exists and health identifies staging stores.
- Hosting site and WIF/deployer identities exist.
- Shared Auth, App Check/reCAPTCHA, Maps restrictions, and upload CORS authorize the canonical hostname.
- GitHub Environment inputs are populated.

Sequence:

1. Prepare/review the bootstrap PR against main. Note that merging triggers the normal production Pages deployment; do not merge without production-release authority.
2. After bootstrap merge, create staging from updated main and apply protections. Workflow dispatch requires the workflow to exist on the default branch.
3. Push or manually dispatch the staging workflow within the authorized rollout.
4. Verify workflow summary, metadata, backend identity, routes, and headers.
5. Perform real browser checks and record evidence.

Remote acceptance:

- Open `/`, `/submit`, and seeded `/suggestion/:id` directly and refresh nested routes.
- Verify maps, search, existing-account sign-in, real App Check, suggestions, and images.
- Submit a synthetic idea/upload; have the backend operator confirm staging-only persistence.
- Confirm browser API requests use the approved staging origin.
- Test Android-class and iPhone-class browsers/devices.
- Verify PWA updating across two deployments and separate browser storage from the production origin.
- Check noindex/cache headers and build-info freshness.
- Demonstrate failed tests prevent publication.
- Deploy two distinct features together and record the tested frontend/backend SHA pair.

The existing read-only live smoke blocks non-read requests. It is not sufficient evidence for authenticated submission/upload behavior. Do not create/delete shared Auth users or modify their claims for these tests.

## 14. Release, rollback, escalation, and reporting

Release: finish staged-pair testing, open a regular merge PR from staging to main, deploy compatible backend production changes first through the existing process, and let the existing main Pages workflow deploy the frontend. Avoid squash-merging recurring promotion. Merge main hotfixes back into staging.

Rollback: pause staging publication, restore the previous release on the specific staging Hosting site, verify its SHA and compatible backend revision, revert the faulty staging commit, then resume publication. Preserve application data. Frontend rollback is not a data reset; verify PWA update behavior during rollback.

Pause the affected step and report evidence if the backend receipt is missing/contradictory, the build resolves to production, required shared configuration would disrupt production, existing changes conflict, or an unrequested production deployment/mutation becomes necessary. Do not disable App Check or use production stores to bypass a blocker. Complete local implementation and checks even if rollout access is unavailable.

Final report: changed behavior/files; exact checks/outcomes; code readiness; remaining configuration; canonical URL and deployed SHAs if deployed; routing/auth/upload/PWA evidence; rollback target; production-parity gaps. Distinguish mock/local results from real-service verification.

## 15. Copyable frontend handoff prompt

```text
Read C:\Users\hexel\repos\DallasUrbanists\improvement-map\.agents\runbooks\firebase-staging-runbook.md, then implement its repository changes in C:\Users\hexel\repos\DallasUrbanists\improvement-map. Follow root AGENTS.md and .agents/instructions.md, preserve unrelated work, and use the current npm run build pipeline without restoring Storybook. Implement Firebase Hosting configuration, staging build validation, deployment metadata, the staging workflow, production deployment guards, branch-tool changes, focused tests, and documentation. Use the backend handoff receipt for the actual staging API origin and cloud identity inputs; do not invent them or fall back to production. Prepare reviewable changes and complete local validation. Do not commit, push, merge, provision resources, deploy, or mutate live data unless my execution request separately authorizes those actions. Do not modify the backend repository. Do not create or message other chats unless I explicitly authorize that coordination. Finish with a report separating repository readiness, required environment configuration, and verified live rollout.
```

If the execution request also authorizes GitHub configuration or staging deployment, carry out those portions using the same contract. That does not authorize merging the production bootstrap PR, production release, or production application-data mutation.
