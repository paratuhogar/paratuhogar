# Mensajería exprés Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Offer opt-in express delivery with an admin-configured final price and a saved delivery estimate.

**Architecture:** Extend the existing tariff and order records additively. Checkout remains authoritative, binds the choice to the quote, and passes the verified values through the existing atomic order and approval functions.

**Tech Stack:** PostgreSQL/Supabase, Deno Edge Functions, vanilla JavaScript and Node tests.

**Spec:** [Mensajería exprés](../specs/2026-11-12-mensajeria-expres-design.md).

## Global Constraints

Ordinary by default, no automatic refunds, no prefilled rates, no production writes while developing. Only administrators edit tariffs. Compare express with the configured ordinary rate on save and the effective ordinary rate at checkout. Quote and database fields are additive for ordinary callers.

### Task 1: Schema and persistence

**Files:** `supabase/proposals/express-shipping.sql`; reference existing `supabase/proposals/atomic-order-numbering.sql` and `supabase/proposals/subgestor-review.sql`; extend their isolated SQL checks.

- [ ] Assert in isolated PostgreSQL that a null pair is valid, an incomplete or equal-price pair fails, and a successful express order survives approval with identical service, price and minutes.
- [ ] Add nullable `precio_expres_pequeno/mediano/grande` and `minutos_expres_pequeno/mediano/grande` columns. For each tier, use a pair constraint following this pattern:

```sql
check ((precio_expres_pequeno is null and minutos_expres_pequeno is null)
  or (precio_expres_pequeno is not null and minutos_expres_pequeno is not null
      and precio_pequeno is not null and precio_expres_pequeno > precio_pequeno
      and precio_expres_pequeno < 'Infinity'::numeric and minutos_expres_pequeno > 0))
```

- [ ] Add `servicio_mensajeria` (ordinary default) and nullable `plazo_mensajeria_minutos` to both order tables; continue using `costo_mensajeria` for the accepted amount. Extend the atomic RPC whitelist and explicit insert lists, and copy both columns on approval. Preserve service-role grants, idempotency and locking. Compare the checked-in function definitions to production read-only before preparing deployable replacements.
- [ ] Rerun the SQL checks, verify ordinary rows still insert without the new fields, and commit the schema and tests.

### Task 2: Authoritative express quote and submit

**Files:** `supabase/functions/secure-data/checkout.mjs`, `handler.mjs`, `tests/new-checkout.test.mjs`, `tests/fixtures/new-checkout.mjs`.

- [ ] Add failing cases with ordinary $6, exprés $10/60 minutes, an equal/cheaper exprés, quantity surcharge raising ordinary above exprés, and a change to minutes between quote and submit. Assert the last three never create an express order. Assert forged fields cannot be written via the generic gateway.
- [ ] Accept `delivery.service` equal to `express` or `ordinary` (omitted = ordinary). For express, reject pickup and unavailable pairs, select the largest tier and compare in cents:

```js
if (expressCents <= ordinaryCents) fail('DELIVERY_UNAVAILABLE', 'Exprés no está disponible para este pedido.');
```

- [ ] Bind express mode to the attempt and include the accepted service, minutes and amount in signed terms. Keep the legacy ordinary signature shape unchanged; omit express-only fields in old ordinary payloads. Reject pricing or deadline changes before insertion. For a multi-provider batch, mark all rows, but assign `costo_mensajeria` only to the first row, as today.
- [ ] Verify current checkout/recovery tests and the new cases, then commit.

### Task 3: Panel, checkout and logistics

**Files:** `index.html`, `js/storefront.js`, `js/checkout-form-shared.js`, `js/pending-checkout-storefront.js`, `mensajeros.html` and its existing scripts, `service-worker.js`, `tests/express-shipping.test.mjs`.

- [ ] Add red tests for admin form validation and checkout mode selection. With a $6 ordinary and a $10/60-minute express fixture, assert initial ordinary, user-selectable express, visible total and delivery estimate. After switching to an unconfigured zone, assert the draft cannot submit until the user explicitly chooses a valid mode. Assert pickup hides express.
- [ ] Add three admin price/minute pairs and save them through the existing protected tariff query. Add the opt-in delivery selector and compute its offer with the same largest-size and cent comparison as the server. Include the chosen mode and estimate in the confirmation; use the authenticated quote for reconciliation. Only allow express while the live quote can be verified. Preserve ordinary offline drafts.
- [ ] Show `Exprés · N min estimados` on saved express rows in logistics/courier views and confirmation, reading the order snapshot rather than the current tariff. Use text-safe rendering for new labels.
- [ ] Rebuild the storefront bundle, version modified script URLs and the corresponding worker cache together, and run the unit, browser, and isolated SQL suites. Commit after the tests pass.

### Task 4: Release checkpoint

- [ ] Review permission and order invariants independently. Test staging with synthetic data only, including concurrent checkout and pending subgestor approval.
- [ ] If authorized to publish, apply schema first, deploy the gateway second and publish versioned assets last. Verify the live version and that no express rates were auto-configured.
