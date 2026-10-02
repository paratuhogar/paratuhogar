# Sales tools and slow connections — 2026-10-02

Baseline: `d3c8941dd160fc029fbbc489d5fa2f3898ff333b`, existing
`paratuhogar/paratuhogar` main/root GitHub Pages source, `paratuhogar.org`.

## Release scope

- Load the sales-message composer, photo ZIP action and catalogue PDF action
  only after their buttons are pressed. The original action bodies are unchanged.
  The existing optional loader handles deduplicated downloads and manual retries;
  a repeated tap shares one pending action. A session change while downloading
  cancels the action. Loading feedback does not overwrite the action's feedback.
- Deliver smaller generated JS entrypoints, with Terser 5.51.2 pinned for local
  builds. Compression transforms and identifier mangling are disabled. Keep
  readable sources and verify byte-for-byte reproducible generated files with
  `npm run check:js`; rebuild after source edits using `npm run build:js`.
- Use the existing 192px logo asset for the 32px header logo. This saves 27,453
  image bytes; social/SEO image references are unchanged.
- Fix direct navigation to `/offline-catalog.html`, including query strings, and
  the saved-catalogue link from the offline fallback page. These previously
  returned the generic offline page despite an existing public catalogue copy.
  Only this explicitly public route joins the root/index offline reader fallback.
- Advance the worker and notification registrars together to
  `20261002-fasttools1`, cache `pth-public-static-2026-10-02-fasttools1`.
  The minimal public reader remains unchanged. Private routes get the generic
  offline fallback; API responses and private documents are not cached.

No backend publication, database, access, authentication, commission, payment,
order-history or customer-data change. No real orders or notifications in tests.
The separately approved visual redesign of the data-saving control is pending:
its required reference image could not be materialized through Library. This
release does not claim that visual work is complete.

## Measurements

Local HTTP gzip + Chromium/CDP, mobile 390px, 430 synthetic public products,
data-saving mode, 900ms latency. CDN/SDK/font/API/external-image responses were
simulated; their real production byte costs are excluded. These are controlled
comparisons, not measured Cuban performance or availability guarantees.

| Link | Previous cold main catalogue | Optimized cold main catalogue | Improvement |
| --- | ---: | ---: | ---: |
| 50 kbps | 65,305ms | 52,109ms | 20.2% |
| 100 kbps | 34,107ms | 27,510ms | 19.3% |

Both runs made 46 local requests; measured encoded resource bodies fell from
306,452/306,450 to 224,220 bytes (main document excluded). No product photos load
in the main grid with data-saving mode enabled; the first page has 24 photo
buttons. The sales module is absent from startup requests and is about 5.8KB
gzip when explicitly opened.

The public reader still has about 14KB gzip of local document/dependencies.
Existing reader/checkout regression measurements: first public copy 6,263ms at
50kbps and 4,584ms at 100kbps; offline repeat 109ms and 100ms. Stored public copy
and cart draft survive worker upgrades. Saved stock/prices are dated snapshots;
placing an order requires live confirmation. Returning online never submits an
order automatically.

## Validation and rollback

Node regressions cover authorization, isolation, validation, catalogue recovery,
prices/commissions, payments and order history. New loading checks cover double
tap, interrupted loading, missing loader, retry, changed session, retained action
feedback and reproducible builds. The catalogue export checks still reject stale
or loading selections, changed sessions and failed description hydration; they
transfer only commercial fields.

Actual browser fixtures use the generated entrypoints for visitor, principal,
child and admin profiles. They exercise search, filters, pagination, cart,
assigned prices, nested-product Stories, a failed composer download and retry,
concurrent composer opening, WhatsApp text generation, and same-tab PDF export.
Public reader tests cover 320/390/1280px, filters, worker upgrades, direct offline
reader URLs and the link from the offline fallback. Existing synthetic checkout
tests prove double-tap/lost-response/manual-retry recovery without duplicate
inserts; the historical row is unchanged. Notification UI is checked for five
profiles; compiled CSS preserves dynamic, responsive and dark-mode utilities.

Publish only these static source/generated assets to the established main/root
Pages target after checks and a remote-head comparison. Record the actual commit
and successful Pages run separately. The build must use `npm ci`,
`npm run build:js`, `npm run check:js`, `npm run build:css` after future source
changes; Tailwind scans source modules and excludes generated `.min.js` copies.

Rollback by reverting this release commit without a force push and publishing a
new matching worker revision across its registrars. Keep public catalogue/cart
data and image caches, and keep secure-data v18 unchanged. Baseline source stays
in the Git history at the SHA above. Verify Pages completion and public-domain
propagation before reporting recovery.
