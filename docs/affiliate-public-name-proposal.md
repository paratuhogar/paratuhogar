# Public name and durable affiliate links — review gate

Magic Studio is complete in `7276fc2`. This is the separate authorized follow-up
for Alina's suggestion. Her report was already answered by the parent; no
duplicate response or report mutation is made here.

Read-only schema verification on project `ljqwaovevfatkiigirhf` confirms
`gestores.id` is UUID and `gestores.nombre` is the historical identity field.
There is no public-name/alias column. `short_links` contains slug, original_url,
gestor, created_at and is_custom; there is no expiry column. This alone is not
proof that no external cleanup deletes links.

## Concrete approval gate

1. Apply the additive nullable `public.gestores.nombre_publico` column and its
   1–40-character/control-character validation from the SQL proposal. No rows
   are renamed or backfilled, no grants/RLS settings change.
2. Add a strictly authenticated secure-data action to edit **only that column
   on the caller's own account**, taking the ID from the validated actor,
   ignoring/rejecting client-supplied identity, and rejecting courier sessions.
   Existing ordinary account writes are scoped to the principal's children,
   so self-editing this field is a new narrowly scoped permission. Do not
   weaken or broaden the generic gestores mutation policy to implement it.
3. Expose the public label through the appropriate public projection while
   retaining the internal full name in authenticated/internal and financial
   flows. The alias is display text, never an identifier or executable content.

These security/database-access actions have not been applied. They must be
approved explicitly under the delegated per-action permission rule before the
feature is activated. The SQL is concrete and reviewable; no credential,
privileged session, direct public grant or destructive migration is proposed.

## Minimum implementation after approval

- Default public display to the first name when no alias is set; provide an
  own-account editor. Keep gestores.nombre intact for all historical joins,
  prices, principal/child attribution, payroll and commissions.
- New links identify the existing account UUID, not the display alias or full
  name. Continue resolving legacy ref=/gestor= full names, old ?s= short links
  and ?r= opaque fallbacks. Ambiguous legacy names retain the existing explicit
  rejection; never pick the first account or resolve a repeated public alias.
- Update server canonical seller resolution before producing UUID links;
  current ordinary-order lookup uses gestores.nombre. Resolve UUID internally
  to the same canonical historical name, with existing status/parent checks.
- Public offer/share messages, Magic Studio text/link, Story text/link, PDF,
  catalogue links and contact displays use the public label. Internal reports
  and historical order fields retain their existing identity. Verify all
  actual entrypoints and both anonymous and authenticated projections.
- Referral memory currently has competing writers: default 30 days, 180 days
  above 500 clicks, and level-based durations displayed elsewhere. Unify the
  accepted maximum retention independently of auth sessions. Preserve
  last-click-wins and honor legacy entries that already expired; extend valid
  entries only, never revive deleted/expired history or reassign orders.
- Stable links should have no calendar expiry while their account and route
  remain valid. Browser attribution can persist until replacement/removal,
  subject to browser clearing/eviction and device/browser changes. Do not
  promise eternal attribution; do not change seven-day auth sessions or
  one-day courier sessions.

Required tests: old/new links and opaque/short fallbacks, duplicate display
names, same-name legacy ambiguity, disabled accounts and parent visibility,
price/commission and order attribution unchanged, own alias write only,
anonymous/other-account denial, untrusted alias text, correct expiry migration,
last-click reassignment unchanged, all public share/PDF/Story/Studio surfaces.

Release order must preserve callers that still use legacy references. Both
aliases and UUID links need server/client compatibility tests before combined
publication; Magic Studio can be released independently from its tested commit.
