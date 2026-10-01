# Catalogue performance phase 2 — 2026-10-01

Baseline: `1757a756b993efb34b46ad9613a8fefb432acb1a` on the existing
`paratuhogar/paratuhogar` main/root publication source for `paratuhogar.org`.
Static frontend only. Gateway v7, database, authorization, prices, commissions,
customer records, and existing inventory-version checks are unchanged.

## Delivered scope

- Public and gestor catalogue cards select AVIF/WebP 360/720 thumbnails with
  intrinsic dimensions and responsive sizes. Detail, zoom and downloads keep
  originals. Missing derivatives fall back to the original, then a local placeholder.
- 84 currently referenced originals were read from `paratuhogar/paratuhogar-fotos`
  at `c7ac10a7db4ad1fe75f4fbb37fc20395b8fafee2`. Their Git blob hashes were verified.
  Source proof is in `scripts/catalog-image-sources.json`. No original was modified,
  deleted or pushed to the photo repository. Older derivatives remain available.
  New output names hash source content plus the encoder recipe identifier.
- Initial catalogue projection omits only `descripcion`. Search/category filters
  continue to operate on the complete product list. Detail, copy, editor and PDF
  load descriptions on demand; overlapping requests share work in batches of 40.
  Descriptions are memory-only and late responses after account/catalogue changes
  are rejected. Responses cannot overwrite prices or other commercial fields.
  Studio detects the lightweight cache and performs its existing full fetch on entry.
- Existing service workers gain a maximum-100-entry cache of same-origin,
  content-addressed public derivatives only. Queries, authorization headers,
  originals, APIs and private data are excluded. Failed fetches are not cached;
  unavailable storage does not prevent network images from displaying. Fresh
  browsers continue using normal HTTP caching: this release does not add worker
  registration or an eager offline install to the startup path.
- Optional diagnostics run only when manually imported. They aggregate local
  timings/resource sizes without URLs, identifiers, account fields or persistence.
  No telemetry endpoint, paid service, credential or new persistent access.

## Measurements and limits

The 84 originals total **26,892,700 bytes**. One selected derivative per original
totals **380,677 bytes AVIF360**, **549,154 WebP360**, **984,770 AVIF720**, or
**1,469,384 WebP720**. The manifest is **35,523 bytes**. These are local file sizes
across the whole set, not one page's transfer total, live network timings or a
promise of speed on Cuban connections. Browsers request the chosen format/size,
not all four variants. New/unmapped products continue to display originals.

Read-only database aggregates found 430 product rows: JSON-row text 878,654 bytes,
with descriptions accounting for 541,541 bytes. These are database text aggregates,
not the gateway's role-projected or compressed wire payload. The frontend omission
reduces browser response data; the existing gateway still reads SELECT * before
authorization/projection. No database-index change was justified by query timing or
EXPLAIN evidence, and none was applied.

Validation: 132 Node tests pass, including isolation, pricing, recovery, description
batching/races, public cache exclusions/bounds/errors, and existing business tests.
Chromium checks verify 390px DPR2 grid → 360px candidate, 1280px DPR2 grid → 720px,
mobile list → 720px; escaping and original/placeholder fallback. Description UI
covers loading, network retry, unchanged prices, navigation races and session
interruption. Full-page fixtures pass visitor/gestor/subgestor startup, pagination,
search/filter/cart and role-specific commissions. Browser fixtures use synthetic
data, not live customer accounts. CSS build and syntax/diff checks pass; only the
existing outdated Browserslist notice remains. Real field CWV were not measured.

## Reproduce and continue in Codex

Canonical source: `https://github.com/paratuhogar/paratuhogar.git`; cloud checkout:
`/workspace/paratuhogar`. Start from current main in a clean checkout, read any
AGENTS.md added subsequently, inspect status before editing, and preserve local work.
Run `npm ci`, `npm run build:css`, and `node --test tests/*.test.mjs`.
Browser tests additionally require Playwright and Chromium (`/usr/bin/chromium`
in this environment): `node tests/product-images-browser.cjs`,
`node tests/product-description-browser.cjs`, `node tests/startup-browser.cjs`.
They intercept network traffic locally. No secrets or production login are needed.

To regenerate images, checkout the photo repository at the exact proof commit,
derive a newline list from its 84 proof paths with the `img_productos/` prefix
removed, and run the generator with Pillow supporting AVIF/WebP:

```sh
python3 scripts/generate_image_variants.py --source-dir /path/to/photos/img_productos \
  --only-list /tmp/catalogue-image-names.txt --source-tree scripts/catalog-image-sources.json
```

Review visual quality and hashes before publishing a changed encoder recipe.
Do not replace originals. Future catalogue image additions require regeneration
with reviewed source proof; fallback keeps those products functional meanwhile.

## Wi-Fi/mobile cold and warm checks

Use the same device, viewport and public catalogue route; repeat each scenario
three times on Wi-Fi and mobile data. Record connection type, cold/warm, selected
image format/width, FCP/LCP candidate and transfer totals. Use a fresh private
window for a cold public test; revisit in that same window for warm. Do not clear
account storage or export private network payloads. Keep logged-in functional
tests separate. Browser throttling is a lab approximation, not mobile-network proof.

After loading the page, manually run in browser developer tools:

```js
const pthDiagnostics = await import('/js/performance-diagnostics.mjs');
pthDiagnostics.snapshot(); // inspect after the page settles
pthDiagnostics.stop();
```

The buffered LCP candidate can still change and is not an INP/field-CWV report.
Zero transferSize means cached OR unavailable cross-origin timing; do not count
it automatically as saved bytes. Share only the aggregate snapshot if desired.

## Release and rollback

Publish only reviewed static source/assets through existing main, after remote
comparison. Git push proves source publication, not public-CDN propagation; the
parent verifies the deployed page externally because this environment's public
HTTP access is restricted. Roll back with a revert commit to the baseline through
the same source, never a force push. Leave original photos and private backend
data intact. No Mac checkout was modified or synchronized by this task.
