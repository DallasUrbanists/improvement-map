# Storybook pilot validation — October 22, 2026

Validated against working changes based on `1c573de`. All catalog entries remain Draft. No screenshots have been promoted to approved baselines. New CI checks are advisory.

| Check | Result |
| --- | --- |
| `npm run build-storybook` | Passed; static catalog and Vue component/docs manifests generated |
| `npm run build:pages` | Passed; app and catalog packaged together, app CNAME preserved |
| `npm run test:storybook` | 56 passed: 28 stories in light and dark, including interaction and automated accessibility checks |
| `npm run test:storybook:visual` | 121 passed: four width/theme profiles plus targeted WebKit dialog behavior and public-subpath checks |
| `npm run test:storybook:pages` | 2 passed: documentation refresh, active app service worker, no catalog precaching, proper missing-page behavior, app entry/CNAME and manifests |
| `node --test tests/storybook-tooling.node.mjs` | 5 passed: transitive selection, story/docs scoping, shared invalidation, conservative fallbacks, rename/delete diff paths |
| `node --test tests/ci-suites.node.mjs` | Existing 8 checks passed; additional Storybook-only app-selection check passed in a focused run |
| `npm run test:feature -- browse` | Passed: Browse/search/history/photos/settings/theme journey |
| `npm run test:ux -- tests/ux/bookmarks.spec.js tests/ux/mobile-panels.spec.js tests/ux/detail-close.spec.js` | 56 passed, 12 failed; pre-existing failures described below |

The built-catalog checks produced **112 screenshot candidates**, with `visual-review-pending` annotations. Rendering is covered; visual comparison remains pending reviewed baselines. A narrow/dark Browse candidate was inspected for layout. Linux CI will produce separate candidates; Windows screenshots do not establish Linux baselines.

Raw results, HTML reports, candidate images, and local logs are under ignored `test-results/` and `playwright-report/`. The workflow uploads its own equivalent reports and static catalog for review. No production deployment or baseline approval was performed locally.

## In-app test-runner verification — October 23, 2026

The first guided UI run exposed a configuration-discovery gap: the addon looks for the conventional `vitest.config.js`, while the CLI explicitly selects `vitest.storybook.config.js`. Added a dedicated single-project UI configuration with its own optimizer cache; the CLI/CI retain their two theme projects. The original failure was a runner startup error, not a failed component assertion.

After restarting Storybook, clicking the testing widget with Interactions and Accessibility enabled completed **28 story tests**, with both categories marked passed. The Browse/Populated Interactions panel displayed five passing steps: row count, bookmark click, saved-state assertion, sort click, and selected-sort assertion. The updated selector tests also passed (five Storybook selector tests and one application-selector isolation test). Local screenshot evidence is in `test-results/storybook-ui-tests.png`.

## Album paginator candidate correction — October 23, 2026

The First story previously finished its interaction check on the second item, so its screenshot showed `2 / 3`. Its play function now exercises Next and Previous and finishes at `1 / 3`, asserting Previous disabled and Next enabled. The production component is unchanged.

The focused light/dark interaction and accessibility run passed all **8 cases**. A fresh static build and all **16 paginator render checks** passed (First/Middle/Last/Empty across narrow/desktop light/dark). The regenerated Windows PNGs and a review sheet are in `test-results/album-paginator-review/fixed/`; the focused HTML test report is in `playwright-report/album-paginator-review/`. These remain candidates with `visual-review-pending`, not approved visual comparisons. No baseline or component approval was recorded; checks remain advisory.

## Album paginator without preview card — October 23, 2026

Removed `map-ui sb-surface` from the paginator story wrapper. Only a plain 720px maximum-width constraint and the standard Storybook canvas spacing remain; the wrapper no longer supplies a background, padding, border, rounded corners or shadow. The production paginator, including its divider and individual button styles, is unchanged. The story documentation now explains this boundary.

The static build, **8 focused interaction/accessibility cases**, and **16 paginator render checks** passed again. Fresh Windows candidates and the review sheet are in `test-results/album-paginator-review/component-only/`; the focused HTML test report is in `playwright-report/album-paginator-component-only/`. These supersede the earlier card-wrapped candidates for the current review. All remain Draft and `visual-review-pending`, with no approved baselines and advisory checks.

