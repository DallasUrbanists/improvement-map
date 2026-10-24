# Cloud API staging implementation runbook

Prepared: 2026-10-23. Status: implementation handoff; no infrastructure provisioning or deployment is claimed.

Execution repository: `C:\Users\hexel\repos\DallasUrbanists\cloud-api-server`.

Inspected backend baseline: `b343bf2`, version `5.6.1`. This file is stored in the Improvement Map repository for handoff. Implement backend code in the execution repository. Paths below are relative to that repository unless stated otherwise.

Frontend companion: [Firebase staging agent runbook](../../.agents/runbooks/firebase-staging-runbook.md).

## 1. Objective and agreed decisions

Provide a persistent staging API for the Firebase-hosted Improvement Map, with automatic deployments from a `staging` branch and isolated application data.

- Use the existing Google Cloud/Firebase project, `urbanists-mixer-slides-helper`.
- Share existing Firebase login accounts and claims.
- Isolate the API service, Firestore and SQL records, uploads, caches, quotas, and presentation sessions.
- Keep production hosting and deployment behavior intact.
- Use a permanent Firebase `.web.app` URL for the frontend.
- Deploy backend and frontend independently; record and test their selected commit pair before promotion.
- Prevent staging from changing shared users' staff claims or revoking their sessions.
- Keep custom DNS, per-PR environments, and automatic backend production deployment outside this implementation.

Repository implementation, cloud provisioning, and live validation are separate completion milestones. Preparing this document does not authorize cloud changes. Follow the actual execution request: when staging provisioning/deployment is authorized, perform those steps without repeatedly asking for permission. Otherwise finish code, tests, and reviewable provisioning instructions, then report the remaining operator steps. Never infer authorization to mutate production data or deploy production from a request for staging setup.

## 2. Acceptance criteria

Completion requires all of the following, with repository readiness reported separately if cloud prerequisites are unavailable:

1. Pushes to backend `staging` deploy the tested commit to the dedicated staging API after successful checks.
2. Staging requires explicit resource settings and cannot silently use production defaults.
3. Suggestions, uploads, SQL-backed features, quotas, caches, and enabled presentation sessions use staging stores.
4. Existing users can sign in, with production-mode App Check enforcement intact.
5. Staff-claim mutation requests cannot change shared accounts through staging.
6. Effective runtime IAM and SQL grants exclude production application writes.
7. Health metadata identifies the environment, commit, revision, and actual configured Firestore database.
8. The frontend implementer receives a non-secret configuration receipt.
9. A previous staging revision can be restored without resetting data.

## 3. Shared resource contract

Use these identifiers consistently across both repositories.

| Resource | Identifier |
| --- | --- |
| Google Cloud project | `urbanists-mixer-slides-helper` |
| Firebase Hosting site | `map-staging-143738155808` |
| Canonical frontend origin | `https://map-staging-143738155808.web.app` |
| Hosting channel | Permanent live channel of that staging site |
| Cloud Run service | `urbanists-cloud-api-staging` |
| Cloud Run region | `us-central1` |
| Firestore database | `public-improvements-staging` |
| Upload bucket | `urbanists-suggestion-photos-staging-143738155808` |
| Existing Cloud SQL instance | `urbanists-mixer-slides-helper:us-south1:contacts-relationships-db` |
| Staging SQL database | `urbanists_staging` |
| Staging SQL user | `urbanists_staging` |
| API-key Secret Manager secret | `improvement-map-staging-api-keys` |
| SQL-password Secret Manager secret | `urbanists-staging-db-password` |
| Runtime service account ID | `api-staging-runtime` |
| Build service account ID | `api-staging-build` |
| Backend deployment service account ID | `api-staging-deployer` |
| Frontend deployment service account ID | `map-staging-deployer` |
| GitHub Environment in each repository | `staging` |

Cloud Run's generated API origin is a provisioning output. Record it; do not guess its hostname. Service-account emails use the IDs above in the agreed project.

Check whether resources already exist. Reuse resources that match this contract. If a name is occupied by an unrelated resource, report the collision before replacing anything or inventing a different contract. Live resource existence, billing, IAM policy, database settings, and domain authorization have not been verified by this runbook.

