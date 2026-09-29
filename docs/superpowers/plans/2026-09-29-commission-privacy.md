# Commission privacy implementation plan

Goal: enforce the approved role-specific commission visibility on the server and in shared vouchers.
Spec: ../specs/2026-09-29-commission-privacy.md

- [x] Implement tested role policy and commission calculation in `supabase/functions/secure-data/policy.mjs`.
- [x] Implement authenticated gateway and private expiring session storage, with narrow query/RPC allowlists and server ownership filters.
- [x] Add `js/secure-data.js` compatibility adapter; migrate login and session restoration in all data consumers. Update voucher amount, checkout line IDs and account-partitioned cache.
- [x] Test anonymous and subgestor data projection, injection/spoofing rejection, canonical monetary calculation, primary approval and legacy session restoration. Run related regression checks.
- [x] Obtain independent read-only code review; address critical/important findings.
- [x] Stage gateway and verify deployment before any access restrictions. Prepare isolated commit and coordinated rollout with rollback instructions.
- [ ] Publish and restrict direct protected access only when all supported pages use the authenticated gateway. Verify live access rules and commission visibility before declaring completion.