## Album paginator fullscreen candidates — October 23, 2026

Set the paginator stories to `layout: 'fullscreen'` and removed the 720px wrapper entirely. The component now fills the available preview width without Storybook canvas padding. Its own divider, internal top spacing and button styling are unchanged. The adjacent story documentation describes the fullscreen presentation.

The static build, **8 focused interaction/accessibility cases**, and **16 paginator render checks** passed. The latest Windows candidates and review sheet are in `test-results/album-paginator-review/fullscreen/`; the HTML test report is in `playwright-report/album-paginator-fullscreen/`. These supersede earlier padded/constrained candidates for the current review. All remain Draft and `visual-review-pending`; no baseline approval was recorded and checks remain advisory.

## Raw previews across the component catalog — October 23, 2026

Made fullscreen the default and replaced the rendered Konsta app wrapper with its renderless provider. The existing preview body supplies production theme tokens with its own surface, border, radius, shadow and spacing removed. Controls, toggles, rows, paginator and trays no longer have decorative preview wrappers. Idea rows retain only the semantically required zero-spacing `ul`. Slot variants use plain content. Raw sheet stories open the sheet directly; the opener/focus scenario moved to `Patterns/Detail sheet with opener`, retaining keyboard restoration coverage. Positioned/teleported panels use isolated Docs iframes. Foundations and Browse remain explicitly documented reference/screen examples. Production component styles were not changed in this revision.

The static build passed. Interaction/accessibility checks completed **62 passed / 2 failed** across 32 stories in both themes. The newly exposed failures are both `Map tray / Long Content`: `.map-tray-content` has overflowing plain text with no keyboard-focusable content (`scrollable-region-focusable`). Earlier padded link fixtures masked this case. The check remains enabled and advisory; no component redesign or accessibility suppression was applied.

All **137 built-catalog checks passed**, including direct component-root/neutral-canvas assertions and Chromium/WebKit opener restoration. They generated **128 Windows candidates**, of which **96 component candidates** are extracted into `test-results/storybook/raw-components-review/` with a filterable review sheet. The HTML report is in `playwright-report/raw-components/`. Background, grid and outline rendering were inspected in the live raw-control preview. All entries remain Draft, baselines remain unapproved, and CI remains advisory.

## Map tray keyboard scrolling fix — October 23, 2026

Resolved the two Long Content accessibility failures exposed by raw previews. Enabled, scrollable `.map-tray-content` now has `tabindex="0"` and a visible inset keyboard-focus outline using the existing text token. Busy/inert and fixed-content modes omit the content Tab stop. Added a raw Fixed Content story and regression coverage for exclusions, actual Tab navigation, visible focus and Page Down scrolling. No preview wrappers or test suppressions were introduced.

The static Storybook build passed. **22 affected interaction/accessibility cases passed** (Map tray and Browse in both themes), including both formerly failing Long Content checks. **34 focused browser checks passed**: 24 tray renders/candidates across four width/theme profiles plus keyboard regressions in Chromium and WebKit. The focused **Browse and Submit application journeys each passed** on Android/light.

The **24 new Windows tray PNGs** and review sheet are in `test-results/storybook/map-tray-keyboard-review/`; browser reports are in `playwright-report/map-tray-keyboard/`. These supersede earlier tray candidates and the earlier unresolved keyboard finding. All entries remain Draft, tests remain advisory, and no baseline was approved or written.

## Local server watcher recovery — October 23, 2026

The local server exited with Windows `EBUSY` while Vite watched a rewritten asset under `storybook-static`. Added generated build/report directory exclusions in `.storybook/main.js` through `viteFinal`: Storybook replaces the standalone Vite configuration's server settings before this hook. Source story/component watching remains enabled and existing server options are preserved.

Restarted Storybook on port 6006, completed a static build while it was running, and confirmed the development server remained available with HTTP 200 and a valid story index including Map tray / Long Content. No generated-output reloads or watcher errors appeared during that verification. Checks remain advisory and baselines remain unapproved.

