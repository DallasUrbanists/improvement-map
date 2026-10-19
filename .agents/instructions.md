# Testing during development

- During active feature development, run only tests relevant to the change. Use `npm run test:feature -- browse`, `submit`, `recovery`, or `guardrails` for the new deterministic journeys. These default to Android/light and omit expensive audit scans and screenshots. Pass `--project=iphone-light` for an iOS-engine-specific change.
- For other features, run the existing focused spec: `npm run test:e2e -- tests/<feature>.spec.js --project=chromium`. Do not run the entire suite after every small edit.
- Use `npm run test:ux` at integration checkpoints or when a shared UI change is ready for review. This runs Android and iPhone engines in light and dark themes with accessibility, layout and screenshot evidence.
- Reserve `npm run test:ux:full` for launch polishing, explicit comprehensive audits, and the scheduled CI job. It is not the default active-development feedback loop.
- When asked to "Run the mobile usability audit and prepare fixes", follow `docs/usability-audit.md`. Read the findings ledger first; reproduce issues, make related small fixes, and verify affected journeys before expanding to the release matrix.
- Do not regenerate screenshot baselines simply to make tests pass. Review expected visual changes and record the decision.
- Ask the user before changing questionable UX behavior or design choices. Record these as `needs-intent-confirmation`, with evidence; do not infer that surprising behavior is a bug. Confirmed intentional behavior: entering Submit from Browse restarts at Locate using the Browse location while retaining entered content. Refresh within Submit preserves the active step.
