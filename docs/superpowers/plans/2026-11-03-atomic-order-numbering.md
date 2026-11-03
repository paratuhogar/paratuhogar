# Atomic order numbering implementation plan

> Execute inline using executing-plans, with test-first steps and a separate reviewer.

**Goal:** Allocate numbers only in successful new-order insert transactions.
**Architecture:** Internal service-role RPC inserts canonical rows and increments
private transactional counters. Gateway retains signing/canonical validation.
Frontend consumes confirmed references; old reservation calls request an update.
**Tech stack:** PostgreSQL PL/pgSQL, existing Supabase gateway, vanilla JS, Node,
PGlite and native Chrome.
**Spec:** ../specs/2026-11-03-atomic-order-numbering-design.md

## Global constraints

No historical renumbering, counter reset, real test orders, changes to prices,
commissions, guarantees, delivery rules, authentication or roles. Preserve PR19.
Do not publish or migrate production in this implementation-only stage.

## Execution record

Implementation and local/integration verification completed on 2026-11-03.
Native PostgreSQL concurrency also passed in a disposable isolated schema; it
and its temporary jobs were removed. Independent review found no remaining
blockers. Activation/publication is deliberately pending separate authorization;
see `docs/operations/atomic-order-numbering-release.md` for evidence and sequence.

## Task 1 — Transactional insert

Files: `supabase/proposals/atomic-order-numbering.sql`,
`scripts/verify-atomic-order-numbering-sql.mjs`.
Interface: `pth_insert_checkout(p_table text,p_rows jsonb)` returns minimal
`[{id,orden_dia,proveedor}]`. Only service_role has EXECUTE. Inputs are canonical
rows with signed submission_token and deterministic IDs, not public client data.

- [x] Write test using real temporary PGlite tables and private counters. Call
  `select pth_insert_checkout($1,$2)` with synthetic rows. Assert first RO receipt
  is `RO-22` when existing counter is 21. Before SQL exists this must fail.
- [x] Implement explicit destination/column validation, transaction-level attempt
  lock and provider locks in stable order; preserve IDs, token and money.
- [x] Verify same-token replay returns `RO-22`, a distinct attempt returns `RO-23`,
  failed insert leaves counter 23, multi-provider failure inserts nothing, partial
  receipt and same-ID different-token collision fail, child approval replay works,
  anon/authenticated cannot execute, and legacy reservation cannot increment.
- [x] Commit SQL and tests only after all checks pass.

## Task 2 — Gateway boundary

Files: `supabase/functions/secure-data/checkout.mjs`,
`tests/fixtures/new-checkout.mjs`, `tests/checkout-atomic-numbering.test.mjs`.
Consumes Task1 RPC; produces existing checkout receipt contract unchanged.

- [x] Write regression `quote never writes; submit calls atomic insert without
  accepting caller reference`. Use existing canonical fixture at DB boundary;
  assert output references differ from supplied `FORGED-999` and replay is stable.
- [x] Run against old implementation and inspect expected failure.
- [x] Replace final table.insert with RPC, remove caller-reference authority,
  preserve deterministic ID generation and error/receipt recovery semantics.
- [x] Adapt fixture RPC to exercise its boundary explicitly and run checkout
  regressions including expired receipt, duplicate challenge and account changes.
- [x] Commit gateway and tests.

## Task 3 — Confirmed references throughout the storefront

Files: `js/storefront.js`, generated `js/storefront.min.js`, `index.html`,
`service-worker.js`, checkout browser fixtures/tests and release documentation.
Consumes existing response `confirmed[{reference,proveedor}]` from Task2.

- [x] Browser regression rejects any reservation RPC, returns confirmed RO-22,
  checks receipt and WhatsApp have RO-22 and no temporary reference; second click
  does not create a second order. Observe regression failure before implementation.
- [x] Remove reservation from new checkout; use no fabricated order reference.
  After submit, bind confirmed refs to message and customer protection. Recovery
  of an existing attempt must reload scoped confirmed message as before.
- [x] Replace public reservation function with explicit update-page error only
  as a separately ordered activation step after old gateway requests drain.
- [x] Update coherent release asset versions and regenerate bundle using existing
  build. Test real worker update and offline behavior.
- [x] Run Node suite, SQL verifier, checkout browser gate, build check, diff check.
- [x] Request independent code review; address blocking findings; record remaining
  native multi-connection staging/production activation checks without claiming
  unexecuted checks passed. Commit scoped implementation and hand off.
