# Storybook pilot

The public catalog publishes alongside the app at **https://map.dallasurbanists.org/storybook/** when the changed deployment workflow runs on `main`. README and app-menu links make it discoverable. PRs produce downloadable static review artifacts rather than replacing the canonical catalog.

See [pilot validation and known existing test failures](storybook-validation.md) for the initial evidence.

The earlier pilot catalog lives under **REFERENCE**: Start here, Foundations, Components, Patterns and Screens. Shared bars, buttons, containers and forms live under **BARS**, **BUTTONS**, **CONTAINERS** and **FORM**. **Colors** is a standalone top-level page defining principal hues, surface levels, button gradients and text roles. Its light/dark documentation sections use matching surfaces; raw component previews retain their existing presentation. Docs and stories remain with their parent component. Reference URLs retain their prefix (for example, `?path=/docs/reference-start-here--docs`).

## Local workflow

```powershell
npm ci
npx playwright install chromium webkit
npm run storybook
npm run test:storybook
npm run build-storybook
npm run test:storybook:visual
npm run build:pages
npm run test:storybook:pages
```

Storybook runs on port 6006. `npm run storybook:serve` serves the static build at `http://127.0.0.1:6007/storybook/`, exercising nested asset URLs. `npm run build:pages` builds the app, builds Storybook separately, then copies the catalog into the single Pages artifact. The existing deployment gate remains; the advisory workflow is independent.

The local **Component tests** widget discovers `vitest.config.js`, which supplies one browser project and uses the selected Storybook globals. Expand the widget to enable **Accessibility** alongside interactions, then choose **Run tests**. The command-line/CI scripts explicitly use `vitest.storybook.config.js` to check both light and dark projects. Those separate configurations avoid duplicate project names in the UI runner. Coverage instrumentation is optional and is not installed in this pilot; leave Coverage unchecked.

## Find a reusable solution

All pilot entries are **Draft**, pending explicit maintainer review. The source of truth is the production component and its adjacent story. Start here in the catalog supplies the same task-oriented navigation.

| Need | Source | Story title | Status |
| --- | --- | --- | --- |
| Standalone square icon action with its own surface | `src/components/SquareIconButton.vue` | BUTTONS/Square Icon Button | Draft |
| Large circular icon-and-label action | `src/components/BigCircleButton.vue` | BUTTONS/Big Circle Button | Draft |
| New idea action with map-pin confirmation and cancel states | `src/components/NewIdeaSpecialButton.vue` | BUTTONS/New Idea Special Button | Draft |
| Fit-content text action with an optional leading icon | `src/components/TextButton.vue` | BUTTONS/Text Button | Draft |
| Full-width, left-aligned menu action | `src/components/RowButton.vue` | BUTTONS/Row Button | Draft |
| Raw full-width text input with optional placeholder and icon | `src/components/TextInput.vue` | FORM/Text Input | Draft |
| Full-width text input joined to an icon or text action | `src/components/TextWithInlineButton.vue` | FORM/Text With Inline Button | Draft |
| Address, search and location bar composed from existing controls and result rows | `src/components/AddressBar.vue` | FORM/Address Bar | Draft |
| Full-width header with optional subtitle and icon actions | `src/components/HeaderBar.vue` | BARS/Header Bar | Draft |
| Full-width header-style row with optional leading symbol and icon actions | `src/components/RowItem.vue` | BARS/Row Item | Draft |
| Full-width, palette-themed row of shared icon or text actions | `src/components/Toolbar.vue` | BARS/Toolbar | Draft |
| Full-width idea summary row with thumbnail, navigation and bookmark action | `src/components/IdeaRowContent.vue` | BARS/Idea row | Draft |
| Full-height panel entering from either viewport edge | `src/components/Drawer.vue` | CONTAINERS/Drawer | Draft |
| Full-width panel entering vertically from below | `src/components/Tray.vue` | CONTAINERS/Tray | Draft |
| Full-width content section for another container | `src/components/ContainedSection.vue` | CONTAINERS/Contained Section | Draft |
| Collapsible header and content section composition | `src/components/Accordion.vue` | CONTAINERS/Accordion | Draft |
| Viewport-height floating panel with fixed header | `src/components/FloatingModal.vue` | CONTAINERS/Floating Modal | Draft |
| Surface-aware tab strip and selected content | `src/components/TabNavigation.vue` | CONTAINERS/Tab Navigation | Draft |
| Map-surface action/toggle | `src/components/MapControlButton.vue` | REFERENCE/Components/Controls/Map control button | Draft |
| Stateless bookmarking | `src/components/BookmarkToggle.vue` | REFERENCE/Components/Controls/Bookmark toggle | Draft |
| Nonmodal workspace panel | `src/components/MapTray.vue` | REFERENCE/Components/Panels/Map tray | Draft |
| Modal details | `src/components/DetailSheet.vue` | REFERENCE/Components/Panels/Detail sheet | Draft |
| Previous/next item | `src/components/AlbumPaginator.vue` | REFERENCE/Components/Navigation/Album paginator | Draft |
| Complete Browse list | `src/views/BrowseView.vue` | REFERENCE/Screens/Browse/List | Draft |

