# Dallas Urbanists Improvement Map

A touch-friendly, mobile-first **Progressive Web App (PWA)** built for pedestrians, cyclists, and transit users to submit on-the-ground civic improvement suggestions and explore existing community feedback.

Hosted on **GitHub Pages**: [https://dallasurbanists.github.io/improvement-map/](https://dallasurbanists.github.io/improvement-map/)

---

## 🌟 Tech Stack & Architecture

### Submission UI preview (development)

On `/submit` in the Vite development server, press **Ctrl+Alt+Enter** to preview the submission loading screen for six seconds, followed by the success screen. This makes no submission or upload requests and preserves the draft. Press **Escape** to cancel, or choose **Back to submission** after completion. Adjust `SUBMISSION_PREVIEW_DURATION_MS` in `src/views/SubmitView.vue` to change the timer. The shortcut is disabled in production builds.

- **Framework**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) + [Vue Router 4](https://router.vuejs.org/)
- **Bundler & PWA Engine**: [Vite](https://vitejs.dev/) + `vite-plugin-pwa` (Workbox Service Worker caching)
- **Styling & Design System**: [Tailwind CSS](https://tailwindcss.com/) adhering to the [Strong Towns Brand Guidelines](https://www.strongtowns.org/resources/brand) (Dark Blue `#0c2340`, Light Blue `#488BE3`, Yellow `#ffa800`, Sidewalk `#f5f3ee`, Inter & DM Serif Display typefaces)
- **Theme**: High-contrast Dark Mode (default) with persistent Light Mode toggle
- **Geospatial & Distance Sorting**: [Turf.js](https://turfjs.org/) (`@turf/turf`) for high-precision spherical distance calculation between user coordinates and suggestions
- **Maps & Geocoding**: Official [Google Maps JavaScript SDK](https://developers.google.com/maps/documentation/javascript) for map embedding, native Google Maps markers, theme-adaptive Streets (`ROADMAP`) basemap (dark/night in dark mode, light/day in light mode) with Satellite toggle, and Google Maps Places / Geocoding API for address search autocomplete and reverse geocoding
- **Iconography**: [FontAwesome 6](https://fontawesome.com/)
- **Testing**: [Playwright](https://playwright.dev/) automated end-to-end regression test suite
- **Backend API**: [Dallas Urbanists Cloud API](http://api.dallasurbanists.org/swagger) (Cloud Run + Express + Firestore `public-improvements` database)

---

## 📱 Core Pages & User Experience

### 1. Home Page (`/`)
- **Persistent map workspace**: One Google Map stays mounted across Browse, submission details, and Submit. The list, details, and later Submit steps appear in trays with 12px side margins, 72px top clearance, and 88px bottom clearance. Search and the floating toolbar stay accessible; the map is dimmed and blurred behind trays.
- **Navigation**: `/?view=map` and `/?view=list` support browser history. Details restore the originating viewport and list scroll on close. `/test` remains a separate proof-of-concept page.

### 2. Submit Page (`/submit`)
A wizard-style multi-step form with persistent `localStorage` draft saving:
- **Step 1: Locate** — Select the pin location on the shared map, with address autocomplete and GPS recentering.
- **Step 2: Photo** — Client-side HTML5 Canvas resizing to WebP format, support for device photo library and camera capture for up to 10 photos with optional captions.
- **Step 3: Describe** — Required description with automatic resizing, speech-to-text recording, and grammar/clarity assistance.
- **Step 4: Review & Submit** — Detailed summary with subheadings and "Edit" links for each step, author name & email validation, and direct-to-cloud submission.
- **Submission in Progress State** — Full-screen modal replacing navbar, beforeunload prevention, animated progress bar, dynamic status text, and green checkmark / error handling states.
- **Tray behavior** — Steps 2–4 lock the address bar to the selected location. Closing a tray preserves the draft; Submit resumes its saved step. Location summaries use the shared map rather than creating embedded maps.

### 3. Browse Page (`/browse`)
- **Map View**: Full viewport Google Map with native Google Maps markers for all suggestions, Streets & Satellite view switchers, search bar overlay with Google address autocomplete, and popups containing summary, photo thumbnail, and "View suggestion" link.
- **List View**: Suggestion cards sorted by distance from user's current GPS location (closest first via Turf.js) or newest first if GPS permission is pending.

### Temporary location-diagram proof of concept (`/test`)

Live diagrams use `https://overpass.openstreetmap.fr/api/interpreter` with `https://overpass.private.coffee/api/interpreter` as fallback. Vite proxies both providers during development and identifies the project with a User-Agent header. If a provider explicitly reports a missing administrative-area database, acquisition retries without area lookup; street, building, and stop geometry still loads, and the page reports that boundary labels are unavailable. The actual query and area-index availability are recorded in acquisition provenance. Other malformed or incomplete responses continue to fail explicitly.

Open `/test` to preview a standalone, square SVG initially centered on **32.78145881782909, -96.7994967769097**. The top coordinate form accepts a decimal `latitude, longitude` string and generates a custom preview from live OSM/Overpass street, building, transit-stop, and administrative-area data. Requests are made only after selecting **Generate diagram**; the entered coordinates are sent to public providers. Loading progress, cancellation, input validation, provider errors, and **Reset example** are supported. A failed or canceled request retains the previous preview, and late responses cannot overwrite it. The custom preview updates the comparison link, SVG download, building toggle, and legends without replacing the nineteen saved gallery cards. Nothing is uploaded or persisted. Rail geometry still comes exclusively from the local catalog. Live administrative containment uses the provider's generated-area index, not the independent polygon checks recorded for saved examples. Live queries start at a 400m square half-width and expand to cover the renderer's adaptive viewport, with at most five rounds and a 3km half-width safety limit. Oversized or unavailable extracts fail explicitly instead of silently omitting viewport geometry. Requests have a 25-second timeout and the generation attempt a 90-second overall limit; public-provider availability and data completeness are not guaranteed. The procedural renderer targets the four nearest distinct named non-service streets by segment distance, but draws every street intersecting the square, including service/access roads, unnamed streets, and Main Street. Service-road segments are excluded from both label candidates and distance ranking, even when they share a name with a regular road. Extracts containing only ineligible roads still render at the minimum 240m coverage without street labels. It preserves north-up layout, simplifies paths, adds a crosshair, and optionally draws building footprints. Street labels follow rendered road curves using embedded SVG text paths where possible. The closest street's label remains fully inside the frame; labels for the second through fourth streets may partially clip at the edge rather than being omitted. The closest label is placed first (with bounded font reduction when necessary); bus badges avoid its protected glyph boxes. Remaining label positions avoid the crosshair, badges, and earlier labels. Streets use subtly rounded corners and a monochrome palette, with no white casing on any street or crosshair; minor roads such as alleys, driveways, and paths are thinner, lighter, and uncased (1.5px, `#bcbcbc`). Parking aisles (`highway=service`, `service=parking_aisle`) and highway ramps (`motorway_link` through `tertiary_link`) are extra-light, extra-thin, and uncased (0.75px, `#d6d6d6`). Saved fixtures retain restored OSM service subtypes and query provenance; ways without a subtype are not guessed to be parking aisles. Nearby parallel carriageways of the same named road/class are collapsed to a single median path at 7px weight (regular streets remain 3px), including Harry Hines, Market Center, East Colorado, and divided Routh segments. Interstate/freeway mainlines (`highway=motorway`) and regular roads tagged `expressway=yes` or named Expressway/Expy (including North Good-Latimer Expressway) use the minor-road gray (`#bcbcbc`) at 14px—twice the merged big-road weight—without casing. Expressway-name matching excludes ramps and service/access roads. Their ramps retain the extra-light 0.75px styling. Matching is local to overlapping sections, with ordinary tails retained and connected to the median; labels anchor to the rendered median. Conservative source-topology cleanup removes tiny dead-end branches relative to their parent road/trail, preserving standalone paths, cul-de-sacs, real connections, and paths continuing outside the thumbnail/acquired area. Recorded source-query and compaction bounds constrain pruning; if trustworthy acquisition bounds are unavailable, pruning is disabled rather than inferring coverage from full-way extents. Short same-road sections bracketed by aligned divided-road endpoints inherit the big-road weight, avoiding brief narrow breaks at intersections. Short triangular transition fans and intersection-sized median gaps are centered after consolidation: spread endpoints and connected road ends meet the median, duplicate fan legs/bases are removed, and nearby outer tips are projected onto aligned centerlines. The Colorado/Beckley junction in location 15 is a regression example. Cleanup is bounded to short, same-grade road connections and excludes minor roads, ramps, roundabouts, and protected-bike connector bases. Available direction/layer/bridge/tunnel tags prevent incompatible merges. Older compact extracts lack directional metadata, so matching falls back to a geometric heuristic: sustained parallel overlap within 12° and 3–30m separation. Minor roads, roundabouts, links, and explicitly two-way roads are excluded. Off-street bicycle-designated trails and on-street tracks/lanes with explicit physical-protection tags render green at regular-street line weight. Ordinary/shared/buffer-only on-street lanes are not highlighted; bicycle/access prohibitions are respected.

Rail shapes and colors come exclusively from the supplied [local rail GeoJSON catalog](./src/data/rails), not OSM railway geometry or route shape memberships. [railCatalog.js](./src/services/railCatalog.js) discovers every `.geojson` file with a Vite glob, loads it once in the lazy test-route chunk, and normalizes `LineString`/`MultiLineString` coordinates in longitude/latitude order. Route identity, agency, color, and provenance come from the GeoJSON properties. The ten supplied services include DART Red, Blue, Green, Orange, and Silver, M-Line, Dallas Streetcar, TRE, A-train, and TEXRail. Services absent from this catalog (such as Amtrak) are not drawn, although their stop logos can still appear.

Only segment bounds intersecting each viewport are projected. Direction/trip duplicates and overlapping variants are combined, with memberships resolved along shared corridor intervals before assigning parallel lanes. All four DART Red, Green, Blue, and Orange services appear at the original location; their colors now match the supplied files. Only services intersecting the square appear in its legend. Offsets represent services, not literal track spacing. The page includes 96px and 160px previews, an OpenStreetMap comparison link, and an SVG download. Replace/add GeoJSON files to refresh the catalog on the next build. Pure rendering callers must supply the preloaded `railCatalog` option; there is deliberately no fallback to API-derived rail shapes.

Rail polylines use bounded quadratic corner rounding, retaining their exact endpoints. All 4.5px colored rail paths have matching 8.5px white casing underneath them; casings render together before the colors so shared-track services remain visible. At detected trunk/branch junctions, the trunk's lane ordering is determined by branch geometry so branch service groups remain adjacent. Branch endpoints and approach tangents align with the matching trunk lanes. For the West End example, the trunk order is Green/Orange/Blue/Red, matching its Green+Orange and Blue+Red branches. A geographically scoped [junction fixture](./src/services/railJunctionFixtures.js) smooths the final offset-lane curves at location 2 while preserving lane endpoints/order. Blue Line GeoJSON is corrected in both directions to use the Red Line's alignment between EBJ Union and 8th & Corinth; geometry outside that section and source metadata are retained.

Transit stops use the corresponding agency logos from [public/icons/transit_logos](./public/icons/transit_logos). Stop network/operator tags take precedence, with route and mode-specific stop-area memberships used when agency metadata is absent. Nearby duplicate rail station/platform groups are combined, retaining the most significant multi-agency representative (Victory DART+TRE and Cityplace DART+M-Line). Groups sharing an OSM stop area or normalized station identity within 80 meters combine their modes and agency sets; adjacent bus/rail stops with unrelated identities are not merged merely because their badges overlap. Close duplicate rail groups within 30 meters sharing an agency also consolidate. Complementary bus-stop pairs with compatible agency and street/cross-street identities consolidate before badge placement. Their actual midpoint is projected onto the rendered shared-road centerline, while unrelated or same-side stops remain distinct. B/R/B+R badges distinguish bus, rail, and combined stations. Bachman and Hebron are combined B+R examples. Badges avoid the pin and street labels where possible; leader lines indicate displaced positions. The expanded icon set supports Amtrak, DART, DCTA, FlixBus, Greyhound, M-Line/MATA, RedCoach, STAR Transit, TRE, Trinity Metro, and Vonlane. Location 6's FlixBus Dallas Market Center and location 7's Greyhound/Flixbus Station now receive FlixBus and Greyhound logos respectively. Stops without a matching supplied logo still receive neutral BUS/RAIL badges, never guessed logos. The original example includes DART logos at the Elm bus stop and Akard station.

Footer labels combine all available containing OSM administrative areas from the [verified administrative-boundary lookups](./src/data/test-location-boundaries.json), ordered by descending administrative level (most specific first). The nearest visible named street intersection or actual transit-stop position is prepended, whichever is closer to the pin; an intersection-first label also includes the nearest visible rail station. With neither present, the nearest visible street name is used. Intersection detection requires shared source-geometry vertices, excludes differing layers/bridge/tunnel tags, and rejects simple two-arm bends/name changes; it does not treat an unconnected geometric crossing as an intersection. Intersection names omit road types (for example, `Boll & McKinney`), while standalone street names retain abbreviated types. US states use two-letter postal codes (`Texas` → `TX`) and `United States` becomes `USA`. The comma-separated label is ellipsis-truncated on the bottom row, with the full text retained in an SVG title. Attribution is right-aligned on the row above it, without a background panel. OSM classifications here include Downtown PID, West End Historic District, Uptown PID, Dallas, and Lewisville (the last pin is in Lewisville despite its internal fixture ID). Containment was discovered in October and checked against June-snapshot polygon geometry; this agreement and the snapshot limitation are documented per record with queries, relation IDs, and geometry hashes. No boundary network lookup runs in the browser. The renderer accepts a verified boundary only when its recorded coordinates exactly match the pin; unavailable/mismatched records display 'Administrative area unavailable'. The not-for-navigation notice remains in accessible SVG descriptions.

The [embedded logo cache](./src/data/transitAgencyLogos.js) preserves all eleven supplied agency artworks, including external SVG references and STAR Transit's PNG. Linked SVG artwork is inlined and the PNG is embedded as a data URI; the original public icons are not modified. Downloaded diagrams use SVG symbols rather than remote artwork requests and work offline. Regenerate the cache after icon changes with `python scripts/update_transit_logos.py` (Python standard library only; requires network access to the linked Wikimedia artwork). The updater validates source hosts, limits downloads/nesting, rejects scripts/event handlers/external unembedded links, and namespaces SVG IDs. Logos identify agencies and do not imply endorsement.

The attributed [original OSM fixture](./src/data/test-location-osm.json), [first seven additional location fixtures](./src/data/additional-test-locations-osm.json), and [ten new location fixtures](./src/data/extra-test-locations-osm.json) provide eighteen original pinned-location examples. The [Arts District](./src/data/arts-district-test-location.json) and [downtown](./src/data/downtown-test-location.json) extracts add two more, inserted as Locations 3 and 4 immediately after the original Location 2. Their public-provider acquisitions include streets, buildings, and transit stops, with recorded queries and timestamps; the provider had no administrative-area index, so their boundary labels are unavailable. Source URLs and capture dates are included. They contain street/building geometry, bus/rail stop nodes and platform centroids, stop-only route memberships, and stop areas. API-derived rail-only way geometry and geometry-only route memberships have been removed; they are no longer needed for rail drawing. Bicycle trails converted from abandoned railways may retain their genuine OSM railway tags alongside highway/bicycle tags, but those tags do not supply transit shapes. Future targeted geometry requests need only streets/buildings, stops, and agency hints, not rail shapes. The gallery renders every requested coordinate in order with adaptive coverage, a map comparison link, and an SVG download. The final example is centered on **32.76352725600037, -96.78637914756813**. The [new boundary lookups](./src/data/extra-test-location-boundaries.json) supply containing administrative labels verified against current October geometry for all ten new examples. Lookup completeness is still limited by the OSM/Overpass administrative-area index. Map data is © OpenStreetMap contributors under [ODbL](https://www.openstreetmap.org/copyright). These snapshots require no live geometry requests or credentials, may contain incomplete/outdated stop metadata, and are not intended for navigation. Attribution appears inside downloads and alongside the previews. The lazy-loaded test route does not change submission, Browse thumbnails, or cloud storage. The five saved OSM extract collections are emitted as separate build chunks so each stays below the PWA precache file-size limit without raising that limit. Production integration would require geometry acquisition, generation retries, storage, and thumbnail fallback handling.

Focused validation: `npx playwright test 'locationDiagram.spec.js|transitStops.spec.js|railGeometry.spec.js|extraLocations.spec.js|diagramStyle.spec.js|blueAlignment.spec.js|railJunctionFixtures.spec.js|dividedStreets.spec.js|liveLocationData.spec.js|customDiagram.spec.js|roadVisualCleanup.spec.js|streetLabels.spec.js|pairedBusStops.spec.js'`. Tests cover all eighteen coordinates, GeoJSON parsing and source colors, reversed/duplicate route shapes, crossing segments whose endpoints are outside the viewport, independence from API rail geometry, rounded corners, trunk/branch ordering and exact joins, verified boundary labels, all eleven agency logo mappings, station deduplication and mode merging, offline previews/downloads, and raster-pixel checks that the DART logos actually render.

### 4. View Submission Page (`/suggestion/:id`)
- Displays full submission details, author name, timestamp, location with Google Maps deep-link, and lightbox photo gallery.

---

## ⚡ Performance & Caching Optimizations

- **PWA Service Worker**: Static asset precaching and runtime caching for Google Maps scripts, Google Fonts, and API responses.
- **API Client Caching**: In-memory caching with 25s TTL for suggestions to minimize redundant network I/O.
- **Client-Side Image Compression**: Automatic canvas compression to max $1920 \times 1080$ WebP before direct upload to Google Cloud Storage via signed PUT URLs.

---

## 🚀 Local Development & Testing

### 1. Install Dependencies
Use Node.js 24.12.0 or newer (required by Firebase); CI uses Node.js 24.

```bash
npm ci
```

#### Dependency security
Run `npm audit` after dependency updates. CI also runs `npm audit --audit-level=high` before building to block known high/critical vulnerabilities.

Firebase's Firestore dependency currently requests the vulnerable `@grpc/grpc-js` 1.9.x series. A scoped override in [package.json](./package.json) pins it to patched version 1.13.6, addressing [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) while retaining the compatible proto-loader 0.7 dependency family. Keep [package-lock.json](./package-lock.json) committed so clean installs reproduce the fix. Remove the override only after Firebase uses a patched version itself, then rerun the audit, build, and tests. Avoid repeated `npm audit fix --force`: it may downgrade Firebase without fixing its upstream dependency constraint.

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Production Build
```bash
npm run build
```
Generates production PWA files in the `dist/` directory.

### 4. Run Automated Playwright Tests
```bash
# Run regression tests across Desktop and Mobile viewports
npm test

# Run tests in UI mode
npx playwright test --ui
```

### Speech recording reliability

Recording uses the browser's Web Speech API. Recognition starts directly from the Record click and requests microphone permission itself, without separately opening and releasing another microphone stream. Previously denied permission must still be reset in browser settings.

- The controls distinguish starting, listening, and stopping. The initial startup shows **Cancel recording**; automatic restarts after a pause show **Please wait** until listening resumes. Either startup can still be cancelled by clicking the button; a missing start callback times out after 15 seconds. A stalled Stop is force-aborted after 1.5 seconds, and a listening session with no transcript updates ends after 30 seconds.
- Android uses short recognition sessions rather than continuous mode. Completed sessions restart after 750 ms while recording remains requested, with limits of two consecutive empty-session retries and ten restarts per minute. Permission, network, and no-speech errors stop rather than retrying indefinitely.
- Final results are retained once per session/result index; provisional text is replaced as recognition evolves. Deliberately repeated words are preserved. Editing is temporarily read-only during recording to avoid overwriting manual changes.
- Leaving Submit, moving to another step, hiding the page, or cancelling invalidates pending callbacks and stops recognition. Displayed text remains in the saved draft. Native recognition still depends on device/browser services; use the keyboard's microphone when unavailable.
- Console debug entries prefixed `[speech-recognition]` include only timestamps, session IDs, event names, and error codes—not source text, transcripts, or audio. The controller also keeps the last 100 diagnostic entries in memory. Browser recognition may use a remote transcription service; this app does not store audio.

Focused regressions:

```powershell
npx playwright test 'speechRecognition.spec.js|e2e.spec.js' -g speech
```

Playwright's mobile project emulates a viewport; it does not exercise Android's microphone or speech service. Before releasing recording changes, test actual Android Chrome devices and desktop Edge over HTTPS (or localhost on desktop): allow/deny permission, cancel while starting, dictate several sentences with pauses, intentionally repeat words, stop/restart rapidly, switch tabs/routes, and test loss of connectivity. Confirm the microphone stops, the UI recovers, results do not accumulate duplicates, and long transcripts still resize/scroll correctly. Capture only the diagnostic event entries when investigating device failures.

---

## 📡 API Endpoints Used

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public-improvements/suggestions` | Retrieves public civic improvement suggestions. |
| `GET` | `/api/public-improvements/suggestions/:id` | Retrieves a single suggestion record by ID. |
| `POST` | `/api/public-improvements/suggestions/upload-url` | Generates a V4 Signed PUT URL for direct photo uploads. |
| `POST` | `/api/public-improvements/suggestions` | Creates a new civic suggestion in Firestore. |

---

## 📄 License

Open-source under the Dallas Urbanists community initiative.


The `/test` renderer selector defaults to **Version Two** and applies to the main diagram and every gallery card. **Current** remains available for the full label, stop-badge, and contextual-footer rendering. Version Two follows source rail curves and keeps service lanes continuous through equivalent route variants; paths are combined only when they share both endpoint nodes and stay within 3 meters, retaining the more detailed shape. It uses a 1.91:1 landscape frame. Construction, corridor, and motorway paths are hidden by default; the test page provides path-type visibility controls.

New submissions generate their first image with Version Two (`src/services/locationDiagramVersionTwo.js`) and upload it as an SVG before any user photos. Submission Details sets Open Graph and Twitter share metadata from the submission's first image URL, summary, and details, restoring prior metadata when leaving the view. These tags are set in the browser: the current static GitHub Pages deployment does not serve submission-specific metadata in the initial HTML. Social crawlers that do not execute JavaScript need a server-rendered or prerendered share page; services that do not accept SVG preview images also need a raster preview.

Google Maps instances in the shared map workspace and location previews also display the local rail catalog through `googleMapsRailOverlay.js`. A noninteractive SVG in Google's overlay pane uses the same source curves, service colors, collective white casing, and junction alignment as Version Two. The full network is cached for up to four zoom scales; pans reposition the geographic viewport without changing rail topology. Google's projection supplies the screen coordinates, with fixed pixel stroke widths and service spacing. These maps remain flat and north-up. Overlay placement updates synchronously with Google Maps draw callbacks to avoid drag-release flicker when the map rebases its panes. Map disposal removes the overlay, camera listeners, and resize observer. This layer uses local data and makes no rail geometry requests.

DART lane ordering follows shared endpoint topology through bends and service splits/rejoins. Nearby station variants for Orange and Blue use the corresponding Green or Red corridor when the complete variant stays within 35 meters, retaining reference vertices and reconnecting adjoining endpoints. The downtown trunk is green, orange, red, blue from north to south. `railServiceOverrides.js` omits the nonregular Orange branch from Pearl/Arts District to Buckner from displayed geometry and station memberships, preserving Green service and regular Orange service elsewhere. The Orange service override is applied at catalog load time.

The TEXRail GeoJSON has a documented geometry correction east of Texan Trail: its approach follows OSM track ways 762734178, 340450022, 457745480, and 702181423, then joins the Silver Line at `[-97.05599, 32.93571]`. Both TEXRail directions reuse Silver's 42 airport vertices through DFW Terminal B, producing 41 shared graph edges and interlined rendering. The feature's `shape_corrections` records the source timestamp, OSM attribution/license, and shared-shape reference; route and stop metadata are retained.

The Orange GeoJSON reuses Green's exact 100-vertex path from the Bachman junction through Victory in all four shape parts. Its two northern-service parts and both Blue directions also reuse Red's exact 72-vertex path from Pearl/Arts District through SMU/Mockingbird, ending just north of the station where Blue branches northeast. These corrections remove differing intermediate vertices along known shared track, allowing the catalog to identify 99 Green/Orange edges and 71 Orange/Red/Blue edges directly. Reference vertices, route metadata, and stop coordinates are retained; `shape_corrections` in each edited feature documents the reference and boundaries.

Further source normalization extends Green/Orange's common path from the Bachman junction through Pearl/Arts District (132 vertices), using Red's downtown vertices so all four services share the exact West End–Pearl trunk. Red and Orange's northern-service shapes share Red part 0 from the West End junction through Parker Road terminus (221 vertices), including both directions. Blue already matches Red from the shared approach to 8th & Corinth through Pearl and SMU/Mockingbird (178 vertices); that file needs no further geometry changes. The common West End–Mockingbird section has 91 vertices for Blue, Orange, and Red. Green, Orange, and Red feature corrections record these extensions; stop metadata and connections beyond the corridor boundaries are retained.

A-train's two direction shapes use the western station-area alignment from source part 0 through North Carrollton/Frankford to Trinity Mills. Part 1 reuses its exact 29 vertices from the last common source point at `[-96.986414, 33.047261]` to the common terminal at `[-96.926596, 32.980827]`, removing the alternate eastern trace. This correction is independent of Green Line geometry; the rest of A-train's shapes and its stop metadata are retained.

TRE's two direction shapes reuse TEXRail's exact 39 vertices southwest of the Fort Worth junction at `[-97.32199, 32.757394]` through Fort Worth Central to TEXRail's T&P endpoint at `[-97.328558, 32.745401]`. These 38 shared edges produce interlined geometry while TRE's separate eastern approach and station metadata are retained. The TRE feature's `shape_corrections` records the reference and replacement boundary.

Silver Line's Alma Road–CityLine/Bush section uses one visually traced construction-corridor curve in both directions (191 vertices), replacing the diagonal shortcut and inconsistent west-end vertices. Existing anchors at `[-96.71655, 33.00342]` and `[-96.70366, 33.001109]` retain connections to the surrounding network. The feature's `shape_corrections` records the satellite-view reference, visual control points, and interpolation method. This is an approximate cartographic trace of visible construction, not a surveyed alignment; station metadata is retained.
