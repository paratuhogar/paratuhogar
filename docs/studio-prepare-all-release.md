# Magic Studio — complete preparation, 3 October 2026

Base: `1a0f6c2` from current `origin/main`; isolated worktree/branch
`feat/studio-prepare-all`. Existing work, including the latest generated SEO
pages, is preserved. Deployment target remains GitHub Pages main/root,
`paratuhogar.org`.

## Result and bounded scope

Select products, click **Preparar todas**, then download the complete selection
or share. There is no **Preparar siguiente tanda** in Magic Studio. Series
generates every selected product; individual/package/compare/multi preserve
their existing composition rules. One image downloads as JPEG; multiple images
download as one ZIP containing every JPEG and the public catalogue text.

Generation uses one canvas at a time, disposes it after each JPEG and yields to
the event loop. JPEGs are placed in a temporary IndexedDB store, separate from
offline orders/customer data. ZIP STORE uses CRC reads of 64 KiB and disk-backed
Blob references; no aggregate typed array of all image bytes or extra ZIP CDN
dependency. The browser owns Blob backing and download buffering; this is not
a claim about a particular phone's physical memory usage.

Output is capped at **128 MiB**, a single image at **12 MiB**, and temporary
stored JPEGs across jobs at **256 MiB**. Limits/storage errors are visible and
never produce an apparently complete partial ZIP. Completed images survive
recoverable preparation errors and resume after an explicit retry with fresh
catalogue verification. Cancel, option/selection change, session change,
pagehide and the five-minute ready expiry remove this job's artifacts and
abort pending writes. Orphans after a crash are swept after two hours; no key,
auth token, profile, product record, commission or customer record is stored.
The only stored fields are random job ID, index, public filename, JPEG Blob and
timestamp. Renderers/text receive the existing public field whitelist.

Sharing remains a separate explicit click and calls `navigator.share`
synchronously before asynchronous reads. At most ten images and 12 MiB of
share files are preloaded. `canShare` does not guarantee that the native share
accepts a larger count. After sharing, the next group is preloaded automatically.
Each native share still needs another user click. Resolving the OS share API
does not prove delivery in WhatsApp. Incompatible browsers use the complete
download; prices and authentication expiration are unchanged.

Quick Story retains the original single-product Batch implementation. The
shared Story dialog retains its existing batch flow. No Supabase schema,
functions, permissions, credentials, orders, payments or commission rules are
changed. Cache-busted Studio/loader entrypoints and the public static cache
update together; the push worker registration version stays unchanged.

## Verification

- Complete Node suite: 355 passed.
- Chromium Studio: 1,003-item catalogue, full filter selection, 23 selected
  images from one click, complete ZIP checked with an independent JSZip CRC
  reader; more than 12 MiB, UTF-8 filenames, complete text and no private fields.
- Native capability fixtures: automatic groups of 10/10/3 even when `canShare`
  accepts all 23 small images;
  explicit user activation, repeated clicks and native cancellation.
- Recoverable image failure resumes saved JPEGs; quota errors, missing data,
  interrupted writes, cancel, repeat, fresh prices and changed options checked.
- Tenant/session cleanup, hidden child-account products, all four templates
  and both sizes, composition modes; layouts at 320/390/820/1366 px.
- Quick Story at 320/390/1280 px; storefront startup with visitor, principal,
  child and admin; lazy loader ordering/retry passed. Fixtures only, no real
  shares/orders or production database mutations.
- `npm run check:js`, JavaScript syntax and `git diff --check`.

## Publication / rollback

Source commit `7276fc2d6aa46d7bfdee4e4129f6fe7b28daa320` was published to main
with explicit user approval and confirmed with `git ls-remote`. Live static
deployment verification is blocked by 403 responses from GitHub Actions and
public website reads; do not describe the browser release as verified.
Publishing does not require a database/security/permission action. Before release, fetch main
again and preserve any newer changes; use a normal merge/fast-forward, never
force push. Rollback is a normal revert of this release commit and standard
Pages publication. No server/data rollback is needed. The local artifact
database may contain only bounded orphan artwork until its next sweep.

## Share-denial follow-up, 3 October 2026

The original release incorrectly treated a positive `canShare({files})` as a
safe count limit. The current [Chromium renderer source](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/modules/webshare/navigator_share.cc)
checks known share fields in `canShare`, but rejects more than ten files in
`share` with `NotAllowedError: Permission denied`. We reproduced the application
fault before fixing it: all 23 small images were loaded instead of ten. This
explains a verified failure path matching the reported message; the phone's
actual selection count, host response headers and native target are not known.
Do not claim the user's exact device cause or successful WhatsApp delivery as
verified. The [Web Share specification](https://www.w3.org/TR/web-share/) also
requires an allowed document policy and transient user activation.

The follow-up always caps native groups at ten images and 12 MiB. A native
`NotAllowedError` on a multiple-image group preserves the complete archive and
current position and offers one image per fresh click for the rest of that
job. It never calls the native API automatically after an error. Cancellation
preserves the current group. Recognized blocked document policy and missing
user activation are checked without changing browser/server permissions.
Magic Studio and Quick Story show fixed Spanish recovery messages rather than
arbitrary browser error text. The existing five-minute expiry/session cleanup
and complete ZIP generation/download stay unchanged.

Verification: 377 Node tests passed; actual local Chromium UI tests passed for
10/10/3 grouping with Chrome-like false-positive capability, rejection,
cancellation, position/archive preservation, single-image retry, duplicate
clicks and a six-second callback that loses activation. Native OS sharing is
simulated in those tests; JPEG rendering and download are real local browser
operations. Studio layout remains checked at 320/390/820/1366 px; Quick Story
at 320/390/1280 px. `npm run check:js`, JS syntax and `git diff --check` passed.
One pre-existing pending-order test mixed its frozen queue clock with real
`Date.now()` and intermittently rejected its own valid fixture; only that
test's timestamp was aligned with its fixture clock. No order runtime changed.

Cache-busted changed Studio/Story assets and loader entrypoints use
`20261003-sharefix1`; the public static cache updates together. The push-worker
registration version is unchanged. This release changes frontend sharing and
tests only, with no database, authentication, prices, commissions, payments,
customer-data or permission changes. Publish by normal main fast-forward;
rollback by reverting this follow-up commit and publishing normally. Do not
undo the separate public-name backend or migration. The user confirmed that
the earlier complete ZIP download works; phone confirmation of this sharing
follow-up is pending. Prior 403 blocks on Pages/Actions and public-site reads
remain verification limits; do not retry through alternative routes.
