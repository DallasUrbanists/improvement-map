# Contributing locally

Start UI work in Storybook, then verify the component in the application.
Ordinary contribution branches start from **staging**; hotfixes start from main.

## First-time setup

Install Git and Docker Desktop (Linux containers/WSL2 on Windows), or Docker Engine
with Compose **2.24 or newer** on Linux. Use any editor. Node, npm, Chromium,
WebKit, and browser system libraries run inside containers.

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
docker compose --profile tools build
docker compose up -d --no-build --pull never
```

Open the [app](http://localhost:5173) and [Storybook](http://localhost:6006).
All services default to **mock**. No API keys, Firebase account, `.env` editing,
Java, or cloud tools are required. The first app and Storybook start copies Linux
dependencies into service-specific volumes; allow several minutes on slower
machines or VMs. Logs show when this preparation starts and finishes. The mock
service uses Node built-ins and fixture files, so it skips this copy.

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

### Understand the setup commands

Both commands use `docker`, the Docker command-line tool, and its `compose`
subcommand, which reads the services defined in this directory's `compose.yaml`.
Run them from the repository directory.

#### Build the shared image

```sh
docker compose --profile tools build
```

| Part | What it does |
| --- | --- |
| `--profile tools` | Includes services assigned to the project-defined `tools` profile, including the optional `test` service. |
| `build` | Builds images for services with a `build:` configuration, following their Dockerfile. It does not start services or run tests. |

The app, Storybook, mock service and test runner share one image containing Node,
npm dependencies, Chromium, WebKit and browser system libraries. Only `web`
currently defines a build, so including `tools` does not build a separate test
image; `docker compose build` currently builds the same shared image.
The first build downloads dependencies; later builds reuse cached steps where
possible. See [Compose profiles](https://docs.docker.com/compose/how-tos/profiles/).

#### Start the services in the background

```sh
docker compose up -d --no-build --pull never
```

| Part | What it does |
| --- | --- |
| `up` | Creates and starts the containers and their network. It reuses existing containers where possible and recreates them when configuration or image changes require it. |
| `-d` | Runs in detached mode: containers stay in the background while your terminal becomes available again, and keep running when you close it. |
| `--no-build` | Uses the prepared image without rebuilding it. |
| `--pull never` | Prevents image downloads from a registry. The required image must already exist locally. |

This starts the app, Storybook and mock service. The optional test service stays
stopped unless you explicitly select it or enable its profile. The `--profile`
option on the earlier build command applies only to that command; it does not
enable `tools` for later commands. See the [Compose up reference](https://docs.docker.com/reference/cli/docker/compose/up/).

Check status, follow logs, or stop the background services with:

```sh
docker compose ps
docker compose logs -f
docker compose down
```

Use Ctrl+C to stop following logs; the detached containers keep running.
`down` removes the containers and project network, while preserving named volumes
with mock submissions, uploads and dependency copies. Adding `--volumes` erases
that saved data.

## Daily development

After preparation, `docker compose up -d --no-build --pull never` works without internet.
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
