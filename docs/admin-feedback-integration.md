# Administrative feedback integration — 2026-10-01

Follows phase-2 performance release `150b159f89c3ff5fc2b3b02c9aec7983d0b61b2c`.
User requested a section inside the administration panel for gestor problems and
improvements, plus creation dates in “Solicitudes y reportes de tu equipo”.

## Scope and boundaries

The new “Problemas y mejoras” administration tab embeds the existing private
reviewer in `feedback.html?view=review`. This is a working inline list, not only a
link: search, pagination, status, priority, response, private assessment and
duplicate association reuse the existing review interface and gateway. It loads
only on opening the tab and unmounts on switching away. Screenshots remain an
explicit separate authenticated request; no automatic capture loading, public
upload or local persistence was added. Embedded mode hides the submission form
and duplicate page header, retaining responsive styling.

Access remains the existing gateway rule: one of the two `OWNER_IDS` AND current
administrative actor classification. A parent-linked account never acquires this
right through an admin label. The embedded view requires the server's `owner:true`
response; other accounts see a no-access message and can still view their own
submissions on the ordinary feedback page. The query parameter controls layout
only and grants no permissions. No database/function/policy deployment is needed.

**Pending only if broader access is desired:** allowing other administrators or
team leaders to read these private reports would expand current access to titles,
submitted details, responses and potentially screenshots/private assessment.
That expansion was not made. The parent must obtain an explicit decision naming
the allowed roles/accounts and whether scope is global or their own team before
changing backend authorization. Existing author/team isolation remains intact.

## Existing team mailbox dates

Read-only information-schema inspection confirmed `public.reportes_gestor` has
`created_at` of type `timestamp with time zone` and an existing default. No report
contents were read for this inspection. The existing mailbox now sorts by this
timestamp rather than UUID and displays date/time with `America/Havana` via Intl.
Null, empty or invalid values show “Fecha no disponible”; no inferred date or
backfill. This older table and its existing data/access route stay separate from
the private feedback table. Its legacy attachment behavior is unchanged; new
private screenshots never use that path. Rendering now escapes submitted text
and attachment attributes so report contents are not executable HTML.

## Verification, publication and rollback

- 132 Node tests pass, including the existing backend feedback author/team/admin
  boundaries, screenshot scope, validation, duplicate/retry and revision checks.
- Browser matrix: 360/390/1280px × authorized reviewer, other admin, gestor and
  subgestor. Checks embedded access, lazy loading, inert submitted HTML, no eager
  screenshot request, logout clearing, tab unmount, Havana summer/winter dates
  and missing/invalid dates. This is a synthetic gateway fixture, not a production
  login test or proof of a new permission deployment.
- Existing feedback browser tests and full storefront visitor/gestor/subgestor
  tests pass; CSS build, JavaScript syntax and whitespace checks pass.

Static frontend release only: HTML, existing UI CSS/JS and matching worker asset
versions. No permissions, prices, commissions, payments or customer records change.
Source is published through the existing main branch; external propagation must
be checked by the parent. Revert this integration commit to remove the embedded
tab/date presentation while keeping phase-2 performance and all private reports.
No Mac files were accessed or synchronized.
