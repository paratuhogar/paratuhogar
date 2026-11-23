# Unified short commercial links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate verified, short, own-domain commercial links in the store, QR and optional Studio text.

**Architecture:** Reuse the existing public `short_links` storage through a shared browser helper. Its URLs contain only `?s=code`; the stored destination retains the exact account UUID and optional catalogue filter. A failed shortener never becomes a long link. Existing referral readers remain compatible.

**Tech Stack:** Browser JavaScript, existing Supabase JS client, Node test runner, Playwright.

**Spec:** User approval in this chat: short own-domain links, unified QR/copy/share, correct subgestor attribution, explicit retry on shortening failure.

## Global Constraints

- No Docker, password, authentication, price, commission, points accounting or schema changes.
- Native product image sharing remains files-only, without automatic captions.
- Preserve existing local changes and generated SEO pages; branch from remote main in an isolated worktree.
- Only anonymous fresh referral entry may establish points provenance; never reconstruct it from ownership memory.

### Task 1: Shared shortener and storefront

**Files:** Create `js/short-links.js`, `tests/short-links.test.mjs`; modify `js/storefront.js`.

**Interfaces:** `PTHShortLinks.configure(client)`, `shorten(url, {gestor, expectedRef}) -> Promise<string>`, `resolve(slug) -> Promise<{url, row}>`, `target(url) -> URL`.

- [x] Write failing tests: repeated URL reuse, UUID validation, short code verification, collision retry, network error rejection, safe legacy destination normalization, no redirect loop.
- [x] Run `node --test tests/short-links.test.mjs` and observe missing implementation failures.
- [x] Implement bounded requests, in-flight deduplication and verified memory cache; replace the storefront fallback with the shared API.
- [x] Keep failed link creation from preventing dashboard rendering; show a retry action and no copyable long link.
- [x] Replace duplicate short-link redirects with one safe resolver and visible retry on failure.
- [x] Run focused link and existing referral unit tests.

### Task 2: QR and optional Studio text

**Files:** `js/personal-qr.js`, `js/studio-jobs.js`, `js/studio-collection.js`, `js/content-studio.js`, `js/quick-story.js`; existing QR and Studio tests.

**Interfaces:** QR calls `shorten(A.link(origin, {id:account.id}), {gestor:account.nombre, expectedRef:account.id})`. Studio uses async `prepareCopy(products,options)`; sync `copy()` only includes a supplied verified `shortLink`, never synthesizes a public long URL.

- [x] Test QR short payload, exact selected UUID, stale-session suppression and failure without long fallback.
- [x] Test Studio short copy; failed shortening preserves images and excludes a long link from ZIP text; explicit copy can retry safely.
- [x] Implement async QR with generation guards after await; add Studio short-link preparation and retry without changing files-only sharing.
- [x] Run QR browser, checkout referral and Studio tests.

### Task 3: Asset release, review and publication

**Files:** `index.html`, `studio.html`, `catalog-maker.html`, `js/internal-assets.js`, `service-worker.js`, `js/pending-checkout-storefront.js`, generated JS build artifacts.

- [x] Load the shared helper before consumers, version changed assets with `20261123-shortlinks1`, and update offline shell version consistently.
- [x] Run dependency install, JS build/check, full unit tests, QR checkout, Studio browser and offline checks.
- [x] Request independent code review; fix any important findings and rerun affected tests.
- [ ] Commit, publish the exact tested tree with an expected-parent lease, and await deployment workflows.
- [ ] Compare published asset bytes to tested local files; report the short-link behavior and any limitation.
