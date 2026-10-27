# Storybook pilot

The public catalog publishes alongside the app at **https://map.dallasurbanists.org/storybook/** when the changed deployment workflow runs on `main`. Staging deployments also include the catalog at **https://map-staging-143738155808.web.app/storybook/**. README and app-menu links make the public catalog discoverable. PRs produce downloadable static review artifacts rather than replacing the canonical catalog.

See [pilot validation and known existing test failures](storybook-validation.md) for the initial evidence.

The catalog contains shared menus, bars, buttons, containers, forms and embeddable elements under **MENUS**, **BARS**, **BUTTONS**, **CONTAINERS**, **FORM** and **EMBEDDABLES**. **Colors** is a standalone top-level page defining principal hues, surface levels, button gradients and text roles. Component previews follow the global theme toolbar; theme cannot be overridden through component controls. Docs and stories remain with their parent component.

## Local workflow

The recommended [container workflow](../CONTRIBUTING.md) starts Storybook alongside
the app with every service mocked, including the embeddable map. Its browser tests
run inside the shared development image. Local servers can opt individual providers
into live mode; static catalog builds always force mocks and omit credentials.
See [container validation and the test-widget limitation](local-development-validation.md)
for the verified commands and current limits.

```powershell
npm ci
npm run playwright:install -- chromium webkit
npm run storybook
npm run test:storybook
npm run build:storybook
npm run test:storybook:visual
npm run build:pages
npm run test:storybook:pages
```

Storybook runs on port 6006. `node scripts/serve-storybook.js` serves the static build at `http://127.0.0.1:6007/storybook/`, exercising nested asset URLs. `npm run build:pages` builds the app, builds Storybook separately, then copies the catalog into the single Pages artifact. The existing deployment gate remains; the advisory workflow is independent.