Reuse a pattern, then extend a documented variant if its responsibility is unchanged. Compose content with slots rather than unrelated boolean props or screen-specific overrides. New components need a clear missing responsibility. Keep props/events/slots documented in stories and source comments; preserve stable story titles and export names.

Square Icon Button composes MapControlButton for native actions and adds a distinct responsibility: its own 48px square surface and icon-only label/tooltip contract. Floating uses a 4px margin, 8px corner radius and shadow; Tight removes all three. Active is a Tight button state that uses the active surface color at its inherited `surfaceLevel` (default 1) when `isActive` is true; hover and focus feedback remain available without replacing that background. The variant control selects Neutral, Primary or Secondary from the shared app palette. Its controls are theme, variant, icon, disabled, isActive and label; `surfaceLevel` is supplied by a parent container. An unset theme follows the theme toolbar. The Pseudo states toolbar holds hover, active (press), and focus-visible (keyboard focus); deselect all for default.

Big Circle Button has one Floating story and shares the theme, variant, icon, disabled and label controls, interaction states, shared palette, and 4px margin. Its 72px circular surface stacks the icon above a visible label; the label is also the accessible name and native tooltip. Choose Neutral, Primary or Secondary with the variant control; the default example shows List.

New Idea Special Button composes Big Circle Button and Text Button for the map's submission flow. New opens pin selection, where the main action becomes Set pin and continue and Cancel pin appears as a Text Button. Pin confirmation advances to the submission Close state; cancel returns to New. Its controls preview the three states, theme, primary-action variant and pin-readiness flag. The app retains its map-positioned morph choreography while the component owns the three button presentations and emitted actions.

Text Button shares Square Icon Button's Floating and Tight stories, theme and variant choices, interaction states, and spacing, radius and shadow treatments. Its Active story uses the Tight treatment and the active surface color selected by inherited `surfaceLevel` when `isActive` is true. Its width fits the content, the label always appears, and the icon control includes a `none` option or can display the selected icon to the label's left. Its controls are theme, variant, icon, disabled, isActive and label; `surfaceLevel` is supplied by a parent container.

Text Input is a raw `<input type="text">` with no rendered label or wrapper. It fills the available width, accepts an optional placeholder and a decorative leading icon, and follows the shared neutral colors for its theme. Floating uses Text Button's 4px margin, 8px radius and shadow; Tight removes all three. Its controls are theme, placeholder and icon; its stories cover both layouts.

