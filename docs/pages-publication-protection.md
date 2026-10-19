# Pages publication protection — activation procedure

Prepared after owner approval on 2026-10-19. **Preparation is not activation.** The existing source must be inspected and switched from branch publication to GitHub Actions before calling the protection active. The browser currently requires the owner to sign in; no credentials are requested in chat or extracted.

## Mechanism

The existing checkout workflow keeps its test job and adds `pages-build` with `needs: checkout-recovery`, then `pages-deploy` with `needs: [checkout-recovery, pages-build]`. Neither production job uses `always()`, `continue-on-error` or a failed-check fallback. A failure/cancellation/skipped prerequisite prevents deployment; the current served site stays in place.

Only pushes to main or a manual run on main can publish. The build checks out `github.sha`, uses the same official Jekyll builder as the previous Pages pipeline and compares the resulting index, worker, queue script and CNAME to the checkout. The artifact belongs to that same run; it is not taken from a different run or the latest branch tip. The generated public `deployment-version.json` contains only commit and run IDs for post-release verification.

The deploy job reads the Pages build type and current main SHA, then requires both to match the expected Actions source and tested commit. Old-run retries cannot publish over current main. Main workflow runs and production deploys are serialized without cancelling an in-flight deployment; a push arriving during an older deployment is handled by a subsequent run. A failed newer run leaves the last passing deployment served.

The main-SHA check is immediately before deployment, not an atomic lock against new Git pushes during the Pages API request. Serialization prevents an older deployment from finishing after a newer one from this workflow. Every published artifact still belongs to its own passing test run.

Permissions are job-scoped: contents read globally, pages read in the build, and pages write/id-token write only in the deployment job. These are the standard short-lived Actions publication permissions, with no new persistent credential or person access. The existing `github-pages` environment is reused without changing its policy.

## Activation order and evidence

1. Review the PR and verify its checkout job succeeds; production build/deploy must be skipped on the PR.
2. Sign in through the normal GitHub browser flow and open repository Settings → Pages. Record existing custom domain and HTTPS settings without changing them.
3. Select **GitHub Actions** as the build/deployment source. Preserve the existing deployed site; do not unpublish, remove the custom domain or disable HTTPS.
4. Integrate only the passing reviewed workflow change. Verify the main checkout, build and deploy jobs all succeed for that exact merge commit.
5. Read the public deployment-version.json and compare its commit/run with that run, then verify index and public checkout assets.
6. Reopen Pages settings and confirm Actions is selected. Audit every repository workflow for another Pages deployment command; no branch-based automatic deployment may remain.

The current migration does not change branch protection, grant users access or prevent an authorized maintainer from changing the workflow or Pages source in the future. It protects publication through the configured workflow; it cannot guarantee that no future test gap or infrastructure failure exists.

The SEO workflow pushes generated files with GITHUB_TOKEN; such pushes do not normally trigger another Actions workflow (and also did not trigger branch-mode Pages builds). They remain on main until a later eligible push or an explicit main dispatch runs the same gate. No unchecked SEO publication path is added, and no new scheduler or token scope is introduced.

## Negative checks and rollback

The deployment-only policy tests reject failed, cancelled, skipped, pending and missing checkout/build results; PR/other-ref events; stale/invalid SHA; and legacy/unknown Pages source. The actual job dependency graph additionally skips deployment when a required job fails. Never put a broken application commit on main to test the gate.

If activation or a job fails, retain the currently served site and correct the workflow. A normal revert can restore the preceding workflow code, but returning Pages to branch publication removes this protection and must be a deliberate settings rollback. No database, cache, queue, session or customer-data deletion is part of rollback.
