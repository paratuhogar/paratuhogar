-- Prepared only. Approval: Sentinel_4c0301415144819180a2b0f93cd8aa4d.
-- No order/auth/payment mutations; no historical date backfill; no scheduler.
begin;
create schema if not exists private;
-- Do not revoke privileges on a potentially shared existing private schema.
grant usage on schema private to service_role;
create table private.ranking_monthly_results (
 month text primary key check(month ~ '^\d{4}-(0[1-9]|1[0-2])$' and month>='2026-11'),
 start_at timestamptz not null,
 end_at timestamptz not null check(end_at>start_at),
 closed_at timestamptz not null default current_timestamp check(closed_at>=end_at),
 reliable boolean not null check(reliable),
 winners jsonb not null check(jsonb_typeof(winners)='array'),
 -- Fail closed: no reliable coverage/eligibility evidence source exists yet.
 constraint ranking_closure_pending_verification check(false)
);
alter table private.ranking_monthly_results enable row level security;
revoke all on table private.ranking_monthly_results from public,anon,authenticated,service_role;
grant select,insert on table private.ranking_monthly_results to service_role;
-- No client policies, no new table access outside this one private table.
create or replace function public.pth_finalize_monthly_ranking(p_month text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public
as $finalize$
declare
 v_local timestamp; v_local_end timestamp; v_start timestamptz; v_end timestamptz;
 v_winners jsonb; v_reliable boolean; v_existing private.ranking_monthly_results%rowtype;
begin
 if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_month<'2026-11' then
  raise exception 'Month is invalid or predates the first complete candidate month' using errcode='22023';
 end if;
 v_local:=to_date(p_month||'-01','YYYY-MM-DD')::timestamp;
 v_local_end:=v_local+interval '1 month';
 v_start:=v_local at time zone 'America/Havana';v_end:=v_local_end at time zone 'America/Havana';
 if (v_start-interval '1 hour') at time zone 'America/Havana'=v_local then v_start:=v_start-interval '1 hour';end if;
 if (v_end-interval '1 hour') at time zone 'America/Havana'=v_local_end then v_end:=v_end-interval '1 hour';end if;
 if current_timestamp<v_end then raise exception 'Open months cannot be finalized' using errcode='22023';end if;
 -- Serialize duplicate closure attempts; no UPDATE/DELETE grant is needed.
 perform pg_advisory_xact_lock(hashtextextended('pth-ranking-close:'||p_month,0));
 select * into v_existing from private.ranking_monthly_results where month=p_month;
 if found then return jsonb_build_object('month',v_existing.month,'closedAt',v_existing.closed_at,'leaderCount',jsonb_array_length(v_existing.winners));end if;
 raise exception 'Coverage and eligibility verification unavailable; closure disabled' using errcode='22023';
 if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass and tgname='pth_record_first_delivery_date' and tgenabled in ('O','A')) then
  raise exception 'Prospective delivery timestamp recording must be enabled' using errcode='22023';
 end if;
