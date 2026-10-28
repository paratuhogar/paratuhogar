# Admin subgestor review Implementation Plan

> Execute inline using executing-plans, with tests before implementation and a read-only code review before completion.

**Goal:** Let verified administrators and the owning principal review pending subgestor orders safely.
**Architecture:** One service-role-only PostgreSQL operation locks a pending ID, verifies the current actor, edits or decides atomically, and records a private audit event. Both existing parent controls and the new lazy admin panel use the same gateway action. Old generic approval/edit/delete calls require a page update; no unaudited legacy route remains.
**Tech Stack:** Existing JavaScript, Supabase Edge gateway, PostgreSQL; PGlite disposable SQL fixtures, Node tests and browser fixtures. No Docker.
**Spec:** `docs/superpowers/specs/2026-10-27-admin-subgestor-review-design.md` (approved).

## Global constraints

- Keep original IDs/references, prices, commissions and parent attribution.
- Do not change credentials, roles, session behavior or subgestor financial visibility.
- No real orders may be edited/approved/rejected as a test.
- Do not publish until separately authorized. Keep newer remote changes intact.
- UI follows existing ParaTuHogar admin blue/slate styling; compact reference-first cards, mobile single-column form, explicit labels, keyboard focus, no decorative animation.

## Task 1: Atomic database and gateway operation

**Files:** `supabase/proposals/subgestor-review.sql`, `supabase/functions/secure-data/subgestor-review.mjs`, `handler.mjs`, `tests/subgestor-review.test.mjs`, `scripts/verify-subgestor-review-sql.mjs`.
**Interface:** `reviewSubgestor(db,body,actor)` consumes a verified actor and `{operation,id,expected,changes,reason,search,offset}`; calls `pth_review_subgestor(p_actor_id,p_operation,p_id,p_expected,p_changes,p_reason,p_search,p_offset)` and returns `{data,error:null}`. Operations list/history/edit/approve/reject. Lists return `{rows,hasMore}`; mutations return `{id,reference,decision,replayed}`. Row version is `md5(to_jsonb(pending)::text)` returned as `review_version`.

- [x] Write failing Node tests for non-admin/non-parent denial, forged actor/financial fields, invalid reason/version, stable gateway actor binding and error handling.
- [x] Write executable PGlite tests using synthetic tables matching inspected production columns. A missing SQL file/function must fail before implementation.
- [x] Implement RLS-protected `pth_subgestor_review_events` with immutable snapshots, actor/decision/server timestamp, partial unique final decision. Grant function execution only to service_role, no public table access.
- [x] Implement per-ID advisory lock plus row lock; validate active actor/parent ownership; same-decision replay only after checking owner, conflicting final decision fails; stale expected row fails; edits whitelist delivery fields; approve copies only stored financial fields to existing `pedidos` columns; reject requires nonempty bounded reason. Audit and approval source removal are in the same transaction; rejection retains a terminal Rechazado row for receipt recovery; SQL failures roll back all writes.
- [x] Lists use 50-row pages, deterministic order, literal case-insensitive reference/customer/child/parent search and role scope. History exposes event metadata to admins only, not private snapshots to sellers.
- [x] Gateway permits the existing parent/admin roles, validates bounded inputs and calls only this internal RPC. Generic legacy approvals/edits/deletes fail with an update-page instruction so cached pages cannot bypass the transaction. Test rollback, retry, snapshots, grants and scope before commit.

## Task 2: Shared UI and parent integration

**Files:** `js/subgestor-review.js`, `js/secure-data.js`, `index.html`, `js/storefront.js`, `subgestores.html`, `css/subgestor-review.css`, `tests/subgestor-review-ui.test.mjs`.
**Interface:** `PTHSecureData.reviewSubgestor(body)` pins the verified token. `PTHSubgestorReview.open()` lazily lists and displays admin rows; `PTHSubgestorReview.decide(row,operation,reason)` submits the row version. Parent handlers use the same API, preserve voucher generation, and send delivery edits with the displayed original version.

- [x] Write failing behavior tests for reference search, paging, role guard, stale-account response suppression, safe text rendering, single-submit controls, edit/vuelto preservation and confirm/reject cancellation.
- [x] Add admin tab with pending counter, search, load-more, refresh, optional audit history, explicit edit form and buttons. Use DOM textContent for all user data. Preserve entered fields on recoverable errors and clear private data on session change. Load no pending data on initial logistics render.
- [x] Add a separate vuelto field that replaces only the standard `[VUELTO: …]` tag, preserving all other delivery text. Do not edit financial fields.
- [x] Replace parent approve/delete/edit operations with shared action. Keep voucher amounts from the saved pending row. A rejected order is audited, never permanently deleted without trace.
- [x] Run Node tests plus existing parent voucher/privacy/session tests and review the diff before commit.

## Task 3: Release preparation and regression review

**Files:** entrypoint versions, service-worker allowlist/shell version, associated cache tests and deployment instructions.

- [x] Build `storefront.min.js`; update coherently all changed script URLs and the offline shell version without changing authentication implementation.
- [x] Run SQL fixture script, new review suites, existing secure-data/checkout/subgestor suites, cache tests, `scripts/build-js.cjs --check`, and `git diff --check`.
- [x] Inspect synthetic browser desktop/mobile flow without contacting production API; test slow responses, account switch and two decisions. Declare any unavailable true multi-session Postgres verification instead of claiming it.
- [x] Request read-only code review, fix important findings and rerun verification. Commit only scoped files. Deliver local implementation plus explicit deployment prerequisites; do not apply SQL, deploy gateway, publish main, or operate real orders without publication authorization.
