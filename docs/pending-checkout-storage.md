# Local pending-order storage

This is a browser-only queue. It changes no backend schema, authentication,
permissions, delivery rules, prices or commissions. Production publication is
a separate approval step.

## Interface

`PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB))` provides:

- `list(owner)`: all records for exactly that account, oldest first.
- `read(owner, id)`: one record or `null`. Without `id`, it returns the oldest
  record with customer fields, then an unresolved status, then the latest receipt.
- `save(owner, {lines, form, estimate}, {intentId, savedAt})`: append a pending
  order. Use a random 64-character hexadecimal intent once per logical order;
  retain it if the save is interrupted or the user taps twice. A matching intent
  returns the existing record. Changed customer fields or quantities with that
  same intent return `INTENT_CONFLICT`. Start a new intent for another order,
  including another customer buying the same products.
- `patch`, `revise`, `cancel`, `retry`, and `confirmed` retain the existing
  `(owner, recordId, ...)` signatures. They affect only that record.
- `run(owner, processor, id?)`: acquire one eligible `queued`, `uncertain` or
  abandoned `sending` record. It skips blocked records and refuses to acquire
  another lease while any record in that account has a live lease. The processor
  still receives `context.row`, `context.save` and `context.confirmed`.
- `logout(owner)`: remove customer fields from every record in that account;
  retain only receipts or signed capabilities needed to check unresolved sends.

The old cart-draft argument with `lines` remains supported for initial recovery.
New forms must supply an independent intent per order, rather than reuse the
cart's product-only intent for multiple customers. The scheduler must use each
record's own intent, attempt, form and receipt; an unknown outcome on one record
must not overwrite or confirm another record.

There are at most 25 unresolved records per account. Confirmation or cancellation
before an attempt frees a slot. Up to 100 minimal finished statuses are retained.
Customer fields expire after seven days when the queue is next read. A closed
browser cannot guarantee background sending or deletion at the exact deadline.

`estimate` contains reference amounts only: equipment is derived from the saved
lines; shipping is a finite nonnegative value or `null` when unknown; total is
equipment plus known shipping. Pickup defaults to zero shipping. Server quote
and submit remain responsible for checking the actual price and delivery.

## Migration and recovery

The existing database `pth_pending_checkout_v1`, version 1, keeps its `orders`
store unchanged. Multiple records live in a separate database
`pth_pending_checkout_v2`, version 1, in `queues` keyed by account. Each queue
contains version-1 order records and minimal import markers. A version-2 queue
is never written into the legacy store; the old reader would delete that value.

On first access, a valid legacy row is copied with its original record ID,
intent, creation date, attempt, prior attempts and customer fields. The copy and
import marker commit together in the new database. Only after that succeeds,
the corresponding legacy row is replaced with a version-1 paused migration
pointer without customer fields. The old singleton code cannot automatically
send that pointer. Subsequent imports are idempotent across tabs.

If the new database cannot commit, the complete legacy row remains intact.
If the browser stops after the new commit but before writing the legacy pointer,
both copies remain temporarily; the next access finishes the pointer operation
without importing a duplicate. The operation reports failure until that cleanup
succeeds. A save retry must retain the same explicit intent to recover any
already committed record safely.

Rollback must preserve both databases. A previous singleton UI cannot list the
new namespace. To roll back UI changes while retaining access to saved orders,
keep this queue core and a compatible list/receipt reader, or restore that reader
in a recovery release. Do not delete IndexedDB or write a multi-order bucket into
the legacy `orders` store. The migration pointer intentionally prevents the old
UI from automatically submitting a stale copy.

All storage checks use synthetic records. The IndexedDB browser regression covers
quota before commit, interruption after commit, concurrent import, duplicate
save, account-wide leases, independent receipts and removal of customer fields.
