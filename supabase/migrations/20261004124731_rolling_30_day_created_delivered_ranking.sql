-- Prepared only. Approved counting rule Sentinel_0dd846afcaf08191812c51e9a88fc29a.
-- Same invoker, actor and object ACLs; no new permissions or data mutations.
begin;
create or replace function public.pth_ranking_summary(p_actor_id uuid)
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public
as $ranking$
with clock as (
 select current_timestamp as now_at, (current_timestamp at time zone 'America/Havana')::date as today
), calendar as (
 select now_at, today, (today-29)::timestamp as local_start, (today+1)::timestamp as local_next,
  (today-29)::timestamp at time zone 'America/Havana' as start_default,
  (today+1)::timestamp at time zone 'America/Havana' as next_default,
  to_char(today,'YYYY-MM') as month_key, today::text as window_key,
  (today-29)::text as start_date, today::text as end_date
 from clock
), period as (
 -- First midnight is essential when Havana repeats midnight at the DST fall-back.
 select now_at,month_key,window_key,start_date,end_date,
  case when (start_default-interval '1 hour') at time zone 'America/Havana'=local_start
   then start_default-interval '1 hour' else start_default end as start_at,
  now_at as end_at,
  case when (next_default-interval '1 hour') at time zone 'America/Havana'=local_next
   then next_default-interval '1 hour' else next_default end as cache_until
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
  count(p.order_id) filter (where p.fecha >= period.start_at and p.fecha <= period.end_at) as count,
  count(p.order_id) filter (where p.fecha is null or p.fecha > period.now_at) as undated_count,
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
 'period', jsonb_build_object('kind','created-delivered-30d','key', period.window_key, 'cacheUntil',period.cache_until,'startAt', period.start_at, 'endAt', period.end_at,
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
commit;
