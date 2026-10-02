# Administration UI and traffic release, 1 October 2026 (Cuba)

## Scope and target

Baseline `6130309603cce8a1a256e61f55426fb95820fcb4`, clean checkout before work.
Repository `https://github.com/paratuhogar/paratuhogar`, verified remote main at
that baseline. Existing deployment target: GitHub Pages main/root for
`paratuhogar.org`, previously confirmed by the user. Do not retry the previously
forbidden Pages API or public proxy route. Source publication and public website
propagation must be reported separately.

This bounded release changes administration navigation, pending-application
presentation, internal traffic reads/rendering and matching public shell assets.
It performs no database mutation, role/grant change, customer-data mutation,
price/payment/commission change or deployment of push functions. Existing push
worker payloads, opt-in registration URL/version, subscriptions, trigger state,
dispatcher and cron are preserved. The service-worker public shell cache version
is advanced and its resource URLs match the updated HTML; no private responses
or records are added to caches.

## Implemented behavior

- The private administration bar has readable wrapping controls in the existing
  blue palette, responsive two/three/six-column layout, >=44px touch targets,
  keyboard focus, active state and contrast >=4.5. A nested button and duplicate
  `tab-trafico` were removed. Existing destinations/actions remain.
- Pending principal applications default to the inclusive last 7*24 hours. Older
  applications remain recoverable under History. Missing/invalid/future dates
  have a separate review filter. Display timezone is America/Havana. Rows are
  deduplicated by ID and are never deleted/rejected by age. Applicant text is
  rendered with textContent; buttons bind existing actions through listeners.
  A recent count is shown in navigation. It refreshes on existing roster loads
  or manual Update, not a newly configured push notification.
- Roster reads paginate by name/id through the existing authenticated gateway,
  retaining active-team behavior. New pending-row cache is cleared on identity
  changes; generation guards prevent stale in-flight reads from restoring it.
- Traffic defaults to a rolling 30-day window, with 7/30/90-day choices. Link and
  product-view queries paginate in batches of 500 by timestamp/id (maximum
  30,000 rows per source); overflow is an error asking for a shorter period,
  never a silently truncated total. Count of orders is exact, with the same
  UTC time bounds, using the existing authenticated gateway.
- The previous all-time/capped orders-to-clics “conversion” is replaced by
  clearly labeled registered-order count. Attribution/unique-visitor claims
  are not made. The page shows source, query time, window, latest entry and
  Havana activity hours. No IP is read or inferred. Product/country/agent text
  stays inert, with Maps protecting hostile keys. Lists show up to 25 results.
- Visible traffic refreshes every minute. Reads are bounded by a 45-second UI
  timeout; errors/partial responses clear totals rather than present misleading
  zeroes. Chart-CDN failures preserve figures and lists. Leaving the tab,
  administrative mode or changing account stops/invalidates the refresh.

## Concrete diagnosis, read-only evidence

At approximately 20:10 Cuba on 1 October (00:10 UTC 2 October):
`link_analytics` had 91,098 total records and 8,802 in the preceding 30 days;
`metricas_vistas` had 86,969 total and 7,352 in 30 days. Last records were
00:01:16 UTC and 22:59:48 UTC respectively. Both sources were current.
A subsequent same-window check found 258 orders. These are changing snapshots,
not permanent values or unique visitor/conversion metrics.

Old traffic source read link rows without pagination; the generic protected
query defaults to 1,000 rows and returned 1,000 orders to the master page. The
old dashboard reused that all-time order array and partial traffic rows, so
1,000/1,000 could appear as 100% conversion. It also used browser-local hours
while labeling them server hours, and ignored result.error in some reads.

Read-only recruitment aggregate: 5 recent pending, 53 older pending, zero future
dates at inspection. No application was approved, rejected or deleted.

## Validation and limits