## 4. Preflight and confirmed evidence

Read applicable ancestor/repository instructions and inspect the current working tree. Preserve unrelated changes. Revalidate these specific assumptions once; do not redo the entire planning investigation.

```text
git status --short
git branch --show-current
git log -3 --oneline
```

| Area | Relevant code |
| --- | --- |
| Server startup | `src/index.ts` |
| Express app and health | `src/app.ts` |
| Firestore selection | `src/config/firestore.ts` |
| Storage selection | `src/config/storage.ts` |
| PostgreSQL selection | `src/config/db.ts` |
| Shared Firebase Admin app | `src/config/firebase.ts` |
| Auth and App Check | `src/middleware/auth.ts` |
| CORS and socket origins | `src/middleware/cors.ts` |
| Shared-user administration | `src/routes/userRoutes.ts`, `src/services/staffClaimService.ts` |
| Signed uploads | `src/services/storageService.ts` |
| AI quota storage | `src/services/assistService.ts` |
| Deployment command | `package.json` |

Confirmed observations:

- Firestore supports `PUBLIC_IMPROVEMENTS_DB`; Storage supports `SUGGESTION_PHOTOS_BUCKET`.
- SQL supports `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `INSTANCE_CONNECTION_NAME`.
- AI quotas can select another Firestore database through `ASSIST_QUOTA_DB`.
- Other caches and services use the default Firestore getter; inspect all callers for explicit database overrides.
- App Check enforcement depends on `NODE_ENV=production`.
- `ALLOWED_ORIGINS` currently augments production defaults rather than replacing them.
- Staff-claim endpoints mutate the shared Firebase user pool.
- `/api/health` currently hardcodes its database name.
- `npm run deploy` explicitly deploys production. Do not invoke it for staging.
- Existing SQL migrations assume foundational tables already exist; applying the migration directory to an empty database is not a complete bootstrap.

## 5. Implement deployment configuration safeguards

Add a small configuration module with a pure, injectable parser/validator for tests.

Preserve existing non-staging behavior. Require these settings when `DEPLOY_ENV=staging`:

| Variable | Required staging value |
| --- | --- |
| `DEPLOY_ENV` | `staging` |
| `NODE_ENV` | `production` |
| `GOOGLE_CLOUD_PROJECT` | `urbanists-mixer-slides-helper` |
| `PUBLIC_IMPROVEMENTS_DB` | `public-improvements-staging` |
| `ASSIST_QUOTA_DB` | `public-improvements-staging` |
| `SUGGESTION_PHOTOS_BUCKET` | Staging bucket from the resource contract |
| `DB_NAME` | `urbanists_staging` |
| `DB_USER` | `urbanists_staging` |
| `INSTANCE_CONNECTION_NAME` | Existing instance connection name |
| `ALLOWED_ORIGINS` | Canonical staging frontend origin |
| `BUILD_COMMIT` | Full deployed Git commit SHA |
| `API_KEYS_JSON` | Staging secret value supplied through Secret Manager |
| `DB_PASSWORD` | Staging secret value supplied through Secret Manager |

Implementation requirements:

1. Reject missing, blank, or incorrect project, database, bucket, SQL database, and SQL user settings in staging.
2. If `K_SERVICE` identifies `urbanists-cloud-api-staging`, reject a missing or incorrect `DEPLOY_ENV`; omission must not bypass staging safeguards.
3. Validate before constructing clients, starting watchers, or listening. ESM imports may initialize services before `index.ts` executes, so apply validation inside configuration getters where necessary.
4. Ensure suggestions, notices, presentation sessions, Streetmix state/caches, and AI quota accounting resolve to staging. Check explicit database arguments as well as defaults.
5. Keep `NODE_ENV=production`; do not bypass Auth or App Check to make staging work.
6. Log only non-secret deployment identifiers. Do not log API keys, passwords, tokens, or full environment dumps.
7. Keep `BOUNDARY_SYNC_ENABLED=false`, `STREETMIX_ENABLED=false`, `PRESENTATION_ENABLED=false`, and `PRESENTATION_WEBSOCKET_ENABLED=false` initially. Enable presentation flags together with the frontend when that feature is being tested. Background ingestion and external publication require separate deliberate enablement.
8. Configure only external providers needed for the selected tests, using staging-specific secrets and budgets. Record unavailable integrations as parity gaps; do not silently reuse production credentials.

Use mocks and injected environment objects in unit tests. Setting staging flags must not cause tests to connect to real cloud resources.

## 6. Protect shared identity and configure origins

Reuse the existing Firebase project and authentication flow. Do not migrate, create, delete, or modify shared users as part of staging seeding or acceptance tests.

For staff claims:

- In staging, deny staff assignment/removal before invoking the mutation service.
- Retain normal authentication checks and response conventions.
- Test that the mutation service is not called.
- Omit Auth administration write permissions from the runtime identity. Allow necessary reads and token verification.
- Do not execute staff-claim migrations as part of this task.

For CORS and sockets:

- In staging, use the explicit configured origins instead of inheriting production origins.
- Authorize the canonical `.web.app` origin; do not wildcard `*.web.app`.
- Preserve required request headers and exposed `ETag` and `Retry-After` headers.
- Apply the same origin policy to suggestion and presentation WebSockets.
- Preserve production and non-staging local-development behavior.

CORS is not the data-isolation boundary. Store selection, SQL grants, and runtime IAM provide that separation. Shared login accounts intentionally remain a common identity boundary.

## 7. Add observable deployment identity

Extend `/api/health` additively:

- Preserve `status`, `timestamp`, and service identification.
- Populate `databases` from the configured Firestore database.
- Add `environment` and `buildCommit`.
- Include the Cloud Run revision identifier when available.
- Keep unset metadata compatible with existing non-staging deployments; do not require a new production variable just to deploy this code.

Required staging values include:

```json
{
  "status": "ok",
  "service": "urbanists-cloud-api-server",
  "databases": ["public-improvements-staging"],
  "environment": "staging",
  "buildCommit": "<deployed backend commit SHA>"
}
```

Existing/additional fields are allowed. Do not expose credentials or SQL connection strings. This identifies deployment configuration; it does not prove data-store readiness without an actual readiness check.

## 8. Provision application stores

Run this section only when the execution request includes staging infrastructure provisioning. Otherwise prepare exact commands/scripts with report-only defaults and document prerequisites.

### Firestore

- Inspect production's location, mode, and relevant settings; create the named staging database compatibly.
- Reproduce required composite indexes, field overrides, and TTL policies against staging.
- Start with synthetic records. Do not copy private production application records.
- Keep provisioning outside application startup and ordinary deployment.

### PostgreSQL

- Create `urbanists_staging` and a dedicated login role of the same name.
- The role must not be a superuser, a member of `cloudsqlsuperuser`, a role administrator, or a production database owner. Do not assume a Cloud SQL-created built-in user is restricted by default.
- Export the current application schema without data, ownership, or grants; review extensions, functions, triggers, and cross-database references.
- Restore only into the staging database, stopping on SQL errors. Record the baseline schema revision.
- Do not blindly rerun migrations already represented in the schema export.
- Grant only required staging schema/table/sequence privileges. Inspect inherited and `PUBLIC` privileges for production write access.
- If isolation requires production grant changes, stop that provisioning step and report the dependency. Do not alter production permissions incidentally.
- Seed synthetic contacts/events and checked-in public reference fixtures, without production private data.

### Storage

- Create the dedicated bucket with compatible region and object-delivery behavior.
- Configure canonical-origin CORS, including signed `PUT` upload requirements.
- Preserve the API's current public-image URL contract.
- Give the runtime identity required staging object permissions and signing permission. Use its own signing identity, with no production bucket mutation grants.

### Seed/reset tools

Provide staging-only seed/reset commands with a report-only default and explicit `--apply`:

- Validate the project, environment, database, bucket, and SQL database before mutation.
- Use deterministic fixture IDs or a fixture manifest for targeted cleanup.
- Never reset shared Auth users or claims.
- Keep these commands out of deployment workflows.
- Document that broad staging resets destroy testers' data and require coordination.

## 9. Configure deployment identities and common cloud resources

The backend developer/cloud operator owns common cloud provisioning: stores, service accounts, WIF providers, Hosting site creation, Auth/App Check domain authorization, and staging browser-key provisioning. The frontend implementer owns Hosting configuration files and its workflow in `improvement-map`.

Use GitHub OIDC and Workload Identity Federation. Create separate frontend/backend providers or equivalently restricted bindings. Validate the actual numeric repository and owner IDs, `refs/heads/staging`, the `staging` Environment subject, and the intended `deploy-staging.yml` workflow. Do not rely only on mutable repository names. Discover GitHub IDs and Google project numbers; do not derive identity bindings from a frontend configuration string.

Use separate deployment, source-build, and runtime identities. Restrict runtime permissions to:

- The staging Firestore database, using supported database IAM conditions.
- The staging upload bucket.
- Staging Secret Manager secrets.
- The staging SQL user's grants.
- Necessary shared Auth reads and token verification.
- Signing as its own identity for uploads.

Configure source-build/deployment permissions according to [Cloud Run source deployment requirements](https://docs.cloud.google.com/run/docs/deploying-source-code). Do not use Owner/Editor as a shortcut. Some deployment permissions in a shared project may be project-wide; record effective scope accurately.

Exclude `gha-creds-*.json`, local credentials, `.env` files, dependencies, and unnecessary artifacts from Cloud Run uploaded source. Inspect the upload manifest before the first deploy. Do not print the complete production service configuration because environment entries may contain secrets; select only needed non-secret fields.

Create the agreed permanent Hosting site without changing the project's existing/default site. Add the canonical hostname to the existing shared Auth authorized domains and compatible App Check/reCAPTCHA configuration; preserve production domains and provider settings. Provision a Maps browser key restricted to staging. The frontend does not need a separate Auth project or a Firebase configuration rewrite for the agreed shared-user setup.

## 10. Add backend staging CI and deployment

Add `.github/workflows/deploy-staging.yml`:

1. Run code checks on PRs targeting staging without cloud credentials.
2. Deploy only on staging pushes or manual dispatch selecting staging. Never deploy PR code through `pull_request_target`.
3. Use Node 24 and `npm ci`.
4. Run `npm test` and `npm run build`.
5. Record the tested SHA and deploy that same source commit.
6. Use the `staging` GitHub Environment; grant OIDC only to the deployment job.
7. Authenticate immediately before cloud operations.
8. Deploy the literal staging service with explicit project, region, runtime/build identities, SQL attachment, environment values, and secret references.
9. Preserve relevant production runtime settings and WebSocket timeout compatibility. Inspect production metadata before selecting CPU, memory, concurrency, scaling, and ingress settings; do not invent performance-parity claims.
10. Serialize staging deployments with `cancel-in-progress: false`. Skip a superseded commit before publication.
11. Verify health identity after deployment and record the actual URL/revision/SHA.

Add a distinct `deploy:staging` entry point if local operator deployment is needed. It must target only staging and refuse dirty/unidentified source deployment. Do not make `npm run deploy` select environments implicitly. Do not add automatic backend production deployment.

Use staging-specific secret names and references so missing staging configuration cannot inherit production values. Keep credentials out of workflow logs, shell command arguments, source archives, and receipts.

## 11. Frontend handoff receipt

Return a non-secret receipt with:

- Project and Hosting site IDs; canonical frontend URL.
- Actual staging API origin.
- Backend SHA, Cloud Run revision, and previous working revision.
- Firestore database, bucket, SQL database, runtime identity, and relevant regions.
- Enabled feature flags and unavailable integrations.
- Frontend WIF provider resource name and deployment service-account email.
- Secret names/references and whether GitHub inputs have been populated.
- Checks performed, outcomes, and outstanding prerequisites.

The frontend repository's `staging` Environment needs variables `STAGING_API_ORIGIN`, `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `VITE_PRESENTATION_ENABLED`, and `VITE_PRESENTATION_WEBSOCKET_ENABLED`.

