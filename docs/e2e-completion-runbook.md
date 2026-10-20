# Runbook: finish the approved E2E test maintenance

Prepared October 20, 2026 for an agent running GPT Luna.

## Task and authorization

Finish the test maintenance already underway in:

```text
C:\Users\hexel\repos\DallasUrbanists\improvement-map
```

The user originally requested an assessment of failed E2E tests and deletion
candidates, including low-value passing tests. They then approved implementing
all recommendations. Implementation was paused at the user's request. This
runbook records the handoff; writing it did **not** resume implementation.
Execute it when the user starts or resumes the completion task.

Preserve the existing uncommitted changes. They are the approved work in
progress, not a clean baseline to reset. No application source changes or
screenshot baseline changes have been made. Do not commit, push, deploy, spawn
agents, retire a renderer, or change product behavior merely to finish this task.

Read these files first, in this order:

1. `.agents/instructions.md` — repository rules.
2. `docs/test-maintenance.md` — current test architecture and coverage policy.
3. `playwright-report/e2e-assessment-2026-10-19.txt` — original assessment and
   its superseding deletion/consolidation recommendations. This is an ignored
   local artifact; if absent, use the implementation inventory below and report
   that the original evidence is unavailable.
4. `playwright.config.js`, `playwright.ux.config.js`, and the testing scripts in
   `package.json`.
5. `git diff --stat` and focused diffs for files you will edit.

## Working rules

- Make small test-only corrections supported by the current implementation.
  Do not weaken an assertion just because it failed.
- Classify each newly observed failure as an obsolete expectation, fixture or
  environment problem, genuine application defect, or unresolved intent.
- For a suspected application defect, preserve the failing evidence and explain
  it. Do not silently convert the test to accept the defect. Seek direction if
  fixing it requires a product choice outside the approved test maintenance.
- Intentional behavior: entering Submit from Browse starts Locate at the Browse
  location and retains content. Refreshing within Submit preserves its step.
- A photo step with no photos says **Skip photos**, not Next.
- A denied location request leaves sorting on **Newest**. Successful location
  access enables **Nearest to me**.
- Current and Version Two renderers remain supported. Adding keyboard-dictation
  guidance after microphone denial is an unresolved product decision. Current
  tests check the actionable error and continued text editing.
- Never regenerate screenshot baselines just to pass. Do not use blanket
  retries, longer timeouts, arbitrary sleeps, or skips to conceal failures.
- Do not rerun the entire suite after every edit. Run the affected cases first.
- Run the final regression and UX suites **sequentially** to simplify diagnosis.
  Do not run two instances of the same suite at once.
- Keep the user informed of meaningful findings about once a minute during
  sustained work. If the user asks to pause, stop the test jobs and preserve work.

## What is already implemented

| Area | Current changes |
| --- | --- |
| Low-value deletions | Removed the storage-only info-window test, historical Blue rail hashes, exact splice-sample test, and exact copyright-footer positioning test. |
| Navigation | Added `tests/workspaceNavigation.spec.js` using the deterministic UX fixture. Covers toolbar, imagery persistence, system/manual theme, actual camera pan/zoom restoration, GPS recentering, sorting, long details, and author persistence/reset. |
| Submission | Repaired Describe-step setup, assistance request/loading/rewrite tests, summary-service fallback, and speech UI setup. Thumbnail mocks cover direct interpreter and local Overpass proxy paths. |
| Photos/layout | Removed old detail grid/slides and obsolete sticky/class/size tests. Kept draft caption/removal and current lightbox checks. Added previous/next photo coverage to the maintained UX submission journey. |
| Shared map | Fixed missing `apiHeaders` export in the API mock. Consolidated duplicate navigation cases and retained map identity, pinning, locking, GPS/map failure and submission retry. |
| Rendering | Corrected landscape projection and synthetic raster sample placement. Kept one offline browser/download smoke per renderer; Current includes embedded-logo raster checks. Gallery data is checked in browserless loops. |
| Rail overlay | Replaced the obsolete OverlayView mock with managed tile lifecycle, geometry reuse, fractional zoom, wrapping, labels, release and disposal checks. |
| Execution | Pure cases, including generated cases, are tagged `@unit` and run once in the `unit` project. Browser projects exclude them. Added `npm run test:unit`. |
| UX precision | Relaxed excessive animation precision while preserving intermediate synchronization, endpoints and reduced-motion behavior. Removed one duplicate typewriter assertion. |
| Artifacts/docs | Default output moved to `test-results/regression`; UX uses `test-results/ux`. Added `docs/test-maintenance.md` and a README link. |

