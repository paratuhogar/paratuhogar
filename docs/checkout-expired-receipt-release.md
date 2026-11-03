# Expired checkout receipt recovery — 2026-11-03

The gateway used the same seven-day parser for sending and receipt reads. A
properly signed old attempt therefore returned `ATTEMPT_EXPIRED` before looking
for accepted orders. The frontend retained that attempt for recovery.

Only `receipt` now allows an old signed timestamp. The signature, token format,
signed table, exact submission key, original date lower bound and minimal receipt
projection are unchanged. Future timestamps remain rejected. `quote`, `submit`
and duplicate-review parsing keep the strict seven-day limit. No frontend,
session/authentication, schema, permissions, existing orders or financial rules
change. An absent or partial receipt does not grant permission to send an expired
attempt. A failed read remains unknown.

Synthetic gateway regressions cover old complete/absent/partial receipts, child
receipts moved during approval, invalid signatures and modified signed fields,
future timestamps, account separation, failed reads/retries, overlapping receipt
and send requests, no receipt writes and the exact sending expiry boundary.
Existing checkout regressions also cover normal sending, lost responses, form
retention, account changes, leases and idempotency.

The required release gate is `npm run check:checkout-release`. Run and inspect it
on GitHub Actions before merging this change or deploying the gateway. Chromium
is intentionally not launched in the managed executor, where an earlier
diagnostic already found SIGABRT/EPERM; the CI workflow runs the same real
browser checks against loopback synthetic fixtures. The first PR run stopped
before tests because `ubuntu-latest` selected Ubuntu 26.04, unsupported by pinned
Playwright 1.57.0. The runner is now pinned to supported Ubuntu 24.04 without
changing any tests or permissions. A missing/skipped/failed gate
does not authorize deployment.

Before release, deployed `secure-data` v32 matched all 13 local runtime files.
Its original files and metadata are retained outside Git at
`/workspace/scratch/checkout-receipt-rollback-v32/`. Preserve `verify_jwt=false`,
the existing custom-session gateway behavior and `deno.json` when deploying or
rolling back. To roll back, redeploy those captured files with the same settings;
Supabase assigns a new version. Revert source with a normal Git revert. Preserve
all receipts, pending records and customer storage.

Source/version readback verifies which implementation is deployed. It does not
prove a particular phone's outcome. No real customer token or authenticated
phone reproduction was available for this release; future-dated attempts still
require separate diagnosis. No production test orders are created.
