# Stories and Magic Studio — 2 October 2026

User approved integrating the previously reviewed Story and four template
designs, complete catalogue/filter selection and sharing multiple selected
products. Repository: `paratuhogar/paratuhogar`, CNAME `paratuhogar.org`.
Release base/rollback reference: `9007b20ec222d7c6ff4d1a83c938cce2b560a7f3`.
Existing SEO update from main was retained before implementation.

## Bounded release

Static frontend only, using the existing secure-data client and authorization.
No database migrations, grants, roles, credentials, functions, customer data,
payments, prices or commission configurations are changed. No new centralized
analytics, automatic WhatsApp sends or external image/AI processing.

- Four distinct deterministic templates: Azul esencial, Grafito premium,
  Ficha clara and Hogar editorial, both 1080×1920 and 1080×1080.
- Shared renderer and private interface for Stories and Studio. Stories loads
  on demand; Studio uses local CSS and a licensed local Manrope font. Removed
  eager runtime Tailwind, ZIP, QR and unused background-removal dependencies
  from Studio. Original photographs are contained, without erasing parts.
- Select all catalogue, all matching results (beyond the loaded 40 cards), or
  individual products. Search/category preserve selection. Selected-only view,
  review/removal, favorites/recent and existing private opportunity filters.
- Series makes one image per product; individual, bundle, comparison and multi
  compositions remain. Existing Studio opt-in commission discount bounds are
  preserved for artwork; Stories cannot reduce the published sum. These tools
  do not write a price or commission to the server.
- Each explicit prepare checks the complete paginated authorized catalogue,
  personalized prices and subgestor visibility. Changed price, availability,
  description, conditions, image or contact requires another review/prepare.
  No unscoped launch-price cache can override fresh data. Renderer/copy receives
  a public field whitelist and verified actor contact; no invented phone,
  delivery speed, warranty, invoice or promotion claim.
- Up to 10 JPEGs and 12 MiB per prepared batch, sequential rendering, progress,
  cancellation, retry and canvas disposal. Prepared files expire after five
  minutes and invalidate on selection/options/session changes. No catalogue
  images or prepared files are persisted. All files/ZIP assembly stay on the
  user's device.
- Share invokes `navigator.share({files})` synchronously from a second explicit
  click after exact `navigator.canShare({files})`. The OS chooses destinations;
  WhatsApp/recipients cannot be forced, and a resolved share does not prove
  delivery. The accompanying attributed catalogue text is copied separately.
- Unsupported browsers download a single JPEG or a ZIP with the images/text.
  Further batches require another explicit preparation after share/download.
  Downloads revoke object URLs; duplicate share/prepare clicks are suppressed.
- Escape/close cancels work; account/role change clears private UI and prepared
  state. Catalogue and submitted text uses DOM textContent/Canvas, never code.

The public cache advances to `pth-public-static-2026-10-02-studio1`; changed
entrypoints/CSS are versioned. The service worker registration URL and existing
push-worker import stay `20261002-applications1` to retain push activation
compatibility. Private pages/data and generated images remain outside caches.

## Validation and evidence

- `npm run build:css`, `git diff --check`, JavaScript syntax checks.
- 171 Node tests passed, including field privacy, price bounds, cancellation,
  synchronous file-sharing invocation and session/expiry checks.
- `tests/content-studio-browser.cjs`: controlled Chromium with 1,003 catalogue
  products, 603 matching results vs 40 rendered cards, full pagination, preserved
  selection, prepared 10-file/12-MiB batches, second batch, actual JSZip contents,
  share gesture, duplicate clicks, AbortError retry, fresh-price review, eight
  designs, bundle/compare/multi, failed images, mobile overflow, dialog focus,
  session clearing and hidden/assigned subgestor products. No production data
  writes or real messages.
- Full visitor/gestor/subgestor storefront startup, actual Stories entrypoint,
  lazy resource dependency order/retry and compiled CSS/browser checks.
- Reviewed one real-photo sheet rendered from the implementation. Catalogue
  read-only verification: Royal Side by Side remains available at $890, warranty
  one month, shipping extra; the EKO demonstration product is now unavailable
  and is excluded from actual tool generation.
- Preview: `libfile_ce0444fe40d881918bdb19910c2d1dbf`, PNG
  `story-y-magic-studio-implementados.png`, version 0; local identity persisted.

## Publication and rollback

Use the existing main/root GitHub Pages release, normal fast-forward push only.
If remote main advances, inspect/integrate that work before publishing; no force
push or reset. Rollback is a normal revert of this release commit followed by
the standard static publication, retaining later work. No SQL rollback needed.
Original Studio core remains in the repository for a reversible restoration.

### Catalogue pagination follow-up (studio2)

Independent public QA reproduced a preexisting issue: selecting ascending price
then loading 48 of 86 products discarded sorting while the selector retained it.
Both `renderProducts` and `loadMoreCatalogProducts` previously bypassed
`applySort`; the same source is present in baseline `9007b20`, before Studio.
The follow-up changes those two calls to reuse the existing sort/filter path.
Search/category/commission and chosen sorting survive loading more; changing
search/category still starts at 24. Existing wholesale-last behavior is retained.

The empty-state recovery is explicitly labelled “Ver todos los disponibles”.
Only that action clears search/category/high-commission and restores the
availability filter. Ordinary filter buttons continue preserving search/category.
The source/shell cache marker advances to studio2, retaining the push registration
URL and all Studio renderer/assets. No backend or commercial changes.