Text With Inline Button composes Text Input with either Square Icon Button or Text Button. At least one of `buttonIcon` or `buttonText` must be supplied: an icon without text selects the square icon action; text selects Text Button, with an optional icon before its label. The joined controls have no gap; the input has square right corners, while the button has square left corners and no left border. Floating preserves 4px around the joined group and puts one shadow on its container; nested controls have no shadows. Tight removes the outer margin and shadow. Theme, variant, placeholder, input icon, button icon, button text and icon-only accessible label are editable. Stories cover Floating and Tight with each button type.

Address Bar is a floating composition of the menu Square Icon Button, Text With Inline Button and (while searching) a shadowed list of Row Items. Browsing shows the current address and changes to Searching on input focus; Searching shows place/address results with location symbols and trailing arrow actions; Viewing locks the address input and changes the trailing action to a location pin. Theme and mode are the only Storybook controls. The address value synchronizes through `v-model`, mode changes emit `update:mode` and `mode-change`, menu activation emits `menu-click`, and result actions emit `select-result`.

Row Button reuses Text Button's Tight treatment and fills the available width with a left-aligned label and optional leading icon. Its With icon and Without icon stories show both forms. The With icon story uses a fixed icon column so labels align across rows. It keeps only a bottom border; its theme, variant, icon, disabled and label controls match Text Button.

Header Bar is a full-width bar with a left-aligned bold label and a solid 1px bottom border. Plain shows only the label; With Subtitle adds a supporting line; With Buttons composes any number of Square Icon Buttons in Tight layout; With Buttons & Subtitle combines both. Buttons inherit the bar theme and variant unless a button item sets its own variant. Activations emit `button-click` with the selected button and its index. Theme and variant use the shared palette's background, foreground and border colors; label, subtitle and button list are editable.

Row Item follows Header Bar's full-width height, typography, palette, bottom border, optional subtitle and right-side Square Icon Buttons. It adds a leading symbol selected by `symbolType`: none, emoji, icon or checkbox. Emoji and icon symbols require their corresponding `emoji` or `icon` value. Symbols sit 12px before the label/subtitle block; the checkbox is an interactive native checkbox. Button actions inherit the row theme and variant unless an item overrides the variant. With one button, its hit target fills the row and its hover, press and focus treatment spans the full row; with multiple buttons they remain distinct actions. The stories cover one-button, two-button, plain and subtitle combinations plus each of the three symbol types.

Idea row is the BARS presentation of an idea list item. It inherits the Header Bar and Row Item theme/variant palette, with a thumbnail, bold two-line summary, single-line truncated address, date/distance metadata and a separate bookmark action. A missing or broken photo uses the idea emoji as a full-size thumbnail fallback when available, and otherwise shows a camera glyph. The required `ul` parent is unstyled. `IdeaRowContent` receives an idea `item` and preformatted address/date strings; its bookmark slot receives `summaryId` for `aria-describedby`. The app-facing `IdeaRow` adapter still supplies workspace formatting and persistent bookmark behavior.

Toolbar is a full-width, palette-themed bar with a 1px bottom border, matching Header Bar. It composes the shared Square Icon Button or Text Button components, always using their Tight treatment with zero margin, corner radius and shadow. All Icon Buttons and All Text Buttons select the composition; the Buttons control edits the list of icon, label and disabled values. Theme and variant style the bar and pass through to each button, and activations emit `button-click` with the selected button and its index.

All **CONTAINERS** components expose `surfaceLevel`, an integer from 0 (deepest) through 5 (closest to the viewer), to choose their theme's surface color. Setting it to `null` makes the surface transparent. Drawer and Tray use it for their panel backgrounds; Contained Section uses it for its background and separator; Accordion uses it for its open background and border colors; Floating Modal uses it for the modal surface and nested sections. Tab Navigation keeps its root transparent and applies the active surface at that level to its selected tab and section.

