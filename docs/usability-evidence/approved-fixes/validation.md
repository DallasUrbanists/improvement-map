# Approved usability fixes — 2026-10-19

- UX-005: toolbar controls now have at least 44x44 CSS-pixel targets. Before-fix Browse test reproduced 40px targets. After-fix Browse journeys passed on Android Chromium and iPhone WebKit, both themes, plus 320px WebKit in both themes.
- UX-006: user confirmed search suggestions covering Browse sorting controls is intentional. No product behavior change.
- UX-007: name/email validation text uses red-600 in light mode and red-300 in dark mode. Original contrast was 3.8:1 light, 3.26:1 dark. The intermediate dark red-400 still failed at 4.3:1; final colors pass axe color-contrast assertions. Submission journeys passed on both mobile engines and themes (light passed in the first run; dark passed after the additional approved adjustment).
- UX-008: short landscape settings trays start below search at 72px and retain 88px toolbar clearance. The first slider fits without scrolling; the close action remains visible after scrolling. Before-fix assertion reproduced the clipped first control. After-fix Browse journeys passed across the mobile matrix and at 320px.
- Reviewed the before/after landscape screenshot and final validation screenshot. Intentionally regenerated and visually inspected all ten Windows toolbar baselines for the approved target-size change; only toolbar screenshots were updated. No page-state baselines were created.
- Production build passed (existing chunk-size warnings); git diff --check passed. Full release suite was not run: checks were limited to affected journeys, narrow layouts, and toolbar visual snapshots.

Evidence in this directory preserves before/after captures and contrast scan results beyond transient Playwright output.
