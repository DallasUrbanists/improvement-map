# Initial implementation validation — 2026-10-19

- `npm run test:ux:full`: **80 passed**, 6.6 minutes. All 27 catalog states visited in each of 10 device/theme profiles (270 state captures). This is report mode, not a claim that all accessibility/layout observations passed.
- `npm run test:feature -- browse` and `npm run test:feature -- submit`: passed during harness development, about 9 seconds each including server startup. Focused runs omit axe scans and screenshot collection.
- `npm run build`: passed, including PWA generation. Vite reports large chunks; no build error.
- Read-only live smoke against `https://dallasurbanists.github.io/improvement-map/`: **1 passed**. Actual Google Map loaded and Browse opened; all non-GET/HEAD requests were blocked.
- Windows toolbar baselines were visually inspected for all 10 profiles and passed comparison in the full run. Linux baseline approval and real-phone checks remain follow-up work.
- `git diff --check`: passed. Remote GitHub Actions has not been executed from this local session.

`initial-audit-summary.json` preserves the initial raw observations and coverage. These are evidence for triage, not individually confirmed defects. `../usability-findings.json` holds the decisions and grouped backlog. Before/after contrast reports document the approved fixes. Full screenshots and traces are available in the local `playwright-report/ux` and `test-results/ux` directories; CI uploads equivalent artifacts for 14 days.

User decisions retained: reopening Submit from Browse restarts Locate; mobile browser zoom restrictions remain; questionable UX changes require intent confirmation. Only the approved helper/counter contrast improvements and bundled icons changed application behavior or assets.
