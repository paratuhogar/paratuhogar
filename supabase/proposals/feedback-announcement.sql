-- PROPOSAL ONLY: specific approval required before production execution.
-- One acknowledgement per existing account and this fixed announcement.
begin;
create table public.pth_feedback_announcement_ack (
 gestor_id uuid primary key references public.gestores(id),
 acknowledged_at timestamptz not null default now()
);
alter table public.pth_feedback_announcement_ack enable row level security;
revoke all on public.pth_feedback_announcement_ack from public, anon, authenticated, service_role;
grant select, insert on public.pth_feedback_announcement_ack to service_role;
-- No browser policies: existing secure-data authenticates each request and
-- derives gestor_id from the active session. No update/delete/impersonation.
commit;
