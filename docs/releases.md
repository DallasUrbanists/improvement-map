# Welcome and release notes

Welcome appears once per tab session until the browser opts out. Direct idea and
submission links defer automatic announcements until Browse. The menu always
offers Welcome & guide and What's new. First visits baseline the bundled release;
later releases are acknowledged only on dismissal. Storage is browser-local.

## Publishing

1. Use the existing `npm run patch`, `minor`, or `major` version command. Stable
   `vMAJOR.MINOR.PATCH` tags trigger **Prepare release draft**.
2. Review the draft in GitHub Releases. Describe user-visible changes in plain
   language; add any direct commits missing from PR-generated notes. PR labels
   `feature`/`enhancement`, `improvement`/`accessibility`/`usability`, and `bug`/`fix`
   supply categories. `skip-changelog` excludes internal changes.
3. Publish the reviewed draft. Publishing, editing, or deleting a release triggers
   a Pages build from current main. The build uses the exact commit tested by CI.
   The release job never replaces existing notes or publishes drafts automatically.

For initial rollout, after the feature has shipped, run **Prepare release draft**
manually with that shipped version's existing tag. Review and publish that one
release; do not backfill old tags automatically. Creating a release for unshipped
code would announce functionality before it is available.

## Build contract

`node scripts/releaseManifest.js` reads the paginated GitHub Releases API and writes
`node_modules/.cache/improvement-map-releases.json`. It requires complete Git
history and tags. Stable published releases must be ancestors of the build commit
and no newer than package.json. CI supplies its read-only GITHUB_TOKEN; it is never
included in browser code. Missing tags, API failures, and invalid manifests fail
the deployment. Empty release feeds are valid.

CI sets `RELEASE_MANIFEST` to this generated file. Vite embeds it in the app bundle,
so the service worker caches notes with their matching app version. Local builds
default to an empty feed; tests intercept the virtual module with fixtures.
No live GitHub requests or credentials are needed in the browser. Markdown disables
raw HTML and images and allows only HTTP(S) links. Corrections to a release do not
reopen its announcement; a rollback never reduces the acknowledgement watermark.

Validation: `node --test tests/releases.node.mjs`,
`npm run test:e2e -- tests/announcements.spec.js --project=chromium`, and
`npm run test:ux -- announcements.spec.js`. Existing app-journey test configurations
seed an opted-out browser; announcement tests explicitly start with empty storage.
