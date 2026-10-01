# Private admin push: active release and operation

## Bounded release

Activation is complete after the user's confirmed test receipt and click.
Migration `20261001235127_admin_web_push_activate_after_verified_pilot` was applied
on 2026-10-01 at 23:51:27 UTC / 19:51:27 America/Havana. Both AFTER INSERT
triggers are enabled. One active named cron job (id 5) runs every minute.
Empty-queue request 2039 returned HTTP 200, timed_out=false, processed=0 and zero
sent/failed/pending/expired counts at 23:51:52 UTC. The scheduled job recorded
succeeded at 23:52:00 UTC. One device is enrolled; no historical events were
backfilled and no fake order/report was created. Values were resolved only inside
the approved server-side call; the agent did not retrieve or print any secret.


This release publishes only the opt-in admin settings page, generic notification
worker, authenticated fixed links, own-session enrollment/pilot, dispatcher and
private queue machinery. Existing catalog projection `select('*')` hotfix,
prices, commissions, payments, order/customer records, report visibility and
public startup behavior are preserved. The preparation release collected no
events or devices. The subsequent approved activation above enables only future
events after the verified opt-in pilot; it includes no historical backfill.

Frontend target is the existing repository `paratuhogar/paratuhogar`, GitHub Pages
main branch/root, domain `paratuhogar.org`. Source publication is separate from
public Pages verification; the parent performs browser checks and updates its Mac
clone by fast-forward. No local Mac or private setup folder is accessed here.

Backend active metadata: secure-data v14 and admin-push-dispatch v5 (user secret
saves refresh versions; approved source is unchanged). Migrations applied:
20261001221521, 20261001225441 and 20261001235127. Exact SQL is in `supabase/proposals/`.
The dispatch migration added fanout/lease columns, indexes and a service-only
invoker RPC. Activation enables pth_push_new_order and pth_push_new_suggestion and the single
every-minute pth-admin-push-dispatch job.
Rollback gateway snapshot before this release is preserved outside the repo at
`/workspace/scratch/push-rollback-v9/`; its files match published a9d1fb7.

## Readiness without secrets

Use the current authenticated administrative session to request config through
`PTHSecureData.push({operation:'config'})`. Inspect only `configured`, `enabled`, `allowedTopics` and the owner-only
`readiness` boolean object; do not print tokens or private browser subscription keys.
Before the pilot, expected booleans are configured=true and enabled=false.
A false configured flag means the user's secret setup needs correction in the
Supabase UI; it does not authorize the agent to read any values.

Database metadata may inspect Vault name existence, trigger state, cron job name,
counts, RLS/grants and lease-RPC privileges. Do not query decrypted Vault values,
HTTP request queue headers/bodies, device endpoints/keys or session credentials.
Actual claim test under service_role returned zero with no events present.

## User-operated pilot (completed for the first device)

The following records the completed rollout procedure. Additional devices need
only their own opt-in and test; do not reapply the installation migration.

1. Parent verifies public source and private page wiring. User edits only
   `PTH_PUSH_ENABLED` to `true` through Edge Functions Secrets. Other configured
   values stay as entered. Triggers and cron remain off throughout the pilot.
2. User opens `https://paratuhogar.org/notifications.html` with their existing
   admin session, selects permitted topics, clicks Activate and makes the browser
   permission decision. This enrolls only that device/session.
3. User clicks Send test and confirms a visible generic notification. Acceptance
   by the provider alone does not establish delivery. Check the notification click
   restores login and opens only the authorized orders/review view.
4. Confirm device opt-out and logout behavior as appropriate. Record observed
   device/browser and outcome without keys, endpoints or customer/report content.
5. Only after confirmed receipt/navigation apply the approved
   `admin-web-push-activate.sql`. It creates one every-minute pg_cron task and
   enables the two INSERT triggers, without old-order/report backfill. The saved
   job resolves the named Vault secret inside the server at execution; no secret
   value is embedded in SQL or returned to the agent. Check trigger/cron metadata
   and response status codes only. Do not create fake production orders/reports
   without a separately approved test action.

## Rollback

Before activation, return PTH_PUSH_ENABLED to false in the user-operated Secrets
UI to pause all enrollment/pilot/delivery. Revert this frontend release commit if
needed. Redeploy the captured v9 gateway files (or source at a9d1fb7) with the
existing verify_jwt=false custom authentication setting. Keep private additive
schema in place; dropping it is unnecessary and would destroy enrolled devices.

After activation, also disable pth_push_new_order and pth_push_new_suggestion and
unschedule only cron job pth-admin-push-dispatch (current job id 5). Keep other project jobs and
secrets unchanged. Historical queue entries are not backfilled; expired events
cannot send. A browser may still show an already accepted generic notice until
it expires or logout closes it.

## Verification evidence

157 Node tests; SQL PGlite schema/fanout/lease/privilege checks; mobile Chromium
settings and explicit permission/failure/interruption/paused opt-out tests;
visitor/gestor/subgestor startup regression checks; CSS build; Deno type checks
and real encryption runtime using deterministic synthetic fixtures only.
Live database grants, disabled triggers, no cron and empty service-role claims
are checked. Deployment source matches reviewed files. The user has now confirmed actual device receipt and safe panel navigation.
The next genuine automatic new-order/improvement delivery has not yet been
observed; no artificial business record is created just to test it.

## Pilot configuration diagnosis

The owner-only config response now identifies each disabled predicate using only
booleans: deliveryReady, switchOn, publicKeyValid, privateKeyValid,
dispatchSecretValid and subjectValid. Ordinary administrators retain the original
config response without this detail; anonymous and non-administrative accounts
remain denied. No values, lengths, prefixes or hashes are returned.

The refreshed settings module (`push3`) displays the first failed condition in
plain Spanish. Reload `notifications.html?check=push3` after Pages serves this
release. Do not change or regenerate keys before reading this safe result.
If switchOn is false, check only PTH_PUSH_ENABLED in the same project. If a key or
dispatch predicate is false, correct only that named field from the user's existing
private setup file through Supabase UI. If subjectValid is false, the public
subject must be exactly https://paratuhogar.org. The agent does not read any of
those stored values. Real current booleans require the user's authenticated
browser; the environment has no such session and does not extract one.

158 Node tests and focused browser checks pass for this diagnostic addition.
Triggers and cron remain disabled throughout diagnosis.

## Button and stalled-browser recovery

The original shared disabled-button style used cursor:wait even when the service
was unavailable and no request was running. The private push component now hides
Activate until readiness/browser checks pass, highlights the actual status and
provides an explicit recheck button. It overrides the cursor locally; unrelated
feedback styles are unchanged.

Bounded waits cover session/config, browser lookup, permission response, worker
registration itself and activation, subscription, save, pilot, opt-out and failed
enrollment cleanup. Busy controls always recover. A late granted permission does
not automatically enroll; a late browser subscription is unsubscribed without
server enrollment. No permission or configuration requirement is bypassed.

Nine Chromium pending-operation scenarios pass, including cleanup/pilot/disable
timeouts and late config/permission/device responses. Healthy, denied, missing
configuration and actual-page mobile checks pass. 159 Node tests pass. No backend
change, credential edit, event-trigger activation or cron accompanies this UI fix.
The actual user's readiness booleans and device receipt still require their private
browser session. A wait cursor alone does not establish a slow server or bad keys.
