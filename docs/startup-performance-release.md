# Storefront startup optimization — 2026-10-01

Baseline remote: `83b219817a427d6c02405051b3b5a00934440468`.
Scope: static frontend and existing public service-worker asset manifest. No
Supabase deployment, schema, authentication, permission, price, commission or
customer-data changes.

## Changes

- Removed mandatory `?v=20260930-catalogue1` document reload. Resource URLs are
  versioned instead; existing referral/contact/query parameters stay intact.
- Compiled Tailwind 3.4.17 with existing plugins/theme and explicit dynamic class
  coverage; removed runtime Play CDN and converted its plain CSS style block.
- Extracted the two large inline scripts into ordered deferred files. Existing
  helpers and Supabase SDK also defer, retaining dependency order.
- Start the application at DOMContentLoaded instead of waiting for eager images.
  Removed the artificial splash overlay/timers.
- Excel, ZIP, PDF/plugin, charts, traffic dashboard and rich editor load on use.
  Small local tutorial/follow-up modules initialize after verified session on idle.
  Basic description editing remains usable if its optional library cannot load.
- Independent hierarchy/inventory-version reads now run together. Authoritative
  catalogue, assigned visibility and personalized price checks still precede
  product rendering; no stale-price cache shortcut was introduced.
- CRM loads on checkout instead of delaying startup or fetching twice there.
- Short links resolve once before normal startup. A valid short link still
  navigates to its destination and records the same attribution.
- Existing service-worker manifest versions match the new static entrypoints.
  API responses, reports, screenshots and customer records are never cached.

## Evidence and limits

Measured local source bytes: baseline HTML 972,985; new HTML 263,613. This is a
smaller document, **not** a claim that all application bytes disappeared: about
698 KB of existing executable code moved to separately cacheable JS files.
Network compression/transfer sizes and live Core Web Vitals were not measured.

A controlled full-page Playwright fixture executes the real page with synthetic
accounts/data and a deliberately delayed hero response. Baseline makes two
navigations and starts catalogue loading after that response. New page makes one
navigation and starts catalogue loading before that response. External CDN
libraries and data are simulated: this experiment proves startup ordering, not
production seconds or Cuban network performance.

Validation: 125 Node tests pass, including existing auth, tenant isolation,
pricing, commission, checkout, catalogue recovery and announcement checks.
Compiled CSS browser tests cover 40 dynamic utilities, theme/plugins, responsive
and dark variants. Navigation passes 360/390/1280px light/dark, keyboard and tap
size checks. Full-page fixture covers visitor/gestor/subgestor, referral params,
visitor login, role-specific commissions, 24/30 pagination, filters/search/cart,
feedback navigation and absence of heavyweight startup downloads. Its mobile
check retains the pre-existing 15px carousel margin; no unrelated redesign.
Announcement tests pass at 360/390/1280px. Lazy-loader tests cover concurrent
request deduplication, failed download/retry and PDF dependency order. Worker
checks cover matching entrypoints, public offline shell, private route fallback
and no protected API interception. An offline public shell is not an offline
transaction/catalogue guarantee; live authorization/stock still require service.

Build passes; only the pre-existing outdated Browserslist dataset notice remains.
No dependency updates were introduced.

To reproduce the baseline control:
`git show 83b2198:index.html > /tmp/pth-startup-baseline.html`
then `PTH_STARTUP_BASELINE=/tmp/pth-startup-baseline.html node tests/startup-browser.cjs`.
Run the same test without that environment variable for current source.

## Publication and rollback

Publish only the reviewed static files to the existing main/root Pages source,
after comparing remote main. Previous source is preserved at the baseline SHA
and locally in `/workspace/scratch/startup-before/index.html`.
Rollback by reverting this release commit (no force push), rebuilding matching
static assets if needed, and deploying through the same Pages source. Keep all
existing private backend data and gateway v7 unchanged. Public propagation must
be verified separately; the coding environment's existing public HTTP proxy
restriction does not permit claiming a push alone proves deployment success.