Do not redo these changes. Review them for correctness and finish verification.

## Evidence at pause

All logs below are in ignored `playwright-report/`. Names containing “final” do
not imply that the run completed.

| Log | Actual status |
| --- | --- |
| `unit-revision.log` | Early browserless run: 134 passed. More generated cases were tagged afterward, so this is not the final count. |
| `browser-revision.log` | First focused run: 21 passed, 9 failed. Several failures were subsequently repaired. |
| `browser-followup.log` | Follow-up: 15 passed, 2 failed. Both navigation expectations were subsequently edited. |
| `ux-focused-revision.log` | Completed: 15 passed on Android/light, covering journeys, detail photos and detail reading. |
| `regression-final.log` | Interrupted by user. Selected 305 executions: 209 unit plus 48 browser cases on each of two Chromium profiles. All 209 unit cases passed in the observed log. Desktop browser execution was still underway. |
| `ux-integration-revision.log` | Interrupted by user. Selected 320 executions across Android/iPhone and light/dark. Only part of the matrix ran. Known failures are described below. |

At pause, both long-running jobs were stopped with Ctrl+C. Do not reuse their
old session IDs. Treat logs and error contexts as historical evidence; current
line numbers may differ because tests were edited while earlier runs were active.

## Remaining issues: handle these first

### 1. Custom diagram reset test: likely asynchronous capture race

File: `tests/customDiagram.spec.js`

Test: `custom coordinates update preview, comparison link, download, and reset without altering the gallery`

Evidence:

```text
test-results/regression/customDiagram-custom-coord-a8e98-ithout-altering-the-gallery-chromium/error-context.md
```

The failure is at the final comparison of the preview's `src` to `original`.
The test selects `current`, immediately reads the preview source, generates a
custom diagram, resets, and compares the source. The saved expectation in the
failure appears to contain Version Two landscape output. The suspected cause
is reading `original` before Vue finishes rendering the newly selected renderer.
This hypothesis still needs verification; it is not a confirmed product bug.

Read `src/views/TestDiagramView.vue`, especially renderer selection, computed
diagram output, and `resetExample()`. Reset restores the example data and
coordinates; it does not intentionally switch the renderer.

Suggested repair:

1. After selecting Current, wait for an observable Current preview contract
   before capturing `original`. An existing browser smoke waits for
   `image.complete && image.naturalWidth === 480 && image.naturalHeight === 480`.
2. Capture the initial coordinate input instead of freezing its numeric string.
3. The title promises an unchanged gallery, but the test only asserts a count
   of 19. Capture the gallery sources after renderer readiness and compare them
   after generation/reset. This checks the promise without freezing a count.
4. Retain meaningful custom-coordinate, comparison-link, downloaded SVG,
   content, reset and overflow assertions.
5. Run this file on desktop and mobile. If it still fails, inspect decoded
   before/after SVGs and renderer state rather than adding a delay.

Avoid dumping the whole error context: it contains enormous SVG data URLs.
Filter out very long lines when reading it.

### 2. My actions navigation selector: corrected but unverified

File: `tests/ux/idea-navigation.spec.js`

Test: `My actions is a Details origin and Escape dismisses the inner layer first`

The old test searched for a link named `View suggestion`. The current
`src/views/MyActionsView.vue` labels the link with the saved idea summary.
The test was changed to use `Suggestion 2`.

Do not revert this correction. Run it and verify the remaining Escape/history
assertions on Android and iPhone. Historical failure evidence is under:

```text
test-results/ux/idea-navigation-My-actions-62136-isses-the-inner-layer-first-android-light/
```

### 3. Two bookmark failures were artifact collisions

During concurrent runs, the old default output directory was the parent
`test-results/`. Starting another default run deleted active UX trace files.
Two Android/light cases failed during `browserContext.close` with `ENOENT` for
trace files, rather than a failed application assertion:

- `bookmark empty state, unavailable ideas, removal focus, and storage failures`
- `unreadable bookmark data is preserved`

The separate output directories are now configured. Rerun these cases before
considering any changes to bookmark code or assertions.

### 4. Finish verification of the latest edits