It also needs:

| GitHub secret | Meaning |
| --- | --- |
| `STAGING_API_KEY` | Key accepted by staging `API_KEYS_JSON` |
| `STAGING_GOOGLE_MAPS_API_KEY` | Restricted staging browser Maps key |
| `STAGING_FIREBASE_API_KEY` | Existing shared Firebase browser key |
| `STAGING_RECAPTCHA_SITE_KEY` | Compatible site key authorized for staging |

Never put secret values in the receipt, runbook, issue, PR description, or chat. Transfer them directly through authorized secret-management interfaces.

## 12. Bootstrap and releases

For each repository, prepare bootstrap implementation on a task branch, review it against main, merge through the normal review process, then create staging from updated main. Workflow dispatch requires the workflow to be present on the default branch; staging push deployment can run from the staging branch.

The frontend bootstrap merge triggers its ordinary production deployment. It is a reviewed production change, not an incidental staging action. Do not merge it without authority to perform that release.

Keep main as the default branch. Ordinary features target staging; hotfixes target main and merge back to staging. Promote tested batches using regular merge PRs from staging to main; do not squash recurring staging promotion. Production backend/frontend releases remain separately reviewed, with compatible backend changes deployed first.

Deploy and validate the staging backend before the frontend. Coordinate a non-secret tested SHA pair; do not invent automatic cross-repository dispatch or compatibility guarantees.

