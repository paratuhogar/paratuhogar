# Conservative bulk commission assignment

## Scope

The 50% action configures only products with **no existing custom-price row**. Every existing commission is preserved, including zero and NULL, together with price and visibility. Historical duplicate pairs are not merged, deleted or assigned a preferred row. The UI explicitly explains this narrower behavior.

The browser sends product IDs in batches of at most 100 and a UUIDv4 batch ID, never a price, commission or actor identity. The authenticated gateway derives the actor, rejects non-principal/inactive accounts and calls the service-only RPC. The server checks current availability and computes floor(base commission / 2). Existing pairs are skipped. A committed receipt and inserts are atomic; the same ID/payload returns the original receipt after a lost response. No automatic mutation retry occurs. In-memory pending state supports explicit same-tab retries. Reloading starts a new plan; existing rows are still skipped and protected from duplication. No success is shown without validated counters.

## Database protection

`supabase/proposals/commission-auto-assign.sql` is an exact reviewed migration proposal, not a fabricated migration-history entry. Apply with the authorized migration connector only after release gates pass. The migration takes a bounded table lock and seeds a private count registry from existing pairs without changing commercial rows. An AFTER trigger maintains counts on insert/delete/rekey and prevents another insert to an occupied pair. AFTER timing avoids phantom counts on `ON CONFLICT DO NOTHING`. Same-key manual updates remain possible, including historical duplicates. Opposing rekeys may fail with a PostgreSQL deadlock; rollback is safe and must not be reported as success.

Private tables have RLS, zero browser policies, and revoked direct grants. Functions use fixed search_path and fully qualified relations. Only the existing service role can execute the assignment RPC; no credentials are created or exposed. The gateway blocks legacy bulk inserts/upserts, so an old browser must refresh instead of using the stale destructive workflow. Individual manual insert/update remains supported.

## Isolated verification and release gate

The `Comisiones - integridad aislada` workflow has read-only repository permissions, no secrets, and no production connections. It runs the exact SQL against disposable synthetic PostgreSQL data, including simultaneous transactions, receipt recovery and counter consistency. Native tests verify an actual lock wait, not merely overlapping promises. Embedded PostgreSQL covers SQL/ACL/sequential behavior but does not replace the multi-connection test. Browser fixtures intercept all external traffic.

Before release all must pass on the exact tree:
- `npm run check:js`
- `node --test tests/*.test.mjs tests/*.test.cjs`
- `node tests/commission-assignment-embedded.cjs` with isolated PGlite
- `node tests/commission-assignment-database.cjs` with isolated native PostgreSQL
- `node tests/half-commission-browser.cjs`
- `npm run check:checkout-release`
- `node tests/checkout-crm-cache-browser.cjs`

The restricted development computer cannot create the Unix sockets required by native PostgreSQL/Chromium. Those stages must run in the isolated CI environment; they are not counted as passed locally. No real commissions may be assigned as a smoke test.

## Publication and verification

Start from current main and preserve later unrelated work. Before deployment re-read the live secure-data sources and database structure; reject unreviewed drift rather than overwrite it. Capture prior function files/version and readonly commercial-row counts/fingerprints. Apply the database migration, verify private permissions and unchanged existing commercial rows, deploy the gateway preserving current settings, and only then publish the UI. Verify the exact public assets and both CI/Pages results. Never invoke the assignment using a real actor/product to test release.

## Rollback

Preserve registry, guards, receipts and all commercial rows. Do not drop tables, disable triggers or undo any genuine user assignment. If rollback is needed, disable the new UI action and revoke execution of this new RPC while keeping generic legacy bulk writes blocked. Do not restore an older button that rewrites zero commissions. A normal forward fix/revert over the latest main is preferred over reset/force push. Capture backend files before deployment for selective rollback; never overwrite subsequent unrelated work.
