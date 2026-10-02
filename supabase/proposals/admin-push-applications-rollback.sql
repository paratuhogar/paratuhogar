-- Containment rollback; preserves existing orders, improvements, records and enrollments.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.gestores disable trigger pth_push_new_application;
CREATE OR REPLACE FUNCTION public.pth_claim_push_deliveries(p_limit integer DEFAULT 10)
 RETURNS TABLE(event_id uuid, subscription_id uuid, lease_token uuid, attempts integer, kind text, source_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if p_limit<1 or p_limit>20 then raise exception 'Invalid batch'; end if;
 -- No historical sends to devices registered after the event.
 with picked as materialized (
  select e.* from public.pth_push_events e where e.fanout_at is null and e.expires_at>now()
  order by e.created_at,e.id limit 100 for update skip locked
 ), seeded as (
  insert into public.pth_push_deliveries as created(event_id,subscription_id)
  select e.id,s.id from picked e join public.pth_push_subscriptions s
   on s.created_at<=e.created_at and s.expires_at>now() and s.revoked_at is null and e.kind=any(s.topics)
  join public.gestores g on g.id=s.gestor_id
  join public.pth_secure_sessions a on a.token_hash=s.session_hash and a.gestor_id=g.id and a.expires_at>now()
  where g.parent_id is null and g.estado='activo' and g.activo is distinct from false
   and lower(g.rol) in ('admin','administrador','superadmin','logistica')
   and (e.kind='orders' or g.id in ('38f20b63-a845-4a03-8d10-9a57da2ac2c4','6193f310-1e3f-4404-b874-977d0e23a6a0'))
  on conflict do nothing returning created.event_id
 ) update public.pth_push_events e set fanout_at=now() where e.id in(select p.id from picked p);

 return query with due as (
  select d.event_id,d.subscription_id from public.pth_push_deliveries d
  join public.pth_push_events e on e.id=d.event_id
  where e.expires_at>now() and d.attempts<8 and d.next_attempt_at<=now()
   and (d.state='pending' or (d.state='sending' and d.lease_until<now()))
  order by d.next_attempt_at,d.event_id limit p_limit for update of d skip locked
 ), claimed as (
  update public.pth_push_deliveries d set state='sending',attempts=d.attempts+1,
   lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
  from due where d.event_id=due.event_id and d.subscription_id=due.subscription_id
  returning d.event_id,d.subscription_id,d.lease_token,d.attempts
 ) select c.event_id,c.subscription_id,c.lease_token,c.attempts,e.kind,e.source_id,e.expires_at
 from claimed c join public.pth_push_events e on e.id=c.event_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.pth_enqueue_admin_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if TG_TABLE_NAME='pedidos' then
  insert into public.pth_push_events(kind,source_id) values('orders',NEW.id) on conflict(kind,source_id) do nothing;
 elsif TG_TABLE_NAME='pth_feedback' and NEW.kind='mejora' then
  insert into public.pth_push_events(kind,source_id) values('suggestions',NEW.id) on conflict(kind,source_id) do nothing;
 end if;
 return NEW;
end;
$function$
;
revoke all on function public.pth_enqueue_admin_push() from public,anon,authenticated,service_role;
revoke all on function public.pth_claim_push_deliveries(integer) from public,anon,authenticated;
grant execute on function public.pth_claim_push_deliveries(integer) to service_role;
-- Retain widened CHECKs: narrowing would fail once application rows/topics exist.
-- Then restore captured gateway v14 / dispatcher v5 source and revert frontend.
commit;

