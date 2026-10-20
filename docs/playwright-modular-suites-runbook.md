# Runbook: modular Playwright suites and workflow gates

Prepared October 20, 2026. Repository: `C:\Users\hexel\repos\DallasUrbanists\improvement-map`.

## Objective and authorization

Implement the approved modular Playwright plan: independently select feature suites by changed filenames and run them concurrently, preserving coverage and deployment policy while targeting 60–120 seconds per browser job including setup and artifact upload.

This document is the implementation handoff. Creating it does not implement the changes or start CI. The latest request is to create this runbook. When implementation resumes, follow the steps below; do not commit, push, dispatch remote workflows, change repository variables, or deploy without authorization for those actions.

Read `.agents/instructions.md`, then this document. Inspect `git status --short` and focused diffs before editing, and preserve unrelated changes. The working tree was clean immediately before this runbook was created. `docs/e2e-completion-runbook.md` describes an older maintenance task; it is not the execution procedure for this change.

## Acceptance criteria

- Eight UX suites each have Android and iPhone jobs, each retaining both themes: 16 routine UX jobs. Two browser regression jobs and one browserless unit job bring advisory execution to 19 jobs. The deployment critical check remains separate.
- Every test/project combination currently executed by `test:critical`, `test:extended`, and `test:ux` remains covered exactly once across their replacements. Do not accidentally add desktop critical tests to advisory execution or remove mobile coverage.
- Each feature has its own filename gate and named result. Shared changes select affected consumers; unknown source/test files or unavailable diff information select conservatively. Documentation-only changes skip the test matrix.
- All current assertions, audit scans, screenshots, retries, device emulation, and enforcement policies survive. Existing local development commands remain available.
- Pages deployment depends on the critical check, not advisory checks. Advisory runs no longer occupy the Pages workflow concurrency lock.
- Scheduled and manual full UX runs retain the additional device profiles. A combined report distinguishes unselected states from missing expected coverage and retains finding provenance.
- Browser job duration is measured from job start through upload. Five successful routine CI runs establish whether each suite averages 60–120 seconds. This cannot be certified from local discovery or one CI run; shorter unit jobs are acceptable.

## Confirmed evidence and relevant code

- `playwright.config.js` discovers 305 regression instances: 209 `unit`, 48 desktop Chromium, and 48 Mobile Chrome. The browser projects exclude `@unit`; `test:extended` excludes `@critical` across all projects, while `test:critical` selects desktop Chromium only. Preserve this actual selection, rather than assuming all 305 instances currently run in CI.
- `playwright.ux.config.js` discovers 316 routine UX instances. An older saved run had 320 instances and 1,897 worker-seconds over 16.1 minutes; WebKit accounted for about two-thirds of that work. Historical logs are sizing evidence, not a current passing baseline.
- Regression CI currently uses one worker; UX uses two. Both configurations already enable `fullyParallel`. UX has one retry in CI; regression has two.
- The locked and locally installed Playwright version at planning time is `1.63.0`. `package.json` requires Node `>=24.12.0`.
- `.github/workflows/deploy.yml` owns `detect-changes`, `critical-tests`, `extended-e2e`, reusable `usability`, and `build-and-deploy`. Its workflow-wide `pages` concurrency group remains occupied while advisory jobs run. `build-and-deploy` already depends only on `critical-tests` and checks out the recorded tested commit.
- `.github/workflows/usability.yml` currently handles PRs, reusable calls, manual runs, and Monday 13:00 UTC full audits. Its test step reports failures unless `UX_ENFORCE=true`; strict UX failures still do not gate deployment.
- `scripts/ci-paths-changed.sh` and `scripts/ci-usability-paths-changed.sh` supply the current broad gates. The second excludes snapshots and workflow changes; the replacement must handle these explicitly.
- `scripts/test-ux.js` forwards Playwright arguments and sets `UX_FULL`. `scripts/test-feature.js` selects journey titles and defaults to Android/light with `UX_SCAN=0`.
- `tests/ux/audit.js` performs checkpoint scans and screenshots. `tests/ux/catalog.js` lists 27 journey states. Other specs also create audit reports; preserve those observations. `scripts/ux-reporter.js` currently assumes every project owes every catalog state and writes to a fixed directory. Both assumptions need updating for partial suites.
- `docs/usability-audit.md` incorrectly says UX enforcement blocks deployment. Update it alongside `docs/test-maintenance.md` and the relevant README command documentation.

## Suite ownership

Use these exact IDs and selectors. Names below are relative to `tests/ux/` unless explicitly qualified.