## 13. Verification

During development run focused tests for configuration, health, CORS, store selection, and shared-user protections. Add cases proving missing/production-valued staging settings fail; production defaults remain compatible; incorrect staging service/environment combinations fail; staff mutation services are not called; auxiliary stores use staging; and deployment targets cannot select production.

At the backend integration checkpoint:

```text
npm ci
npm test
npm run build
```

Validate workflow syntax and permissions. Use fakes or isolated emulators for store-selection tests; do not treat real-cloud access as a unit-test prerequisite.

For authorized live acceptance:

1. Sign in with an existing account and verify real App Check enforcement.
2. Submit a synthetic idea and upload an image.
3. Confirm records/objects exist only in staging stores.
4. Exercise SQL-backed reference/recommendation behavior.
5. Exercise presentation pairing and sockets when enabled.
6. Inspect effective IAM and SQL privileges to exclude production writes; use non-mutating permission checks rather than destructive production probes.
7. Verify production through read-only checks.
8. Demonstrate failed checks prevent deployment.
9. Record the frontend/backend SHA pair tested together.

## 14. Rollback, escalation, and completion report

Rollback: pause staging publication, route staging traffic to the recorded previous working revision, verify health/application behavior, revert the faulty staging commit, and resume publication. Preserve data; do not run automatic down-migrations. Confirm the restored revision supports the current schema.

