# Orders incident investigation — 2026-10-19

Status: incident not declared resolved. Bounded frontend release approved for publication after verification below. No backend deployment is part of this release. Confirm the public deployment separately; approval or Git push alone is not confirmation.

## Verified

- Isolated clone of `paratuhogar/paratuhogar`, fetched remote main and fast-forwarded to `8b3d59ec`. No files from the unapproved security candidate were copied. No credentials were inspected.
- Read `docs/gestor-feedback-release.md` and the checkout recovery release assessment. The October 17 recovery changes are present in current main. They bound checkout network waits; they do not prove the cause of this incident.
- Public website returned HTTP 200. Downloaded deployed service worker, offline storefront adapter and checkout submit guard matched this checkout byte-for-byte. This verifies those assets, not every client cache or the entire deployment.
- Minimal anonymous public catalogue API read returned HTTP 200 with one ID and no error. No customer rows or sessions were queried by this investigation.
- Chrome's existing owner session loaded the sales catalogue with 92 visible products. No cart lines, orders, stock reservations or messages were created. The readiness screen said the device was ready for offline work; this message describes preparation, not a detected outage. Administrative view was restored after observation. No tokens or browser storage were extracted or cleared.

## Reproduced queue defect

`tick()` in `js/pending-checkout-storefront.js` refreshes the session inside `queue.run()` before binding the saved order. The current handler can return HTTP 503 with `SERVICE_UNAVAILABLE` for a transient session-store failure. The queue did not classify this code as retryable, so it moved the row to `blocked` and subsequent normal scheduler ticks skipped it, even after recovery.

Two synthetic regressions ran the real gateway handler with a failing session read. Baseline produced `blocked` for both unsigned and signed pending rows. Adding only `SERVICE_UNAVAILABLE` to the queue's retryable codes preserves `queued` or `uncertain`, the same intent, form, signed attempt and account isolation. Recovery confirms exactly one synthetic server write. A third regression covers server acceptance followed by service failure, then explicit recovery of an old blocked row: its receipt is recovered with no second write.

This is a verified failure mechanism, not proof of the reporting gestor's exact cause. The parent reported one production 503 as `EDGE_FUNCTION_ERROR`, and several 401s; its actual response body and affected browser trace are unavailable here. Do not equate that event with the handler's `SERVICE_UNAVAILABLE`. Do not modify authentication, accounts or permissions on this evidence.

## Tests and review

- Focused pending queue + session infrastructure suite: 53 passed, zero failed. Includes genuine 401 credential rejection and 403 denial tests; their behavior is unchanged.
- Before the third regression was added, all Node suites: 610 passed / 623 total, 13 failed. Repeating with the original production queue file produced the same 13 failures plus the two new expected red regressions (608 passed / 623). Existing failures concern admin view fixtures, shell/cache expectations and unavailable dependencies. No claim of a fully green suite.
- Independent code review found no important introduced issue; it noted that Node bridges do not prove full browser checkout integration. Reviewer could not repeat tests because Node was not on its PATH; main investigator used the bundled Node executable.
- `git diff --check` passed. No Docker or PostgreSQL installed.

## Recovery and release limits

Do not clear application data, IndexedDB, queues or all caches. Existing blocked rows are preserved. Their existing explicit recovery action is **Reintentar con mi cuenta** on `/offline-order.html`; this may perform a real submission and must be undertaken only by the account holder intentionally, after checking any confirmed references. No such real action was executed here. Do not recreate the same order to test.

Before release, integrate only the queue fix and regressions over then-current main, coordinate the public worker/cache and pending-script URLs, exercise browser recovery and verify the published assets. No backend deployment is needed or authorized by this patch. In particular, do not deploy gateway v7 from another candidate.

Rollback the bounded queue change with a normal revert and a new coordinated public cache version; keep all queue readers, signed attempts and stored pending rows. No data migration or deletion is required.

Remaining diagnostic gap: exact error code/status and current session state on an affected gestor's browser, with personal fields and tokens excluded. The duplicated phone correlation reported by the parent is only an ambiguity hypothesis; no accounts were merged or changed.

## Approved release verification

The owner explicitly prioritized completion of the independent reproduced defect and authorized publication after confirming it does not bypass identity/session/account validation. The only changed business behavior is classification of `SERVICE_UNAVAILABLE`; no authentication, permissions, pricing, commissions or backend changes.

- Independent reviewer repeated all 53 queue/session tests successfully and found no blocking issue in code or coordinated asset versions.
- `tests/pending-service-recovery-browser.cjs` passed in installed Chrome at 390px: shipped page, worker, IndexedDB, session client and real queue scheduler against the local synthetic gateway. A real handler 503 leaves a queued row and credential intact; closing and reopening a tab preserves its identity/form; recovery confirms with exactly one write; reload does not duplicate it. A genuine handler 401 clears the browser credential and performs no further order write. No production orders or accounts are involved.
- `tests/checkout-recovery-latest-browser.cjs` passed at 390px and 1280px: bounded stalled network read, late result ignored, acceptance with lost response, same-attempt receipt recovery with one write, and confirmed receipt rendering. `PTH_CHROMIUM` now supports the installed executable without changing application behavior.
- Focused queue/session/submit guard/adapter/shell repair/upgrade/cache suite: **88 passed, zero failed**.
- Full Node suite: **615 passed / 624 total; 9 pre-existing failures** (six admin-view fixture expectations and three missing dependency suites for `web-push`/`terser`). Four stale cache-fixture references were aligned with the actual release so their cache rejection and upgrade tests execute correctly. No unrelated production fixes bundled.
- New coordinated static cache: `pth-public-static-2026-10-19-ordersretry1`; pending queue and pending storefront asset URLs use `20261019-ordersretry1`. Index and offline-order worker dependencies match. Queue format is unchanged.

Existing blocked rows require the existing explicit recovery action; this release does not silently resend a row requiring review. A 401 still requires a valid same-account login. Receipt confirmation remains mandatory for success; offline saving never promises delivery.

Rollback: revert the two bounded release commits over then-current main, then assign a fresh static cache version in both worker and pending storefront UI. Restore the previous public references consistently. Preserve IndexedDB queues, signed attempt tokens and receipts. Do not deploy or revert any Supabase function as part of this frontend rollback.
