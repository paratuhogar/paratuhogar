# Public name and durable affiliate links

## Approved implementation checkpoint — 2026-10-03

Marcel explicitly approved the nullable field, narrowly scoped own-account edit
action, and publication of Magic Studio and the compatible alias/link feature.
The parent relayed that approval with transcript evidence. No further consent
is needed for these exact actions; tool-level denials must still be respected.

Magic Studio source commit `7276fc2d6aa46d7bfdee4e4129f6fe7b28daa320` was pushed
to `main` and independently confirmed by `git ls-remote`. Deployment verification
is blocked: GitHub Actions run listing and public website reads returned 403.
The earlier Pages configuration read was also denied. No alternative route is
used to bypass these denials. Do not describe the live website as verified.

Alias implementation is local in `/workspace/paratuhogar-studio-all`:
authenticated `public_name` accepts only `nombre_publico` and scopes update to
the validated actor ID; generic account mutation policy remains unchanged.
Public display defaults to first name, while new references use UUID and keep
old name/short/opaque links readable. Existing internal names, financial joins,
customer ownership and seven-day authentication expiration are retained.

Referral records use nullable expiry and preserve last-click replacement. Valid
legacy browser records migrate to this format; expired/malformed records clear
both keys. A link has no calendar expiry while its account and route remain
valid; browser clearing/eviction, another link, browser/device changes still
limit attribution. No IP fingerprinting, cross-device tracking or session
extension is added. Public projection still retains the historical `nombre`
needed by legacy price resolution; this is customer-visible name/URL control,
not a claim that historical names disappear from all public API responses.

Read-only database checks found no short_links expiry column, no public/private
function referencing that table and no current cron command mentioning it.
This does not establish anything about unconnected external cleanup jobs.
Existing gestores RLS is enabled, not forced. Schema/action deployment has not
yet been applied. Local regression: 372 Node tests pass; Magic complete-output
browser stress and PDF UI tests pass. Mobile editor/full-startup verification
passes for visitor, principal, child and administrator, including failed alias
save/retry, own-label editing at widths 320/390/820, unchanged internal names,
no attribution replacement on edit, UUID short-link destinations, Story copy
and PDF payload alias. PDF API testing uses a stub and is not a real layout proof.

Next: apply the already approved additive SQL,
deploy compatible secure-data backend before client UUID links, then publish
the alias commit and verify exact deployment when the read blocks are resolved.
Rollback frontend/backend before removing anything; retain nullable aliases
and old links. Backend version 20 was fetched and matches base `1a0f6c2` exactly.
Its previous payload is stored privately in the execution orchestration state;
no environment values or credentials were read or created.

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

These security/database-access actions are approved and have not yet been applied.
The SQL is concrete and reviewable; no credential,
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