Pause the affected step and report evidence if resources collide, shared settings would disrupt production, required isolation depends on production grants, actual contracts contradict this runbook, permissions are unavailable, or an unrequested production deployment/mutation is needed. Complete unaffected local work. Do not weaken IAM, disable App Check, or switch to production stores to bypass a blocker.

Report changed behavior/files, exact checks and outcomes, code readiness, provisioning/deployment status, resource identifiers, SHA/revision, rollback target, the frontend receipt, and unresolved limitations. Never label mock/emulator results as real-cloud verification.

## 15. Copyable backend handoff prompt

```text
Read C:\Users\hexel\repos\DallasUrbanists\improvement-map\docs\deployment\cloud-api-staging-runbook.md and use it as the implementation contract for C:\Users\hexel\repos\DallasUrbanists\cloud-api-server. Read applicable repository instructions and inspect the working tree first. Implement the staging configuration safeguards, shared-user mutation protection, health metadata, tests, staging deployment workflow, and operator provisioning instructions. Preserve production defaults and the existing production deployment command. Prepare reviewable code and configuration; do not commit, push, merge, provision cloud resources, deploy, or mutate live data unless my execution request separately authorizes those actions. Complete available local validation and return the non-secret frontend handoff receipt, clearly distinguishing repository readiness from cloud provisioning and live verification. Do not modify the frontend repository. Do not create or message other chats unless I explicitly authorize that coordination.
```

If the execution request also authorizes staging provisioning/deployment, carry out those sections using the same resource contract; that does not authorize production releases or production application-data mutation.