Twelve additional regression tests cover both audiences and all five sorting
criteria, stable prefixes, filtered pagination and explicit empty-state reset;
the 183-test suite passes. Browser fixtures exercise the actual 24→48 of 86
button and recovery for visitors, gestores and subgestores. Parent verified
studio1 publicly and synchronized the Mac at `45739ac`; studio2 propagation and
Mac synchronization need its new source hash after the follow-up push.

### Customer wording follow-up (studio3)

User requested that customers not receive the labels gestor/subgestor. The shared
artwork contact block now says “Contáctanos” across Story/square templates and
compositions. Studio sign-in/error/no-script wording is neutral. Public footer
recruitment link says “Trabaja con nosotros”, retaining its original destination.
Contextual shared catalogue links use the already supported canonical `ref` and
`contact` parameters, preserving name/contact attribution and filter context;
existing legacy URL parsing, internal roles, schema/identifiers, private admin
terminology and business/legal terms remain. Accompanying customer copy/ZIP
text already uses neutral wording and verified catalogue/contact facts.
The old Library review sheet predates this wording change and is not a new
preview of studio3. No new analytics, business data or access changes.

A successful source push confirms only GitHub source publication. Public Pages
propagation and signed-in checks on an actual phone are the parent's follow-up:
this environment previously received a denied public/Pages HTTP route, which
was not retried or bypassed. Real Android/iOS/desktop WhatsApp attachments and
recipient delivery need device verification; Chromium fixtures prove wiring,
fallbacks and state handling, not real-app delivery.

### Story product-route follow-up (studio4)

The user's mobile screenshot exposed a lazy-load failure after opening a product
detail: `openDetail` changes the URL to `/producto/<slug>/` using `pushState`,
so relative tool URLs requested nonexistent product-local JS/CSS. The shared
optional asset loader now resolves local tools from the site root, retaining
absolute CDN URLs, load order, deduplication, and failure/retry handling. The
Canvas font also uses its root path, preventing a second failure during rendering.
Only affected asset versions and the shell/cache marker advance to studio4;
the push registration URL remains applications1. Scope is static file routing;
there are no database, permission, price, commission, or customer-data changes.

The nested-route regression failed with the exact tool-load error before the fix
and passes afterward, including session/traffic tools. Full mobile Chromium
fixtures now open the real product detail, click its Story button, verify the
selected product, loaded font, and completed 1080×1920 Canvas, then select the
catalogue and close cleanly, for both internal roles. The four-template Studio
browser suite and 183 Node tests pass. No production writes or messages were
used. There are no CSS/build-input changes. Rollback is a normal revert of this
follow-up commit, retaining preceding releases. Parent must check live studio4
propagation and the signed-in product-detail button on an actual phone; the
previously denied public/Pages route remains unused in this environment.

### Catalogue loading and PDF follow-up (catalog1)

Support supplied a mobile screenshot of “La consulta no devolvió un único
registro”. Read-only project checks confirmed healthy inventory and duplicate
active account names. No account records, credentials, prices, commissions or
permissions were changed. Private identifiers and contact details are omitted
from this public release record.

Session hierarchy/setup now resolves the signed-in account by its existing ID,
not its non-unique display name; hierarchy caches are scoped by account. Shared
catalogue/referrer reads accept a repeated name only when every matching account
has the same pricing owner, without selecting an arbitrary account ID. Mixed
parent assignments produce a recovery error. Transaction authorization and the
server-side policies remain intact. Malformed/empty catalogue caches are
refetched; a full optional cache no longer hides a valid server response.

The PDF handoff uses a same-tab root URL after description loading, checks the
session before/after, rejects concurrent clicks and stale/failed selections,
transfers only commercial fields, and explains storage errors. The unused older
duplicate PDF function was removed. The PDF workspace renders its product list
without eager PDF/QR libraries or runtime Tailwind; its styles use the compiled
site stylesheet. Libraries load with bounded retry on preparation, photographs
have a timeout and safe fallback, and a basic price list needs no photographs.
A prepared PDF has explicit download/open links for a fresh user gesture;
changes to selection/options invalidate it. Product IDs use listener closures,
never inline JavaScript generated from data. Cache/source marker is catalog1;
push registration still uses applications1.

Validation: 193 Node tests, real Chromium storefront fixtures for visitors,
gestores, subgestores and administrators, duplicate account names, own pricing,
24→48 pagination/filter recovery, product-detail Story rendering, and the actual
PDF button/same-tab handoff. Separate mobile PDF fixtures cover 86 products,
library failure/retry, image failures/timeouts, duplicate preparation, explicit
download/open links and untrusted identifiers. That test uses a PDF API stub:
it verifies UI/download wiring, not binary rendering by the CDN libraries.
Compiled CSS and lazy-asset browser checks pass. Actual library retrieval
returned HTTP 403 in this environment and was not bypassed; live PDF binary
rendering and actual-phone saving remain external verification steps. Existing
public/Pages access limits likewise prevent claiming live propagation solely
from source publication. All production connector actions were read-only.

Publication uses the existing main/root target and a normal fast-forward push.
Rollback is a normal revert of this follow-up commit, retaining earlier work;
there is no database migration or SQL rollback.
