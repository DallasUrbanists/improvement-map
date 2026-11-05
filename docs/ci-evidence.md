# Reusing advisory test results

PR advisory jobs can reuse a successful result for the same commit, PR base SHA,
suite, and device profile. The fingerprint also records the project list, locked
Playwright image version, Node version, and policy version. An updated commit or
base invalidates the result. Results expire after seven days.

Required deployment/critical checks, the unit job, presentation connection checks,
offline-environment checks, pushes, scheduled audits, releases, and manual full
audits continue to execute. `UX_ENFORCE=true` disables advisory reuse altogether.
This procedure validates head-commit advisory tests; it does not substitute for
testing a merge with staging or approve visual baselines.

## Automatic reuse

The small evidence step queries GitHub Actions for prior runs of the same workflow
and PR head (up to 20 completed runs, plus the preceding rerun attempt). It accepts
only a completed successful job with a successful test step carrying the matching
fingerprint. Storybook additionally requires successful tooling, build,
interaction, browser, and Pages steps: a green advisory job alone is insufficient.
Reused jobs are never used as evidence of a fresh test execution.

The workflow executes the reuse controller from the PR base checkout. A PR that
changes its workflow or reuse policy runs fresh tests. During rollout, a base
without this controller also runs fresh tests. Consequently this feature begins
working after these changes reach the PR target branch; this implementation PR
will run its normal tests.

API failures, missing permissions, expired results, and incomplete searches fall
back to running tests. No test execution credentials or write token are added.
The source revision and configured runner/image versions are matched; this is not
a claim that mutable runner images or external services are bit-for-bit identical.

## Maintainer-approved local evidence

Repository administrators may set the Actions repository variable
`CI_LOCAL_APPROVERS` to a comma-separated list of trusted maintainers' GitHub
usernames. With no list configured, local evidence is never accepted. The PR body,
labels, contributor reports, and author-association labels do not grant approval.
This explicit allowlist is the approval authority; update it when access changes.

1. Commit the code and create the PR. Obtain its exact current base commit, for
   example with optional GitHub CLI:

   ```sh
   gh pr view 123 --json baseRefOid --jq .baseRefOid
   ```

2. From a clean working tree, use the isolated test container. Replace `BASE_SHA`
   with the full base SHA from the preceding step:

   ```sh
   docker compose run --rm --pull never test node scripts/local-test-evidence.js ux-browse android BASE_SHA
   docker compose run --rm --pull never test node scripts/local-test-evidence.js ux-browse iphone BASE_SHA
   ```

   UX suite IDs are listed in `scripts/playwright-suites.js`; profiles are
   `android`, `iphone`, `narrow`, `landscape`, or `desktop`. For a noncritical
   regression group, use `regression-app regression` or
   `regression-diagrams regression`. For the complete Storybook catalog:

   ```sh
   docker compose run --rm --pull never test node scripts/local-test-evidence.js storybook catalog BASE_SHA
   ```

   The command accepts no test filters, runs the whole selected suite/profile,
   checks the working tree before and after, and issues a receipt only for
   nonempty successful results with no skipped or flaky browser tests. UX scans
   are enabled and strict. Storybook runs tooling checks, builds the combined
   artifact, and tests all stories and catalog/Pages browsers.

3. Find the exported receipt and raw reports under
   `test-results/local-development/test-results/local-evidence/SUITE-PROFILE/`.
   Related HTML reports are exported under
   `test-results/local-development/playwright-report/`. Upload a report archive
   to the PR or another location the reviewer can access. Keep it outside Git:
   adding the report in a commit would change the tested revision.

4. An allowlisted maintainer reviews the receipt, complete results, device
   coverage, and actual environment. The development container and CI runner are
   different environments; accepting the local result is an explicit maintainer
   decision, not independent proof of an honest execution. A maintainer must post
   the receipt's approval command as the **entire body of a PR comment**, replacing
   its placeholder URL with the reviewed report link:

   ```text
   /accept-local-tests HEAD_SHA SUITE PROFILE FINGERPRINT https://report-link
   ```

5. Rerun the existing PR workflow using GitHub Actions. Posting a comment does not
   itself launch or cancel jobs. The evidence gate checks the actual commenter,
   current commit/base fingerprint, and seven-day approval lifetime. It records
   the approval comment and report URLs. For Storybook use suite `storybook` and
   profile `catalog`; each Playwright device group needs its own approval.

To revoke, edit the latest matching approval comment and replace its report URL
with `revoked`, then rerun. The latest allowlisted command for that commit and
suite/profile wins. Already completed runs are historical and are not retroactively
changed. Deleting all matching approvals also removes local authorization.

## Visibility and fresh execution

Every reused job adds a source link and fingerprint to its Actions summary and
uploads `reuse.json`. Combined Playwright reports list accepted reuse separately
and use `passed-with-reuse` instead of claiming that those tests ran again. The
original CI run/report archive remains the place to inspect its raw evidence.

Set repository variable `CI_REUSE_DISABLED=true` and rerun to force fresh PR
execution. A manually dispatched full audit always runs fresh. No new npm scripts,
additional host apps, elevated `pull_request_target` workflow, or external
evidence-hosting service are required.