Drawer is a full-height, up-to-320px panel with stories anchored to the left or right edge. Its stories compose the existing Header Bar With Buttons at the top, with one `xmark` action that closes the drawer, then accept application content through the default slot. **Menu drawer** shows the left-side menu composition, using any number of Row Buttons with icon, label, disabled and optional variant values; edit the list in its `menuItems` control. `open` controls its position. `canDragClose` and `canDragOpen` independently enable the handle for closing and opening; dragging snaps to the nearer endpoint, while a quick flick chooses by direction. The 12px-wide handle sits just beyond the bordered edge; its 6px grip spans half the drawer height and fades from 50% opacity to 80% on hover and 100% while dragging. The grip is white except in the light-theme, closed, openable state, where it is black for contrast. A closed drawer moves fully off-screen; its handle remains visible only when `canDragOpen` is enabled. When open, a 36% black scrim with 4px backdrop blur covers underlying content, with the drawer and handle layered above it. Closed content is inert, and reduced-motion preferences disable transitions.

Tray follows the same theme and blurred-backdrop behavior as Drawer, but spans the viewport width and slides vertically from below. It has closed, medium and maximum positions: `mediumHeight` sets the open height that leaves space above, `maxHeight` sets the height used when `maximize` is true, and `open` controls whether it is closed. Drag release snaps to the nearest allowed position; a quick flick advances one position in its direction. `canDragClose` and `canDragOpen` control which direction the handle can move. Its With Header story composes Header Bar with a close action; With Toolbar composes the shared Toolbar with navigation, save and close actions. Toolbar buttons retain only their left separators, except the first button; the toolbar has its own bottom border. The horizontal drag handle sits above the top border while open and stays at the viewport's bottom edge when closed only if `canDragOpen` is enabled. Reduced-motion preferences disable transitions.

Contained Section is a full-width content region for use inside a larger container. Its `surfaceLevel` selects the background and separator color. Its `padded` control adds 12px interior spacing, and its HTML `content` is provided by the parent. It draws a 1px bottom border unless it is the last child in its container. Stories show the padded and unpadded treatments.

Accordion composes a tight Square Icon Button caret, a Header Bar without its bottom border, and a Contained Section. Its caret has no border and a transparent background, rotating right-to-down as the section opens. The component has top and bottom borders; `surfaceLevel` selects the open background and border colors. Its background is transparent while closed or locked, and transitions as it opens. The contained section grows and shrinks with a height transition. The `locked` control prevents toggling and mutes the caret without disabling independent header actions. Header Bar settings are supplied through the `header` configuration, and an optional `headerTextButton` adds an independently clickable Text Button. Stories cover a simple header, a header Text Button, and both locked cases.

Floating Modal is a full-height, 4px-inset panel with an 8px radius, shadow, and a fixed Header Bar containing a close action. Its `surfaceLevel` selects the modal surface. Its column content region grows to fill the remaining height and scrolls independently. Any number of padded Contained Sections can be provided through the default slot. The component defaults closed; stories open it and demonstrate centered, left, and right positioning. Its controls are `surfaceLevel`, `open` and `position`.

Tab Navigation is a transparent full-width column containing a borderless Toolbar and a selected Contained Section. The Toolbar uses Tight neutral Text Buttons; their `isActive` state and the selected section share the active surface color at the inherited `surfaceLevel`. Its `tabs` entries provide an id, label, HTML content and optional padding. The `selectedIndex` model lets the parent control selection, and `tab-change` reports the selected tab and index. Left/Right Arrow and Home/End provide keyboard tab navigation. Stories demonstrate surface levels 1, 2 and 3.

`BookmarkButton` and `IdeaRow` retain their app contracts, including bookmark event arguments and workspace formatters. Their inner presentation is reusable without persistence. Browse stories render the real view with a fixture workspace. Storybook-only aliases replace bookmark and scroll-storage services with resettable memory implementations; the app builder never loads those aliases.

## Approval and current conventions

### Honest component previews

All stories default to fullscreen. Under **Components**, render the production component directly: no decorative surface, layout wrapper, width constraint, margin, padding, radius, shadow, caption or helper button added by the story. Component-owned layout and styling remain visible, including tray clearances and modal backdrops. Use toolbar backgrounds, grid, outline, theme and viewport tools to change review conditions.

