-- PRIVATE, APPROVED SCOPE, NOT APPLIED. Additive preparation, reminders OFF.
-- Baseline: paratuhogar 6429f45; existing three-topic applications extension.
-- No secret values, recipients inferred by name, subscriptions or production scans.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table public.pth_application_reminder_config (
 singleton boolean primary key default true check (singleton),
 enabled boolean not null default false,
 angel_id uuid not null default '6193f310-1e3f-4404-b874-977d0e23a6a0'
  references public.gestores(id),
 marcel_id uuid default '38f20b63-a845-4a03-8d10-9a57da2ac2c4' references public.gestores(id),
 check (angel_id = '6193f310-1e3f-4404-b874-977d0e23a6a0'),
 check (marcel_id is null or marcel_id = '38f20b63-a845-4a03-8d10-9a57da2ac2c4'),
 check (not enabled or marcel_id is not null)
);
insert into public.pth_application_reminder_config(singleton) values (true);
create table public.pth_application_reminder_ledger (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.gestores(id) on delete cascade,
 local_date date not null,
 reminder_kind text not null check (reminder_kind in ('daily','escalation')),
 snapshot_at timestamptz not null default now(),
 unique(recipient_id,local_date,reminder_kind)
);
-- Ledger has no subscription FK: logout/expiry/re-enrollment cannot erase dedupe.
create index pth_application_reminder_retention
 on public.pth_application_reminder_ledger(local_date);
alter table public.pth_application_reminder_config enable row level security;
alter table public.pth_application_reminder_ledger enable row level security;
revoke all on public.pth_application_reminder_config,
 public.pth_application_reminder_ledger from public,anon,authenticated,service_role;
grant select on public.pth_application_reminder_config to service_role;
grant select,insert,delete on public.pth_application_reminder_ledger to service_role;
-- No browser RLS policies or grants; service_role is already server-only.

alter table public.pth_push_subscriptions
 drop constraint pth_push_subscriptions_topics_check;
alter table public.pth_push_subscriptions
 add constraint pth_push_subscriptions_topics_check
 check (cardinality(topics) between 1 and 4 and
  topics <@ array['orders','suggestions','applications','application_reminders']::text[]);
alter table public.pth_push_events drop constraint pth_push_events_kind_check;
alter table public.pth_push_events add constraint pth_push_events_kind_check
 check (kind in ('orders','suggestions','applications','application_reminders'));

-- Actual clock only: no date argument, historical replay or manual backfill RPC.
create function public.pth_seed_application_reminders()
returns integer language plpgsql security invoker set search_path='' as $$
declare
 v_now timestamptz := pg_catalog.now();
 v_local timestamp;
 v_policy public.pth_application_reminder_config%rowtype;
 v_count integer := 0;
begin
 v_local := v_now at time zone 'America/Havana';
 -- Keep only today plus preceding 29 local dates, including disabled operation.
 delete from public.pth_application_reminder_ledger
  where local_date < v_local::date - 29;
 select * into v_policy from public.pth_application_reminder_config where singleton;
 if not found or not v_policy.enabled or v_policy.marcel_id is null
  or v_local::time < time '08:00' or v_local::time >= time '09:00' then
  return 0;
 end if;
 with targets as (
  select v_policy.angel_id recipient_id, 'daily'::text reminder_kind
   where exists(select 1 from public.gestores p
    where p.parent_id is null and p.estado='pendiente'
     and p.created_at >= v_now - interval '168 hours' and p.created_at <= v_now)
  union all
  select v_policy.marcel_id, 'escalation'::text
   where exists(select 1 from public.gestores p
    where p.parent_id is null and p.estado='pendiente'
     and p.created_at >= v_now - interval '168 hours' and p.created_at <= v_now
     and p.created_at < v_now - interval '48 hours')
 ), eligible as (
  select t.* from targets t join public.gestores g on g.id=t.recipient_id
  where g.parent_id is null and g.estado='activo' and g.activo is distinct from false
   and lower(g.rol) in ('admin','administrador','superadmin','logistica')
   and exists(select 1 from public.pth_push_subscriptions s
    join public.pth_secure_sessions a
     on a.token_hash=s.session_hash and a.gestor_id=g.id and a.expires_at>v_now
    where s.gestor_id=g.id and s.revoked_at is null and s.expires_at>v_now
     and 'application_reminders'=any(s.topics))
 ), inserted as (
  insert into public.pth_application_reminder_ledger
   (recipient_id,local_date,reminder_kind,snapshot_at)
  select recipient_id,v_local::date,reminder_kind,v_now from eligible
  on conflict(recipient_id,local_date,reminder_kind) do nothing returning id
 )
 insert into public.pth_push_events(kind,source_id,created_at,expires_at)
 select 'application_reminders',id,v_now,
  (v_local::date + time '09:00') at time zone 'America/Havana'
 from inserted on conflict(kind,source_id) do nothing;
 get diagnostics v_count = row_count;
 return v_count;