| ID | Test files after the journey split |
| --- | --- |
| `ux-browse` | `browse-journey.spec.js`, `recovery-journey.spec.js`, `announcements.spec.js`, `visual.spec.js`, `guardrails.spec.js` |
| `ux-submit` | `submit-journey.spec.js` |
| `ux-saved` | `bookmarks.spec.js`, `mobile-panels.spec.js` |
| `ux-navigation` | `idea-navigation.spec.js`, `detail-navigation.spec.js` |
| `ux-motion` | `detail-close.spec.js`, `detail-map-settling.spec.js`, `detail-typewriter.spec.js` |
| `ux-content` | `detail-reading.spec.js`, `detail-tray.spec.js`, `detail-photos.spec.js` |
| `ux-actions` | `recommended-actions.spec.js`, `recommendation-state.spec.js` |
| `ux-streetmix` | `streetmix.spec.js` |
| `regression-app` | Under `tests/`: `announcements.spec.js`, `api-startup.spec.js`, `e2e.spec.js`, `mapWorkspace.spec.js`, `workspaceNavigation.spec.js`, `photoViews.spec.js`, `speechRecognition.spec.js`, `suggestionDensity.spec.js` |
| `regression-diagrams` | Under `tests/`: `customDiagram.spec.js`, `locationDiagram.spec.js`, `streetLabels.spec.js`, `transitStops.spec.js` |
| `unit` | All existing `@unit` cases in the regression config, including mixed files |

Both regression suites run `chromium` and `Mobile Chrome`, exclude `@unit` and `@critical`, and never select the `unit` project. The unit suite selects only `unit`. Keep the existing critical command unchanged. Standalone `tests/*.node.mjs` files and the live UX smoke are outside this restructuring; preserve their existing execution paths.

## Ordered implementation

### 1. Capture discovery, then split journeys

Capture JSON discovery in ignored `test-results/suite-migration/` before edits using the three current selections: critical, extended, and routine UX. Also capture expanded UX discovery with `UX_FULL=1`. Use the local Playwright CLI, not an installer:

```powershell
node node_modules/@playwright/test/cli.js test --project=chromium --grep @critical --list --reporter=json
node node_modules/@playwright/test/cli.js test --grep-invert @critical --list --reporter=json
node node_modules/@playwright/test/cli.js test --config=playwright.ux.config.js --list --reporter=json
```

Redirect outputs to distinct files when capturing. Discovery must not launch browsers. For the expanded capture, set `UX_FULL=1` only for that invocation and restore the prior environment value afterward.

Split the three complete tests in `tests/ux/journeys.spec.js` into the three files in the table, retaining titles, actions, assertions, and checkpoint names. Remove the original file so tests are not duplicated. Preserve test-directory and snapshot-template semantics. Existing `test:feature` title selectors must still select the same journeys.

### 2. Introduce one registry and suite runner

Create `scripts/playwright-suites.js` as the shared ESM registry. Each entry contains ID, kind (`ux`, `regression`, `unit`), exact test selectors, source roots, test/helper dependencies, applicable profile names, and expected audit states. Export registry data and reusable selection functions without executing a CLI on import.

Create `scripts/test-suite.js` and add `test:suite` to `package.json`. Interface:

```text
npm run test:suite -- <suite> [Playwright options]
```

Unknown IDs exit nonzero with the supported IDs. UX defaults to the existing four routine projects; `--full` adds expanded profiles using existing `UX_FULL` semantics. Explicit `--project` arguments narrow projects. CI passes both theme projects for one profile. Regression and unit selection must obey the table; user options must not accidentally broaden the suite into unrelated projects. Preserve child exit codes and signals.

Keep local worker defaults; set four browser workers in CI invocations. Do not start Vite or require a browser for the unit command. Use a configurable per-job artifact root so isolated suite executions and reports cannot overwrite one another. Preserve current output locations for existing unsplit local commands.

### 3. Implement filename selection and its contract

Create `scripts/ci-test-matrix.js` using the registry. It reads the GitHub event payload and checked-out repository and emits `has-tests`, `has-browser-tests`, `run-unit`, JSON browser `matrix` with an `include` array, the resolved checkout SHA, and the Playwright container image. Each browser row contains suite ID, kind, profile (or regression identifier), exact projects, and a stable artifact ID. Include the selected unit scope in the planned-report manifest separately.

