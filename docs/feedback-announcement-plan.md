# Feedback announcement: release record

2026-10-01. Remote main verified at 771f5838a340b1dfa4bf0f5fbfd632a88712b0e3.
Specific user approval received via parent: “autorizo si” in response to creating the private acknowledgement table and granting the existing service read/insert access. Frontend publication is the remaining release step.

Existing introduction campaigns and welcome/CRM guidance use localStorage.
None supplies an account acknowledgement shared between browsers. Read-only
production metadata inspection found no announcement/preference/onboarding
table or matching gestores column. Do not reuse feedback submissions as hidden
settings or change customers, permissions, prices, commissions or existing roles.

## Approved production change

Applied `supabase/proposals/feedback-announcement.sql` to Supabase project
`ljqwaovevfatkiigirhf`: one new private table containing only an existing gestor
UUID and acknowledgement timestamp. RLS enabled; PUBLIC/anon/authenticated have
no privileges, and existing service_role has only SELECT and INSERT. No new
credentials, public access, grants on existing tables, UPDATE or DELETE.

Extend the existing secure-data gateway with fixed announcement operations
`status` and `acknowledge`. Authenticate through the unchanged opaque session and
active-parent validation. Derive account UUID server-side; reject client-supplied
identity and unknown operations. Return only the requesting account's boolean.
Use INSERT with duplicate-key handled as already acknowledged, so retries do
not create duplicate records. No arbitrary text or campaign input is accepted.

## Visible notice

Title: ¿Algo no funciona o tienes una idea?

Ahora tienes “Problemas y mejoras”: un espacio para avisar de errores y proponer
cambios que te ayuden a trabajar mejor y vender más. Cuéntanos qué pasó o qué
necesitas. Podrás consultar el estado de tu envío y las respuestas desde esa
misma sección.

Actions: “Conocer la sección” and “Entendido”. Both acknowledge; the first opens
feedback.html only after confirmation succeeds. Merely displaying the notice,
navigating away, or pressing Escape does not acknowledge it. Escape dismisses
for the current visit; the next visit may show it until explicitly acknowledged.
If saving fails, retain a clear retry action and allow leaving the dialog without
blocking the work panel. Never claim the acknowledgement saved on failure.

## Integration and verification

Show after verified gestor/subgestor session setup. Sequence with the existing
welcome and price introduction modals to avoid stacked dialogs. Native dialog,
label/description, initial focus, keyboard focus containment, focus restoration,
44px minimum actions, mobile scrolling, and site navy/rounded styling.
Session changes must close stale notices and discard stale async responses.

Verify distinct accounts sharing one browser, subgestor/parent separation,
repeated logins, fresh browser/device simulation, back/forward, duplicate clicks,
failed/lost responses, session invalidation, Escape, keyboard and 360/390/1280px.
Database tests must deny direct browser access and mutation of acknowledgements.

Deploy only after explicit approval of the table/grants and gateway extension,
tests pass, and remote main is checked again. Order: additive table, compatible
gateway, frontend. Rollback frontend/gateway to prior reviewed versions; leave
acknowledgements intact, without destructive migration or dropping data.

## Verified release evidence

- Migration `20261001204708_feedback_announcement_ack` succeeded.
- Live SQL confirmed RLS enabled, zero browser policies, anon/authenticated denied
  SELECT/INSERT/UPDATE/DELETE/TRUNCATE, service_role allowed SELECT/INSERT only.
- `secure-data` v7 ACTIVE, verify_jwt=false preserved for existing custom session
  authentication. Retrieved deployed sources exactly match reviewed local files.
- v6 source matched baseline before deployment and is preserved locally at
  `/workspace/scratch/announcement-rollback-v6/`; previous git source is 771f583.
- 122 Node tests pass, including real gateway session resolution with distinct
  synthetic accounts, parent/child separation, invalid operation/identity rejection,
  duplicate acknowledgement and retry after failure.
- Exact SQL passed embedded PostgreSQL checks with deliberately permissive default
  grants, proving the explicit revokes and minimum service permissions.
- Real browser + session adapter with mocked gateway: 360/390/1280px, focus,
  keyboard cycle, Escape, failed confirmation, lost response/retry, fresh browser,
  subgestor on same browser, navigation/back, prior notice queue, logout and stale
  response cancellation. These are local tests, not a real-account production pilot.
- Direct public-origin verification remains blocked by this environment's previously
  observed network proxy restriction; do not label a git push as confirmed propagation.
- No account/credential resets, new credentials, third-party reporting or automation
  changes included. Existing private reports and permissions preserved.