Both app and Storybook import `src/tailwind.css` before `src/style.css` as separate
JavaScript imports. Keep ordinary CSS in `src/style.css` or component style blocks;
keep Tailwind imports, source declarations, theme tokens and `@apply` rules in
`src/tailwind.css`. Combining them makes every ordinary CSS edit recompile the
framework. Tailwind scans UI templates explicitly so edits to repository docs and
application tests do not reload the preview. New UI template locations outside the
listed sources need a corresponding `@source`. Restart the dev servers after
changing source discovery to clear their old watched dependencies. See the
[CSS update investigation](local-development-validation.md#storybook-css-update-investigation)
for measured timings and remaining limitations.

Storybook's final Vite server config warms only `src/tailwind.css`, moving its
initial framework compilation into server startup. This improves the first
preview once warmup has completed; it does not eliminate the compilation work
or promise faster warm reloads. Keep the list narrow rather than warming every
story. [Transform profiling and before/after measurements](storybook-validation.md#experiment-4-transform-profiling-and-targeted-warmup)
explain why dependency optimization settings were retained.

For the opt-in no-autoplay editing experiment, add `&editing=true` to the local
catalog URL, for example
`http://127.0.0.1:6006/?path=/story/bars-header-bar--plain&editing=true`.
The preview uses Storybook 10.6.3's embed-mode switch to skip automatic play
functions while retaining the catalog UI and manual component interactions. The
flag persists through sidebar navigation; remove it and reload to restore
playback. The Interactions panel has no steps in this mode, even if its status
says Pass. It does not validate interaction behavior. Normal URLs, production
catalogs, and the independent Vitest runner retain normal playback. This is an
experiment tied to the installed runtime's embed behavior; review on upgrade.
See [the measured comparison](storybook-validation.md#experiment-3-opt-in-no-autoplay-editing)
for its navigation benefit and remaining refresh delay.

The [filesystem comparison](storybook-validation.md#experiment-1-filesystem-environment-comparison)
found native Windows fastest for warm interactive catalog work in this checkout;
Linux-local WSL had shorter startup times. To try the measured native editing
setup in a dedicated PowerShell terminal, using the installed Node 24 runtime:

```powershell
docker compose stop storybook
$env:STORYBOOK_EDITING = 'true'
$env:DEV_FORCE_MOCKS = '1'
$env:CHOKIDAR_USEPOLLING = 'false'
npm run storybook -- --host 127.0.0.1 --ci --exact-port
```

Keep `editing=true` in the browser URL to retain the no-autoplay setting. The app
and mock services can continue in Docker. Stop the native process before
restarting the Docker Storybook service on the same port. Linux remains the
verified environment for component-test execution; earlier native Windows
multi-theme runs encountered dependency-cache locking/import errors. This is an
optional interactive workflow, not a change to the default Compose startup.
Keep the Windows bind mount's existing Docker polling setting; reliable native
events were tested on the native Windows checkout and the Linux-local WSL copy.

The separate addon-free editing experiment starts Storybook with
`STORYBOOK_EDITING=true`. This omits only `@storybook/addon-vitest`; the Component
tests widget and its persistent runner are unavailable in that server. Docs,
controls and the accessibility addon remain. Use `editing=true` in the browser
URL as well when you want to skip automatic interaction playback.

For the Docker workflow in PowerShell:

```powershell
$env:STORYBOOK_EDITING = 'true'
docker compose up -d --no-deps --no-build --pull never storybook
```

Set the variable to `'false'` and repeat the Compose command to restore the test
widget. Changing it requires recreating Storybook; the browser flag alone cannot
remove server addons. Native starts accept the same environment variable before
`npm run storybook`. The default remains the full addon set, and the independent
`npm run test:storybook` configuration retains its Vitest plugin.

The local **Component tests** widget discovers `vitest.config.js`, which supplies one browser project and uses the selected Storybook globals. Expand the widget to enable **Accessibility** alongside interactions, then choose **Run tests**. The command-line/CI scripts explicitly use `vitest.storybook.config.js` to check both light and dark projects. Those separate configurations avoid duplicate project names in the UI runner. Coverage instrumentation is optional and is not installed in this pilot; leave Coverage unchecked.

The pinned addon has an upstream IPC synchronization race. The `prestorybook`
hook applies a small backport from [upstream PR 36068](https://github.com/storybookjs/storybook/pull/36068)
to its installed dev worker. It waits for the test, status and provider stores
before starting Vitest, rather than waiting only for the test store. The hook
checks addon version 10.6.3 and expected source, is idempotent, and stops with a
review message after a dependency upgrade. Use `npm run storybook`; invoking
`storybook dev` directly after a fresh install bypasses the hook. No startup
deadline, test assertions or accessibility checks are relaxed.

`npm run test:storybook:widget` starts an isolated, fully mocked dev Storybook and
checks that a selected story completes with successful interaction and
accessibility results. Set `STORYBOOK_WIDGET_URL` to test an already-running
server, including Docker on port 6006. This is separate from static catalog tests,
which cannot exercise the dev-server widget or its child process.

## What the tests protect

Story play functions own component behavior: accessible names, keyboard operation, disabled actions, selection, emitted payloads and content. Keep layout checks when they protect use, such as a row-wide hit target, joined input/action geometry or a panel staying within the viewport. Accessibility checks remain enabled.

Do not add exact colors, radii, shadows, fonts, gradient strings or pseudo-element dimensions merely to describe the current implementation. A CSS assertion needs a documented requirement or a known defect it prevents. Keep representative token-mapping checks in Text Button and Contained Section, rather than repeating the palette in every consumer. The Colors documentation test checks its generated reference against current tokens and retains contrast requirements.

Use catalog screenshots and focused state captures to review appearance. Intentional design changes should be reviewed visually. Screenshots without approved baselines are marked `visual-review-pending`; capturing a candidate does not establish visual regression coverage. Do not replace removed style assertions with automatically approved snapshots. See the [coverage ownership ledger](test-maintenance.md#storybook-coverage-ownership) before duplicating checks across stories and browser specs.

## Find a reusable solution

All catalog entries are **Draft**, pending explicit maintainer review. The source of truth is the production component and its adjacent story.

| Need | Source | Story title | Status |
| --- | --- | --- | --- |
| Standalone square icon action with its own surface | `src/components/SquareIconButton.vue` | BUTTONS/Square Icon Button | Draft |
| Large circular icon-and-label action | `src/components/BigCircleButton.vue` | BUTTONS/Big Circle Button | Draft |
| New idea action with map-pin confirmation and cancel states | `src/components/NewIdeaSpecialButton.vue` | BUTTONS/New Idea Special Button | Draft |
| Fit-content text action with an optional leading icon | `src/components/TextButton.vue` | BUTTONS/Text Button | Draft |
| Rounded inline text label with size, palette, click and selection states | `src/components/PillText.vue` | BUTTONS/Pill text | Draft |
| Full-width, left-aligned menu action | `src/components/RowButton.vue` | BUTTONS/Row Button | Draft |
| Raw full-width text input with optional placeholder and icon | `src/components/TextInput.vue` | FORM/Text Input | Draft |
| Full-width text input joined to an icon or text action | `src/components/TextWithInlineButton.vue` | FORM/Text With Inline Button | Draft |
| Address, search and location bar composed from existing controls and result rows | `src/components/AddressBar.vue` | FORM/Address Bar | Draft |
| Modal browse list with Tab Navigation, shared surface level and bookmark actions | `src/components/BrowseList.vue` | MENUS/Browse List | Draft |
| Link-based application drawer composed from Header Bar and Menu Items | `src/components/AppMenu.vue` | MENUS/App Menu | Draft |
| Interactive Google Map with map style and rail overlay controls | `src/components/GoogleMap.vue` | EMBEDDABLES/Google Map | Draft |
| Full-width header with optional subtitle and icon actions | `src/components/HeaderBar.vue` | BARS/Header Bar | Draft |
| Full-width header-style row with optional leading symbol and icon actions | `src/components/RowItem.vue` | BARS/Row Item | Draft |
| Full-width semantic link row with optional leading symbol and independent icon actions | `src/components/MenuItem.vue` | BARS/Menu Item | Draft |
| Full-summary action row with a details dialog and independent save/hide icons | `src/components/ActionRow.vue` | BARS/Action Row | Draft |
| Fixed, swipe-dismissible stack of level-5 neutral notifications with optional actions | `src/components/ToastNotification.vue` | BARS/Toast Notification | Draft |
| Full-width, palette-themed row of shared icon or text actions | `src/components/Toolbar.vue` | BARS/Toolbar | Draft |
| Full-width, palette-themed tab bar composed from shared icon or text buttons | `src/components/Tabbar.vue` | BARS/Tabbar | Draft |
| Full-width idea summary row with thumbnail, navigation and bookmark action | `src/components/IdeaRowContent.vue` | BARS/Idea row | Draft |
| Full-height panel entering from either viewport edge | `src/components/Drawer.vue` | CONTAINERS/Drawer | Draft |
| Full-width panel entering vertically from below | `src/components/Tray.vue` | CONTAINERS/Tray | Draft |
| Full-width content section for another container | `src/components/ContainedSection.vue` | CONTAINERS/Contained Section | Draft |
| Collapsible header and content section composition | `src/components/Accordion.vue` | CONTAINERS/Accordion | Draft |
| Viewport-height floating panel with fixed header | `src/components/FloatingModal.vue` | CONTAINERS/Floating Modal | Draft |
| Surface-aware tab strip and selected content | `src/components/TabNavigation.vue` | CONTAINERS/Tab Navigation | Draft |

Reuse a pattern, then extend a documented variant if its responsibility is unchanged. Compose content with slots rather than unrelated boolean props or screen-specific overrides. New components need a clear missing responsibility. Keep props/events/slots documented in stories and source comments; preserve stable story titles and export names.

Action Row presents only the full wrapping summary, without a thumbnail or photos. A native row button opens the existing details sheet with description, instructions, source and other action details. Save and Hide are independent icon controls with hover/focus labels and native click events; the recommendation consumer owns persistence. Saved rows use the active surface. Hidden rows shown for review prefix their summary with “(Hidden action)”, use italic text and 50% opacity, and omit Save. Four states passed interactions and accessibility in both themes (8 cases) on October 25, 2026. Visual review remains `visual-review-pending`.

October 26 design decision: the maintainer confirmed that Hidden Action Row keeps
**50% opacity on the entire row**, including text and controls. Its contrast
failure remains unresolved: the current widget run passes all 105 interaction
tests and 102 of 105 accessibility checks; Recommended, Long Summary and Saved
fail contrast after Hide is activated. Checks remain enabled and failures remain
visible. This decision confirms the intended appearance without approving the
accessibility defect. See [the failure investigation](storybook-validation.md#component-test-widget-failures--october-26-2026).

Toast Notification is a fixed stack inset 8px from the top and sides, so it does not affect page layout. Notifications use the level-5 neutral surface, slide down on entry, and dismiss through their Dismiss action, a swipe in any direction, or an optional integer auto-dismiss timer. Optional links or callback actions sit beside Dismiss and leave the toast open when activated. The stories cover one toast, a three-toast stack, a five-second triggered toast and an extra View action.

Square Icon Button composes MapControlButton for native actions and adds a distinct responsibility: its own 48px square surface and icon-only label/tooltip contract. Floating uses a 4px margin, 8px corner radius and shadow; Tight removes all three. Neutral background, hover and press colors use the inherited `surfaceLevel` (default 1 when omitted); `null` makes the neutral background transparent. Active uses the active surface color at that same level when `isActive` is true. The variant control selects Neutral, Primary or Secondary from the shared app palette. Its controls are variant, icon, disabled, isActive and label; `surfaceLevel` is supplied by a parent container. The global theme toolbar sets its theme. The Pseudo states toolbar holds hover, active (press), and focus-visible (keyboard focus); deselect all for default.

Big Circle Button has one Floating story and shares the variant, icon, disabled and label controls, interaction states, shared palette, and 4px margin. Its 72px circular surface stacks the icon above a visible label; the label is also the accessible name and native tooltip. Choose Neutral, Primary or Secondary with the variant control; the default example shows List. Theme follows the global toolbar.

New Idea Special Button composes Big Circle Button and Text Button for the map's submission flow. New opens pin selection, where the main action becomes Set pin and continue and Cancel pin appears as a Text Button. Pin confirmation advances to the submission Close state; cancel returns to New. Its controls preview the three states, primary-action variant and pin-readiness flag. The app retains its map-positioned morph choreography while the component owns the three button presentations and emitted actions. Theme follows the global toolbar.

Text Button shares Square Icon Button's Floating and Tight stories, variant choices, interaction states, and spacing, radius and shadow treatments. Neutral background, hover and press colors use the inherited `surfaceLevel` (default 1 when omitted); `null` makes the neutral background transparent. Its Active story uses the Tight treatment and the active surface color selected by that same level when `isActive` is true. Its width fits the content, the label always appears, and the icon control includes a `none` option or can display the selected icon to the label's left. Its controls are variant, icon, disabled, isActive and label; `surfaceLevel` is supplied by a parent container. Theme follows the global toolbar.

Pill text is a rounded inline label with small (0.75em), regular (1em) and large (1.5em) sizes and Neutral, Primary and Secondary palette variants. Without `onclick` it renders a span; supplying the callback renders a native button. Selectable pills maintain selected state, exposed through `aria-pressed`; bind `selected` for exclusive groups. Selected pills use the active surface treatment. The global theme toolbar sets its palette. Stories show all size/variant combinations, clickable variants and independently selectable groups.

Text Input is a raw `<input type="text">` with no rendered label or wrapper. It fills the available width, accepts an optional placeholder and a decorative leading icon, and follows the shared neutral colors for its theme. Floating uses Text Button's 4px margin, 8px radius and shadow; Tight removes all three. Its controls are placeholder and icon; its stories cover both layouts. Theme follows the global toolbar.

Text With Inline Button composes Text Input with either Square Icon Button or Text Button. At least one of `buttonIcon` or `buttonText` must be supplied: an icon without text selects the square icon action; text selects Text Button, with an optional icon before its label. The joined controls have no gap; the input has square right corners, while the button has square left corners and no left border. Floating preserves 4px around the joined group and puts one shadow on its container; nested controls have no shadows. Tight removes the outer margin and shadow. Theme, variant, placeholder, input icon, button icon, button text and icon-only accessible label are editable. Stories cover Floating and Tight with each button type.

Address Bar is a floating composition of the menu Square Icon Button, Text With Inline Button and (while searching) a shadowed list of Row Items. Browsing shows the current address and changes to Searching on input focus; Searching shows place/address results with location symbols and trailing arrow actions; Viewing locks the address input and changes the trailing action to a location pin. Mode is its only Storybook control; theme follows the global toolbar. The address value synchronizes through `v-model`, mode changes emit `update:mode` and `mode-change`, menu activation emits `menu-click`, and result actions emit `select-result`.

Google Map embeds an interactive Google map centered on Dallas with road or satellite styling and the shared transit-rail overlay. The global theme toolbar sets its map theme; `style`, `railsEnabled`, integer `railsThickness`, CSS `width` and `height`, and `coverViewport` are configurable. The default size is full width by 33vh. `coverViewport` fixes it edge-to-edge behind page content and does not affect surface depth. The app supplies its Maps API key; Storybook does not bundle credentials.

Row Button reuses Text Button's Tight treatment and fills the available width with a left-aligned label and optional leading icon. Its With icon and Without icon stories show both forms. The With icon story uses a fixed icon column so labels align across rows. It keeps only a bottom border; its variant, icon, disabled and label controls match Text Button. Theme follows the global toolbar.

Header Bar is a full-width bar with a left-aligned bold label and a solid 1px bottom border. Plain shows only the label; With Subtitle adds a supporting line; With Buttons composes any number of Square Icon Buttons in Tight layout; With Buttons & Subtitle combines both. Buttons inherit the bar theme and variant unless a button item sets its own variant. Activations emit `button-click` with the selected button and its index. The global theme toolbar sets the palette; variant uses the shared palette's background, foreground and border colors. Label, subtitle, button list and `seamlessButtonEdge` are editable. `seamlessButtonEdge` defaults to false and removes the left border of the left-most button when enabled.

Row Item follows Header Bar's full-width height, typography, palette, bottom border, optional subtitle and right-side Square Icon Buttons. It adds a leading symbol selected by `symbolType`: none, emoji, icon or checkbox. Emoji and icon symbols require their corresponding `emoji` or `icon` value. Symbols sit 12px before the label/subtitle block; the checkbox is an interactive native checkbox. Button actions inherit the row theme and variant unless an item overrides the variant. With one button, its hit target fills the row and its hover, press and focus treatment spans the full row; with multiple buttons they remain distinct actions. The stories cover one-button, two-button, plain and subtitle combinations plus each of the three symbol types.

Menu Item follows Row Item's content controls and stories, with an `href` control and an anchor for its full-row link. The anchor uses Text Button's Tight, Neutral palette and interaction treatment. Optional trailing Square Icon Buttons remain independent click targets even when exactly one button is present; the link does not expand over the button. Theme, variant, label, subtitle, buttons, symbolType, emoji and icon match Row Item.

Idea row is the BARS presentation of an idea list item. It inherits the Header Bar and Row Item theme/variant palette, with a thumbnail, bold two-line summary, single-line truncated address, date/distance metadata and a separate bookmark action. A missing or broken photo uses the idea emoji as a full-size thumbnail fallback when available, and otherwise shows a camera glyph. The required `ul` parent is unstyled. `IdeaRowContent` receives an idea `item` and preformatted address/date strings; its bookmark slot receives `summaryId` for `aria-describedby`. The app-facing `IdeaRow` adapter still supplies workspace formatting and persistent bookmark behavior.

Toolbar is a full-width, palette-themed bar with a 1px bottom border, matching Header Bar. It composes the shared Square Icon Button or Text Button components, always using their Tight treatment with zero margin, corner radius and shadow. All Icon Buttons and All Text Buttons select the composition; the Buttons control edits the list of icon, label and disabled values. The global theme toolbar sets its palette; variant styles the bar and passes through to each button, and activations emit `button-click` with the selected button and its index.

Tabbar starts as a clone of Toolbar under **BARS/Tabbar**, with the same theme, variant, button list, icon/text composition, Tight treatment, and `button-click` event. Its `surfaceLevel` control selects the regular neutral button and bar colors. Clicking a button selects it and emits `button-click` with the button and its index; `selectedIndex` can be controlled by a parent. Selected buttons retain their normal neutral appearance without an active surface fill; non-selected buttons use the bar background at half brightness and white text/icons. The bar background is also displayed at half brightness.

All **CONTAINERS** components expose `surfaceLevel`, an integer from 0 (deepest) through 5 (closest to the viewer), to choose their theme's surface color. Setting it to `null` makes the surface transparent. Drawer and Tray use it for their panel backgrounds; Contained Section uses it for its background and separator; Accordion uses it for its open background and border colors; Floating Modal uses it for the modal surface and nested sections. Tab Navigation uses the neutral surface at that level for its root background and selected section; the root background is displayed at half brightness. Tab buttons retain Text Button's shared colors, with active surface fill disabled.

Drawer is a full-height, up-to-320px panel with stories anchored to the left or right edge. `fromDirection` selects the entering edge. Its stories compose the existing Header Bar With Buttons at the top, with one `xmark` action that closes the drawer, then accept application content through the default slot. **Menu drawer** shows the left-side menu composition, using any number of Row Buttons with icon, label, disabled and optional variant values; edit the list in its `menuItems` control. `open` controls its position. `canDragClose` and `canDragOpen` independently enable the handle for closing and opening; dragging snaps to the nearer endpoint, while a quick flick chooses by direction. The 12px-wide handle sits just beyond the bordered edge; its 6px grip spans half the drawer height and fades from 50% opacity to 80% on hover and 100% while dragging. The grip is white except in the light-theme, closed, openable state, where it is black for contrast. A closed drawer moves fully off-screen; its handle remains visible only when `canDragOpen` is enabled. When open, a 36% black scrim with 4px backdrop blur covers underlying content, with the drawer and handle layered above it. Closed content is inert, and reduced-motion preferences disable transitions.

App Menu composes Drawer from the left, a plain Header Bar labeled “Idea Map” with a close action, and five Menu Items: Saved ideas, Saved actions, Welcome guide, What's new, and Map settings.

Tray follows the same theme and blurred-backdrop behavior as Drawer, but spans the viewport width and slides vertically from below. Content is split into the `head` slot (one Header Bar, Tabbar or Toolbar row) and the default slot body. The head stays fixed at the top while the body scrolls. It has closed, medium and maximum positions: `mediumHeight` sets the open height that leaves space above a scrollable tray, `maxHeight` sets the height used when `maximize` is true, and `open` controls whether it is closed. If head and body content fit within `mediumHeight`, the tray shrinks to fit, cannot maximize, and the handle only closes/reopens it at that fitted height. Tray recalculates overflow as content and viewport dimensions change. Drag release snaps to the nearest allowed position; a quick flick advances one position in its direction. `canDragClose` and `canDragOpen` control which direction the handle can move. Its With Header story composes Header Bar with a close action and six paragraphs; Short Body shows the fit-content case; With Toolbar composes the shared Toolbar with navigation, save and close actions. Toolbar buttons retain only their left separators, except the first button; the toolbar has its own bottom border. The horizontal drag handle sits above the top border while open and stays at the viewport's bottom edge when closed only if `canDragOpen` is enabled. Reduced-motion preferences disable transitions.

Contained Section is a full-width content region for use inside a larger container. Its `surfaceLevel` selects the background and separator color. Its `padded` control adds 12px interior spacing, and its HTML `content` is provided by the parent. It draws a 1px bottom border unless it is the last child in its container. Stories show the padded and unpadded treatments.

Accordion composes a tight Square Icon Button caret, a Header Bar without its bottom border, and a Contained Section. Its caret has no border and a transparent background, rotating right-to-down as the section opens. The component has top and bottom borders; `surfaceLevel` selects the open background and border colors. Its background is transparent while closed or locked, and transitions as it opens. The contained section grows and shrinks with a height transition. The `locked` control prevents toggling and mutes the caret without disabling independent header actions. Header Bar settings are supplied through the `header` configuration, and an optional `headerTextButton` adds an independently clickable Text Button. Body content can be supplied through the default slot for composed application UI, or through the HTML `content` prop for simple markup. Stories cover simple, slotted, and Text Button header content plus both locked cases.

Floating Modal has two viewport form factors: `tall` leaves 64px above the panel and caps its width at 1024px; `full` uses an 8px inset on every edge. `position` controls the horizontal alignment of the tall form. `blocking` adds a dark blurred backdrop, prevents pointer interaction outside the dialog, traps keyboard focus inside, and restores focus when closed. The fixed Header Bar always includes Close. Optional `headerButtons` entries use `{ type: 'text' | 'icon', ...buttonProps }` to render Tight Text Buttons or Square Icon Buttons before Close; `header-button-click` reports `{ button, index }`. Optional `footerButtons` are Tight, neutral Text Buttons in equal-width columns below the independently scrolling body; `footer-button-click` reports `{ button, index }`. A supplemental `footer` slot supports fixed content such as the welcome preference above the button row. Escape closes the modal; `backdrop-click` lets a consumer opt into backdrop dismissal. The modal surface comes from `surfaceLevel`. The default slot is its scrolling body, and exposed `content` and `element` refs support consumer scroll/focus restoration. Attributes and classes apply to the dialog section; its viewport layer provides a single transition root. Blocking focus is suspended while a newer blocking modal or native modal dialog is active, and deactivated cached views release their focus trap. Stories show tall centered non-blocking, full blocking with footer actions, and full blocking with header and footer actions.

The main app reuses Floating Modal for these panels, preserving their route, storage and action behavior. Visual review remains `visual-review-pending`.

| Panel | Form factor | Position | Blocking |
| --- | --- | --- | --- |
| Saved ideas | Tall | Left | No |
| Saved actions | Tall | Left | No |
| Welcome guide | Full | Center | Yes |
| What's new | Tall | Center | Yes |
| Map settings | Tall | Center | Yes |
| Style settings | Tall | Center | Yes |
| Attach photos | Tall | Center | Yes |

Migration validation on October 25, 2026: the production build passed; all three [Floating Modal stories](../src/components/FloatingModal.stories.js) passed in light and dark themes (six cases). Focused desktop checks passed for [the migration](../tests/floatingModalMigration.spec.js), announcements and photo editing (14 cases including saved-list scroll restoration, remove/undo and nested action details); the four configuration/navigation checks also passed on Mobile Chrome. Candidate captures for all seven panels are in `test-results/floating-modal-desktop/` and `test-results/floating-modal-mobile/`; mobile photo, style and welcome layouts were inspected. These remain `visual-review-pending` for maintainer approval.

Tab Navigation is a full-width column containing a Tabbar and a selected Contained Section. The root background and section use the neutral surface at the inherited `surfaceLevel`; the root background is displayed at half brightness. Tabbar controls selection, with non-selected buttons using its half-brightness bar fill and white foreground. A bottom rule spans the Tabbar; the selected button's bottom border matches the section surface to visually connect them. Setting the level to `null` keeps the component backgrounds transparent. Its `tabs` entries provide an id, label and HTML content. The `padded` control sets spacing on the selected Contained Section. The `selectedIndex` model lets the parent control selection, and `tab-change` reports the selected tab and index. Left/Right Arrow and Home/End provide keyboard tab navigation. Stories demonstrate surface levels 1, 2 and 3.

`BookmarkButton` and `IdeaRow` retain their app contracts, including bookmark event arguments and workspace formatters. Storybook-only aliases replace bookmark and scroll-storage services with resettable memory implementations; the app builder never loads those aliases.

## Approval and current conventions

### Honest component previews

All stories default to fullscreen. Under **Components**, render the production component directly: no decorative surface, layout wrapper, width constraint, margin, padding, radius, shadow, caption or helper button added by the story. Component-owned layout and styling remain visible, including tray clearances and modal backdrops. Use toolbar backgrounds, grid, outline, theme and viewport tools to change review conditions.

The Konsta provider is renderless. The existing preview body supplies the production map-control tokens, with its own border, radius, shadow, padding and surface removed. No extra theme container is rendered. An Idea row requires a semantic `ul` parent; its `idea-list` host has zero margin/padding and no surface. Slot examples supply plain text or the necessary icon content, without added spacing or decoration. Closed/empty components may correctly show nothing.

Positioned and teleported panels use isolated Docs iframes so their own viewport behavior does not cover the documentation page. Record any future required semantic host in the component contract and keep reusable compositions in the relevant component group.

Draft means documented for review. Approved means a maintainer reviewed intended use, interactions, accessibility and screenshots, with an issue/PR reference recorded in this index. Deprecated entries name the replacement and remain available while consumers migrate. Update the story status tag and this index together: `tags: ['!draft', 'approved']` removes the inherited Draft tag when approving. Tests passing never automatically promotes a pattern.

The pilot preserves existing appearance and behavior. Current body text uses the Tailwind sans stack, map controls explicitly use Roboto, and editable fields use Courier New. Earlier README claims about Inter/DM Serif do not describe the implementation. The catalog reads existing semantic map-control and text-input variables; no new visual system is imposed.

Record questionable behavior or conflicting design expectations as `needs-intent-confirmation` with evidence before changing it. Do not change screenshot baselines to conceal failures.

## Tests and advisory enforcement

The new workflow is advisory at job and test-step level, and is not a deployment dependency. Failures, missing reports and pending baselines remain visible in summaries/artifacts. Local commands return nonzero for failures and must be inspected.

| Layer | Responsibilities |
| --- | --- |
| Story interaction/a11y | Both themes: states, events, disabled controls, toggles, pagination, modal keyboard/focus, automated accessibility |
| Built catalog/visual | Selected stories at narrow/desktop light/dark; local assets/fonts, nested URLs, storage/GPS isolation; targeted WebKit dialog behavior |
| App journeys | Real sorting, GPS/recovery, map lifecycle, routing/history, persistence/undo, opener/scroll restoration, integrated layout/themes |

No app assertions are removed in this rollout. Before removing one, document its replacement and demonstrate equivalent coverage; retain integration coverage.

| Existing assertion | Replacement story/assertion | Evidence and decision |
| --- | --- | --- |
| None migrated yet | Pilot only | Existing app coverage retained |

`npm run storybook:select` selects affected story files using the project branch comparison policy; pass an explicit base as an argument if needed. `node scripts/test-storybook-selected.js` runs that selection. Static browser tests honor it with `STORYBOOK_SELECTED=1`. Transitive imports select consumer stories; shared CSS/assets/config/dependencies invalidate all. Unknown, deleted or dynamic dependencies fall back to all. The app selector independently selects consumer journeys and excludes story-only paths. Weekly/manual Storybook runs select everything.

Reviewed baselines belong in `tests/storybook/snapshots/<platform>/<project>/`. Missing baselines produce attached candidates and `visual-review-pending`; a successful render is not a completed visual comparison. CI uses Linux and lockfile-pinned Playwright. Review candidates, record the decision, then commit chosen Linux baselines. Windows candidates are separate. Baseline updates are never automatic.

## Optional local MCP

The running local server exposes `http://localhost:6006/mcp`. Connect it with the agent client's supported project configuration. This change does not modify personal/global agent settings. MCP/manifests remain preview features. Prefer targeted documentation lookup and affected-story tests; fall back to the index/source/stories if unavailable. Vue docgen generates development manifests on demand: use MCP/debugger locally, or `storybook-static/manifests/*.json` after a build. GitHub Pages hosts static files, not a live MCP server.

## Publishing and isolation

Dedicated Storybook Vite configuration uses local Roboto fonts and intentional assets, excluding app PWA/release/404 plugins, the app entry point and environment-file directory. Relative assets support custom-domain and GitHub project paths. The app-menu link derives from `BASE_URL`.

The app builds before Storybook is copied into `dist/storybook`; Workbox excludes catalog files/navigation. App/CNAME and catalog upload as one Pages artifact from one commit. Component checks remain advisory; publishing requires successful builds and existing critical app tests.

Next adoption areas: submission forms/feedback, recommendations, photos, then presentation UI. Track reuse, correction rounds, comparable agent token usage, selected-test counts/runtime, and unresolved design decisions before expanding enforcement.

October 25 representative and selection fixes: Square Icon Button bookmark icons use an outline when inactive and a filled icon when active; active surfaces persist during hover. Pill text selected fills persist after the pointer leaves. The [Bookmark story](../src/components/SquareIconButton.stories.js) and [Selectable pill story](../src/components/PillText.stories.js) cover these interactions. Focused component checks passed in light and dark (18 cases); [app journeys](../tests/mapWorkspace.spec.js) passed for representative save persistence, contacts, theme backgrounds, muted jurisdictions, retry and navigation (2 cases). Live Idea tray inspection confirmed opaque contact menus and actual contact values with truncated website labels. Visual review remains `visual-review-pending`; no screenshot baselines were approved.
