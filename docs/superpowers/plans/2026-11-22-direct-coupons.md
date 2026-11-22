# Direct Coupons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Offer administrator-managed discounts only to direct customers with atomic redemption and protected customer assignment.

**Architecture:** Protect assignment at confirmed-order insertion, preserve existing ownership, and expose narrow verified follow-up operations. A private coupon schema owns campaign revisions, eligibility and quota locking; a service-only wrapper inserts orders and redemption together. The existing signed checkout binds the coupon and canonical economic terms; absent a code, the existing path is unchanged.

**Tech Stack:** Native PostgreSQL 17 tests, Supabase Edge JavaScript, vanilla browser JS, Playwright. No Docker.

**Spec:** `docs/superpowers/specs/2026-11-22-direct-coupons-design.md` (approved including assignment protection on 22 November 2026).

## Global Constraints

- No real campaigns active by default; deployment and activation require separate authorization.
- Do not change catalogue/custom prices, commissions, points, passwords, roles or historic orders.
- One code per cart; products only, shipping is never discounted; canonical integer USD cents.
- Coupon errors preserve the form and never silently charge an undiscounted total.
- Coupons are denied for commercial sessions/references, commercial phone accounts, existing bindings or commercial order history; errors fail closed.
- No public campaign or usage enumeration; separate ten-per-minute IP+phone quote limit.

## File ownership and contracts

- Assignment task owns `customer-bindings.mjs`, its migration, assignment DB tests and the assignment functions in `js/storefront.js` only. Coordinator owns gateway dispatch and `js/secure-data.js`.
- Database coupon task owns its migration and `tests/coupons-db.cjs`. Coordinator owns `coupons.mjs`, checkout/gateway integration, all coupon UI, documents, builds and lockfiles.
- Both SQL tasks use `pth_customers.canonical_phone(text)` returning eight digits or NULL, and `pg_advisory_xact_lock(hashtextextended('customer-binding:' || canonical_phone,0))`. Acquire this phone lock before campaign locks. Normalized indexes are nonunique: never rewrite existing variants.
- Assignment module exports `customerBindings(db,body,actor)`; supported operation `renew` accepts phone only and server verifies current owner. Browser closure no longer writes: assignment is atomic at order insertion. No caller-selected new owner endpoint.
- Coupon SQL RPCs: `pth_coupon_quote(p_code text,p_phone text,p_rows jsonb,p_rate_key text) returns jsonb`; `pth_insert_coupon_checkout(p_rows jsonb,p_coupon jsonb,p_captures jsonb,p_tariff jsonb) returns jsonb`; `pth_coupon_admin(p_actor uuid,p_operation text,p_campaign jsonb) returns jsonb`. Wrapper always targets `pedidos`; verified gateway rejects commercial actors and child carts before invoking it. Quote returns `{id,revision,code,subtotal_cents,discount_cents,allocations:[{proveedor,gross_cents,discount_cents,net_cents}]}`. Allocation includes products only. Rows keep shipping as separate unchanged field. `p_coupon` is the exact quote snapshot plus phone; confirmation verifies the snapshot inside locks. DB rejects forged allocations, ineligible rows and consumed quotas itself.
- New order columns `subtotal_productos`, `descuento_productos`, `cupon_codigo` store dollar snapshots (NULL for historic/no-code). Order `total` remains net products plus shipping; canonical supplier cost and commissions unchanged.

### Task 1: Protect assignment

**Files:** new migration created with CLI, `supabase/functions/secure-data/customer-bindings.mjs`, `tests/customer-bindings-db.cjs`, assignment functions in `js/storefront.js`.

- [x] Write native PostgreSQL tests proving anon/authenticated cannot insert/update/delete binding/events, confirmed commercial orders create ownership, existing owner is preserved, child approval does not reassign, renewed follow-up cannot claim another owner, and normalized phone races serialize.
  ```js
  await assert.rejects(pg.query("set role anon; update public.customer_bindings set agent_name='Other'"));
  assert.equal((await pg.query('select agent_name from public.customer_bindings')).rows[0].agent_name,'Original');
  ```
- [x] Run `node --test tests/customer-bindings-db.cjs` and record the expected missing-protection failure.
- [x] Implement a service-only trigger/function with fixed search_path, server timestamps and immutable ownership; no historic changes. Migrate legitimate renewals to verified service operation, replace raw browser writes with confirmation/renew calls.
- [x] Run the tests including binding errors and same-ID child approval; inspect privilege grants and constraints.
- [x] Commit only task-owned files after review.

### Task 2: Private campaigns and atomic redemption

**Files:** new coupon migration, `tests/coupons-db.cjs`, test-only fixtures/helper as needed.

- [x] Write native SQL tests for amount/percent, cap, minimum, UTC dates, zero quota consumption on quote, phone variants, all exclusion sources, inactive campaigns, revisions, admin role/child denial, no public access, per-phone and last-global-use concurrency, same-token replay and rollback.
  ```js
  assert.equal(quote.discount_cents,333);
  assert.deepEqual(quote.allocations.map(x=>x.discount_cents),[111,222]);
  assert.equal((await pg.query('select count(*) from pth_coupons.redemptions')).rows[0].count,'1');
  ```
- [x] Run `node --test tests/coupons-db.cjs`; verify missing feature fails before implementing.
- [x] Add private RLS tables, revision/audit snapshots and RPC contracts above. Use exact cent arithmetic and stable provider residual allocation. Serialize phone then campaign. Return accepted receipt before campaign changes. Wrap existing points/express insertion, roll back all changes on failure. Admin updates require a reason; retired codes remain reserved.
- [x] Run DB tests with parallel transactions and role checks. No campaigns or backfills in migration.
- [x] Commit only task-owned files after review.

### Task 3: Signed checkout, administration and economic presentation

**Files:** `coupons.mjs`, `checkout.mjs`, `handler.mjs`, `index.ts`, `js/secure-data.js`, new `js/coupons.js`, `css/coupons.css`, checkout integration in `js/storefront.js` and `js/checkout-pending.js`, invoice/export/profit consumers, index/templates/service worker, tests.

- [x] Write behavior tests first: noncommercial code quote is bound to exact phone/products/delivery, canonical net terms, rejected context never invokes redemption, existing receipt wins, no-code regression unchanged, quote tampering fails, errors preserve drafts. Browser tests exercise actual collapsed client control/admin form, subtotal-discount-shipping-net and session isolation.
  ```js
  assert.equal(result.data.terms[0].descuento_productos,5);
  assert.equal(result.data.terms[0].total,21);
  assert.equal((await checkout(changedPhone,null)).error.code,'PAYLOAD_CHANGED');
  ```
- [x] Run new tests, observe red. Implement service module, signed payload optional field (omit entirely absent code), server-only configuration disabled by default, checked gateway actions, administration and client controls. Never trust browser-provided amount or eligibility.
- [x] Show the same stored snapshots in WhatsApp/vale/invoice/Excel; profit uses existing net `total` minus unchanged shipping/cost rules. Keep historic documents unchanged and existing currency conversions.
- [x] Run all unit suites, native DB suites, checkout/QR/browser regressions, build checks and SEO validation. Review feature against every design section and request independent read-only code review.
- [x] Commit complete tested implementation on the isolated branch. Document deploy order (assignment/schema → gateway disabled → web → explicit enable) and rollback. Do not publish or activate in this task.