with period as (select v_start as start_at,v_end as end_at,current_timestamp as now_at), accounts as (
 select g.id, g.nombre, g.parent_id, parent.nombre as parent_name,
  coalesce(nullif(btrim(g.nombre_publico), ''), nullif(split_part(btrim(g.nombre), ' ', 1), ''), 'Cuenta') as alias,
  g.estado = 'activo' and g.activo is not false
   and (g.parent_id is not null or lower(coalesce(g.rol, '')) not in ('admin','administrador','superadmin','logistica','mensajero'))
   and (g.parent_id is null or (parent.estado = 'activo' and parent.activo is not false)) as participates
 from public.gestores g left join public.gestores parent on parent.id = g.parent_id
), delivered as (
 select p.id, p.gestor, p.subgestor_nombre, p.fecha, p.fecha_entrega from public.pedidos p where p.estado = 'Entregado'
), candidates as (
 select p.id as order_id, a.id as account_id, p.fecha, p.fecha_entrega,
  count(*) over (partition by p.id) as candidate_count
 from delivered p join accounts a on
  (nullif(btrim(p.subgestor_nombre), '') is null and a.parent_id is null and a.nombre = p.gestor and p.gestor <> 'Venta Directa')
  or (nullif(btrim(p.subgestor_nombre), '') is not null and a.parent_id is not null and a.nombre = p.subgestor_nombre and a.parent_name = p.gestor)
), attributed as (
 select * from candidates where candidate_count = 1
), stats as (
 select a.id, a.alias, coalesce(a.participates, false) as participates,
  count(p.order_id) as lifetime_count,
  count(p.order_id) filter (where p.fecha_entrega >= period.start_at and p.fecha_entrega < period.end_at
   and p.fecha_entrega <= period.now_at and (p.fecha is null or p.fecha_entrega >= p.fecha)) as count,
  count(p.order_id) filter (where p.fecha_entrega is null or p.fecha_entrega > period.now_at or p.fecha_entrega < p.fecha) as undated_count,
  not exists (select 1 from accounts other where other.id <> a.id and other.nombre = a.nombre
   and ((a.parent_id is null and other.parent_id is null) or
    (a.parent_id is not null and other.parent_id is not null and other.parent_name = a.parent_name))) as identity_reliable
 from accounts a cross join period left join attributed p on p.account_id = a.id
 group by a.id, a.alias, a.participates, a.nombre, a.parent_id, a.parent_name
), ranked as (
 select id, alias, count, rank() over (order by count desc) as position,
  row_number() over (order by count desc, id) as ordinal
 from stats where participates and count > 0
), quality as (
 select not exists (
  select 1 from delivered p where
   not (coalesce(p.gestor,'')='Venta Directa' and nullif(btrim(p.subgestor_nombre),'') is null)
   and ((p.fecha_entrega>=v_start and p.fecha_entrega<v_end) or (p.fecha>=v_start and p.fecha<v_end))
   and (p.fecha_entrega is null or p.fecha_entrega>current_timestamp or p.fecha_entrega<p.fecha
    or not exists(select 1 from attributed a where a.order_id=p.id))
 ) as reliable
)
select coalesce((select jsonb_agg(jsonb_build_object('id',id,'alias',left(alias,40),'count',count) order by id) from ranked where position=1),'[]'::jsonb),quality.reliable
into v_winners,v_reliable from quality;
 if not v_reliable then raise exception 'Month requires date and attribution review; no recognition recorded' using errcode='22023';end if;
 insert into private.ranking_monthly_results(month,start_at,end_at,reliable,winners) values(p_month,v_start,v_end,true,v_winners);
 return jsonb_build_object('month',p_month,'closedAt',current_timestamp,'leaderCount',jsonb_array_length(v_winners));
end;
$finalize$;
revoke all on function public.pth_finalize_monthly_ranking(text) from public,anon,authenticated;
grant execute on function public.pth_finalize_monthly_ranking(text) to service_role;

