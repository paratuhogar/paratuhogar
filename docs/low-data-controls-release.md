# Clear data-saving controls — 2026-10-02

Previous release: `b0b689a05c1f830e6ea636d870f7fb90b6a6f009`.
Target remains `paratuhogar/paratuhogar` main/root GitHub Pages with CNAME
`paratuhogar.org`. This follow-up completes the separately approved control UI.

## Result

The previous small checkbox and inline saved-catalogue link were inspected in
the actual local application, using generated browser entrypoints and synthetic
data. The supplied Library screenshot was not downloaded or inspected: its
authorization failure was respected. Subsequent authorization allowed direct
inspection of the application's own local UI.

Two distinct cards now show:

- **Ahorro de datos**: Activado/Desactivado status, an explicit Activar/Desactivar
  ahorro action, and a short explanation of the actual product-photo behavior.
  The existing saved preference and public-product image helper remain in use.
- The actual public-card photo test exposed a navigation bug: replacing the
  photo button inside the product anchor still followed that enclosing link.
  The photo button now prevents the anchor's default action as well as stopping
  propagation. It loads the chosen photo without leaving the catalogue; normal
  product/detail links are unchanged.
- **Catálogo guardado**: a separate root reader link, the snapshot date in Cuba
  time, an indication when the copy needs updating, and instructions when no
  copy exists. Prices and availability always need online confirmation before
  an order; the UI does not describe an offline copy as current inventory.

The blue/white cards follow the site's palette, with dark mode, a two-column
desktop layout and stacked mobile layout. Native buttons/links have at least
44px touch targets, visible focus and text contrast of at least 4.5:1 in the
tested states. The toggle exposes aria-pressed and explanatory text; focus is
retained when the panel updates. Receipt messages remain separate from the
copy date. Existing manual receipt/cart actions keep their original handlers.

No schema, backend, permissions, credentials, prices, commissions, payment or
order-history changes. No new external resources. Readable source and generated
JS remain reproducible with the pinned build. The changed CSS is 3,452 raw bytes,
1,098 bytes with local gzip. Worker/notification registrars advance together to
`20261002-fasttools2`; the previous public reader and its stored data are retained.

## Absolute measurements

| Condition | Before both optimizations | Final optimized main catalogue |
| --- | ---: | ---: |
| 50kbps, 900ms latency | 65,305ms | 52,340ms |
| 100kbps, 900ms latency | 34,107ms | 27,627ms |

Method: local HTTP gzip, Chromium/CDP mobile 390px, 430 synthetic public products,
data-saving enabled, cold browser contexts. SDK/CDN/font/API/external-image
responses are simulated, so their real production costs are excluded. Timing
ends when the real main application has its synthetic catalogue available;
the first grid has 24 photo buttons and zero product images.

Both versions made 46 local requests. Encoded resource bodies (main document
excluded) fell from 306,452/306,450 to 225658 / 225658 bytes. Final offline root
navigation was 52/45ms and direct reader navigation worked. These comparisons
do not establish a production SLA or measured Cuban connection speed. The
existing separate public reader remains approximately 14KB gzip; the initial
main catalogue still has a substantial cost on very slow links.

## Tests and publication

- 274 Node regressions pass: isolation, validation, sessions, catalogue recovery,
  original commissions/payment/order-history rules and reproducible JS artifacts.
- The delivered UI is tested in 12 visitor/principal × 320/390/1280px × light/dark
  combinations: photo-on-tap, automatic photos when disabled, real keyboard
  interaction/focus, touch targets/contrast, valid/stale/missing snapshots,
  unavailable storage, public-reader navigation and manual saving. These actions
  do not create orders, change personalized prices or request payments.
- Existing actual application fixtures cover visitor/principal/child/admin,
  search/filters/pagination/cart, nested-product Stories, composer retry and
  deduplication, WhatsApp text and same-tab catalogue PDF.
- Actual service-worker upgrades preserve public snapshots, draft carts, image
  caches and unrelated caches; remove prior static caches; and keep root/direct
  public reader access offline. Private routes receive only the generic offline
  fallback. Notification UI checks cover five profiles without prompting or
  subscribing on initial page load.
- The existing local checkout test covers duplicate taps, response loss,
  offline/manual retry, one atomic insert, anonymous receipt and unchanged
  historical records. No production orders or notifications are used.

The preceding Pages build/deploy succeeded for b0b689a (run 37061105262).
The public domain was readable through the authorized web reader. Direct
environment requests to the root and compiled JS returned HTTP 403, preventing
a byte-for-byte public asset comparison; no attempt bypasses that denial.
Record this release's actual commit and completed Pages run separately. Final
public asset verification requires an authorized reader able to retrieve the
HTML, `js/storefront.min.js?v=20261002-fasttools2`,
`css/low-connectivity.css?v=20261002-fasttools2` and
`service-worker.js?v=20261002-fasttools2` from the existing domain.

Rollback this follow-up by reverting its commit without force pushing, then
advance the worker/registrar marker together and rebuild matching JS. To undo
both releases, additionally revert b0b689a. Keep backend secure-data v18 and all
public catalogue/cart data unchanged. The pre-optimization baseline remains
`d3c8941dd160fc029fbbc489d5fa2f3898ff333b` in Git history.
