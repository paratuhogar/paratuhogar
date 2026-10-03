# Private monthly ranking — approval checkpoint

Repository `paratuhogar/paratuhogar`, local branch `feat/private-monthly-ranking`,
base main `417d3d1d6dc5d5c1393dece28b0c7ff74323359e`. Deployment target remains
GitHub Pages main/root, `paratuhogar.org`. Supabase target is verified active
project `ljqwaovevfatkiigirhf`, name `paratuhogar`, PostgreSQL 17.6.
Live `secure-data` remains version 21. No new SQL, permissions, trigger or Edge
deployment has been applied; frontend has not been published.

## Evidence and chosen rules

Read-only aggregate audit: 1,511 delivered orders; 1,432 without delivery dates
(94.77%). No delivery-before-order or future-delivery dates were found. Only
79 have a recorded delivery date, between July 21 and September 26, 2026; zero
dated deliveries in October. There is one October-created delivered order
without a delivery date. We will not silently use order creation dates as
delivery dates. Monthly counts therefore start from verified dates and explain
the incomplete history. No historical backfill is proposed or authorized.

Attribution audit: 1,452 delivered orders uniquely match an account, 22 match
multiple accounts, and 37 have no match. There are 17 duplicate internal-name
groups. Alias is display only; UUID is identity. Existing order schema stores
seller names, so the aggregate uses an exact, unique internal-name match; for
a child account it also matches the principal relationship. Ambiguous and
unmatched orders are excluded, not assigned to a guessed UUID. Internal names
remain internal and no records are renamed or backfilled.

- Calendar month in `America/Havana`; inclusive first midnight, exclusive next
  month's first midnight. Repeated midnight at the November DST change is
  handled explicitly; October ends at `2026-11-01T04:00:00Z`, not the second
  midnight at 05:00Z.
- One delivered order counts once, for the identified child seller when one
  is recorded, otherwise the principal seller. Parent network sales do not
  count again for the parent.
- Only active selling accounts with an active parent participate. Staff/admin
  can read the same bounded summary but do not compete; a child whose stored
  role says admin remains a child, matching existing authorization precedence.
- Rank by delivered count. Equal counts share a competition rank (1, 1, 3).
  UUID determines stable display order only, not rank or reward. Zero monthly
  deliveries have no rank. Three leading accounts and at most five neighboring
  accounts are returned, never a complete leaderboard or raw orders.
- Personal monthly goals 1, 3, 5, then one more delivery. Personal cumulative
  milestones use uniquely attributed delivered counts, with no invented dates.
  No past monthly awards/positions are manufactured from incomplete dates.
- Aliases use the existing public display name or first-name fallback. No
  customer, product, phone, internal full-name, cost, commission or payment
  fields are returned. The frontend uses plain text, no submitted instructions.

## Exact approval needed

Delegation requires: “Si requiere permisos nuevos/lectura agregada
security-sensitive, presenta alcance exacto para aprobación antes aplicarlo”.
The complete reviewable SQL is [ranking-summary-proposal.sql](ranking-summary-proposal.sql).

1. Create `public.pth_ranking_summary(uuid)`, `SECURITY INVOKER`, and revoke
   execution from PUBLIC/anon/authenticated; grant execution only to existing
   `service_role`. It reads existing orders/accounts internally to aggregate,
   returning only own summary and at most eight display rows. No table grants,
   RLS policies, credential creation, new keys or persistent access changes.
2. Create `public.pth_record_delivery_date()` and the
   `pth_record_first_delivery_date` trigger BEFORE UPDATE OF estado on pedidos.
   On a **future transition** into Entregado it records the server timestamp
   when the old delivery date is missing, otherwise preserves that old date.
   Replaying an already-delivered row leaves its missing historical date
   untouched. It never edits customer or monetary fields. Existing delivered
   rows remain unchanged. This forward recording is necessary so future admin
   confirmations participate reliably rather than remaining undated.
3. Deploy the prepared `secure-data` code with the new `ranking` action and
   `ranking.mjs`, preserving every other live source file and existing custom
   session authentication/`verify_jwt:false`. Only an active verified gestor,
   child or admin can invoke it. Body must be exactly `{action:"ranking"}`;
   actor UUID comes solely from the verified session. Caller-chosen account,
   month, limits, instructions, generic RPC invocation and mutations are denied.

Publish the accompanying static frontend only after the approved backend/SQL
are verified. It removes the old attempted cross-account order query and
level-4 gate, showing the new card directly in Inicio. Ranking stays out of
offline storage, service-worker response caches and public pages. Loading,
offline, error, retry, logout and late-response fencing are explicit.

## Verification and rollback

384 Node tests passed including the independent-start/offline-state check.
Real Chromium storefront
checks passed for visitor/gestor/child/admin, level-zero availability, aliases
as text, mobile widths 320/390/820, error/retry, duplicate reads and interrupted
responses. All browser traffic uses labeled synthetic fixtures; no real orders
or external messages. CSS/JS builds, generated-JS check and diff check passed.

The exact aggregate SELECT was executed read-only against the live schema;
it returned bounded October metadata with zero current dated entries. Synthetic
CTE-only PostgreSQL tests verified own/child/admin, same-alias different UUIDs,
2/2 ties, single child attribution, ambiguity, missing dates, canceled orders,
future-date rejection and both repeated midnight hours included in November.
No function, object, grant or real order was created by those tests.

Rollback frontend with a normal revert. Remove the new ranking Edge action,
drop only the new ranking function and delivery trigger/function if approved
and installed. Preserve any delivery dates legitimately recorded after release;
do not erase them or reverse financial triggers. Do not revert the separate
public-name schema or backend improvements. Prior 403 blocks on live runtime,
Pages/Actions and public-site verification remain; never bypass them.

Tutorial capture checklist is saved separately for the later phase. No tutorial
screenshots were taken during this ranking implementation.
