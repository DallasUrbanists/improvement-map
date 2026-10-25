# Storybook pilot validation — October 22, 2026

Validated against working changes based on `1c573de`. All catalog entries remain Draft. No screenshots have been promoted to approved baselines. New CI checks are advisory.

| Check | Result |
| --- | --- |
| `npm run build:storybook` | Passed; static catalog and Vue component/docs manifests generated |
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

## Raw previews across the component catalog — October 23, 2026

Made fullscreen the default and replaced the rendered Konsta app wrapper with its renderless provider. The existing preview body supplies production theme tokens with its own surface, border, radius, shadow and spacing removed. Component previews no longer have decorative wrappers. Idea rows retain only the semantically required zero-spacing `ul`. Slot variants use plain content. Positioned/teleported panels use isolated Docs iframes. Production component styles were not changed in this revision.

The static build passed. Interaction/accessibility checks completed **62 passed / 2 failed** across 32 stories in both themes. The newly exposed failures are both `Map tray / Long Content`: `.map-tray-content` has overflowing plain text with no keyboard-focusable content (`scrollable-region-focusable`). Earlier padded link fixtures masked this case. The check remains enabled and advisory; no component redesign or accessibility suppression was applied.

All **137 built-catalog checks passed**, including direct component-root/neutral-canvas assertions and Chromium/WebKit opener restoration. They generated **128 Windows candidates**, of which **96 component candidates** are extracted into `test-results/storybook/raw-components-review/` with a filterable review sheet. The HTML report is in `playwright-report/raw-components/`. Background, grid and outline rendering were inspected in the live raw-control preview. All entries remain Draft, baselines remain unapproved, and CI remains advisory.

## Local server watcher recovery — October 23, 2026

The local server exited with Windows `EBUSY` while Vite watched a rewritten asset under `storybook-static`. Added generated build/report directory exclusions in `.storybook/main.js` through `viteFinal`: Storybook replaces the standalone Vite configuration's server settings before this hook. Source story/component watching remains enabled and existing server options are preserved.

Restarted Storybook on port 6006, completed a static build while it was running, and confirmed a valid story index. No generated-output reloads or watcher errors appeared during that verification. Checks remain advisory and baselines remain unapproved.

## Square Icon Button and Colors — October 23, 2026

Added the separate `BUTTONS/Square Icon Button` collection with exactly Neutral, Primary and Secondary stories, plus a standalone top-level Colors document. The production component composes MapControlButton and owns its 48px square surface, 12px radius and shadow. Neutral follows the supplied light/dark references; Primary is yellow and Secondary navy as requested. `src/design/buttonColors.js` is shared by the component and Colors swatches. Existing app controls were not replaced.

Each story exposes theme (light/dark), icon, disabled and label controls. An unset story theme follows the theme toolbar. The label supplies `aria-label` and the native hover tooltip, with no printed button text. The official version-matched Pseudo States addon adds toolbar inspection for hover, active/press and focus-visible; reset gives default. Native pointer and keyboard states also work, without added preview elements.

The static build and **6 focused interaction/accessibility cases** passed. **44 focused browser checks passed**, exercising four states and disabled behavior for all variants across narrow/desktop light/dark, alternate icon/label values, raw rendering, Colors and catalog metadata. **60 state screenshot candidates** are extracted into `test-results/storybook/square-icon-button-review/`; reports are in `playwright-report/square-icon-button/`. The broader catalog run initially exposed a cold optimizer reload of `storybook/theming`; prebundling it in the shared Vite config resolved the reload and all **72 catalog interaction/accessibility cases passed**. The live state toolbar, four controls and Colors page were inspected.

All designs remain Draft, checks remain advisory and no screenshot baseline was approved or written.

## App-wide Colors documentation and theme containers — October 23, 2026

Reworded Colors as a shared palette for the entire app, spanning components, patterns and screens, with Square Icon Button identified as its first consumer. Background, foreground, border and interaction roles now describe general UI usage; component-specific sizing, focus geometry and disabled opacity are distinguished from color roles. Color values and production component styles were not changed.

Wrapped the light and dark palette sections in matching documentation-only surfaces and explicit Storybook theme providers, so swatch labels remain readable regardless of the surrounding Docs theme. These containers do not affect raw component previews. The static build and **4 focused documentation browser checks passed**, covering the shared-palette wording and both section backgrounds across the existing viewport/theme profiles. The live page was inspected. Tests remain advisory and baselines remain unapproved.

## Drawer browser starting state — October 24, 2026

The two `CONTAINERS/Drawer` slide stories finish their play functions closed. The browser test now verifies that state after `data-storybook-ready` and reopens through the existing accessible `Open drawer` handle before checking the open backdrop and geometry. Production code, story play functions, IDs, screenshots, and existing closed/drag-disabled coverage were not changed.

The focused Storybook build passed. **16 drawer browser cases passed** across `narrow-light`, `desktop-light`, `narrow-dark`, and `desktop-dark`: both `containers-drawer--slide-from-left` and `containers-drawer--slide-from-right` passed their open/close/reopen checks, and all eight closed/drag-disabled cases passed. **6 interaction/accessibility cases passed** for the Drawer stories in light and dark. The initial narrow/light baseline reproduced 2 open-state failures and 2 closed-state passes before the test setup change.

The focused commands were the pinned Storybook build, `node node_modules/@playwright/test/cli.js test --config playwright.storybook.config.js tests/storybook/drawer.spec.js --project=narrow-light --project=desktop-light --project=narrow-dark --project=desktop-dark`, and `PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers node node_modules/vitest/vitest.mjs run --config vitest.storybook.config.js src/components/Drawer.stories.js`. The test container was explicitly mounted to this branch worktree; its bundled Chromium path was used for the interaction run because the branch helper selects a checkout-local browser download path.

Evidence: [browser JSON](../test-results/local-development/test-results/storybook/browser.json), [interaction JSON](../test-results/local-development/test-results/storybook/interactions.json), and [HTML report](../test-results/local-development/playwright-report/storybook/index.html). No screenshot candidates were generated or approved. Drawer designs remain Draft; visual review remains pending.

## Existing application-test failures

Three scenarios in `tests/ux/mobile-panels.spec.js` fail in all four Android/iPhone light/dark profiles:

- “action removal undo restores the saved action” expects a `My actions (1)` link that is absent in the current UI.
- “context previews and full sheets fit 320x568” expects a `View all areas` button that is absent.
- The same context-preview scenario at 844x390 expects that absent button.

Both distinct failure types were reproduced against an isolated copy of **unmodified HEAD `1c573de`** on port 5184 with the same Playwright version. They fail at the same missing-control locators. The source UI and these existing tests were not changed to make the checkpoint pass. Correcting their expectations or changing the design is separate work requiring the current intended behavior to be confirmed.

The checkpoint passed bookmark persistence, cross-tab synchronization, row activation separation, unavailable data/storage handling, sorting/recovery, saved-list restoration, settings/theme controls, and map camera/detail-close behavior. Existing application assertions were retained.