- Routine UX profiles: `android`, `iphone`; both themes per row. Full mode adds `narrow`, `landscape`, `desktop`, also with both themes. Preserve the current device descriptors and browser types.
- Push diff: event `before` to the checked-out push SHA. PR diff: merge base of base/head to PR head; test that same immutable head SHA. Use NUL-delimited Git output and include both old and new names for renames. Handle deletions even when the old file no longer exists.
- Missing/zero SHAs, failed Git lookup, or unresolved relevant dependencies select all applicable suites and emit a diagnostic. A valid empty diff produces no rows and a successful summary.
- Match production roots by feature and expand their local imports transitively, including extensionless JS/Vue imports, literal dynamic imports, and imported assets. Do not include `App.vue` as a feature root: it would connect every feature to every suite. Treat unresolved dynamic dependencies conservatively.
- Feature roots: Browse/search/toolbar for Browse; Submit and photo editing for Submit; bookmark view/service/button/idea rows and mobile-panel consumers for Saved; navigation and detail view for Navigation; detail view and map/tray synchronization for Motion; detail view, sheets, photos and previews for Content; action views/components/services for Actions; Streetmix components/services for Streetmix. Regression roots follow the corresponding tested application or diagram entrypoints; unit roots come from their test imports and fixture/data reads.
- Shared `App.vue`, `main.js`, router, global CSS, API, storage, authentication, and common map/tray infrastructure select all their consumers. Register those consumer sets explicitly; overlapping ownership is expected. Unknown files under `src/` or `tests/` select all suites rather than silently disappearing.
- A changed spec selects every owning suite, including `unit` for mixed files. Imported fixtures/helpers select their consumers, including root specs importing `tests/ux/fixture.js`. UX audit/reporter changes select UX consumers. Unmapped test helpers select all suites.
- Current snapshots follow `tests/ux/snapshots/{platform}/{project}/{name}.png`. Map toolbar snapshots to `ux-browse` and the matching profile; unknown snapshot ownership selects all applicable UX suites. Do not run non-routine profiles on ordinary pushes solely because an expanded-profile baseline changed; report that it is covered by full mode.
- Manifests and lockfiles select all; shared suite infrastructure selects all; config/workflow changes select their consumers conservatively. Ordinary Markdown/docs changes select none. Public runtime assets select UI consumers conservatively.

Use the lockfile's exact `@playwright/test` version to emit `mcr.microsoft.com/playwright:v<version>-noble`. Validate that all locked Playwright packages agree and that the image version is identical; avoid an independently maintained version constant. Registry errors are failures, not empty successful selections.

### 4. Separate advisory workflows from deployment

Replace the monolithic usability workflow with a standalone advisory workflow in `.github/workflows/usability.yml`; retain the filename to minimize churn. Trigger on `push` to `main`, PRs, existing release event types, manual dispatch, and the existing schedule. Remove `workflow_call` after removing its deployment caller.

- Push/PR: filename-selected routine rows. Release events: all routine rows against one resolved `main` commit, not the release tag. Manual: all suites, with `full` defaulting to true. Schedule: expanded UX only, preserving its existing purpose.
- Detection needs checkout and Node, but no `npm ci` or browser installation. Resolve and publish the immutable SHA once; every matrix row checks out that SHA.
- Use concurrency grouped by workflow plus PR number or ref, `cancel-in-progress: true`, and `fail-fast: false`. The browser matrix uses `max-parallel: 18`; the separate unit job brings maximum advisory execution to 19. Scheduled/full runs can need several waves. This cap applies to this workflow; it cannot impose an organization-wide 20-runner limit.
- Browser rows use the emitted official container on `ubuntu-latest`, Node 24, cached npm downloads, and `npm ci`. Do not run `playwright install` inside browser rows. The separately gated unit job uses the runner directly with no browser container. Guard browser matrix evaluation with `has-browser-tests`, and unit execution with `run-unit`, so unit-only and empty selections work.
- Regression/unit test failures remain advisory. UX uses `UX_STRICT` and `UX_ENFORCE` exactly as today: the test result is nonblocking in report mode and fails the advisory job in enforcement mode. Preserve real outcomes in summaries even when a step continues on error. Setup/infrastructure failures must be visible.
- Upload artifacts with `if: always()`, unique suite/profile/run-attempt names, and 14-day retention. Record setup/test/upload durations and job timestamps; distinguish raw failure from allowed advisory failure. The final report job may use job-level `actions: read` permission to read completed job/step timestamps through the Actions API, including container setup and upload. Other jobs need only `contents: read`. Do not use a two-minute timeout to force the performance target.
- Add an always-running report job after the selected matrix, with an explicit no-tests summary for an empty selection. It must account for setup failure or cancellation that leaves no report.

In `.github/workflows/deploy.yml`, remove the obsolete detector, `extended-e2e`, and `usability` caller. Preserve `critical-tests`, its recorded commit output, `build-and-deploy`, Pages permissions/concurrency, release checkout behavior, and release-manifest processing. Advisory tests now run independently and cannot occupy the Pages lock. Do not add advisory jobs to deployment `needs`.

Remove old gate scripts only after confirming no remaining references; otherwise retain compatibility wrappers pointing to the new selector. Update the documentation to explain actual enforcement and deployment behavior.