end;
$$;
revoke all on function public.pth_seed_application_reminders()
 from public,anon,authenticated;
grant execute on function public.pth_seed_application_reminders() to service_role;

-- Keeps the same lease API, retries, old topics and source uniqueness.
-- Dispatcher must call the new seed RPC before its existing claim RPC.
create or replace function public.pth_claim_push_deliveries(p_limit integer default 10)
returns table(event_id uuid,subscription_id uuid,lease_token uuid,attempts integer,
 kind text,source_id uuid,expires_at timestamptz)
language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz := pg_catalog.now();
begin
 if p_limit<1 or p_limit>20 then raise exception 'Invalid batch'; end if;
 with picked as materialized (
  select e.* from public.pth_push_events e
  where e.fanout_at is null and e.expires_at>v_now
  order by e.created_at,e.id limit 100 for update skip locked
 ), seeded as (
  insert into public.pth_push_deliveries as created(event_id,subscription_id)
  select e.id,s.id from picked e join public.pth_push_subscriptions s
   on s.created_at<=e.created_at and s.expires_at>v_now
    and s.revoked_at is null and e.kind=any(s.topics)
  join public.gestores g on g.id=s.gestor_id
  join public.pth_secure_sessions a
   on a.token_hash=s.session_hash and a.gestor_id=g.id and a.expires_at>v_now
  left join public.pth_application_reminder_ledger r
   on e.kind='application_reminders' and r.id=e.source_id
  left join public.pth_application_reminder_config c on c.singleton
  where g.parent_id is null and g.estado='activo' and g.activo is distinct from false
   and lower(g.rol) in ('admin','administrador','superadmin','logistica')
   and (e.kind='orders'
    or (e.kind='suggestions' and g.id in
     ('38f20b63-a845-4a03-8d10-9a57da2ac2c4','6193f310-1e3f-4404-b874-977d0e23a6a0'))
    or (e.kind='applications' and g.id='6193f310-1e3f-4404-b874-977d0e23a6a0')
    or (e.kind='application_reminders' and c.enabled and r.recipient_id=g.id
     and r.local_date=(v_now at time zone 'America/Havana')::date
     and ((r.reminder_kind='daily' and g.id=c.angel_id)
      or (r.reminder_kind='escalation' and g.id=c.marcel_id))))
  on conflict do nothing returning created.event_id
 )
 update public.pth_push_events e set fanout_at=v_now
 where e.id in(select p.id from picked p);

 -- Same device: an accepted daily recap covers queued individual requests
 -- created before its snapshot. A new request after the snapshot still alerts.
 update public.pth_push_deliveries d set state='expired',lease_until=null
 from public.pth_push_events e,public.gestores p
 where d.event_id=e.id and e.kind='applications' and e.source_id=p.id
  and d.state='pending'
  and exists(select 1 from public.pth_push_deliveries rd
   join public.pth_push_events re on re.id=rd.event_id
   join public.pth_application_reminder_ledger r on r.id=re.source_id
   where rd.subscription_id=d.subscription_id and rd.state='sent'
    and re.kind='application_reminders' and r.reminder_kind='daily'
    and r.recipient_id='6193f310-1e3f-4404-b874-977d0e23a6a0'
    and r.local_date=(v_now at time zone 'America/Havana')::date
    and p.created_at>=r.snapshot_at-interval '168 hours' and p.created_at<=r.snapshot_at);

 return query with due as (
  select d.event_id,d.subscription_id from public.pth_push_deliveries d
  join public.pth_push_events e on e.id=d.event_id
  where e.expires_at>v_now and d.attempts<8 and d.next_attempt_at<=v_now
   and (d.state='pending' or (d.state='sending' and d.lease_until<v_now))
   -- Do not race an individual notice against its device's live daily recap.
   -- Failed/expired recaps release the individual notice without retry cost.
   and (e.kind<>'applications' or not exists(
    select 1 from public.pth_push_deliveries rd
    join public.pth_push_events re on re.id=rd.event_id
    join public.pth_application_reminder_ledger r on r.id=re.source_id
    join public.gestores p on p.id=e.source_id
    where rd.subscription_id=d.subscription_id
     and rd.state in ('pending','sending') and re.expires_at>v_now
     and re.kind='application_reminders' and r.reminder_kind='daily'
     and r.recipient_id='6193f310-1e3f-4404-b874-977d0e23a6a0'
     and r.local_date=(v_now at time zone 'America/Havana')::date
     and p.created_at>=r.snapshot_at-interval '168 hours' and p.created_at<=r.snapshot_at))
  order by d.next_attempt_at,d.event_id limit p_limit for update of d skip locked
 ), claimed as (
  update public.pth_push_deliveries d set state='sending',attempts=d.attempts+1,
   lease_until=v_now+interval '2 minutes',lease_token=gen_random_uuid()
  from due where d.event_id=due.event_id and d.subscription_id=due.subscription_id
  returning d.event_id,d.subscription_id,d.lease_token,d.attempts
 ) select c.event_id,c.subscription_id,c.lease_token,c.attempts,e.kind,e.source_id,e.expires_at
 from claimed c join public.pth_push_events e on e.id=c.event_id;
