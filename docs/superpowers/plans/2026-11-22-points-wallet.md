# Points wallet implementation plan

> **For agentic workers:** Use executing-plans inline, task by task. Subagent-driven-development is not installed. Request an independent read-only code review before completion.

**Goal:** Implement the approved points wallet locally, ready for an explicitly authorized release.

**Architecture:** A private PostgreSQL ledger derives rewards from immutable order snapshots. A service-only transactional wrapper preserves current order insertion and numbering; database triggers reconcile delivery and settlement. The existing secure gateway exposes a scoped action consumed by a standalone responsive wallet dialog.

**Tech stack:** PostgreSQL, existing Supabase Edge gateway, vanilla browser JS/CSS, Node tests and disposable native embedded PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-22-points-wallet-design.md` (approved by Marcel on 22 November 2026).

**Execution record:** Implemented and verified locally on 22 November. Final gates:
760 unit/integration tests, 31 native PostgreSQL tests, 19 wallet Chrome tests,
existing checkout browser chain, real service-worker cache test and JS/CSS build
checks all passed. Independent read-only review found no remaining Critical or
Important issues. The implementation is delivered in one cohesive local feature
commit rather than separate database/gateway/UI commits. No push or production
activation was performed. Release steps are documented, not executed.

## Global constraints

- No Docker, production writes, deployment or push.
- Preserve personalized prices, commissions, current authentication and receipts.
- Do not incorporate the house-number worktree.
- No cash conversion, spending, coupons, QR, expiry or historical backfill.
- Child sales reward the child UUID only; principal sales reward the principal.
- Gain eligibility requires Entregado plus Conciliado_Prov or Liquidado_Gestor.
- Start disabled. Preserve existing snapshots and reversals when disabled later.

## Interfaces

`POST secure-data {action:'points_wallet',operation,...fields}` uses the current verified session. Operations and fields:

- `summary`: optional `beneficiaryId`, `offset` default 0. Returns `{beneficiary:{id,name},enabled,startedAt,balance,pending,reversed,movements,nextOffset}`. Movement fields: `{id,points,kind,reason,createdAt,orderReference,reversalOf}`.
- `accounts`: admin only; `search`, `offset`; returns `{rows:[{id,name}],nextOffset}`.
- `rules`: admin only; `search`, `offset`; returns `{rows:[{productId,name,size,pointsPerUnit,customPoints}],nextOffset}`.
- `save_rule`: admin; `productId`, `pointsPerUnit` (nonnegative integer or null for default), `reason`, `idempotencyKey`.
- `grant`: admin; `beneficiaryId`, positive integer `points`, `reason`, `idempotencyKey`, optional `captureId` for an eligible unresolved sale.
- `reverse`: admin; `movementId`, `reason`, `idempotencyKey`.
- `issues`: admin; `offset`; returns `{rows:[{id,beneficiaryId,name,orderReference,reason}],nextOffset}`.
- `settings`: admin read; returns `{enabled,startedAt}`. Activation is an operator release step, not exposed as a spend/cash control.

`public.pth_points_wallet(p_actor_id uuid,p_operation text,p_body jsonb)` enforces the same permissions inside PostgreSQL. Only service_role can execute it.

`public.pth_insert_checkout_points(p_table text,p_rows jsonb,p_captures jsonb,p_tariff jsonb default null)` delegates to the existing insertion RPC, then stores validated reward snapshots in the same transaction. Each capture is `{pedido_id,beneficiary_id,lines:[{producto_id,cantidad}]}`. The database chooses rules and points; clients never supply those values. A receipt retry cannot create a snapshot for a pre-existing historical order.

`window.PTHSecureData.pointsWallet(body)` preserves session ownership and does not automatically replay writes. `window.PTHPointsWallet.open()` opens the own wallet. `openAdmin()` opens the admin tools.

## Task 1 Private ledger and transactional rewards

**Files:** CLI-generated `supabase/migrations` file ending in `_points_wallet.sql`; `tests/fixtures/points-wallet.sql`; `tests/points-wallet-db.cjs`; pinned dev dependencies in package manifest/lockfile.

- [x] Install native test PostgreSQL and inspect Supabase CLI help; generate the migration with `supabase migration new points_wallet`. Do not start Supabase or Docker.
- [x] Write database fixtures and failing tests before the migration implementation. Example independent expectation:

```js
await db.query("update pedidos set estado='Entregado' where id=$1", [order]);
assert.equal((await summary(child)).balance, 0);
await db.query("update pedidos set estado_financiero='Conciliado_Prov' where id=$1", [order]);
assert.equal((await summary(child)).balance, 8);
assert.equal((await summary(parent)).balance, 0);
```

- [x] Run the tests and verify missing database behavior fails. Implement private config, per-product rules, captures/lines, earning-state revisions and immutable movements. Protect privileges and RLS; retain UUID references/history without cascading deletes.
- [x] Capture each product quantity and effective point value atomically at new insertion. Missing classification or legacy unstructured insert creates an exception, not a guessed reward or a blocked sale. Approval preserves the child UUID using the same order identity.
- [x] Reconcile net eligible points using a per-capture row lock and unique revision key. On cancellation/de-conciliation append a reverse; genuine restoration appends restoration. Repeating a status produces no movement. Recognitions and reversals use capture/original-movement locks and request idempotency keys with payload checks. Full exact reversals plus unique original references enforce nonnegative balances without cross-capture account locks that could deadlock existing bulk updates.
- [x] Implement scoped summary, rules, grants, reversal and exception RPC operations. Manual sale corrections must be eligible and unresolved; a linked recognition prevents later automatic double credit. No free debit or editing ledger rows.
- [x] Run real multi-connection tests: initial disabled state, 1/2/3 rates, override zero, child ownership through approval, no retroactive capture, points frozen after product edits, unknown classification, duplicate grants/reversals, simultaneous insert and status changes, invalid actors and direct anon/authenticated access, immutability, snapshot rollback and retention.
- [x] Commit only these verified files.

## Task 2 Gateway and checkout integration

**Files:** `supabase/functions/secure-data/points-wallet.mjs`, `handler.mjs`, `checkout.mjs`, `index.ts`; `js/secure-data.js`; `tests/points-wallet-gateway.test.mjs`, `tests/points-wallet-client.test.cjs`; checkout fixtures only if necessary.

- [x] Write failing tests for own-account scope, admin-only actions, invalid payload rejection, service failure and session changes. Assert an attempted principal lookup of a child wallet fails. Test the checkout's actual RPC call and verified beneficiary capture.
- [x] Add the points action with strict field validation and server-owned actor ID. Forward to `pth_points_wallet`; return safe errors without private database messages.
- [x] Guard checkout integration behind `PTH_POINTS_WALLET_ENABLED`, false by default. Carry internally verified seller UUID/line IDs into the transactional wrapper without changing quote prices, commission calculations, token formats or receipt queries.
- [x] Add browser client method, capturing token before session restore and rejecting delayed results from an old account. Do not retry manual writes automatically.
- [x] Run points tests plus the existing checkout and session unit suites. Verify feature-off preserves exact old RPC behavior.
- [x] Commit these verified files.

## Task 3 Responsive wallet and admin tools

**Files:** `js/points-wallet.js`, `css/points-wallet.css`, `index.html`, `service-worker.js`, `js/pending-checkout-storefront.js`; relevant version tests; `tests/points-wallet-browser.cjs`.

- [x] Add browser tests using the real wallet JS with local synthetic API responses. They must first fail for missing wallet behavior.
- [x] Reuse the store's blue/slate palette and existing font. Use a native dialog, a sober points balance and an annotated movement list; no money symbols. Provide visible loading/empty/error/offline states and keyboard close/focus return.
- [x] Add own and admin entry buttons. Own view includes earned/pending/reversed totals and paginated movements. Admin includes account search, reason-required grants, linked issue resolution, reversal and per-product rules with zero/null distinction. Preserve inputs on failures and keep idempotency keys across uncertain retries.
- [x] Clear private views and reject stale responses on account/role changes, logout and expiry. Principal never sees child tools unless independently authorized as admin.
- [x] Add versioned JS/CSS references and a coherent service-worker cache version/readiness update. Cache public source only, never wallet API responses or private snapshots.
- [x] Run mobile/desktop browser tests, offline/session-change tests, cache coherence and build checks; visually inspect local screenshots.
- [x] Commit these verified files.

## Task 4 Integration review and release handoff

**Files:** `docs/points-wallet-release.md`, plan checkboxes and any verified fixes.

- [x] Run all database, gateway, client and browser tests plus existing checkout/session/regression suites. Record exact counts and limitations.
- [x] Request an independent read-only reviewer against the approved design and fix critical/important findings. The reviewer may not edit files or production.
- [x] Document deployment sequence: migration disabled, gateway flag off, web deploy, enable gateway flag, synthetic read-only/quote checks, then explicitly authorized DB activation at real server UTC. Disabling captures must preserve existing ledger obligations.
- [x] Verify clean diff, generated bundle/CSS and migration ACL checks. Commit the local result without push. Report what is implemented and what still requires release authorization.
