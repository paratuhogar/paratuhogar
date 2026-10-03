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
synchronously before asynchronous reads. At most 12 MiB of share files are
preloaded. If the entire selection fits that budget and real `canShare` accepts
it, it is shared together even above ten files. Otherwise a compatible bounded
group is loaded; after sharing, the next group is preloaded automatically.
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
- Native capability fixtures: all 23 small images together or automatic groups;
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