### 5. Make reporting suite-aware

Keep audit checkpoints and their scan behavior intact. Extend `scripts/ux-reporter.js` to read the selected suite/project scope and configurable output root. Use actual selected tests/projects, not every configured project, when constructing expected coverage.

- `ux-browse` owns catalog Browse and recovery states; `ux-submit` owns Submit states. Register other existing audit checkpoints with their suite. Suites with no full checkpoint reports must not claim those 27 journey states as missing.
- Record suite ID, project, test identity, retry/attempt, state, and original attachment provenance. Do not overwrite distinct tests that report the same project/state. Deduplicate findings while retaining all occurrences.
- Failed selected journeys leave their later expected states missing. Unselected states are explicitly outside the selected scope, not failures. In `UX_SCAN=0` feature mode, distinguish visited annotations from audited states.
- Add blob reporting to isolated executions. Create `scripts/merge-test-reports.js` to combine suite summaries and use Playwright's blob merge to build one HTML report. Preserve all screenshots/traces and avoid replaying the custom UX reporter with an incorrect global scope.
- Compare received artifacts with the planned matrix: absent selected jobs are incomplete, never a green coverage result. A report-only UX failure may leave the workflow nonblocking but must remain visible in the report.

## Verification and rollout

Implement focused Node tests for the selector, registry/discovery partition, and report merger. Keep them outside default Playwright discovery, for example `tests/ci-suites.node.mjs`, runnable with `node --test tests/ci-suites.node.mjs`. Test real temporary Git histories for rename/delete/merge-base behavior rather than only mocking path strings.

1. **Discovery parity:** compare before/after multisets using project, title path, and normalized file identity. Map the old journey file's three tests to their new files; ignore changed line numbers and generated test IDs. Assert no omissions or duplicates for critical plus advisory selections, and for routine/full UX separately. Do not compare new CI execution against all 305 regression instances without accounting for existing critical exclusions.
2. **Gate cases:** Streetmix-only; bookmark-only; diagram service/data; shared CSS; shared workspace fixture; toolbar snapshot/profile; docs-only; empty diff; unknown source/spec; missing SHA; rename across owners; deletion; PR merge-base; config/lockfile/workflow change. Assert exact expected rows and the 16/19 routine maximums.
3. **Runner cases:** unknown suite ID; child failure; both themes for one profile; explicit local project; full mode; browserless unit run; retained feature-title selectors. Confirm neither test options nor mixed files duplicate unit cases.
4. **Reporting cases:** partial suite, failed journey with missing later states, duplicate state across tests, retries, feature mode, missing artifact, empty selection, advisory failure, strict UX failure, and merged screenshot/trace links. Use small fixture reports before running browsers.
5. **Focused execution:** run the unit suite and a representative UX suite on Android/light and iPhone/light after discovery passes. Then run the complete routine matrix once and expanded matrix once in authorized CI. Do not run full audits after every edit.
6. **Timing acceptance:** collect five successful routine CI runs. Record selection, suite/profile, setup, tests, upload, total active job duration, and queue duration separately. Report cold starts/retries separately. Target 60–120 seconds average per browser job; retain evidence rather than asserting an unmeasured speedup.

Run `git diff --check` and inspect workflow structure: deployment `needs` remains critical-only; advisory matrix handles an empty selection before evaluating its matrix; permissions remain read-only; concurrency and failure policies match above. Never regenerate screenshot baselines during verification.

## Constraints and escalation

- Production code, UX behavior, screenshot baselines, paid runners, and account settings are outside scope. Intentional Submit behavior remains: entering from Browse restarts Locate with retained content; refresh preserves the active step.
- Do not remove scans, themes, assertions, or retries to manufacture a timing improvement. Preserve current screenshot approval and network-firewall behavior.
- If current discovery differs from the historical counts, use the newly captured baseline and explain the difference; counts alone do not justify deleting tests.
- If coverage cannot be partitioned without changing behavior, or a genuine application defect surfaces, preserve evidence and return for a scope decision. Do not weaken expectations.
- If the exact image is unavailable, Node 24 cannot run in it, or four workers cause resource failures, report the measured failure and revise infrastructure before broad rollout; do not silently change Playwright versions or coverage.
- If averages miss the target, inspect setup versus execution first, then rebalance independent tests within the existing job budget. If meeting the target requires more runners, reduced coverage, changed scan behavior, or paid infrastructure, return with measured tradeoffs.
- CI execution and five-run timing acceptance can remain pending when remote authorization or run history is unavailable. Finish reviewable local work and report the precise outstanding checks; do not claim full acceptance.

Completion report: changed files and behavior, exact checks/results, discovery parity, CI/report links if available, measured timings, and remaining rollout evidence.