end;
$$;
revoke all on function public.pth_claim_push_deliveries(integer)
 from public,anon,authenticated;
grant execute on function public.pth_claim_push_deliveries(integer) to service_role;
-- One snapshot after encryption, just before provider HTTP. Boolean only;
-- no passwords, session values, keys, endpoints or applicant records returned.
create function public.pth_application_reminder_delivery_ready(
 p_ledger_id uuid,p_subscription_id uuid,p_lease_token uuid,p_fingerprint text
)
returns boolean language sql security invoker set search_path='' as $$
 with instant as (select pg_catalog.now() ts)
 select exists(
  select 1 from public.pth_push_subscriptions s
  join public.gestores g on g.id=s.gestor_id
  join public.pth_secure_sessions a
   on a.token_hash=s.session_hash and a.gestor_id=g.id
  cross join public.pth_application_reminder_config c
  cross join instant n
  where s.id=p_subscription_id and c.singleton and c.enabled
   and c.angel_id='6193f310-1e3f-4404-b874-977d0e23a6a0'
   and c.marcel_id='38f20b63-a845-4a03-8d10-9a57da2ac2c4'
   and g.id in(c.angel_id,c.marcel_id)
   and g.parent_id is null and g.estado='activo' and g.activo is distinct from false
   and lower(g.rol) in('admin','administrador','superadmin','logistica')
   and a.expires_at>n.ts and s.expires_at>n.ts and s.revoked_at is null
   and 'application_reminders'=any(s.topics)
   and a.credential_hash=pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(g.password,'UTF8')),'hex')
   and p_fingerprint ~ '^[a-f0-9]{64}$'
   and p_fingerprint=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    s.endpoint||E'\n'||s.p256dh||E'\n'||s.auth||E'\n'||s.session_hash,'UTF8')),'hex')
   and (
    -- An explicitly requested generic pilot has no fake source/lease and
    -- checks the same current device/session/policy, at any hour. Existing
    -- gateway pilot ownership, rate limit and secret dispatch auth remain.
    (p_ledger_id is null and p_lease_token is null)
    or (p_ledger_id is not null and p_lease_token is not null and exists(
     select 1 from public.pth_application_reminder_ledger r
     join public.pth_push_events e on e.source_id=r.id and e.kind='application_reminders'
     join public.pth_push_deliveries d
      on d.event_id=e.id and d.subscription_id=s.id
     where r.id=p_ledger_id and r.recipient_id=g.id
      and r.local_date=(n.ts at time zone 'America/Havana')::date
      and (n.ts at time zone 'America/Havana')::time>=time '08:00'
      and (n.ts at time zone 'America/Havana')::time<time '09:00'
      and ((r.reminder_kind='daily' and g.id=c.angel_id)
       or (r.reminder_kind='escalation' and g.id=c.marcel_id))
      and e.expires_at>n.ts and s.created_at<=e.created_at
      and d.state='sending' and d.lease_token=p_lease_token and d.lease_until>n.ts
      and exists(select 1 from public.gestores p
       where p.parent_id is null and p.estado='pendiente'
        and p.created_at>=n.ts-interval '168 hours' and p.created_at<=n.ts
        and (r.reminder_kind='daily' or p.created_at<n.ts-interval '48 hours'))
    ))
   )
 );
$$;
revoke all on function public.pth_application_reminder_delivery_ready(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.pth_application_reminder_delivery_ready(uuid,uuid,uuid,text)
 to service_role;
-- No new trigger, extension, cron job, Vault record, secret or public RPC route.
commit;
