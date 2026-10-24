# Contributing locally

Start UI work in Storybook, then verify the component in the application.
Ordinary contribution branches start from **staging**; hotfixes start from main.

## First-time setup

Install Git and Docker Desktop (Linux containers/WSL2 on Windows), or Docker Engine
with Compose **2.24 or newer** on Linux. Use any editor. Node, npm, Chromium,
WebKit, and browser system libraries run inside containers.

While online:

```sh
git clone --branch staging https://github.com/DallasUrbanists/improvement-map.git
cd improvement-map
docker compose --profile tools build
docker compose up -d --no-build --pull never
```

Open the [app](http://localhost:5173) and [Storybook](http://localhost:6006).
All services default to **mock**. No API keys, Firebase account, `.env` editing,
Java, or cloud tools are required. The first start copies Linux dependencies into
service-specific volumes; allow a few minutes.

See `docker compose logs -f web storybook mock` and the
[dependency status](http://localhost:5173/__dev). Servers read only optional
`.env.development.local`, never legacy `.env` or `.env.local` configuration.

The starter sandbox includes three synthetic suggestions, local photos, fixture
address search (try **Dallas**, **Elm**, or **Main**), interactive recorded Elm Street
geometry, mock GPS/speech, text assistance, and persisted submissions/uploads.
Clustering and satellite imagery are simulated; outside fixture coverage the map
is not a real basemap. Data is synthetic; OSM geometry retains its attribution.

This first milestone provides the shared environment and starter mocks. Full
OpenAPI validation, rich recommendation/civic fixtures, account simulation,
Streetmix generation, and presentation HTTP/socket workflows remain follow-up
work. Unimplemented endpoints fail explicitly without live fallback. Presentation
stays disabled; no login UI is added.

## Daily development

After preparation, the same `docker compose up` command works without internet.
If Node/npm is already installed on your host, the default command is a shortcut
for starting the same app, Storybook and mock containers together:

```sh
npm run dev
```

It runs `docker compose up --no-build --pull never`: it never starts a native
server, installs packages, or pulls images. All dependencies default to mocks;
only explicit per-service live settings in `.env.development.local` opt into
providers. Build the shared image once using the first-time instructions above.
Node/npm on the host remains optional; the direct Compose command works with Git
and Docker alone. Pass `-- -d` to the npm command to run in the background.

Source edits hot-reload in both servers. Ctrl+C stops a foreground run. Stop a
background run with `docker compose down`; mock suggestions and uploads survive
restart. Reset suggestions with:

```sh
docker compose exec mock npm run mock:reset
```

After editing the mock server or its seed data, run `docker compose restart mock`.

Refresh afterward. Reset preserves uploaded files and unrelated browser storage;
clear drafts/bookmarks separately if desired. To explicitly erase all project
volumes, including uploads and dependency copies, use `docker compose down --volumes`.
Rebuild images online when dependencies change, then recreate containers. Startup
checks the lockfile and never installs packages.

## Work in Storybook

Read [the component index](docs/storybook.md), inspect the production component
and adjacent story's props/events/slots, and reuse existing components first.
Review controls, themes, keyboard interactions, viewport and pseudo states.
Use the commands below for reliable interaction/accessibility checks with the
container's Chromium. The pinned Storybook 10.6.3 Component tests widget has an
intermittent [upstream startup race](https://github.com/storybookjs/storybook/issues/35864);
it can crash or remain at Starting. Restart Storybook with
`docker compose restart storybook` and use the CLI when that happens. Coverage is
not installed. No vendor patch or relaxed assertions are applied.

```sh
docker compose run --rm --pull never test npm run test:storybook -- src/components/Tabbar.stories.js
docker compose run --rm --pull never test npm run test:feature -- browse
docker compose run --rm --pull never test npm run test:local
```

The test service has no external network and uses an isolated source copy. Reports
are exported under `test-results/local-development/`. `test:local` owns its servers
and forces mocks regardless of personal overrides. Designs remain Draft, CI stays
advisory, and screenshot candidates stay `visual-review-pending` until reviewed.

For dependent build/check commands, use one invocation so build outputs survive:

```sh
docker compose run --rm test sh -c "npm run build-storybook && npm run test:storybook:visual"
docker compose run --rm test sh -c "npm run build:pages && npm run test:storybook:pages"
```

Static catalog builds always force mocks and omit credentials. The optional local
MCP endpoint is http://localhost:6006/mcp; source/stories remain the fallback.

## Switch one dependency to live

Copy `dev.env.example` to `.env.development.local` in your editor. For Maps only:

```dotenv
DEV_MAPS_MODE=live
VITE_GOOGLE_MAPS_API_KEY=your-local-development-browser-key
```

Authorize both `http://localhost:5173/*` and `http://localhost:6006/*` for that
development key. The deployed staging key does not automatically permit localhost.

```sh
docker compose up -d --no-build --pull never --force-recreate web storybook
```

Everything else stays mocked, including Overpass. Set the mode back to `mock` and
recreate to return offline. Keys alone never activate a live service. The example
lists all selectors; missing required live inputs fail startup.

Live Cloud API groups need an explicit staging `DEV_LIVE_API_ORIGIN`, browser API
key, and localhost-compatible CORS/App Check. Uploads also require bucket CORS.
Never add backend passwords, provider tokens, or service-account files. Live reads
with mock uploads work; live submissions are blocked until uploads are also live.
Use records present in the selected backend. Optional provider configuration and
cloud provisioning remain separate operator work.

## Contribute and troubleshoot

Use Git to branch from staging, commit focused changes, and push when online. Open
PRs against staging through GitHub's website, including relevant stories, test
results and visual evidence. Existing issue/branch helpers require optional GitHub
CLI authentication; the basic local workflow does not.

- Engine unavailable: start Docker Desktop and select Linux containers.
- Ideas could not be loaded: open http://localhost:5173/__dev. The container
  sandbox returns JSON with dependency modes. If it returns an HTML page, a native
  provider-backed server (such as `npm run dev:provider`) is occupying the port.
  Stop that server with Ctrl+C in its terminal, then start Compose.
  Native mock development requires `mock:dev` and
  `dev:local`, as described below.
- Healthy containers but an unreachable app after restarting Docker: check
  `docker compose ps` for the published `127.0.0.1:5173->5173/tcp` mapping. If it is
  missing, run `docker compose down`, then the normal Compose startup command to
  recreate the project network. Keep any port overrides. This preserves volumes;
  do not add `--volumes`.
- Port occupied: leave other servers running and set `DEV_APP_PORT` or
  `DEV_STORYBOOK_PORT` in your shell before starting Compose. In PowerShell,
  `$env:DEV_STORYBOOK_PORT='6008'` selects http://localhost:6008. Keep the same
  override for subsequent Compose commands. The app's catalog link follows it.
- File watching: Compose enables 500ms polling for cross-platform bind mounts.
  Set `DEV_USE_POLLING=false` in your shell if native events work reliably.
- Browser missing: rebuild the shared image; do not install a host browser.
- Removed dependency still present: recreate dependency volumes explicitly.

Native development remains available with Node 24.12+, `npm ci`, and separate
terminals for `npm run mock:dev`, `npm run dev:local`, and `npm run storybook`.
Native browser tests need `npm run playwright:install -- chromium webkit` once.
Provider-backed native development is explicitly opt-in with `npm run dev:provider`.
It starts only Vite and reads the established provider configuration. Existing
Playwright fixture servers use that explicit command with their test config;
they do not invoke Docker or change their request mocks.

Containers do not change Firebase staging, GitHub Pages, or Cloud Run deployments.
Deployed Vite inputs remain build-time, with existing Git/SHA checks and exact
tested artifacts. Offline development is separate from installed-PWA offline and
update lifecycle acceptance.

See the [validation receipt and current limits](docs/local-development-validation.md).
