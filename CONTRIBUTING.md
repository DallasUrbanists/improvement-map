# Contributing locally

Start UI work in Storybook, then verify the component in the application.
Ordinary contribution branches start from **staging**; hotfixes start from main.

## First-time setup

Install Git and Docker Desktop (Linux containers/WSL2 on Windows), or Docker Engine
with Compose **2.24 or newer** on Linux. Install host Node **24.21.0** (pinned in
`.nvmrc` and `.node-version`; minimum 24.12). Storybook runs on your host;
the app, mocks, component tests and test browsers run in Docker. Windows, macOS
and Linux use the same commands. Keep host and Linux container dependencies separate.

### Linux: configure Docker Engine permissions

For a standard Docker Engine installation on Linux, allow your account to access
Docker before running the project commands. Run these on the **host machine**:

```sh
sudo groupadd --force docker
sudo usermod -aG docker "$USER"
newgrp docker
```

`groupadd --force` succeeds even if the group already exists. `usermod -aG` adds
your account without removing its other group memberships. `newgrp docker` opens
a shell with the new group access immediately. Alternatively, log out fully and
back in; a Linux virtual machine may need a restart. Opening another terminal in
the same existing login session may not apply the change.

Membership in the `docker` group provides root-level access to the machine.
See [Docker's Linux post-installation guidance](https://docs.docker.com/engine/install/linux-postinstall/)
for details and the rootless alternative. Docker Desktop users can skip these
Linux Engine permission commands.

Verify that Docker and the Compose plugin work without `sudo`:

```sh
docker info
docker compose version
```

Resolve any permission or daemon connection errors before continuing.

Leave several GB of free space on Docker's storage filesystem for dependency
copies, browser files and build cache. On a standard Linux Engine installation,
check `df -h /var/lib/docker`; `docker system df` shows Docker's own usage. A full
VM disk prevents services from starting even when the image built successfully.

### Clone, build and start

While online:

```sh
git clone --branch staging https://github.com/DallasUrbanists/improvement-map.git
cd improvement-map
npm ci
docker compose --profile tools build
npm run dev
```

Open the [app](http://localhost:5173) and [Storybook](http://localhost:6006).
All services default to **mock**. No API keys, Firebase account, `.env` editing,
Java, or cloud tools are required. The first app or optional Docker Storybook
start copies Linux dependencies into service-specific volumes; allow several minutes on slower
machines or VMs. Logs show when this preparation starts and finishes. The mock
service uses Node built-ins and fixture files, so it skips this copy.

Storybook logs appear in the launcher terminal. See `docker compose logs -f web mock` and the
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

### What setup prepares

`npm ci` installs the pinned host dependencies for Storybook. The Docker build
prepares separate Linux dependencies and Chromium/WebKit for the app and tests.
Rebuild the image and rerun host `npm ci` after dependency changes. Normal startup
never installs packages or pulls images. Host browser installation is unnecessary
for the standard component-test commands.

## Daily development

```sh
npm run dev
```

The launcher starts the Docker app and mocks in the background, then runs native
Storybook in the foreground. It stops this project's optional Docker Storybook
first so both cannot compete for port 6006. Repeating the command reuses the
verified native server owned by this checkout.

Source edits hot-reload. Ctrl+C stops native Storybook; the Docker app and mocks
remain available. Stop the whole development stack with:

```sh
npm run dev:stop
```

This preserves mock submissions, uploads and dependency volumes. Use
`npm run status` to check both runtimes. Native Storybook proxies mock requests
through the Docker app's published port, including uploads.

Set `DEV_APP_PORT` and `DEV_STORYBOOK_PORT` in your shell for alternate ports.
For simultaneous checkouts, also give each one a distinct `COMPOSE_PROJECT_NAME`.
Keep these settings when starting the stack or running Docker commands.
In PowerShell, for example, `$env:DEV_STORYBOOK_PORT='6008'` selects port 6008.
Native startup refuses to terminate an unrelated process occupying a port.

### Docker-only fallback and test widget

```sh
npm run dev:docker
# With only Git and Docker installed:
docker compose --profile storybook up --no-build --pull never
```

The npm fallback stops this checkout's verified native Storybook first. Stop a
native launcher before using the direct Compose command. The fallback includes
the persistent Component tests widget and automatic story playback. Native
editing omits both by default; use the separate Docker test commands for checks.
Pass `-- -d` to `dev:docker` for detached operation. Native `dev` stays
in the foreground and does not accept `-d`.

Direct `docker compose up` starts only app and mocks; Storybook is opt-in through
its profile. `docker compose down` removes containers/network and preserves
volumes; adding `--volumes` erases saved data.

Reset suggestions with `docker compose exec mock npm run mock:reset`, then refresh.
This preserves uploads and browser storage. After editing the mock server or
seed data, run `docker compose restart mock`.

## Work in Storybook

Read [the component index](docs/storybook.md), inspect the production component
and adjacent story's props/events/slots, and reuse existing components first.
Review controls, themes, keyboard interactions, viewport and pseudo states.
Native editing keeps controls, themes, keyboard interaction and accessibility
tools, while omitting automatic play functions and the persistent Vitest addon.
An empty Interactions panel is not a test result. These host commands run component
checks in Docker using the prepared Chromium:

```sh
npm run test:storybook -- src/components/Tabbar.stories.js
npm run test:storybook:watch -- src/components/Tabbar.stories.js
npm run test:storybook:widget
npm run test:storybook:visual
npm run test:storybook:pages
docker compose run --rm --pull never test npm run test:feature -- browse
docker compose run --rm --pull never test npm run test:local
```

One-shot tests use an isolated source copy without external networking or personal
environment overrides. Reports are exported under `test-results/local-development/`.
Watch mode uses a separate Linux dependency volume and the live source bind mount;
polling detects host edits. Static visual/pages commands build their output inside
the isolated test container. Existing prepared Linux CI runs its tests directly.

The pinned Storybook 10.6.3 widget has an intermittent
[upstream startup race](https://github.com/storybookjs/storybook/issues/35864).
The launcher and raw `storybook:serve` hook apply a version-checked synchronization
backport. Review/remove it on upgrade. The widget smoke test starts its own full
addon server; it does not use native editing. Coverage is not installed.

Designs remain Draft and screenshot candidates remain `visual-review-pending`
until reviewed. Static catalog builds force mocks and omit credentials.
The optional local MCP endpoint is http://localhost:6006/mcp.

## Switch one dependency to live

Copy `dev.env.example` to `.env.development.local` in your editor. For Maps only:

```dotenv
DEV_MAPS_MODE=live
VITE_GOOGLE_MAPS_API_KEY=your-local-development-browser-key
```

Authorize both `http://localhost:5173/*` and `http://localhost:6006/*` for that
development key. The deployed staging key does not automatically permit localhost.

```sh
npm run dev:stop
npm run dev
```

Everything else stays mocked, including Overpass. Set the mode back to `mock` and
restart to return offline. Keys alone never activate a live service. The example
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

Advisory CI can reuse matching trusted test results. Maintainers may also approve
complete local container test evidence for expensive advisory suites; required
checks still run. See [test evidence and approval instructions](docs/ci-evidence.md).

Optional branch helpers accept a type instead of using a separate command for
each branch type:

```sh
npm run branch:start -- feature improve-search 123
npm run branch:finish -- feature
```

`branch:start` accepts `feature`, `fix`, `hotfix`, `release`, `refactor`, `docs`,
`test`, or `chore`, followed by a lowercase kebab-case description and an optional
issue number. Without an issue number it prompts for one or offers to create an
issue. Hotfixes start from main; other types start from staging.
`branch:finish` accepts `feature` or `refactor`, runs selected tests and the app
build, and displays changes for review. With a clean working tree it attempts to
open a draft PR against staging. These helpers need network access and GitHub CLI.

Use `npm test -- <test-file> --project=chromium` for a focused regression test,
`npm test -- --grep-invert @critical` for noncritical regression tests, and
`npm run test:ux -- --full` for the comprehensive UX audit. These commands can also
run through the test container as shown above. For release maintainers,
`npm run release -- patch` (or `minor` / `major`) creates a version commit/tag and
pushes main and tags; it refuses to run outside main. See [release instructions](docs/releases.md).

- Engine unavailable: start Docker Desktop and select Linux containers, or start
  Docker Engine using your Linux distribution's service manager. Check `docker info`.
- Permission denied connecting to `/var/run/docker.sock`: complete the
  [Linux Docker Engine permissions setup](#linux-configure-docker-engine-permissions)
  above, then retry from a shell with the updated group membership.
- Dependency failed to start on first setup: inspect `docker compose ps -a` and
  `docker compose logs --tail 80 mock web storybook`. Initial dependency preparation
  can take several minutes on a VM. If `mock` has since become healthy but the
  app/Storybook remain `Created`, rerun the startup command. Compose will then
  start them; there is no need to erase volumes and repeat preparation. If a
  container exited or logs show an error, diagnose that error before retrying.
- Disk full: check `df -h /var/lib/docker` and `docker system df`. Free space before
  retrying startup. `docker builder prune --all` prompts before removing unused
  build cache; it preserves prepared images, containers and saved volumes, but
  future builds may take longer. If that is insufficient, free other unneeded
  files or expand the VM disk/filesystem. Keep several GB of headroom for startup.
- Ideas could not be loaded: open http://localhost:5173/__dev. The container
  sandbox returns JSON with dependency modes. If it returns an HTML page, a native
  provider-backed server (such as `npm run dev:provider`) is occupying the port.
  Stop that server with Ctrl+C in its terminal, then run `npm run dev`.
  For the default hybrid stack, restart with `npm run dev`.
- Healthy containers but an unreachable app after restarting Docker: check
  `docker compose ps` for the published `127.0.0.1:5173->5173/tcp` mapping. If it is
  missing, run `docker compose down`, then the normal Compose startup command to
  recreate the project network. Keep any port overrides. This preserves volumes;
  do not add `--volumes`.
- Port occupied: leave other servers running and set `DEV_APP_PORT` or
  `DEV_STORYBOOK_PORT` in your shell before running the launcher. In PowerShell,
  `$env:DEV_STORYBOOK_PORT='6008'` selects http://localhost:6008. Keep the same
  override for subsequent Compose commands. The app's catalog link follows it.
- File watching: native Storybook uses native events; Compose enables 500ms polling for cross-platform bind mounts.
  Set `DEV_USE_POLLING=false` in your shell if native events work reliably.
- Browser missing: rebuild the shared image; do not install a host browser.
- Removed dependency still present: recreate dependency volumes explicitly.

Advanced all-native app development uses separate `mock:dev` and `dev:local`
terminals. `storybook:serve` starts only the raw catalog and does not start Docker;
set its mock origin explicitly for an all-native stack. Native browser tests need
`npm run playwright:install -- chromium webkit` once.
Provider-backed native development is explicitly opt-in with `npm run dev:provider`.
It starts only Vite and reads the established provider configuration. Existing
Playwright fixture servers use that explicit command with their test config;
they do not invoke Docker or change their request mocks.

Containers do not change Firebase staging, GitHub Pages, or Cloud Run deployments.
Deployed Vite inputs remain build-time, with existing Git/SHA checks and exact
tested artifacts. Offline development is separate from installed-PWA offline and
update lifecycle acceptance.

See the [validation receipt and current limits](docs/local-development-validation.md).

## Clean up after contributing

### Stop development and keep your work

From the repository directory, run:

```sh
docker compose --profile tools down --remove-orphans
```

This stops and removes the project's containers and network. Your checkout,
prepared image and named volumes remain available for the next session.

### Remove the project from a Linux machine

Push or back up any work you want to keep, including uncommitted files and local
configuration. The following steps permanently delete local mock submissions,
uploads, dependency copies and the checkout. They do not delete the GitHub
repository or remote branches.

These commands assume the checkout is `~/repos/improvement-map` and the default
Compose project name is `improvement-map`. If you used a different path or a
`--project-name` override, use those same values throughout cleanup.

Start from the checkout and inspect any local changes:

```sh
cd "$HOME/repos/improvement-map" || exit
git status --short
git log --oneline --branches --not --remotes
```

After saving any work you need, remove the project's Docker resources **before
deleting the checkout**, while `compose.yaml` is still available:

```sh
docker compose --profile tools down --volumes --remove-orphans --rmi all
```

`--profile tools` includes the optional test service. `--volumes` deletes the
declared named volumes, including mock data and uploads. `--remove-orphans`
includes this project's containers from older service definitions. `--rmi all`
also removes the shared development image. If another container still uses that
image, Docker may refuse to remove it; inspect the error rather than forcing it.
See the [Compose down reference](https://docs.docker.com/reference/cli/docker/compose/down/).

Older versions may have left project volumes that are no longer declared in the
current Compose file. Inspect them, then remove any remaining unused volumes
labelled for this project:

```sh
docker volume ls --filter label=com.docker.compose.project=improvement-map
docker volume ls -q --filter label=com.docker.compose.project=improvement-map | xargs -r docker volume rm
```

After Docker cleanup succeeds, delete the checkout. `rm -rI` asks for confirmation
before recursively deleting the directory:

```sh
cd "$HOME/repos" || exit
pwd
rm -rI -- improvement-map
```

If container-generated files cause permission errors, verify the exact checkout
path and retry only that deletion with:

```sh
sudo rm -rI -- "$HOME/repos/improvement-map"
```

### Optional: recover unused build-cache space

```sh
docker builder prune --all
docker system df
df -h /
```

Build-cache pruning prompts for confirmation and affects unused cache across
Docker projects, not just this one. It preserves other projects' images,
containers and volumes, but later builds may take longer or need downloads.
See the [build-cache pruning reference](https://docs.docker.com/reference/cli/docker/builder/prune/).

Browser drafts and bookmarks are separate from Docker storage. If desired, clear
site data for the local app origin (normally `http://localhost:5173`) in your
browser as well.