- `mapWorkspace`: the single-map continuity test passed later in the interrupted
  regression run after removing obsolete exact camera-center expectations.
- `workspaceNavigation`: toolbar reopen/close expectations were corrected after
  the focused follow-up. The latest version still needs completed validation.
- `e2e`: constrained-viewport assistance-menu bounds were added late. Validate
  the clarity rewrite case on both browser profiles.
- `detail-typewriter`: only a redundant assertion was removed late; include it
  in integration verification.
- Other tests in the interrupted matrices have not necessarily executed.

## Execution sequence

Use PowerShell from the repository root. Record each command's exit code and
summary. Keep logs in `playwright-report/`, outside Playwright's cleaned result
directories. Use new log names rather than overwriting historical evidence.

First inspect status and collection without launching the full suites:

```powershell
git status --short
git diff --stat
npm run test:e2e -- --list
npm run test:unit -- --list
npm run test:extended -- --list
npm run test:critical -- --list
```

Check that pure cases appear once in the unit project and do not leak into
device projects, including the extended CI command. Browser tests must not
appear in the unit project.

Current filter caveats:

- `--grep` can override project selection. For title-filtered browser runs,
  explicitly use a browser project and `--grep-invert @unit`.
- Use `--project=unit` with the equals sign for the current server-suppression
  logic. Do not assume the space-separated form has been handled.
- Unit-only execution should not start Vite or launch a browser.

After repairing the custom diagram test, run focused regressions:

```powershell
npm run test:e2e -- tests/customDiagram.spec.js tests/mapWorkspace.spec.js tests/workspaceNavigation.spec.js tests/e2e.spec.js --project=chromium --reporter=list
npm run test:e2e -- tests/customDiagram.spec.js tests/workspaceNavigation.spec.js tests/e2e.spec.js --project="Mobile Chrome" --reporter=list
```

Run the affected UX cases first on Android/light, then iPhone/light:

```powershell
npm run test:ux -- tests/ux/bookmarks.spec.js tests/ux/idea-navigation.spec.js --project=android-light
npm run test:ux -- tests/ux/bookmarks.spec.js tests/ux/idea-navigation.spec.js --project=iphone-light
```

For any new failure: read its error context, inspect the relevant source,
classify it, make the smallest justified correction, and rerun only that case
or file. Do not broadly delete additional coverage to obtain green results.

Once focused checks pass, run the full regression suite and wait for completion:

```powershell
npm run test:e2e -- --reporter=list > playwright-report/luna-regression.log 2>&1
```

Then run the required core UX matrix and wait for completion:

```powershell
npm run test:ux > playwright-report/luna-ux.log 2>&1
```

Do **not** run `test:ux:full`: the core matrix already covers the integration
checkpoint required here. If final validation reveals a failure and you repair
it, rerun its affected coverage; do not repeat unrelated passing tests without
a reason. Explain aggregate evidence accurately if the final state is validated
by a complete run plus targeted reruns.

If local server sockets or browser startup are blocked by sandbox permissions,
use the normal escalation mechanism with a precise justification. Do not
circumvent the sandbox or install unrelated dependencies. Never kill an unknown
process just to free ports 5173 or 5174; identify its ownership first.

## Final review and delivery

Run `git diff --check` and review `git diff --stat`. Verify:

- No unintended application source, rail data, dependency, or baseline changes.
- No skipped tests, `.only`, arbitrary sleeps, or broad timeout increases.
- No temporary editing scripts remain.
- The approved meaningful behaviors remain covered after consolidation.
- The unit/browser selection and artifact isolation work as documented.
- Documentation matches the final commands and outcomes.

Some files were rewritten with normalized line endings. At handoff,
`tests/customDiagram.spec.js` appeared in status but had no substantive diff.
Do not confuse a status entry with a functional change. README also contains
pre-existing non-UTF-8 bytes; preserve its encoding if editing it. Prefer the
new UTF-8 documentation files for further prose.

Do not stage or commit unless requested. Deliver a concise summary containing:

1. What was completed, including deleted/consolidated low-value coverage.
2. Exact completed test counts and commands; distinguish interrupted runs and
   targeted reruns.
3. Any remaining defects or intent decisions with evidence and recommendations.
4. Links to the maintenance documentation and relevant saved results.

Completion means the approved maintenance is implemented and validated, or a
specific remaining blocker is clearly documented. A stopped process, partial
log, or passing focused subset is not evidence that the full suite passed.
