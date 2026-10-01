# Admin Web Push: integrated, automatic delivery disabled

The approved integration is implemented. The user entered the VAPID and dispatch
secrets through Supabase; the agent did not create, read or transmit their values.
Only the presence of Vault name `pth_push_dispatch_secret` has been checked.

## Deployed backend

- Project: `ljqwaovevfatkiigirhf` (existing ParaTuHogar project).
- Preparation: `20261001221521_admin_web_push_disabled_preparation`.
- Queue machinery: `20261001225441_admin_web_push_dispatch_machinery_disabled`.
- `secure-data` v10 and `admin-push-dispatch` v2 are ACTIVE. Both implement custom
  authentication; the gateway preserves its existing opaque-session behavior.
- Three private tables have RLS, no browser grants and no browser policies.
  Service role has CRUD, without TRUNCATE. The lease RPC is executable only by
  service role; actual service-role execution returned an empty batch.
- Both INSERT triggers remain DISABLED. No push cron exists. Final metadata
  inspection found zero subscriptions and zero events. No real push was sent.
- `PTH_PUSH_ENABLED=false` is the user setup default. The new code is delivery-ready
  and requires valid configuration plus this flag set to `true` before enrollment
  or pilot. Secret values, including the stored flag, were not read by the agent.
  Verify the runtime's safe config booleans through the authenticated page.

The frontend is `notifications.html`, linked from the existing administration
navigation. It is available only to verified administrative accounts without a
parent. No permission prompt or subscription occurs on load. Each device needs
an explicit topic selection, Activate click and browser permission. The current
worker must activate before subscribing. Failed enrollment removes a newly
created browser subscription; a paused service still permits opt-out.

## Authorization and privacy

Orders use the existing global administrative roles. Improvements use only the
existing OWNER_IDS plus current administrative status. Parent-linked accounts,
gestores, messengers and ordinary admins without review rights cannot receive
improvement alerts. This adds no report or customer-data visibility.

The gateway binds subscription save/status/remove/pilot to the verified account
and session. A conflicting endpoint is never reassigned to another account or
session. Pilot targets are derived server-side and limited to five attempts per
ten minutes per session. Logout revokes the existing session, cascades its devices,
and asks the browser worker to unsubscribe and close admin notices.

Before every delivery the dispatcher checks the current role, account activity,
parent relationship, credential hash, session binding/expiry, device expiry,
topics and canonical source existence. HTTPS endpoints are restricted to known
push vendors; redirects and private/arbitrary hosts are refused. Logs and response
counts do not contain endpoints, keys, provider bodies or submitted text.

Only `{version:1,kind}` is encrypted for the push provider. Lock-screen text is
“Hay novedades en tu panel. Entra para revisarlas.” Fixed same-origin links restore
login and check current server topic rights before opening logistics or feedback.
No report/customer IDs, text, screenshots or private API responses enter caches.

## Events and delivery

An event is inserted in the same transaction as a new canonical `pedidos` row or
a new `pth_feedback` row of kind `mejora`. Rollback produces no visible event.
No cart, payment, delivery or update event exists. Subgestor requests notify only
after approval into canonical orders. There is no historical backfill.

Unique source events and device deliveries suppress duplicate enqueue/fanout.
Atomic SKIP LOCKED claims use two-minute leases and unique lease tokens. Each run
claims at most ten deliveries with two concurrent sends, 12-second provider
requests and at most eight attempts. Retry backoff is bounded and events expire
after one hour. Gone endpoints are deleted. A provider timeout after acceptance
can produce a repeated delivery; per-topic browser tags collapse visible notices.
Exactly-once delivery and immediate delivery are not guaranteed.

## Validation and release gate

157 Node tests pass, covering authorization, device/session ownership, invalid
input, retry enrollment, pilot target spoofing/rate limits, errors, lease results,
credential/role changes, generic encrypted payloads, logout and worker upgrades.
Local PostgreSQL executes the SQL for RLS/grants, audience fanout, INSERT-only
semantics, duplicate suppression, rollback and expired/live leases. Chromium
checks explicit opt-in, denial, failed-save cleanup, interruption, paused opt-out
and the actual mobile settings page for admin/gestor/parent-linked accounts.
The existing visitor/gestor/subgestor catalog startup checks and CSS build pass.
Deno type checks pass for both functions; a standalone Deno runtime encrypted a
synthetic message without network or production credentials. Dependencies are
pinned with committed npm and Deno locks. New advisor finding is only the expected
INFO notice for private tables with RLS and no browser policies.

A real device pilot remains required. Provider acceptance is not proof that the
notification appeared. Automatic event collection and cron must stay disabled
until the user confirms receipt and safe click navigation. The activation SQL is
recorded separately and has NOT been applied. See `admin-web-push-release.md` for
operator steps and rollback.