create or replace function public.pth_ranking_summary(p_actor_id uuid)
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public
as $ranking$
with clock as (
 select current_timestamp as now_at, date_trunc('month', current_timestamp at time zone 'America/Havana') as local_start
), calendar as (
 select now_at, local_start, local_start at time zone 'America/Havana' as start_default,
  local_start + interval '1 month' as local_end,
  (local_start + interval '1 month') at time zone 'America/Havana' as end_default,
  to_char(local_start, 'YYYY-MM') as month_key,
  local_start::date::text as start_date, (local_start + interval '1 month' - interval '1 day')::date::text as end_date
 from clock
), period as (
 -- Cuba can repeat midnight when DST ends. Use the FIRST midnight, not the later fold.
 select now_at, month_key, start_date, end_date,
  case when (start_default - interval '1 hour') at time zone 'America/Havana' = local_start
   then start_default - interval '1 hour' else start_default end as start_at,
  case when (end_default - interval '1 hour') at time zone 'America/Havana' = local_end
   then end_default - interval '1 hour' else end_default end as end_at
 from calendar
), accounts as (
 select g.id, g.nombre, g.parent_id, parent.nombre as parent_name,
  coalesce(nullif(btrim(g.nombre_publico), ''), nullif(split_part(btrim(g.nombre), ' ', 1), ''), 'Cuenta') as alias,
  g.estado = 'activo' and g.activo is not false
   and (g.parent_id is not null or lower(coalesce(g.rol, '')) not in ('admin','administrador','superadmin','logistica','mensajero'))
   and (g.parent_id is null or (parent.estado = 'activo' and parent.activo is not false)) as participates
 from public.gestores g left join public.gestores parent on parent.id = g.parent_id
), delivered as (
 select p.id, p.gestor, p.subgestor_nombre, p.fecha, p.fecha_entrega from public.pedidos p where p.estado = 'Entregado'
), candidates as (
 select p.id as order_id, a.id as account_id, p.fecha, p.fecha_entrega,
  count(*) over (partition by p.id) as candidate_count
 from delivered p join accounts a on
  (nullif(btrim(p.subgestor_nombre), '') is null and a.parent_id is null and a.nombre = p.gestor and p.gestor <> 'Venta Directa')
  or (nullif(btrim(p.subgestor_nombre), '') is not null and a.parent_id is not null and a.nombre = p.subgestor_nombre and a.parent_name = p.gestor)
), attributed as (
 select * from candidates where candidate_count = 1
), stats as (
 select a.id, a.alias, coalesce(a.participates, false) as participates,
  count(p.order_id) as lifetime_count,
  count(p.order_id) filter (where p.fecha_entrega >= period.start_at and p.fecha_entrega < period.end_at
   and p.fecha_entrega <= period.now_at and (p.fecha is null or p.fecha_entrega >= p.fecha)) as count,
  count(p.order_id) filter (where p.fecha_entrega is null or p.fecha_entrega > period.now_at or p.fecha_entrega < p.fecha) as undated_count,
  not exists (select 1 from accounts other where other.id <> a.id and other.nombre = a.nombre
   and ((a.parent_id is null and other.parent_id is null) or
    (a.parent_id is not null and other.parent_id is not null and other.parent_name = a.parent_name))) as identity_reliable
 from accounts a cross join period left join attributed p on p.account_id = a.id
 group by a.id, a.alias, a.participates, a.nombre, a.parent_id, a.parent_name
), ranked as (
 select id, alias, count, rank() over (order by count desc) as position,
  row_number() over (order by count desc, id) as ordinal
 from stats where participates and count > 0
), own as (
 select s.*, r.position, r.ordinal from stats s left join ranked r on r.id = s.id where s.id = p_actor_id
), top_three as (
 select id, alias, count, position, ordinal from ranked order by ordinal limit 3
), neighbors as (
 select r.id, r.alias, r.count, r.position, r.ordinal from ranked r cross join own
 where abs(r.ordinal - own.ordinal) <= 2 order by r.ordinal limit 5
), quality as (
 select not exists (select 1 from delivered p cross join period where p.fecha_entrega is null
  or p.fecha_entrega > period.now_at or p.fecha_entrega < p.fecha
  or not exists (select 1 from attributed a where a.order_id = p.id)) as history_complete
)
select jsonb_build_object(
 'period', jsonb_build_object('key', period.month_key, 'startAt', period.start_at, 'endAt', period.end_at,
  'startDate', period.start_date, 'endDate', period.end_date, 'timeZone', 'America/Havana'),
 'updatedAt', period.now_at,
 'leaderCount', (select count(*) from ranked where position=1),
 'history', coalesce((select jsonb_agg(h.item order by h.month desc) from (select r.month, jsonb_build_object('month',r.month,'closedAt',r.closed_at,'leaderCount',jsonb_array_length(r.winners),'count',(r.winners->0->>'count')::bigint,'aliases',coalesce((select jsonb_agg(w.value->>'alias' order by w.ordinality) from jsonb_array_elements(r.winners) with ordinality w where w.ordinality<=3),'[]'::jsonb)) as item from private.ranking_monthly_results r where r.reliable and r.end_at<=period.now_at and r.month<period.month_key and jsonb_array_length(r.winners)>0 order by r.month desc limit 6) h),'[]'::jsonb),
 'self', jsonb_build_object('id', own.id, 'alias', own.alias, 'count', own.count, 'rank', own.position,
  'lifetimeCount', own.lifetime_count, 'undatedCount', own.undated_count,
  'participates', own.participates, 'identityReliable', own.identity_reliable,
  'nextHigherCount', (select min(count) from ranked where count>own.count and own.count>0 and own.participates),
  'monthlyBadges', coalesce((select jsonb_agg(b.item order by b.month desc) from (select r.month,jsonb_build_object('month',r.month,'count',(w.value->>'count')::bigint) as item from private.ranking_monthly_results r cross join lateral jsonb_array_elements(r.winners) w where r.reliable and r.end_at<=period.now_at and r.month<period.month_key and w.value->>'id'=p_actor_id::text order by r.month desc limit 120) b),'[]'::jsonb)),
 'top', coalesce((select jsonb_agg(to_jsonb(t) - 'position' - 'ordinal' || jsonb_build_object('rank', t.position) order by t.ordinal) from top_three t), '[]'::jsonb),
 'nearby', coalesce((select jsonb_agg(to_jsonb(n) - 'position' - 'ordinal' || jsonb_build_object('rank', n.position) order by n.ordinal) from neighbors n), '[]'::jsonb),
 'historyComplete', quality.history_complete
) from period cross join own cross join quality;
$ranking$;
revoke all on function public.pth_ranking_summary(uuid) from public, anon, authenticated;
grant execute on function public.pth_ranking_summary(uuid) to service_role;

commit;
