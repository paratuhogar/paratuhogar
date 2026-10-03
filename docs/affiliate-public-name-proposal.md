# Public name and durable affiliate links — release evidence

Marcel explicitly approved the nullable field, the action limited to editing
one's own public label, and publication of Magic Studio and aliases. The parent
relayed the approval with transcript evidence. Alina's report and reply remain
with the parent; no report was edited or marked resolved in this work.

## Implementation and compatibility

`97ac750` implements the alias feature. The own-account editor appears in
Dashboard → Inicio. Customers see the saved public label, or the first name
when it is empty. `gestores.nombre` remains unchanged for account access,
historical orders, principal/child pricing, payroll and commissions.

`public_name` accepts only `action` and `nombre_publico`. It obtains the target
ID from the validated actor, rejects anonymous/courier callers and forged target
IDs or other fields, and returns only ID and public label. The ordinary gestores
write scope is unchanged. Submitted aliases are display text, never commands,
HTML, identity keys or aliases for account lookup.

New links use the existing account UUID. Old `ref=`/`gestor=` full names, `?s=`
short links and `?r=` opaque fallback data remain supported. Short-link rows
and their existing destinations are not rewritten. Repeated public labels
do not merge accounts; ambiguous legacy names retain their explicit rejection.
The compatible backend resolves UUID to the canonical historical name before
storing a sale. Existing price/commission and customer-ownership rules remain.

Story, Magic Studio, public offer/composer text, contact display and public PDF
labels use this separation. Old cached PDF payloads abbreviate the full name.
The public projection still contains historical `nombre` for legacy price
resolution: this feature controls customer-visible labels and shared URLs,
not the removal of historical names from all public API responses.

## Duration

Links have no calendar expiry while their account and route remain valid.
New browser referral records have nullable expiry and preserve last-click
replacement. Valid legacy records migrate; expired or malformed records clear
both storage keys and cannot be revived through an older fallback key.
Another link, browser clearing/eviction, or a different browser/device limits
attribution. No IP fingerprinting, cross-device tracking or authentication
extension is added. Seven-day main and one-day courier sessions are unchanged.

Read-only checks found no short_links expiry column, no public/private SQL
function referring to short_links and no current cron command mentioning it.
Unconnected external cleanup jobs were not inspected.

## Applied backend and schema — 2026-10-03

Project: `ljqwaovevfatkiigirhf`.

- Migration `public_name_affiliate`, version `20261003131350`, succeeded.
  `nombre_publico` is nullable text with no default; the database constraint
  allows null or 1–40 characters without markup/control characters. No rows
  were renamed or backfilled and no grants or RLS policies were changed.
- Metadata read after application confirms the field, constraint, and the
  unchanged gestores RLS state: enabled, not forced.
- `secure-data` version 21 is ACTIVE. Management readback confirms all returned
  source files byte-for-byte against the tested local deployment payload.
  The existing `verify_jwt:false` setting is retained because this gateway uses
  its existing custom authenticated sessions; authentication is unchanged.
- Previous version 20 was read and matched repository base `1a0f6c2` exactly.
  No environment values, new credentials or persistent service access were
  read or created. The deployment uses the already authorized connector.

Backend 21 was deployed and verified before publishing any UUID client links.
Migration source is `supabase/migrations/20261003_public_name_affiliate.sql`.

## Validation

372 Node tests pass. Checks include own-account field isolation, anonymous,
courier, expired-session and forged-ID denial, repeated names/aliases,
old/new/opaque references, inactive seller checks, unchanged financial results,
last-click memory, legacy expiry migration and logout fencing. Alias editing
does not extend authentication or assign a different customer owner.

The full storefront browser test passes for visitor, principal, child and
administrator: failed alias save/retry, editing at 320/390/820 px, unchanged
internal names, UUID short-link destinations, actual Story copy, and PDF alias
payload. Magic complete-output stress and PDF UI tests also pass. PDF API
testing uses a stub and is not a real layout proof. `check:js` and diff checks
pass; no real customer order or message was sent by tests.

## Publication and verification limits

Magic source `7276fc2d6aa46d7bfdee4e4129f6fe7b28daa320` was published to main
and confirmed by `git ls-remote`. The alias implementation and migration are
prepared for a normal fast-forward of the same repository; never force-push.
The final remotely confirmed source hash is reported in the task outcome.

These reads were denied; no alternative route was used to bypass them:

- Pages configuration: `gh api repos/paratuhogar/paratuhogar/pages` → Forbidden.
- Actions run listing through `gh run list`, whose request was
  `https://api.github.com/repos/paratuhogar/paratuhogar/actions/runs?per_page=20&exclude_pull_requests=true&head_sha=7276fc2d6aa46d7bfdee4e4129f6fe7b28daa320`
  → Forbidden. No server reason was provided beyond that message.
- Public file reads through exec/Python urllib, such as
  `https://paratuhogar.org/studio.html?verify_release=7276fc2d6aa46d7bfdee4e4129f6fe7b28daa320&check=<timestamp>`,
  plus index.html, content-studio.js, studio-collection.js, internal-assets.js
  and service-worker.js → Tunnel connection failed: 403 Forbidden.
- Runtime gateway checks through exec/Python urllib at
  `https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data`
  → Tunnel connection failed: 403 Forbidden. Neither the public no-row alias
  projection nor anonymous-denial smoke test reached a usable response.

Supabase management reads verify the schema and ACTIVE backend source. Git
confirms repository publication. They do not establish which static release
the browser currently receives or an authenticated runtime alias edit.
Do not declare the live UI fully verified or mark the report resolved.

## Rollback

Retain the nullable column, saved labels and old links. Before client publication,
backend 20 can be restored if needed. After UUID links have been issued, retain
the UUID canonical resolver and nullable-expiry reader during rollback;
restoring the full old backend/referral reader would break new links/memory.

For an alias-editing fault, pause only the new public_name action after actor
validation with a controlled 503 response, keeping UUID/name resolution and
public labels. Repair/redeploy it using the same scoped permission. A broader
UI rollback requires backporting that compatibility first; never drop or rename
the field or historical identities. Magic Studio's separate frontend commit
can be reverted independently without a server/data rollback.
