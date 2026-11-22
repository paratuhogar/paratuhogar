# Personal QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let each active gestor/subgestor and authorized administrators download a scannable QR for that account's existing personal link.

**Architecture:** A focused browser module creates a UUID-only HTTPS link and lazily loads a pinned local QR library. An accessible native dialog renders a 1024px white PNG with a four-module quiet zone. Existing verified profile queries supply admin selection; generation does not change sales or points.

**Tech Stack:** Vanilla JS, local pinned QR encoder, Playwright with actual PNG decoder tests.

**Spec:** `docs/superpowers/specs/2026-11-22-personal-qr-design.md` (approved 22 November 2026).

## Global Constraints

- No Docker, schema, price, points, commission, password or role changes.
- URL is `https://paratuhogar.org/?ref=<account UUID>`; no buyer data, phone, session or credentials.
- Subgestor uses their own UUID, never the principal's.
- Local library loads only after user gesture; no remote QR image service.
- Inactive accounts cannot generate new QR; account/session changes clear and close the dialog.
- No publication without explicit authorization.

## File map

- Implementer owns `js/personal-qr.js`, `css/personal-qr.css`, local encoder+license in `js/vendor/`, `tests/personal-qr-browser.cjs`.
- Coordinator owns shared script tags, service worker/build integration, package and both lockfiles. Implementer must request any decoder dependencies instead of editing package files.
- Module public interface: `window.PTHPersonalQR.openOwn()`, `openAdmin()`, `openAccount(account)` (only accepts current verified actor or authorized admin selection). Module mounts own/admin buttons using current DOM conventions, or supplies exact coordinator hooks; no edits to `storefront.js` in this task.

### Task 1: Exact QR and accessible account isolation

**Files:** module, CSS, vendor library/license, browser tests.

- [x] Write browser behavior tests for own/child/admin selection and PNG decoding before implementation.
  ```js
  assert.equal(decoded.data,'https://paratuhogar.org/?ref=11111111-1111-4111-a111-111111111111');
  assert.equal(png.width,1024);
  ```
- [x] Run `node --test tests/personal-qr-browser.cjs`; confirm the missing UI/encoder fails meaningfully.
- [x] Verify upstream source and license; vendor pinned code, no network on generation. Add native dialog with visible focus, Escape/focus restore, copied link, user-triggered download and optional native share fallback. Render true quiet zone, no overlay logo. Match established ParaTuHogar blue/white design and compact copy; the code itself is the signature visual.
- [x] Validate session/profile before opening, close/clear on logout or account change, ignore stale admin searches, deny inactive accounts and non-admin selection. Library failure preserves text link/retry; cancelled share reports no success.
- [x] Run desktop/mobile tests, verify contrast/quiet zone, decode actual download, follow link in isolated browser to confirm referral entry without submitting an order. Run existing subgestor-only points regressions.
- [x] Supply exact integration hooks to coordinator and commit only owned files after review.

### Task 2: Integrate and verify distribution

**Files:** shared entrypoints/templates/cache/builds owned by coordinator, QR deployment notes.

- [x] Add own QR beside personal-link entry and administrative QR selector with role visibility; test absence before integration and visible behavior after.
- [x] Include local scripts/styles in established lazy/cache paths without preloading encoder, keep coupons independent, run generated asset checks and all related browser suites.
- [x] Request independent read-only code review and resolve important findings. Record tests and commit on the isolated branch, without publishing.
