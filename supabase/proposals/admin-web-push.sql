-- PROPOSAL ONLY. Do not execute before specific database/access approval.
-- No customer values, titles, report text, screenshots, or bearer tokens stored.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
create table public.pth_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 gestor_id uuid not null references public.gestores(id) on delete cascade,
 session_hash text not null references public.pth_secure_sessions(token_hash) on delete cascade,
 endpoint text not null unique check (length(endpoint) between 20 and 2048),
 p256dh text not null check (length(p256dh) between 80 and 128),
 auth text not null check (length(auth) between 20 and 64),
 topics text[] not null check (cardinality(topics) between 1 and 2 and topics <@ array['orders','suggestions']::text[]),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz
);
create index pth_push_active_actor on public.pth_push_subscriptions(gestor_id,expires_at) where revoked_at is null;
create table public.pth_push_events (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('orders','suggestions')),
 source_id uuid not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '1 hour'),
 unique(kind,source_id)
);
create table public.pth_push_deliveries (
 event_id uuid not null references public.pth_push_events(id) on delete cascade,
 subscription_id uuid not null references public.pth_push_subscriptions(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','sending','sent','expired','failed')),
 attempts integer not null default 0 check(attempts between 0 and 8),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 status_code smallint,
 primary key(event_id,subscription_id)
);
create index pth_push_delivery_due on public.pth_push_deliveries(next_attempt_at) where state in ('pending','sending');
alter table public.pth_push_subscriptions enable row level security;
alter table public.pth_push_events enable row level security;
alter table public.pth_push_deliveries enable row level security;
revoke all on public.pth_push_subscriptions,public.pth_push_events,public.pth_push_deliveries from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.pth_push_subscriptions,public.pth_push_events,public.pth_push_deliveries to service_role;
-- Trigger writes only the minimal outbox row in the same transaction as INSERT.
-- Rollback = no visible event. Retried/duplicate checkout INSERTs = no extra event.
create function public.pth_enqueue_admin_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='pedidos' then
  insert into public.pth_push_events(kind,source_id) values('orders',NEW.id) on conflict(kind,source_id) do nothing;
 elsif TG_TABLE_NAME='pth_feedback' and NEW.kind='mejora' then
  insert into public.pth_push_events(kind,source_id) values('suggestions',NEW.id) on conflict(kind,source_id) do nothing;
 end if;
 return NEW;
end;
$$;
revoke all on function public.pth_enqueue_admin_push() from public,anon,authenticated,service_role;
create trigger pth_push_new_order after insert on public.pedidos for each row execute function public.pth_enqueue_admin_push();
create trigger pth_push_new_suggestion after insert on public.pth_feedback for each row execute function public.pth_enqueue_admin_push();
-- Preparation release: no order/report event is collected before activation.
alter table public.pedidos disable trigger pth_push_new_order;
alter table public.pth_feedback disable trigger pth_push_new_suggestion;
-- No backfill, no cart events, no update trigger, no second trigger for
-- pedidos_subgestores: notification occurs once when approved into pedidos.
-- Scheduler, lease RPC, Vault/Edge secrets and dispatcher are separate gated work.
commit;
