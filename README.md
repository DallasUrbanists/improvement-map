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
- **Step 1: Describe** — Required Summary and Details/Impact fields with validation.
- **Step 2: Locate** — Embedded Google Maps SDK with draggable Google Maps marker, Streets (`ROADMAP`) & Satellite view toggle, Google Maps address search autocomplete, GPS recenter button, and optional "Describe location" modal.
- **Step 3: Photo** — Client-side HTML5 Canvas resizing to WebP format, support for device photo library and camera capture for up to 10 photos with optional captions.
- **Step 4: Review & Submit** — Detailed summary with subheadings and "Edit" links for each step, author name & email validation, and direct-to-cloud submission.
- **Submission in Progress State** — Full-screen modal replacing navbar, beforeunload prevention, animated progress bar, dynamic status text, and green checkmark / error handling states.

### 3. Browse Page (`/browse`)
- **Map View**: Full viewport Google Map with native Google Maps markers for all suggestions, Streets & Satellite view switchers, search bar overlay with Google address autocomplete, and popups containing summary, photo thumbnail, and "View suggestion" link.
- **List View**: Suggestion cards sorted by distance from user's current GPS location (closest first via Turf.js) or newest first if GPS permission is pending.

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
```bash
npm install
```

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
