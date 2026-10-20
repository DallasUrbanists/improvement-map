# Regression test maintenance

Run focused tests while editing, then use the integration matrix:

```powershell
# Pure geometry, data and speech-controller tests, once without a browser/server
npm run test:unit

# A browser feature on desktop
npm run test:e2e -- tests/mapWorkspace.spec.js --project=chromium

# All pure cases once and browser cases on desktop and mobile Chromium
npm test

# Android/iPhone, light/dark, accessibility and approved screenshots
npm run test:ux

# Run one registered CI feature suite with the routine device matrix
npm run test:suite -- ux-browse
```

Playwright CI divides UX coverage into `ux-browse`, `ux-submit`, `ux-saved`,
`ux-navigation`, `ux-motion`, `ux-content`, `ux-actions`, and `ux-streetmix`.
Each suite runs Android Chromium and iPhone WebKit in light and dark themes.
`npm run test:suite -- <suite> [Playwright options]` runs an individual
registered suite locally; add `--full` to include the expanded device profiles.
The `regression-app`, `regression-diagrams`, and `unit` suites split the former
extended E2E job. The standalone advisory workflow selects suites by changed
files, uploads per-suite evidence, and builds one combined report. UX checks
report failures by default; `UX_ENFORCE=true` makes them fail that workflow but
does not block Pages deployment. The deployment workflow continues to require
the critical test job.

Browserless Playwright cases are tagged `@unit` and run in the `unit` project.
Mixed files keep shared fixtures together, but their pure cases do not run in
the device projects. When filtering by title, select the intended project and
exclude unit cases for a browser run: `--grep` overrides the project's selection
filter. For example:

```powershell
npm run test:unit -- tests/speechRecognition.spec.js
npm run test:e2e -- tests/speechRecognition.spec.js tests/e2e.spec.js --project=chromium --grep speech --grep-invert @unit
```

Regression artifacts live in `test-results/regression`; UX artifacts live in
`test-results/ux`. Keeping these separate prevents one runner from clearing
another runner's active traces.

## Coverage retained after the October 2026 assessment

- Deterministic workspace navigation checks toolbar behavior, manual/system
  theme selection, actual camera restoration and GPS recentering, sorting,
  scrollable details, and author persistence through submission.
- Workspace tests retain a single shared map across navigation, location
  pinning and locking, map/GPS failure, and submission retry.
- Submission HTTP tests retain assistance request payloads, loading and
  acceptance/discard behavior, generated summaries, summary-service fallback,
  photo upload payloads and speech recovery. Both local Overpass proxy paths
  and direct interpreter requests are intercepted for thumbnail generation.
- The maintained UX journeys own responsive navigation, focus, bounded layout,
  photo navigation/captions, editing, upload failure and recovery. Detail photo
  tests cover the current accordion and accessible lightbox.
- Current and Version Two each have an offline browser/download smoke.
  Current also checks embedded agency logos in rasterized output. All gallery
  fixtures are validated without a browser.
- Rail overlay tests model managed tiles, geometry reuse, fractional zoom,
  wrapping, label lifecycle, released tiles and disposal.

The deleted checks covered storage operations performed by the test itself,
historical whole-file hashes and splice samples, obsolete detail photo toggles,
or incidental layout and fixture ordering. Meaningful geometry, attribution,
escaping, authentication, race/retry, accessibility and guardrail coverage stays.

Use assertions about usable controls, persisted application state, recovery,
accessible content and rendering correctness. Avoid freezing exact utility
classes or source serialization. Animation checks use perceptible tolerances
and endpoint/reduced-motion assertions. Screenshot baselines remain
review-controlled and were not regenerated.

This work preserves both renderer features. Blocked microphone coverage checks
the current actionable error and editable text; adding keyboard-dictation
guidance remains a separate product decision.
