-- PRIVATE APPROVED SCOPE, NOT APPLIED. Both recipient UUIDs independently confirmed.
-- Apply ONLY after reviewed gateway/dispatcher/frontend publication and checks.
-- Verified by authorized minimal read at 2026-10-02 23:17 UTC: Marcel Montano = 38f20b63-a845-4a03-8d10-9a57da2ac2c4.
-- Keep NULL until this phase is approved; then use that verified value. Never execute this template without approval.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$
declare v_marcel uuid := '38f20b63-a845-4a03-8d10-9a57da2ac2c4';
begin
 if v_marcel is null then
  raise exception 'BLOCKED: Marcel UUID must be independently confirmed';
 end if;
 if v_marcel='6193f310-1e3f-4404-b874-977d0e23a6a0' then
  raise exception 'Reviewer and escalation recipient must differ';
 end if;
 if (select count(*) from public.gestores g
  where g.id in (v_marcel,'6193f310-1e3f-4404-b874-977d0e23a6a0')
   and g.parent_id is null and g.estado='activo' and g.activo is distinct from false
   and lower(g.rol) in ('admin','administrador','superadmin','logistica')) <> 2 then
  raise exception 'Both confirmed recipients must remain active administrators';
 end if;
 update public.pth_application_reminder_config
 set marcel_id=v_marcel,enabled=true where singleton;
 if not found then raise exception 'Inactive preparation is missing'; end if;
end;
$$;
-- No topic is added to any existing device: explicit opt-in remains required.
-- The already active one-minute dispatcher job evaluates the Cuba-time window.
-- No activation backfill: outside 08:00 <= time < 09:00 nothing is seeded.
commit;