## REFERENCE catalog grouping — October 23, 2026

Moved all nine story collections and the standalone Start here document beneath `REFERENCE/`. The sole root now contains Start here, Foundations, Components, Patterns and Screens in that order. The built index retains **43 entries: 33 stories and 10 documentation pages**, all under REFERENCE. Updated component-boundary checks, keyboard routes, Pages refresh routes, the reuse index and the active local screenshot gallery's live-story links for the generated `reference-` URL prefix. Historical result files and candidates retain their original provenance.

The combined app/Storybook Pages build passed, **66 story interaction/accessibility cases passed**, **51 focused browser checks passed**, and **2 packaged Pages/service-worker checks passed**. The live sidebar and new Start here page were inspected; screenshot evidence is `test-results/storybook/reference-sidebar.png`. No production UI change or baseline approval was made. Tests remain advisory and all catalog entries remain Draft.

## Square Icon Button and Colors — October 23, 2026

Added the separate `BUTTONS/Square Icon Button` collection with exactly Neutral, Primary and Secondary stories, plus a standalone top-level Colors document. The production component composes MapControlButton and owns its 48px square surface, 12px radius and shadow. Neutral follows the supplied light/dark references; Primary is yellow and Secondary navy as requested. `src/design/buttonColors.js` is shared by the component and Colors swatches. Existing app controls were not replaced.

Each story exposes theme (light/dark), icon, disabled and label controls. An unset story theme follows the theme toolbar. The label supplies `aria-label` and the native hover tooltip, with no printed button text. The official version-matched Pseudo States addon adds toolbar inspection for hover, active/press and focus-visible; reset gives default. Native pointer and keyboard states also work, without added preview elements.

The static build and **6 focused interaction/accessibility cases** passed. **44 focused browser checks passed**, exercising four states and disabled behavior for all variants across narrow/desktop light/dark, alternate icon/label values, raw rendering, Colors and catalog metadata. **60 state screenshot candidates** are extracted into `test-results/storybook/square-icon-button-review/`; reports are in `playwright-report/square-icon-button/`. The broader catalog run initially exposed a cold optimizer reload of `storybook/theming`; prebundling it in the shared Vite config resolved the reload and all **72 catalog interaction/accessibility cases passed**. The live state toolbar, four controls and Colors page were inspected.

The earlier REFERENCE entries retain their grouping. All designs remain Draft, checks remain advisory and no screenshot baseline was approved or written.

## App-wide Colors documentation and theme containers — October 23, 2026

Reworded Colors as a shared palette for the entire app, spanning components, patterns and screens, with Square Icon Button identified as its first consumer. Background, foreground, border and interaction roles now describe general UI usage; component-specific sizing, focus geometry and disabled opacity are distinguished from color roles. Color values and production component styles were not changed.

Wrapped the light and dark palette sections in matching documentation-only surfaces and explicit Storybook theme providers, so swatch labels remain readable regardless of the surrounding Docs theme. These containers do not affect raw component previews. The static build and **4 focused documentation browser checks passed**, covering the shared-palette wording and both section backgrounds across the existing viewport/theme profiles. The live page was inspected. Tests remain advisory and baselines remain unapproved.

## Existing application-test failures

Three scenarios in `tests/ux/mobile-panels.spec.js` fail in all four Android/iPhone light/dark profiles:

- “action removal undo restores the saved action” expects a `My actions (1)` link that is absent in the current UI.
- “context previews and full sheets fit 320x568” expects a `View all areas` button that is absent.
- The same context-preview scenario at 844x390 expects that absent button.

Both distinct failure types were reproduced against an isolated copy of **unmodified HEAD `1c573de`** on port 5184 with the same Playwright version. They fail at the same missing-control locators. The source UI and these existing tests were not changed to make the checkpoint pass. Correcting their expectations or changing the design is separate work requiring the current intended behavior to be confirmed.

The checkpoint passed bookmark persistence, cross-tab synchronization, row activation separation, unavailable data/storage handling, sorting/recovery, saved-list restoration, settings/theme controls, and map camera/detail-close behavior. Existing application assertions were retained.
