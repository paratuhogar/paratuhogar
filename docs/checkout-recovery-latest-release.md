# Checkout recovery and latest receipt — local candidate

Base: remote main `867ef12f`, fetched 2026-10-17. Includes `d76964ec` and the subsequent SEO update. Isolated branch `fix/checkout-recovery-latest`; no push, deployment, database changes or feedback edits.

## Reproduced behavior and scope

Chromium fixtures on baseline at 390px and 1280px reproduce an unresolved risk lookup leaving the button at PROCESANDO, the submission guard active and the Web Lock held. There are zero order writes. Closing the document releases those in-memory locks. This demonstrates a failure mechanism compatible with the reported symptom; without a production network trace it does not establish which request stalled on the original device. Existing gateway fetch has a 30-second AbortSignal, but checkout previously depended entirely on every underlying promise settling.

Individual network-result waits now have a 45-second application deadline. Rejection unwinds the original handler and its Web Lock, resets the button and retains the submission token, form, cart and any saved signed attempt. The deadline never races the whole workflow or IndexedDB writes. Late network results cannot resume the timed-out handler. Before submit, the existing outcome is still persisted; retries check its receipt before issuing another order. No success is declared before server confirmation. The post-confirmation customer-closure wait is also bounded, using the existing confirmed-error cleanup without changing that operation's inputs or behavior.

Receipt notices previously rendered every retained unclosed entry. Normal rendering now selects the latest complete group before checking dismissal. All provider references within that group remain together. Closing it cannot expose older notices, including after reload or duplicate acknowledgments. Old buttons cannot act on a superseded entry. Minimal receipt history retains the existing seven-day policy, with account-scoped restoration and preservation across account changes. Other accounts' minimal routing/receipt metadata is preserved, never their message or session token. Server history and the separate pending-order queue remain intact. No real records are deleted.

Public cache version and changed script URLs are coordinated for the offline shell; no private response caching, queue format or migration changes.

## Verification

- Before: dedicated Node latest-receipt assertion failed with three cards; baseline Chromium reproduced stalled risk read at both widths.
- After: dedicated Chromium tests at both widths pass stalled-read recovery, ignored late read, server acceptance with lost response, receipt-only retry with exactly one server write, ignored late submit result, grouped provider references, close and reload. Synthetic gateway/DB only; no WhatsApp or real orders.
- Complete Node suite: 624/624 passed after final URL alignment; final log recorded in delivery evidence.
- JS bundle build/check, guide check, CSS build and whitespace check. CSS output unchanged.
- Independent review covered timeout continuation, attempt retention, latest/dismiss semantics, account separation and shell version alignment; no blocking findings.

Run the dedicated browser test with Playwright installed outside the repository:
`NODE_PATH=/tmp/pth-browser/node_modules node tests/checkout-recovery-latest-browser.cjs`.
For baseline reproduction, set `PTH_REPRO_BASELINE=1 PTH_FIXTURE_ROOT=/workspace/pth-checkout-baseline` as well.

Evidence logs and screenshots: `/workspace/scratch/checkout-recovery-evidence/` (local only, synthetic data). These tests do not establish physical Android behavior or deployment propagation. IndexedDB transactions that never complete and the scheduler's pre-handler session/receipt checks are separate limits; no unsafe timeout is applied to storage transactions. No claim is made that the exact original production request has been identified.

## Publication and rollback

Publication requires explicit approval. Re-fetch main, preserve any subsequent work, review and integrate only this candidate. Do not retry the denied Pages API/public tunnel routes. Do not mark feedback resolved before confirmed deployment.

Rollback uses a new revert commit over the then-current main, never reset/force-push. Keep IndexedDB, pending queue readers and minimal receipt history. A future rollback should assign a fresh coordinated public-cache version to the reverted assets. Reverting the receipt UI can display historical notices again; it must not erase them to hide that regression. The base checkout and queue schemas remain readable. Local forward/reverse patches are delivered separately.
