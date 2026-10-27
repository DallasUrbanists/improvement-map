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

## Component-test widget failures — October 26, 2026

Captured the user's widget run: 13 interaction failures and 3 accessibility
failures. Corrected Accordion's unconditional empty slot masking its HTML content,
Active Text Button hover specificity, Toolbar queries that counted both button
groups, and Toast/Tray assertions that ran during transitions. Tray also computed
its initial medium offset from stale DOM height; offsets now use its reactive
target height. Scrollable tray content is keyboard-focusable, and the stories
retain drag, size, focus and reduced-motion coverage. Accordion's slotted story
now verifies that supplied slot content takes precedence over fallback HTML.

The maintainer confirmed Hidden Action Row should retain its current 50% opacity;
its stale 75% expectations and documentation were corrected. This exposes a real
hidden-text contrast failure (3.31:1 versus the check's 4.5:1 requirement).
**Confirmed design decision — October 26, 2026:** the maintainer explicitly chose
to keep the entire row at 50% opacity and document the unresolved contrast
failure. This resolves the intent question; it does not resolve the accessibility
defect or establish compliance. The whole-row opacity remains unchanged.
Accessibility checks stay enabled and the three failures are not suppressed.

The three original accessibility failures recorded an earlier blue-on-red Big
Circle Button experiment. The user's uncommitted yellow/black styling was
preserved; the New Idea Special Button cases pass with that current styling.

Verification: 42 focused interaction/accessibility cases passed in light/dark;
8 local Node checks and both current app/Storybook smoke journeys passed. A full
run through the actual Docker widget passed all 105 interaction tests and 102 of
105 accessibility checks. The remaining three are the Hidden Action Row contrast
cases reached after toggling Hide in Recommended, Long Summary and Saved.

The older Browse journey stops before the changed components at its missing
`.map-search-panel` selector; the current Address Bar no longer supplies that
class. That application assertion was retained. No screenshot baseline or
component approval was changed; visual review remains pending.

Receipts: `test-results/widget-catalog-fixed-summary.log`,
`test-results/widget-catalog-fixed.json`,
`test-results/widget-fixes-verified-components.log`,
`test-results/widget-fixes-local-smoke.log`, and
`test-results/widget-fixes-browse-journey.log`.

## Existing-browser load timings — October 26, 2026

Measured the user's existing in-app browser tab against Docker Storybook on
`127.0.0.1:6006`, without clearing caches, changing configuration or restarting
services. The standalone Browser skill was unavailable; the available browser
control API attached to the existing tab. Times run from initiating reload or
clicking a catalog entry through network idle, the selected preview appearing in
the accessibility tree, and its Interactions status reaching Pass. They include
browser-control/observation overhead and interaction playback, so they are
approximate user-workflow timings rather than browser paint or transfer profiles.
“First visit” means first visit in this measured round, not a verified cold cache.
Readiness-probe attempts before the valid refresh were discarded; that refresh
was therefore also warm. Expanding Text Input opened Floating outside the timed
sequence; Tight was the measured story. No component test suite ran during the
measurement sequence.

The valid initial refresh of Header Bar / Plain took **12.983 seconds**.

| Story | First visit (seconds) | Revisit (seconds) |
| --- | ---: | ---: |
| Header Bar / With Buttons | 1.880 | 1.504 |
| Text Input / Tight | 1.598 | 1.571 |
| Tray / With Header | 0.808 | 3.596 |
| Accordion / With simple header | 2.106 | 2.582 |
| Toolbar / All Text Buttons | 3.011 | 3.929 |
| Contained Section / With padding | 0.837 | 1.728 |
| Mean | 1.707 | 2.485 |

After completing both rounds, two diagnostic reloads of the original Header Bar /
Plain took **8.947 and 25.911 seconds**. Browser logs recorded fresh manager-side
`UniversalStoreFollowerTimeoutError` errors for `storybook/test` during those
reloads. The installed manager rejects follower synchronization after one second
(`storybook/dist/manager/globals-runtime.js`, `prepareThis`). The existing worker
startup backport is present in the running container's installed source; this
remaining manager synchronization failure is not evidence that the backport is
missing, nor proof that the timeout accounts for the entire reload duration.

Observed contributors and limits:

- Storybook consumes 67–69% CPU and about 3.55 GiB while idle. The separate web
  container consumes about 31% CPU. Storybook retains its Vitest child and headless
  Chromium after tests. Both servers use polling at a 500 ms interval over the
  Windows bind mount; the addon creates Vitest with `watch: true` even when the UI
  is not running tests. This is strong evidence of background overhead, but no
  controlled process or polling A/B was performed to apportion its cost.
- Warm HTTP probes ranged from 4–61 ms to 400–525 ms for source/preview requests;
  the first manager document probe was 522 ms. The manager globals/runtime
  responses alone contain about 4.59 MB of uncompressed JavaScript. A refresh
  reloads manager and preview runtimes; a sidebar switch reuses them. These are
  response-body sizes, not measured browser transfer sizes or execution costs.
- Stories automatically execute play functions after rendering. Toolbar activates
  six buttons, Text Input types/clears text, and Tray/Accordion exercise state and
  transitions. Revisit completion therefore includes fresh test work. The slower
  second-round mean does not support blaming only cold compilation/cache misses.
- No browser resource waterfall or CPU profile was available through the browser
  control API, so exact critical-path attribution remains unmeasured.

Prioritized speedup experiments: compare the same checkout/browser on native
Windows or a Linux-local WSL checkout with reliable event watching; then compare
an explicit UI-editing mode without the persistent Vitest addon against the full
testing mode, retaining CLI interaction/accessibility coverage. An optional
no-autoplay editing mode could separately reduce story-settling time while keeping
test execution enabled in test mode. Profile transforms before adding narrow Vite
warmup/prebundling rules or removing documentation features. Do not simply disable
polling on a Windows bind mount (changes may stop arriving), raise synchronization
timeouts, or disable the docgen server: the installed Vue fallback forces full
reloads in its hot-update hook. No runtime/configuration change was made for this
investigation and no speedup is claimed without a comparison run.

Sources: [Storybook play functions](https://storybook.js.org/docs/writing-stories/play-function),
[Vite file watching](https://vite.dev/config/server-options#server-watch), and
[Vite performance guidance](https://vite.dev/guide/performance).
Receipts: `test-results/storybook-load-timing.json`,
`test-results/storybook-load-timing-diagnostic.json`, and
`test-results/storybook-load-timing.png` (local ignored artifacts).

## Experiment 3: opt-in no-autoplay editing

Added a development-only `editing=true` URL flag in `.storybook/preview.js`.
The manager strips the reserved `embed` parameter, so the preview translates the
custom flag to `embed=true` before story selection. The installed Storybook
10.6.3 runtime's `shouldAutoplay` then skips the play function. This retains the
manager/sidebar and manual component interaction. No dependency, polling,
Vitest-addon, docgen or timeout setting was changed, and services were not
restarted. Production builds ignore the flag. The independent Vitest browser
entry does not receive it. Revisit this implementation when upgrading Storybook.

In the same existing browser, measured the same six stories twice per mode with
warm caches and the prior readiness proxy (network idle, matching preview and
Pass status). The editing mode had zero interaction steps on every visit; normal
mode displayed completed interaction steps. One normal Header Bar sample observed
Pass before its steps populated; it was excluded and replaced with a sample
requiring all 11 steps and Pass. Sidebar group preparation and mode-change loads
were excluded. The editing rounds preceded normal rounds; this is a small,
sequential experiment, not a randomized browser profiler benchmark. Browser
automation/observation overhead is included.

| Story | Autoplay on, mean seconds | Autoplay off, mean seconds |
| --- | ---: | ---: |
| Header Bar / With Buttons | 2.248 | 1.479 |
| Text Input / Tight | 2.469 | 1.468 |
| Tray / With Header | 3.908 | 1.476 |
| Accordion / With simple header | 2.545 | 1.467 |
| Toolbar / All Text Buttons | 3.264 | 1.468 |
| Contained Section / With padding | 1.468 | 1.430 |
| Overall mean | 2.650 | 1.465 |

Observed navigation completion improved by about **45%** overall, with the
largest reductions in the stories that exercise multiple actions/transitions.
Contained Section's simple assertions made almost no difference. This supports
keeping the opt-in mode for CSS/manual editing; an empty Interactions panel is
not evidence that its tests ran, even if the manager displays Pass.

Two refreshes per mode on Header Bar / Plain took **22.278 / 15.329 seconds** with
autoplay on and **13.069 / 21.871 seconds** with autoplay off. Their overlapping
range does not establish a meaningful refresh improvement. Disabling playback
does not address the earlier background-resource and synchronization findings.
The next experiment should evaluate the persistent Vitest addon separately;
experiment 2 was not started as part of this work.

Focused validation retained actual playback: both Text Input cases passed in
light on native Windows, and both dark cases passed in the existing Linux
container. The initial sandboxed attempt could not reach localhost. After
allowing local browser access, the combined native run hit an `EPERM` dependency
cache rename and a dark-theme `aria-query` import failure before those tests
executed; a native dark-only retry stalled and was stopped. The successful Linux
dark run took 99.30 seconds, mostly setup/import work. Cache configuration was
not changed as part of this experiment. Normal browser URLs also completed
interaction steps across all six comparison stories. The final browser tab was
left on Toolbar with `editing=true`, zero steps and its manual buttons visible.

Receipts: `test-results/storybook-autoplay-experiment.json` (includes the excluded
sample), `test-results/storybook-autoplay-editing.png`,
`test-results/storybook-autoplay-test.log`,
`test-results/storybook-autoplay-test-dark.log`, and
`test-results/storybook-autoplay-test-dark-container.log`.

## Experiment 2: editing without the persistent Vitest addon

Added the opt-in `STORYBOOK_EDITING=true` server environment switch. Main config
omits only `@storybook/addon-vitest` in this mode; Compose passes the flag only to
Storybook, with a default of false. The independent CLI Vitest plugin remains
configured. The test widget is absent, while Docs, controls, accessibility and
the catalog remain available (132 index entries in both modes). Both sides of
the experiment retained `editing=true` in the browser URL to disable autoplay.
Polling, the Windows bind mount, dependencies, docgen and timeout settings were
unchanged. Only Storybook was recreated; web and mock services were left running.

Measured three states to distinguish restarting from removing the addon:

1. Fresh full server, before the test widget has launched a worker.
2. Same server after one selected Header Bar / Plain widget test completed. Its
   interaction and accessibility checks both passed; the run reported one passed
   test and four skipped cases, not a full suite. Vitest and Chromium remained
   running afterward.
3. Fresh server with the addon omitted.

Each state has three warm refreshes of Header Bar / Plain and two rounds through
the same six stories. Mode-change initial loads and category expansion are
excluded. Caches were retained. A temporary preview `afterEach` probe set its
document title to `<story-id> [ready]` for the `timing=true` query flag, allowing
the browser accessibility tree to confirm completion independently of the test
panel. Timings ran from reload/click through network idle and that marker. The
same probe was used in every state and removed afterward. These are approximate
wall-clock workflow measurements including browser-control overhead, with small
sequential samples rather than a randomized performance profile.

An initial sidebar-preparation batch was discarded: component group buttons
opened Docs when the modified-story filter was absent, and rapid selections
left a stale preview. The valid navigation rounds used category Expand all
controls followed by direct story links, waiting for each preview to finish.
The browser control session was reattached to the same existing tab after its
preparation timeout. Earlier completed refresh records were recovered from their
tool outputs; no navigation measurements from the failed batch were retained.

| State | Refresh samples, seconds | Mean refresh | Mean story switch |
| --- | --- | ---: | ---: |
| Fresh, addon enabled, worker not started | 3.884 / 3.496 / 7.978 | 5.119 | 1.396 |
| Addon enabled, worker/browser persistent after test | 18.963 / 13.559 / 21.615 | 18.046 | 2.030 |
| Addon omitted | 4.236 / 3.693 / 3.657 | 3.862 | 1.742 |

Per-story navigation means (two visits each):

| Story | Fresh full server | Persistent worker | Addon omitted |
| --- | ---: | ---: | ---: |
| Header Bar / With Buttons | 1.585 | 1.560 | 1.365 |
| Text Input / Tight | 1.286 | 2.838 | 1.842 |
| Tray / With Header | 1.227 | 2.577 | 2.448 |
| Accordion / With simple header | 1.495 | 2.259 | 1.839 |
| Toolbar / All Text Buttons | 1.417 | 1.611 | 1.490 |
| Contained Section / With padding | 1.368 | 1.334 | 1.469 |

Idle resource samples, taken outside active test execution:

| State | Storybook container CPU | Memory | Processes/threads reported by Docker |
| --- | ---: | ---: | ---: |
| Fresh full server, no worker | 26.74% | 795.3 MiB | 96 |
| After selected test, worker/browser remain | 66.68% | 1.708 GiB | 260 |
| Addon omitted | 32.34% | 913.6 MiB | 95 |

The process lists confirm Vitest/headless Chromium in the persistent state and
their absence from the addon-free idle server. The app container continued using
about 34% CPU in the persistent and addon-free resource samples; its polling was
not changed. A first diagnostic process-name search matched its own command text
and was disregarded; the actual process lists/resource captures establish these
states.

Compared with the persistent runner, omitting the addon reduced mean refresh time
by **78.6%**, with a more modest **14.2%** navigation reduction. The fresh full
server was already much faster before its first test, and its navigation mean
was slightly better than addon-free mode. This supports avoiding the persistent
test runner during CSS/manual editing, rather than claiming the addon always
adds a large cost just by being installed. It also explains why restarting can
temporarily help. No one-second synchronization timeout reproduced in the valid
rounds. A stale preview logged a generic `vite-app.js` loading/hostname message
during the deliberate server replacement; subsequent measured previews completed
successfully without changing allowed-host settings.

The addon-free server is left running for manual editing. To restore the widget,
set `STORYBOOK_EDITING=false` and recreate only Storybook as documented in
[the local workflow](storybook.md#local-workflow). Removing `editing=true` from
the URL restores autoplay separately.

Verification after removing the temporary probe: the independent CLI invocation
`npm run test:storybook -- src/components/TextInput.stories.js --project=storybook-light`
passed both stories inside the addon-free container, with `STORYBOOK_EDITING=true`
and fully mocked providers. Duration was 28.14 seconds. These tests execute their
typing/clearing play functions; the editing mode does not silently skip CLI
interactions. The default config was also checked to retain the full addon set,
with the opt-in config differing only by removal of the Vitest addon.

Receipts: `test-results/storybook-vitest-addon-experiment.json`,
`test-results/storybook-addon-widget-warmup.log`,
`test-results/storybook-addon-persistent-resources.log`,
`test-results/storybook-addon-disabled-resources.log`, and
`test-results/storybook-addon-free-editing.png`, and
`test-results/storybook-addon-free-cli-test.log`.

## Experiment 4: transform profiling and targeted warmup

Profiled Vite 6.4.5 with `DEBUG=vite:transform,vite:plugin-transform,vite:deps` in
the existing Docker editing environment. Both variants omitted the Vitest addon
and used `editing=true` to skip autoplay. Dependency caches and browser caches
were retained; each variant started a fresh server process. Logs included plugin
elapsed time and total module-transform elapsed time, not a CPU sample profile.
Overlapping asynchronous timings must not be added as critical-path duration.

The first-load baseline contained 284 module transforms. The largest was
`src/tailwind.css` at **5053 ms**, including **4167.27 ms** in
`@tailwindcss/vite:generate:serve`. Other representative costs were Action Row's
CSF transform at 816.94 ms (784.57 ms in `plugin-csf`), Header Bar's CSF module at
176.03 ms, and the generated story import module at 132.53 ms. Across 84 Vue
plugin calls, accumulated elapsed time was about 607 ms; the profile included
187 Konsta-related transformed module URLs (including Vue/CSS subrequests).

Vite reported a consistent dependency hash and skipped re-optimization. Its
metadata already included `storybook/theming`, Vue, Vue Router, `konsta/vue`,
Storybook runtime/test modules, React and Docs dependencies. Explicitly including
these again would be redundant. Konsta's optimized entry still references Vue
source modules; an optimized entry does not imply its entire SFC graph is bundled.
Deeper SFC bundling would require a separate strategy, not merely another include
entry. No late dependency-discovery/re-optimization reload occurred in either
profile. Dependency optimization settings were therefore left unchanged.

The candidate adds only
`server.warmup.clientFiles: ['./src/tailwind.css']` in `viteFinal`, after
Storybook replaces the Vite server options. Existing watcher output exclusions
remain intact. Candidate logs show the stylesheet transformed once during
startup, finishing before the first measured preview. This candidate transform
took 7149.82 ms, including 6217.45 ms in Tailwind: warmup schedules the work
earlier, rather than making the compiler itself faster.

| Measurement | Baseline | Targeted warmup |
| --- | ---: | ---: |
| First preview after server restart, one sample | 10.352s | 5.183s |
| Warm refresh 1 | 4.029s | 3.341s |
| Warm refresh 2 | 3.883s | 3.443s |
| Warm refresh 3 | 4.436s | 3.639s |
| Mean warm refresh | 4.116s | 3.474s |
| Mean story switch, six stories visited twice | 1.458s | 1.502s |

The observed first preview was about 50% faster after the startup warmup had
completed. There is only one first-preview sample per variant, and the earlier
compilation/head start is not included in that browser-request timing. This is
not a claim of reduced total startup work or a guaranteed 50% startup reduction.
Someone opening the preview immediately when the server starts can still wait
for unfinished warmup.

Both variants' three warm-refresh windows contained **zero new module
transforms**. The smaller warm-refresh difference cannot be confidently
attributed to transform warmup, and navigation showed no meaningful improvement.
Remaining warm-load costs need browser request/runtime profiling rather than
additional broad warmup or redundant prebundle settings. The retained change is
limited to first-visit scheduling; it does not replace the more substantial
persistent-runner improvement from experiment 2.

Method: same existing in-app browser tab, Header Bar / Plain for first load and
refresh, then direct sidebar links to the same six comparison stories twice.
Category expansion was outside timed actions. Timings ran through network idle
and a temporary `afterEach` document-title completion marker, identical in both
variants. Samples are small and sequential, include browser-control/observation
overhead, and both profiling variants had debug logging enabled. This is a
workflow comparison, not a browser paint/transfer benchmark. The temporary marker
and profiling environment were removed afterward; the addon-free editing server
was recreated with the retained warmup and normal logging.

Sources: [Vite 6 performance guidance](https://v6.vite.dev/guide/performance) and
[Vite 6 server warmup](https://v6.vite.dev/config/server-options#server-warmup).
Final verification: both Text Input interaction stories passed in the fully
mocked Linux CLI light-theme project (33.37 seconds). A merged-config check
confirmed only the intended stylesheet is warmed, existing server host options
are preserved, and output-directory watcher exclusions remain effective. No
component behavior, accessibility assertion, dependency or screenshot baseline
was changed.

Receipts: `test-results/storybook-transform-experiment.json`,
`test-results/storybook-transform-baseline.log`,
`test-results/storybook-transform-baseline-summary.json`,
`test-results/storybook-transform-warm-baseline-summary.json`,
`test-results/storybook-transform-warmup.log`,
`test-results/storybook-transform-warmup-summary.json`,
`test-results/storybook-optimized-dependencies.log`, and
`test-results/storybook-warmup-editing.png`, and
`test-results/storybook-warmup-cli-test.log`.

## Experiment 1: filesystem environment comparison

Compared the existing Windows checkout through Docker's bind mount, native
Windows Node, and a genuine Linux-local ext4 checkout in the available Ubuntu
24.04 WSL2 distro. The WSL service distro initially had no Node/npm, so copies
of Node 24.21.0, npm and Linux dependencies from the existing development image
were placed only in a temporary directory. No software was installed and no
distro, service or network configuration was changed. A local Git bundle and
working-tree archive reproduced the current tracked source, including the
uncommitted Storybook changes. SHA-256 comparison found zero mismatches across
237 runtime/configuration files. Private environment files and unrelated
untracked design-system documents were not transferred.

Every case used Node 24.21.0, Storybook 10.6.3 and Vite 6.4.5 (including Vite
resolved by the Storybook builder), all providers mocked, no Vitest addon,
autoplay disabled, and the same targeted Tailwind warmup. All served 132 index
entries to the same existing browser tab at `127.0.0.1:6006`. The app/mock Docker
services remained running. Docker used its Linux dependencies volume; Windows
used its installed Windows dependencies; WSL used the copied Linux dependencies.

The Windows bind mount and first WSL case both used 500ms polling. The second
WSL case and native Windows used `CHOKIDAR_USEPOLLING=false`. This provides a
watcher control inside WSL, but the overall comparison still includes platform,
runtime-library, networking and process-launch differences; it is a practical
workflow comparison rather than a laboratory test of filesystem latency alone.

Preparation launches were excluded. Each filesystem first loaded a preview to
prepare its dependency/browser caches, then started a fresh measured process.
The WSL event case reused the prepared WSL caches in another fresh process.
Storybook's CLI was launched directly in each case; Docker's normal npm/bootstrap
wrapper was bypassed only for the benchmark. Transient port handoff failures,
the WSL launcher adjustment and the initial missing-npm failure were discarded.
Port settling was outside the startup clock. A foreground WSL client kept its
temporary process group alive; no persistent service was created.

Startup was timed automatically from launch through an HTTP process probe and
completion of `server.warmupRequest('/src/tailwind.css')`. It therefore includes
framework stylesheet readiness rather than merely the early server-ready log.
It includes each platform's launch/container/forwarding overhead, and excludes
copying sources/dependencies and tool interaction time. The subsequent first
browser load is a separate measurement after that readiness point, not total
time since launch. These two columns must not be confused with a single directly
observed end-to-end startup measurement.

| Environment / watcher | Startup through stylesheet ready | First browser load afterward | Mean warm reload | Mean story switch |
| --- | ---: | ---: | ---: | ---: |
| Docker, Windows bind mount, 500ms polling | 10.566s | 4.789s | 3.202s | 1.590s |
| Native Windows, file events | 9.205s | 2.374s | 2.054s | 1.264s |
| WSL ext4, 500ms polling | 5.689s | 2.966s | 2.624s | 1.511s |
| WSL ext4, file events | 6.602s | 3.000s | 2.453s | 1.367s |

Each case has one measured startup/first browser load, three warm reloads and
two rounds through the same six stories. The reload samples were:

- Docker: 3.559 / 2.760 / 3.288 seconds.
- Native Windows: 2.188 / 1.819 / 2.155 seconds.
- WSL polling: 2.654 / 2.474 / 2.743 seconds.
- WSL file events: 2.475 / 2.398 / 2.485 seconds.

The common browser completion proxy was network idle plus a temporary
`afterEach` title marker for the selected preview. Category expansion was
untimed. All browser timings include automation/observation overhead. Caches
were retained, samples were small and sequential, and the browser may perform
background reconnect/preload work while servers change. The measurements do not
establish a universal ranking across machines, stories or a complete test run.

Transform logs measured the initial Tailwind stylesheet at 5978.12ms through the
Windows bind mount, 3408.99ms on native Windows, 2773.71ms on WSL with polling,
and 3138.73ms on WSL with file events. The faster Linux-local startup even with
polling held constant supports a filesystem-boundary cost, while native Windows
had the best observed already-running browser interaction times.

Five-second Node-process resource samples after the story rounds:

| Case | Process CPU | Process RSS |
| --- | ---: | ---: |
| Docker bind mount | 28.0% | 875 MiB |
| Native Windows | 7.4% | 585 MiB |
| WSL polling | 27.8% | 1005 MiB |
| WSL file events, two samples | 38.2% / 23.5% | about 874 MiB |

These use the same `process.cpuUsage()` delta and `process.memoryUsage().rss`
probe across operating systems. They are process samples, not container totals,
and may include background indexing/checking/GC. Turning off Vite's polling did
not consistently eliminate WSL's background CPU cost; no CPU profile was taken
to attribute that residual work. Do not claim WSL file events solved all CPU
overhead. A separate change-detection smoke check edited only the isolated WSL
stylesheet and observed updated CSS from Vite within **46.86ms**, then restored
its exact original bytes. This measures server cache invalidation, not paint
latency, and confirms that file watching worked in that event configuration.

For this Windows checkout, native Storybook editing is the best next interactive
option observed: about **36% shorter warm reloads** and **20% shorter story
switches** than Docker's Windows bind mount. WSL is a viable alternative with
shorter startup, but it did not beat native Windows's warm browser timings or
show a consistent CPU advantage. Keep Linux for the component-test pipeline
given the previously recorded Windows optimizer-cache issues; the experiment
did not rerun or repair the full test widget in every environment.

The original Docker editing server was restored afterward, with normal logging
and provider settings. Temporary process/readiness hooks were removed; the
existing warmup and editing toggles were retained. Owned native/WSL benchmark
processes were stopped, and the temporary WSL checkout/runtime plus large copied
runtime/dependency archives were removed. No WSL installation, default workflow
migration, source branch change or component-style change was retained.

This result is consistent with Microsoft's recommendation to keep files on the
filesystem native to the tools using them: [WSL filesystem guidance](https://learn.microsoft.com/en-us/windows/wsl/filesystems).
Vite documents the watcher limitations and polling tradeoffs for Windows-mounted
WSL/Docker projects in [its server watcher guidance](https://v6.vite.dev/config/server-options#server-watch).

Receipts: `test-results/storybook-filesystem-summary.json`,
`test-results/storybook-filesystem-startup.json`,
`test-results/storybook-filesystem-browser.json`,
`test-results/storybook-filesystem-source-verification.json`,
`test-results/storybook-filesystem-docker.log`,
`test-results/storybook-filesystem-windows.log`,
`test-results/storybook-filesystem-wsl-polling.log`,
`test-results/storybook-filesystem-wsl-events.log`, and
`test-results/storybook-filesystem-final.png`. Preparation/controller scripts,
the source snapshot and copies of the temporary instrumentation are retained
under `test-results/` for local review; the large platform runtime archives are
not retained.

## Existing application-test failures

Three scenarios in `tests/ux/mobile-panels.spec.js` fail in all four Android/iPhone light/dark profiles:

- “action removal undo restores the saved action” expects a `My actions (1)` link that is absent in the current UI.
- “context previews and full sheets fit 320x568” expects a `View all areas` button that is absent.
- The same context-preview scenario at 844x390 expects that absent button.

Both distinct failure types were reproduced against an isolated copy of **unmodified HEAD `1c573de`** on port 5184 with the same Playwright version. They fail at the same missing-control locators. The source UI and these existing tests were not changed to make the checkpoint pass. Correcting their expectations or changing the design is separate work requiring the current intended behavior to be confirmed.

The checkpoint passed bookmark persistence, cross-tab synchronization, row activation separation, unavailable data/storage handling, sorting/recovery, saved-list restoration, settings/theme controls, and map camera/detail-close behavior. Existing application assertions were retained.

## Native Storybook default workflow (October 26, 2026)

Implemented separately from checkpoint PR #17 on
`refactor/native-storybook-development`. `npm run dev` / `npm run storybook`
start Docker app/mocks, then host Storybook with autoplay and the persistent
Vitest addon disabled. Public component-test commands run in Docker; existing
prepared Linux CI retains direct execution. `dev:docker` restores the complete
Docker catalog; `dev:stop` preserves data volumes.

Verified on native Windows Node 24.21.0 with an isolated Compose project
(`improvement-map-native-smoke`, app 5177, catalog 6009):

- 19 focused Node checks passed for configuration, mock persistence, story
  selection, editing exclusions, process ownership and the versioned workaround.
  The existing Storybook-only CI suite-selection contract also passed.
- Public `npm run test:storybook -- src/components/TextInput.stories.js` ran in
  the network-disabled Docker test workspace: four cases passed across both themes.
- `test:local` passed 12 Node checks and both browser smoke tests, including real
  frontend WebP upload/submission and app/catalog mock-map rendering (58.3s browser
  suite). These isolated test servers use the raw catalog command to avoid
  recursively launching the development stack.
- `test:storybook:widget` passed its selected-story interaction/accessibility
  smoke check (45.8s suite). The first attempt found the test clicking a control
  in a collapsed testing panel; explicitly expanding it fixed the interaction.
  No timeout, assertion or accessibility requirement was relaxed.
- Native catalog HTTP checks confirmed all providers mocked, three fixture
  suggestions, mock health, Overpass geometry and upload PUT/GET byte equality.
  Upload and public URLs retained the native catalog origin through both proxies.
  The index contained 132 entries. Repeated checks passed after runtime switching.
- Repeated startup reused the owned native PID. A changed-port attempt refused
  without starting another server. Native-to-Docker and Docker-to-native switches
  worked. Shutdown recovered the saved Compose project even without shell project
  overrides; isolated ports closed while original app 5173/catalog 6006 remained
  HTTP 200.
- Docker watch mode explicitly uses `--watch`, so redirected/non-interactive
  terminals do not silently perform a single run. Initial Text Input checks passed
  four cases and remained waiting for file changes. Its first cold run over this
  Windows bind mount took 111.11s; this is test-run setup, not an editing load-time
  benchmark.

Raw evidence remains ignored under `test-results/`, including
`native-hybrid-http-smoke.json` and exported Docker browser reports under
`test-results/local-development/`. No screenshot baseline or design approval
changed. The three previously documented Hidden Action Row contrast failures
remain enabled. The launcher uses portable Node APIs and Unix process groups on
macOS/Linux; manual startup and performance verification here covers Windows.


The host comment-only edit triggered a Docker watch rerun: all four cases passed
again (47.70s). The temporary edit was restored byte-for-byte after stopping the
watch container.