The Konsta provider is renderless. The existing preview body supplies the production map-control tokens, with its own border, radius, shadow, padding and surface removed. No extra theme container is rendered. An Idea row requires a semantic `ul` parent; its `idea-list` host has zero margin/padding and no surface. Slot examples supply plain text or the necessary icon content, without added spacing or decoration. Closed/empty components may correctly show nothing.

Opener/focus-restoration examples live under **Patterns → Detail sheet with opener**, separate from the raw sheet. Foundations is a reference document, and REFERENCE/Screens/Browse is an explicitly documented screen fixture. Positioned/teleported panels use isolated Docs iframes so their own viewport behavior does not cover the documentation page. Record any future required semantic host in the component contract; put application compositions and helper controls under Patterns or Screens.

Draft means documented for review. Approved means a maintainer reviewed intended use, interactions, accessibility and screenshots, with an issue/PR reference recorded in this index. Deprecated entries name the replacement and remain available while consumers migrate. Update the story status tag and this index together: `tags: ['!draft', 'approved']` removes the inherited Draft tag when approving. Tests passing never automatically promotes a pattern.

The pilot preserves existing appearance and behavior. Current body text uses the Tailwind sans stack, map controls explicitly use Roboto, and editable fields use Courier New. Earlier README claims about Inter/DM Serif do not describe the implementation. The catalog reads existing semantic map-control and text-input variables; no new visual system is imposed.

Map tray's enabled, scrollable content is a keyboard Tab stop, including when its slot contains only text. Its focus-visible outline uses the existing control text token and stays inside the scroll area. Busy/inert and fixed-content modes do not add a content Tab stop. The Long Content and Fixed Content stories cover these states; built-catalog keyboard checks verify actual scrolling in Chromium and WebKit.

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

`npm run storybook:select` selects affected story files against the merge base with `origin/main`; pass a different base as an argument if needed. `node scripts/test-storybook-selected.js` runs that selection. Static browser tests honor it with `STORYBOOK_SELECTED=1`. Transitive imports select consumer stories; shared CSS/assets/config/dependencies invalidate all. Unknown, deleted or dynamic dependencies fall back to all. The app selector independently selects consumer journeys and excludes story-only paths. Weekly/manual Storybook runs select everything.

Reviewed baselines belong in `tests/storybook/snapshots/<platform>/<project>/`. Missing baselines produce attached candidates and `visual-review-pending`; a successful render is not a completed visual comparison. CI uses Linux and lockfile-pinned Playwright. Review candidates, record the decision, then commit chosen Linux baselines. Windows candidates are separate. Baseline updates are never automatic.

## Optional local MCP

The running local server exposes `http://localhost:6006/mcp`. Connect it with the agent client's supported project configuration. This change does not modify personal/global agent settings. MCP/manifests remain preview features. Prefer targeted documentation lookup and affected-story tests; fall back to the index/source/stories if unavailable. Vue docgen generates development manifests on demand: use MCP/debugger locally, or `storybook-static/manifests/*.json` after a build. GitHub Pages hosts static files, not a live MCP server.

## Publishing and isolation

Dedicated Storybook Vite configuration uses local Roboto fonts and intentional assets, excluding app PWA/release/404 plugins, the app entry point and environment-file directory. Relative assets support custom-domain and GitHub project paths. The app-menu link derives from `BASE_URL`.

The app builds before Storybook is copied into `dist/storybook`; Workbox excludes catalog files/navigation. App/CNAME and catalog upload as one Pages artifact from one commit. Component checks remain advisory; publishing requires successful builds and existing critical app tests.

Next adoption areas: submission forms/feedback, recommendations, photos, then presentation UI. Track reuse, correction rounds, comparable agent token usage, selected-test counts/runtime, and unresolved design decisions before expanding enforcement.