166 Node tests passed (163 regression/date tests plus 3 pending-load interruption tests), including authentication/role isolation, private
feedback, catalog projection validation and existing push behavior. The cache
version expectations were updated and the cache/7-day unit suite passed.
Chromium checked 360/390/1280px in light/dark modes: navigation/contrast/focus,
recent/history/missing dates, inert applicant/analytics text, action binding,
1,601 traffic rows and 1,100 product views beyond API caps, query bounds,
partial-read failure, retry, unavailable charts and tab interruption.
Existing browser suites also passed: visitor/gestor/subgestor storefront startup,
12 private feedback variants, notifications page and compiled CSS. Nine existing
push interruption scenarios passed. CSS build passed.

Synthetic data was used for browser checks; no real account was signed in,
no production application or fake order was written and no real notification
was sent. Actual submitted screenshot bytes were unavailable: Library's
supported materialization failed twice. Local rendered previews were inspected
at `/workspace/scratch/admin-panel-preview`; do not claim the supplied screenshot
pixels were inspected. Parent owns a real signed-in/public propagation check and
Mac-clone sync once the source hash is reported.

## Applications notification: initial approval checkpoint

The approval recorded below was subsequently received. The scoped extension is
implemented and active; see [admin-applications-push-release.md](admin-applications-push-release.md)
for deployed versions, verification, opt-in steps and rollback. This section
preserves the earlier checkpoint.

### Initial precise approval boundary

Authoritative candidate: `Angel Rodriguez`, ID
`6193f310-1e3f-4404-b874-977d0e23a6a0`, active `superadmin`, no parent; exact
expected-email predicate matches `angelrodriguezfleites@gmail.com`. Another
principal account named Angel Hernández Gutiérrez is an ordinary gestor.
The user confirmed this is the requested Angel: “es Angel Rodriguez si”.

Two questions were presented: confirm candidate account and authorize the
following extension of existing private push machinery. Identity is confirmed;
the separate database/server authorization question remains unanswered. No
related database/server changes have been applied:

1. Extend `pth_push_subscriptions` topics CHECK to allow `applications`, with
   topic cardinality 1..3; extend `pth_push_events.kind` CHECK likewise. Existing
   RLS/browser denies, service grants and UNIQUE constraints remain.
2. Extend `pth_enqueue_admin_push()` with an INSERT-only principal application
   branch on `gestores`, `parent_id IS NULL`, `estado='pendiente'`; add only one
   new AFTER INSERT trigger `pth_push_new_application`. Preserve both existing
   order/improvement branches and triggers. No backfill or state UPDATE trigger.
3. Extend the service-only lease/fanout function so applications are delivered
   only to this confirmed UUID with a current permitted admin role, active
   account/session, matching credentials and an explicitly enrolled topic.
   Keep existing order/improvement audiences, bounds, leases and retry policy.
4. Update and deploy secure-data topic validation/config and admin-push-dispatch
   canonical-source validation for `gestores` application events. Fixed generic
   encrypted payload remains `{version:1,kind}`, with no names, phones, IDs,
   form text or screenshots in notification content. No new credentials,
   public grants or cron job are required.
5. Add the Applications opt-in topic only for the confirmed account. Existing
   subscriptions are not enrolled automatically. Extend the fixed worker/link
   mapping to `index.html?admin_alert=applications` and verify server topic
   authorization before opening `aprobaciones`. An authenticated panel badge/
   private notice for Angel can use existing roster access, without browser
   permission; push needs his explicit device activation.

After precise approval: inspect actual constraint/function definitions, prepare
and locally test a bounded transactional migration (role isolation, rollback,
deduplication and no backfill), preserve pre-change function source, deploy
compatible source before enabling the new trigger, and verify an opted-in
Angel device without inventing applications. Approval of this UI release and confirmation of Angel’s identity do
not infer an answer to the remaining database/server authorization question.

## Rollback

Normally revert the UI release commit over current main, never reset or
force-push. This restores preceding static HTML/JS/CSS/cache resources while
preserving private data and the functioning push backend. No database rollback
is needed for this bounded release.
