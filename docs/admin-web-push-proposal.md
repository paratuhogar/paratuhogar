# Admin Web Push: prepared, NOT activated

Update after explicit user approval: preparation migration
`20261001221521_admin_web_push_disabled_preparation` applied and secure-data v8
deployed. Tables have RLS and no browser grants; both INSERT triggers are DISABLED.
The settings backend has an additional code-level false readiness flag, so secrets
alone cannot enable delivery. No credentials, subscriptions or cron created.
141 Node tests plus local PostgreSQL and real grants/trigger-state checks pass.
See `docs/push-secure-setup-es.md` for user-operated setup. The sections below
describe the approved design and remaining activation work, not an active service.

Stable published main: `b801001e60a23a3265a82bafe712931a521c8eee`.
Development branch: `feature/admin-push-preparation`. No credentials generated,
no subscriptions, no real notification sent. Prepared component,
worker handler and policy are deliberately not imported into production entrypoints.

## Inspection

No Web Push/VAPID/subscription implementation exists in repository source.
Read-only production metadata found no push/outbox/notification tables. Existing
Edge Functions are secure-data v7, google-statistics v3 and swift-responder v10;
none is identified as a push sender. Existing service-worker handles only public
cache/offline behavior. pg_cron, pg_net and supabase_vault are already installed.
Secret values were not read; available connectors expose no secret-management
action, so unused remote VAPID configuration cannot be ruled out or configured here.
Do not extract management tokens or reuse unknown secrets to bypass this limitation.

## Approved configuration scope

1. Apply reviewed `supabase/proposals/admin-web-push.sql`: three private tables
   (device subscriptions, minimal event queue, per-device delivery records), RLS
   with no browser policies/grants, existing service-role CRUD for delivery/cleanup,
   and two AFTER INSERT triggers on `pedidos` and `pth_feedback`. Triggers only
   enqueue metadata; no order/customer/price values are changed. No backfill.
2. Generate a VAPID P-256 key pair if no approved existing pair is available.
   Store `PTH_PUSH_VAPID_PRIVATE_KEY` exclusively in Supabase Edge secrets; its
   public key can be returned by the authenticated settings endpoint. Set public
   VAPID subject `https://paratuhogar.org` (no new mailbox needed).
3. Generate `PTH_PUSH_DISPATCH_SECRET`, restricted to this dispatcher, stored in
   Edge secrets and Supabase Vault for the scheduler. No key belongs in Git,
   browser storage, report text, logs or chat. This is new persistent access and
   needs explicit approval plus a supported secret-management path/operator.
4. Deploy an authenticated dispatcher and extend the existing secure-data gateway
   with own-subscription config/save/remove operations. Configure one pg_cron job
   every minute via pg_net, authenticated with the dispatch secret. No new paid
   service/signup; existing project usage applies. Preserve current worker caches.

No request to broaden feedback visibility is included. Order notifications use
the current global administrative order-read roles; improvements only the existing
OWNER_IDS with current admin status. Parent-linked admins, gestores and messengers
do not qualify. If Angel/another admin lacks feedback review rights, they cannot
receive private-improvement alerts until a separate permission decision names the
account/role and allowed scope. Bug reports are not a requested push category.

## Prepared behavior and pending integration

`js/admin-push.mjs` is an opt-in settings component with server-supplied allowed
topics, explicit checkbox choice and a user-click browser permission prompt. It
never prompts during mount, never accepts permission itself, and stays disabled
when the backend is unavailable. Adapter contract: config derives allowed topics
from the verified actor; scope binds the existing opaque session; registration
returns the existing root worker; save/remove use the captured session, never
client-supplied actor IDs. Failed new subscriptions are unsubscribed; session
changes abort; disable attempts server removal and browser unsubscribe.

Desktop and Android use capability detection. iPhone/iPad guidance requires
opening the Home Screen web app on a supported system. See
[WebKit guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
and [MDN user-gesture/subscription requirements](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).

`js/admin-push-worker.js` ignores arbitrary payload text/URLs. Lock-screen content
is generic; click destinations are fixed same-origin admin routes with no customer
or report IDs. Before wiring this handler, implement those deep links so the page
restores authentication and checks authorization before opening logistics/review.
No private data is cached. Prepared policy rechecks actor, session expiry, current
credential hash, device binding, expiry/revocation and allowed topic before send.

Events: AFTER INSERT into canonical `pedidos`, and AFTER INSERT into feedback only
when kind=mejora. Queue insert is transactional: rollback yields no event. Checkout
idempotency already prevents duplicate order insertion; queue additionally has
unique(kind,source_id), deliveries have unique(event,subscription). Subgestor
requests notify once when approved into canonical pedidos, not once before and
again after approval. No cart/client click triggers or retrospective notifications.

Dispatcher still needs implementation after approval: atomic leased claims,
bounded retry/backoff, expiry, active-session/credential/actor checks, current
source existence and scope, delete expired 404/410 endpoints, per-session logout
cascade, stale-account cleanup and bounded logs with no endpoints/keys. Only
approved vendor HTTPS push endpoints, no redirects/private IPs/arbitrary hosts
(prevent server-side request forgery). Delivery retry after an uncertain provider
response cannot guarantee exactly once; generic per-topic notification tags can
collapse repeated visible alerts. Do not claim end-to-end push works yet.

Scheduling reference: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Tests and remaining gate

Node tests cover audience/parent isolation, active session/credential binding,
correct event types, desktop/Android/iOS/blocked capability states and inert
generic worker content/fixed click URLs. Browser fixtures cover explicit opt-in,
unavailable backend, denied permission, failed-save cleanup, session interruption
and disable. Permission and push services are mocked; no real subscriptions.
Local PGlite executes the proposed SQL to verify RLS/grants, INSERT-only events,
improvement-only filtering, duplicate suppression and transaction rollback.

Specific approval has been received. Credential setup still requires the user's
secure entry; dispatcher/cron and frontend activation remain incomplete. Keep main available
for the separate Mac clone. No Mac files are touched by this branch.
