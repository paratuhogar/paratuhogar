# Ángel: new gestor application notifications

Specific user approval was received after confirming Angel Rodriguez, account
`6193f310-1e3f-4404-b874-977d0e23a6a0` (active superadmin, no parent).
Baseline/source rollback commit: `f9953236a0cfd762f62b07c086bba577f98405f2`.
The existing project is `ljqwaovevfatkiigirhf`; Pages target remains main/root,
`paratuhogar.org`. Mac clone sync and public signed-in propagation checks belong
to the parent. A source push alone is not evidence of public propagation.

## Deployed state

- `20261002004438_admin_push_applications_scoped_preparation` applied: widened
  topics/kind CHECKs, replaced enqueue and claim functions, added one disabled
  AFTER INSERT trigger on gestores. No backfill, new table or public grant.
- Existing gateway v14 and dispatcher v5 source were captured and compared to
  local source before changes. The gateway matched; dispatcher used an older
  shared push module without the latest readiness diagnostics. Deployment uses
  the current gateway-compatible module without changing its delivery checks.
- `secure-data` v15 and `admin-push-dispatch` v6 are ACTIVE. Remote code retrieval
  matched every uploaded source/config file after deployment. Existing custom
  authentication is preserved (`verify_jwt=false`); no credentials were created,
  read, changed or transmitted. Pinned runtime dependencies/lockfiles included.
- `20261002004640_admin_push_applications_activate_verified_source` applied after
  matching source verification. Three named triggers are enabled: orders,
  improvements and applications. New enqueue is principal `estado='pendiente'`
  INSERT only; child requests, active accounts and UPDATEs do not create events.
- The single existing cron job 5, `pth-admin-push-dispatch`, remains enabled,
  every minute. No new cron/Vault/secret configuration was made.
- Read-only checks at 20:48 Cuba on 1 October (00:48 UTC 2 October): zero
  eligible application devices for Ángel and zero application events. His account
  was not subscribed automatically. No old requests or fake applications sent.
- Scheduled runs at 20:45/46/47 Cuba succeeded. Corresponding safe response
  projections showed HTTP 200, no timeout, processed=0 and all counters zero.
  This confirms dispatcher runtime/configuration accepts the existing scheduler;
  it does not demonstrate a real device delivery.
- Actual RLS remains enabled on all three push tables. anon/authenticated retain
  no CRUD/TRUNCATE; service_role still has no TRUNCATE. The claim RPC is invoker,
  service-only, empty search_path. The internal enqueue remains definer with an
  empty search_path and no public/anon/authenticated/service execute grant.
  Existing private table/source uniqueness and lease/retry limits remain.
- Security advisor counts/findings match the pre-change snapshot after excluding
  observation timestamps. The expected private-table RLS-without-public-policies
  info finding remains; browser roles have no grants. No new finding was introduced.

## Behavior and privacy

The application audience requires the confirmed UUID plus a current permitted
administrative role, active principal account, matching current session and
credentials, nonexpired/nonrevoked device, and explicit `applications` selection.
Other owners/admins, parent-linked accounts, gestors and messengers cannot enroll
or receive this topic. Order/improvement audiences are unchanged. The source
must still exist, be principal and pending at dispatch; an already processed or
deleted request does not produce a stale notice.

Only generic `{version:1,kind:'applications'}` is encrypted. No applicant name,
phone, text, screenshot or source ID is included in a notification. Text is fixed;
the click target is `index.html?admin_alert=applications`. Restored session and
server topic rights are checked before opening `aprobaciones`. User-provided
URLs/instructions never influence content/navigation/execution.

The frontend adds an unchecked “Nuevas solicitudes de gestores” choice only when
server configuration grants it. Existing saved topics remain, and no new topic,
permission request, device subscription or pilot is created on page load.
The current root worker version is `20261002-applications1`; opt-in waits for
that worker to activate. PWA registration uses the same version to prevent an
older URL registration from replacing the push-capable worker. Public shell
cache is advanced; protected pages/data/screenshots remain outside caches.

New requests are captured after activation; events expire after one hour.
Devices enrolled after an event do not receive it. Delivery is normally checked
by the existing one-minute scheduler, subject to browser/network/provider limits
and the existing bounded retries. Exactly-once or immediate receipt is not claimed.

## Validation

171 Node tests pass, including the existing authenticated/private feedback,
catalog/role protections and new exclusive-audience, explicit enrollment,
canonical-source and fixed-link tests. Local PostgreSQL executes the real SQL
and validates: disabled staging, no backfill, duplicate source/claim suppression,
rollback isolation, principal/child/UPDATE boundaries, preserved order/improvement
recipients, explicit opt-out, late enrollment, inactive account/expired sessions,
private RLS/grants and real service-role invoker execution. Containment rollback
is exercised locally and preserves new order/improvement insertion behavior.

Chromium passes existing push scenarios plus Ángel's new and already-enrolled
choice scenarios: no auto-enrollment, unchecked new topic, saved topics retained,
permission denial, failed save cleanup and identity change. The actual settings
page is exercised for Ángel, another owner, ordinary admin, gestor and subgestor,
with controlled data/browser permissions. Nine bounded interruption cases and
visitor/gestor/subgestor full storefront startup pass. No production test rows,
subscriptions or pilot sends were created.

Official function/security documentation was consulted. Changelog markdown
retrieval was unsupported by web and the shell request returned 403; it was not
retried or bypassed. No new Supabase API/library convention was introduced.

## Ángel's voluntary device setup

1. Sign in with his own account at `https://paratuhogar.org/`.
2. Open Administración → Notificaciones. If a PWA update banner appears, choose
   Actualizar ahora and reopen the page.
3. Check “Nuevas solicitudes de gestores”; for the first applications-link test,
   leave other topics unchecked. Add other topics afterward if desired.
4. Click “Activar notificaciones” and grant the browser's notification permission.
5. Confirm “Notificaciones activadas en este dispositivo para tu sesión actual.”
6. Optionally click “Enviar aviso de prueba”, then verify receipt and that its
   click opens Solicitudes de gestores. The test is generic, not a fake application.

Repeat for each device. On iPhone/iPad, use a compatible iOS/iPadOS version,
add the site to the home screen and open from that icon. Sessions/devices expire
under the existing session policy; signing out revokes them. Reopen settings and
activate again after a new session if required. Existing browser subscriptions
belonging to another account/session must be deactivated before re-enrollment.
The pilot opens the first selected topic: select only applications for its first
test if he wants to verify the applications destination, then add other topics
and click Activate again. No real delivery is claimed until Ángel completes this
voluntary check.

## Rollback

Containment: disable only `pth_push_new_application`. Preserve the original two
triggers, existing cron and private rows. Captured pre-extension runtime source:
`/workspace/scratch/applications-rollback-v14-v5/secure-data` and `dispatch`.
Restore those files/config (with the repository's pinned lockfiles) through normal
Edge Function deployment; platform versions increase rather than rewinding.
Revert this frontend release over current main, never force-push/reset.

`supabase/proposals/admin-push-applications-rollback.sql` disables the new trigger
and restores captured enqueue/claim code and execute permissions. Leave widened
CHECKs in place; narrowing them may fail once application events/topics exist.
No rows, devices, secrets, customer records or historical requests are deleted.
Queued application delivery is rejected by the restored dispatcher, which
recognizes only orders/improvements. This containment has been tested locally.
