-- Approved and applied 2026-10-03: migration 20261003173240,
-- private_monthly_delivered_ranking. Retained as the exact release SQL.
-- No changes to existing table privileges, RLS, order rows or historical dates.
begin;
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
 'self', jsonb_build_object('id', own.id, 'alias', own.alias, 'count', own.count, 'rank', own.position,
  'lifetimeCount', own.lifetime_count, 'undatedCount', own.undated_count,
  'participates', own.participates, 'identityReliable', own.identity_reliable),
 'top', coalesce((select jsonb_agg(to_jsonb(t) - 'position' - 'ordinal' || jsonb_build_object('rank', t.position) order by t.ordinal) from top_three t), '[]'::jsonb),
 'nearby', coalesce((select jsonb_agg(to_jsonb(n) - 'position' - 'ordinal' || jsonb_build_object('rank', n.position) order by n.ordinal) from neighbors n), '[]'::jsonb),
 'historyComplete', quality.history_complete
) from period cross join own cross join quality;
$ranking$;
revoke all on function public.pth_ranking_summary(uuid) from public, anon, authenticated;
grant execute on function public.pth_ranking_summary(uuid) to service_role;

-- Separate, explicit review: record first delivery only on FUTURE status transitions.
-- Replaying an already-delivered row never fills a missing historical date.
create or replace function public.pth_record_delivery_date()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public
as $delivery$
begin
 if new.estado = 'Entregado' and old.estado is distinct from 'Entregado' then
  new.fecha_entrega := coalesce(old.fecha_entrega, statement_timestamp());
 end if;
 return new;
end;
$delivery$;
revoke all on function public.pth_record_delivery_date() from public, anon, authenticated;
create trigger pth_record_first_delivery_date before update of estado on public.pedidos
for each row execute function public.pth_record_delivery_date();
commit;
