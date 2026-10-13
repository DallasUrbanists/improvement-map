# Dallas Urbanists Improvement Map

A touch-friendly, mobile-first **Progressive Web App (PWA)** built for pedestrians, cyclists, and transit users to submit on-the-ground civic improvement suggestions and explore existing community feedback.

Hosted on **GitHub Pages**: [https://dallasurbanists.github.io/improvement-map/](https://dallasurbanists.github.io/improvement-map/)

---

## 🌟 Tech Stack & Architecture

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
- **Live Activity Log**: Displays the most recent civic suggestions submitted by advocates.
- **30-Second Polling**: Automatically refreshes in near real-time as new submissions are posted.

### 2. Submit Page (`/submit`)
A wizard-style multi-step form with persistent `localStorage` draft saving:
- **Step 1: Describe** — Required description with automatic resizing, speech-to-text recording, and grammar/clarity assistance.
- **Step 2: Locate** — Embedded Google Maps SDK with draggable Google Maps marker, Streets (`ROADMAP`) & Satellite view toggle, Google Maps address search autocomplete, GPS recenter button, and optional "Describe location" modal.
- **Step 3: Photo** — Client-side HTML5 Canvas resizing to WebP format, support for device photo library and camera capture for up to 10 photos with optional captions.
- **Step 4: Review & Submit** — Detailed summary with subheadings and "Edit" links for each step, author name & email validation, and direct-to-cloud submission.
- **Submission in Progress State** — Full-screen modal replacing navbar, beforeunload prevention, animated progress bar, dynamic status text, and green checkmark / error handling states.

### 3. Browse Page (`/browse`)
- **Map View**: Full viewport Google Map with native Google Maps markers for all suggestions, Streets & Satellite view switchers, search bar overlay with Google address autocomplete, and popups containing summary, photo thumbnail, and "View suggestion" link.
- **List View**: Suggestion cards sorted by distance from user's current GPS location (closest first via Turf.js) or newest first if GPS permission is pending.

### Temporary location-diagram proof of concept (`/test`)

Open `/test` to preview a standalone, square SVG centered on **32.78145881782909, -96.7994967769097**. The procedural renderer labels only the three nearest distinct named streets by segment distance, but draws every street intersecting the square, including unnamed streets and Main Street. It preserves north-up layout, simplifies paths, adds a crosshair, and optionally draws building footprints. Street labels are centered directly on their street paths, aligned to the segment angle; candidate anchors move along the street to avoid pins, markers, edges, and other labels rather than offsetting text beside the street.

Rail shapes and colors come exclusively from the supplied [local rail GeoJSON catalog](./src/data/rails), not OSM railway geometry or route shape memberships. [railCatalog.js](./src/services/railCatalog.js) discovers every `.geojson` file with a Vite glob, loads it once in the lazy test-route chunk, and normalizes `LineString`/`MultiLineString` coordinates in longitude/latitude order. Route identity, agency, color, and provenance come from the GeoJSON properties. The nine supplied services include four DART light-rail lines, M-Line, Dallas Streetcar, TRE, A-train, and TEXRail. Services absent from this catalog (such as Amtrak) are not drawn, although their stop logos can still appear.

Only segment bounds intersecting each viewport are projected. Direction/trip duplicates and overlapping variants are combined, with memberships resolved along shared corridor intervals before assigning parallel lanes. All four DART Red, Green, Blue, and Orange services appear at the original location; their colors now match the supplied files. Only services intersecting the square appear in its legend. Offsets represent services, not literal track spacing. The page includes 96px and 160px previews, an OpenStreetMap comparison link, and an SVG download. Replace/add GeoJSON files to refresh the catalog on the next build. Pure rendering callers must supply the preloaded `railCatalog` option; there is deliberately no fallback to API-derived rail shapes.

Rail polylines use bounded quadratic corner rounding, retaining their exact endpoints. At detected trunk/branch junctions, the trunk's lane ordering is determined by branch geometry so branch service groups remain adjacent. Branch endpoints and approach tangents align with the matching trunk lanes. For the West End example, the trunk order is Green/Orange/Blue/Red, matching its Green+Orange and Blue+Red branches.

Transit stops use the corresponding agency logos from [public/icons/transit_logos](./public/icons/transit_logos). Stop network/operator tags take precedence, with route and mode-specific stop-area memberships used when agency metadata is absent. Nearby duplicate rail station/platform groups are combined, retaining the most significant multi-agency representative (Victory DART+TRE and Cityplace DART+M-Line). Groups sharing an OSM stop area or normalized station identity within 80 meters combine their modes and agency sets; adjacent bus/rail stops with unrelated identities are not merged merely because their badges overlap. Close duplicate rail groups within 30 meters sharing an agency also consolidate. B/R/B+R badges distinguish bus, rail, and combined stations. Bachman and Hebron are combined B+R examples. Badges avoid the pin and street labels where possible; leader lines indicate displaced positions. The expanded icon set supports Amtrak, DART, DCTA, FlixBus, Greyhound, M-Line/MATA, RedCoach, STAR Transit, TRE, Trinity Metro, and Vonlane. Location 6's FlixBus Dallas Market Center and location 7's Greyhound/Flixbus Station now receive FlixBus and Greyhound logos respectively. Stops without a matching supplied logo still receive neutral BUS/RAIL badges, never guessed logos. The original example includes DART logos at the Elm bus stop and Akard station.

Footer labels come from the [verified administrative-boundary lookups](./src/data/test-location-boundaries.json), selecting the smallest containing OSM `boundary=administrative` polygon, not the nearest place or a guessed neighborhood. OSM classifications here include Downtown PID, West End Historic District, Uptown PID, Dallas, and Lewisville (the last pin is in Lewisville despite its internal fixture ID). Containment was discovered in October and checked against June-snapshot polygon geometry; this agreement and the snapshot limitation are documented per record with queries, relation IDs, and geometry hashes. No boundary network lookup runs in the browser. The renderer accepts a verified boundary only when its recorded coordinates exactly match the pin; unavailable/mismatched records display 'Administrative area unavailable'. The not-for-navigation notice remains in accessible SVG descriptions.

The [embedded logo cache](./src/data/transitAgencyLogos.js) preserves all eleven supplied agency artworks, including external SVG references and STAR Transit's PNG. Linked SVG artwork is inlined and the PNG is embedded as a data URI; the original public icons are not modified. Downloaded diagrams use SVG symbols rather than remote artwork requests and work offline. Regenerate the cache after icon changes with `python scripts/update_transit_logos.py` (Python standard library only; requires network access to the linked Wikimedia artwork). The updater validates source hosts, limits downloads/nesting, rejects scripts/event handlers/external unembedded links, and namespaces SVG IDs. Logos identify agencies and do not imply endorsement.

The attributed [original OSM fixture](./src/data/test-location-osm.json), [first seven additional location fixtures](./src/data/additional-test-locations-osm.json), and [ten new location fixtures](./src/data/extra-test-locations-osm.json) provide eighteen pinned-location examples. Source URLs and capture dates are included. They contain street/building geometry, bus/rail stop nodes and platform centroids, stop-only route memberships, and stop areas. API-derived railway way geometry and geometry-only route memberships have been removed; they are no longer needed for rail drawing. Future targeted geometry requests need only streets/buildings, stops, and agency hints, not rail shapes. The gallery renders every requested coordinate in order with adaptive coverage, a map comparison link, and an SVG download. The final example is centered on **32.76352725600037, -96.78637914756813**. The [new boundary lookups](./src/data/extra-test-location-boundaries.json) supply containing administrative labels verified against current October geometry for all ten new examples. Lookup completeness is still limited by the OSM/Overpass administrative-area index. Map data is © OpenStreetMap contributors under [ODbL](https://www.openstreetmap.org/copyright). These snapshots require no live geometry requests or credentials, may contain incomplete/outdated stop metadata, and are not intended for navigation. Attribution appears inside downloads and alongside the previews. The lazy-loaded test route does not change submission, Browse thumbnails, or cloud storage. Production integration would require geometry acquisition, generation retries, storage, and thumbnail fallback handling.

Focused validation: `npx playwright test 'locationDiagram.spec.js|transitStops.spec.js|railGeometry.spec.js|extraLocations.spec.js'`. Tests cover all eighteen coordinates, GeoJSON parsing and source colors, reversed/duplicate route shapes, crossing segments whose endpoints are outside the viewport, independence from API rail geometry, rounded corners, trunk/branch ordering and exact joins, verified boundary labels, all eleven agency logo mappings, station deduplication and mode merging, offline previews/downloads, and raster-pixel checks that the DART logos actually render.

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
