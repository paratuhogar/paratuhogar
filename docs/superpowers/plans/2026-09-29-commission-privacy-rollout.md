# Commission privacy release

Production project: `ljqwaovevfatkiigirhf`. Baseline repository: `8975da5182267e85df7022cb1d29e81057ccbce9`.

Executed release: `f79e4a8b822de9d0efa195fe8d4a4e538a8d5807` published to main, GitHub Pages build completed, all ten data consumer pages and the adapter verified live. `secure-data` version 4 and `google-statistics` version 3 active. Both migrations applied successfully. 60 complete automated regressions pass, including 19 security-targeted tests.

Post-restriction live checks: public finance/product-star/password/order/custom-price REST reads and finance RPC return 401; public order gateway returns 403; catalogue view and sanitized gateway return 200. Invalid opaque token reaches the custom session rejection, not platform JWT rejection. Anonymous/authenticated commission column grants are false; service-role order access remains true. Post-restriction counts and order sum exactly match the baseline above.

Security advisors: protected tables no longer have disabled-RLS findings, and the safe catalogue view has no definer-view finding. Pre-existing findings remain for unrelated analytics, customer bindings, logs, categories, shipping tariffs and configuration; they are not silently treated as a completed site-wide security audit. Public delivered-order count and sequence reservation RPCs remain intentionally executable. Reference: https://supabase.com/docs/guides/database/database-linter .

Release order:
1. Apply additive `commission_sessions` migration and deploy `secure-data` with `verify_jwt=false`. The handler authenticates opaque bearer tokens itself; never expose its service-role key.
2. Deploy compatible `google-statistics`, publish main, confirm GitHub Pages serves the new privacy adapter and all protected data consumer pages.
3. Apply transactional `commission_privacy_restrictions` migration. Existing product public SELECT policy remains; column grants permit only the safe invoker catalogue view.
4. Verify public REST denies finance/password/order reads and privileged RPCs; the public catalogue gateway and SEO view must still work. Compare ledger counts/totals with the pre-restriction snapshot, accounting for concurrent legitimate sales.

Pre-restriction snapshot (2026-09-29): 2,225 orders; total order value USD 1,079,583.50; 508 accounts; 112 payout requests. No financial records were edited by this release.

Verification: automated regressions cover handler integration tests of hashed-session resolution with an isolated fake database. Independent read-only review identified private JSON/raw-OR count probes; these are rejected and regression-tested. Public live gateway and invalid-credential checks passed. Live authenticated private user testing requires an actual user login; no impersonation session was created to perform that check.

Compatibility: named existing accounts/passwords remain. Local-only master shortcuts are intentionally removed. People who used those shortcuts must sign in with their existing named administrator account. Existing account sessions migrate automatically where their saved credentials are valid. Legacy clients must reload; no insecure REST fallback is allowed. Password recovery now routes through a verified principal/administrator instead of an anonymous password rewrite. Already shared WhatsApp vouchers and historically downloaded data cannot be withdrawn.

Recovery: keep the gateway and restrictions active while repairing a page or handler. Revert only the defective compatible frontend/handler patch; do not blindly revert to pre-release pages or restore public financial table grants. Supabase dashboard/service-role access remains available for diagnosis and approved recovery. This release deliberately does not delete or renumber orders, recalculate old payouts, rotate user passwords, or change balances.
