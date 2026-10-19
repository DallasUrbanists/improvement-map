# Mobile usability audit

## Choose the smallest useful level

| When | Command | Work performed |
| --- | --- | --- |
| Active Browse development | `npm run test:feature -- browse` | One Android/light journey; assertions only |
| Active Submit development | `npm run test:feature -- submit` | Upload/edit/validation/recovery/persistence assertions |
| Error-state development | `npm run test:feature -- recovery` | Empty, denied location, missing detail |
| Audit tooling changes | `npm run test:feature -- guardrails` | Deliberate defects and write-blocking canaries |
| Other features | `npm run test:e2e -- tests/<feature>.spec.js --project=chromium` | Selected existing spec |
| Integration/review | `npm run test:ux` | Android Chromium + iPhone WebKit, light/dark, all audit states |
| Launch polishing | `npm run test:ux:full` | Adds 320px iPhone, landscape iPhone, desktop, both themes |

Pass `--project=iphone-light` to a feature command for WebKit. Pass `--grep` or `--project` to audit commands to narrow an investigation. Do not run the full matrix on every edit. `npm test` retains the existing suite and excludes the new UX directory.

Install with `npm ci` and `npx playwright install chromium webkit` (Linux: add `--with-deps`). The harness starts an isolated Vite server on port 5174; stop conflicts rather than reusing an unknown server. Device profiles emulate browser properties; they do not run iOS itself.

## Repeatable AI review

When asked **"Run the mobile usability audit and prepare fixes"**:

1. Read this procedure, `AGENTS.md`, `docs/usability-findings.json`, and recent changes. Respect recorded intentional/deferred decisions.
2. Run the affected feature tests first. At the audit checkpoint run the core suite; reserve the full matrix for release polishing or an explicit comprehensive audit.
3. Open the HTML report with `npx playwright show-report playwright-report/ux`. Read `test-results/ux/summary.json` for visited/missing states and deduplicated observations. Inspect screenshots; passing assertions do not imply good UX. Failed journeys leave later states explicitly missing.
4. Explore untested combinations: open/close/reopen, history, refresh, long input, denied permissions, delays, failure/retry, themes, orientation. Review hierarchy, wording, consistency and discoverability. Record extra coverage and concrete reproduction steps in the ledger.
5. Reproduce observations. Distinguish fixture failures, defects, intentional behavior and subjective recommendations. Check incomplete axe results manually; scans do not establish accessibility conformance.
6. **Ask the user before changing questionable UX behavior or design choices.** Set status `needs-intent-confirmation`; provide evidence, consequences and a suggested change. Reopening Submit from Browse intentionally returns to Locate at the Browse location. Refresh within Submit should retain its step.
7. For confirmed fixes, add a regression check, preserve before/after evidence, make a small related patch, and rerun the affected journey on both mobile engines and themes. Broaden only for a shared change or release checkpoint.
8. Update existing ledger IDs instead of filing duplicates. Report fixes, pending intent decisions, coverage gaps and actual validation. Do not publish or deploy automatically.

Ledger fields: `id`, `fingerprint`, `status`, `severity`, `states`, `devices`, `reproduction`, `evidence`, `decision`, `regression`. Statuses: `open`, `needs-intent-confirmation`, `intentional`, `deferred`, `fixed`. Automated observations are not automatically bugs.

## Evidence, comparisons and rollout

Each checkpoint attaches a screenshot, axe violations/incomplete checks, layout observations, visited states and transitions. Small targets use a preferred 44×44 CSS-pixel threshold, not a blanket WCAG violation. Overlap checks are heuristic; scrolling and modal backgrounds require interpretation. Enlarged-text testing increases root font size and is not complete browser text-zoom simulation. Runtime exceptions and journey assertions fail local commands.

Screenshots use fixed time, deterministic data and a fake map with external traffic blocked. The fake basemap excludes remote tiles while retaining app controls. System font fallback is used when Google Fonts is unavailable; check live rendering separately. Comparisons use the same OS/device/theme. Missing baselines create review annotations, never a claim of visual equivalence. To generate candidates deliberately, set `UX_VISUAL=1` and run a selected audit with `--update-snapshots=all`; inspect every candidate before committing it. Never use this flag in CI. Linux CI baselines must be generated/reviewed on Linux; Windows images are not interchangeable.

CI runs core checks on PRs and before Pages deployment. Weekly Monday 13:00 UTC and manual full runs cover the expanded matrix. Artifacts last 14 days. Initially failures are reported without blocking deployment; **read the outcome and findings, not just the green workflow badge**. After triaging/fixing findings, set repository variable `UX_ENFORCE=true` to enable strict accessibility/layout gates and block deployment on failure. Local strict mode uses `UX_STRICT=1`. Resolve false positives before enabling. Differences against approved screenshot baselines fail tests even in report mode; CI initially reports those failures.

CI does not invoke an AI model. AI review is on demand in this chat or a future explicitly configured automation. No paid services or API keys are required for deterministic tests.

The user explicitly deferred changing `user-scalable=no`; `meta-viewport` stays in reports but is excluded from strict blocking. Other findings remain actionable after intent confirmation. The first approved visual baseline covers the toolbar on Windows; page-state screenshots are review evidence until separately approved. Linux CI captures candidates until Linux baselines are reviewed.

## Live and real-device checks

`npm run test:ux:live` requires explicit `UX_LIVE_URL`. It runs separately, allows only GET/HEAD, uses no map/API mocks and verifies the actual Maps container plus Browse navigation. SDK telemetry may fail because writes are blocked. It does not assert camera, permission dialogs, tile correctness or all live services.

Before release, on actual iPhone/Safari and Android/Chrome:

- Open search, description, name and email with the keyboard showing; verify reachable actions, scrolling and restoration after dismissal.
- Expand/collapse browser bars and rotate; inspect safe areas and fixed controls.
- Allow/deny location, microphone and camera. Capture/select a photo and recover from cancellation.
- Check pinch zoom, enlarged system text, VoiceOver/TalkBack and focus order.
- Install/open the PWA, reload offline and verify update/recovery. Do not send production submissions solely for testing.

Keep `/test` secondary: existing diagram specs remain separately runnable. PWA installation/service-worker lifecycle are excluded from deterministic tests, which block service workers for network isolation.
