-- Historial confiable de pagos a gestores.
-- La fecha de pago se captura en la transición real a "Pagado" y las
-- solicitudes archivadas siguen disponibles para auditoría.

alter table public.pedidos
  add column if not exists pago_gestor_en timestamptz;

create or replace function public.registrar_fecha_pago_gestor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.pago_gestor, ''))) = 'pagado'
     and lower(trim(coalesce(old.pago_gestor, ''))) <> 'pagado' then
    new.pago_gestor_en = coalesce(new.pago_gestor_en, now());
  elsif lower(trim(coalesce(new.pago_gestor, ''))) <> 'pagado'
        and lower(trim(coalesce(old.pago_gestor, ''))) = 'pagado' then
    new.pago_gestor_en = null;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_registrar_fecha_pago_gestor on public.pedidos;
create trigger pedidos_registrar_fecha_pago_gestor
before update of pago_gestor on public.pedidos
for each row execute function public.registrar_fecha_pago_gestor();

-- Recupera la fecha de solicitudes ya pagadas para pedidos antiguos.
update public.pedidos p
set pago_gestor_en = (
  select s.pagado_en
  from public.solicitudes_cobro_detalle d
  join public.solicitudes_cobro s on s.id = d.solicitud_id
  where d.pedido_id = p.id::text
    and s.estado in ('pagado', 'archivado')
    and s.pagado_en is not null
  order by s.pagado_en desc, s.creado_en desc
  limit 1
)
where lower(trim(coalesce(p.pago_gestor, ''))) = 'pagado'
  and p.pago_gestor_en is null;

create or replace function public.listar_historial_pagos_gestores(
  p_admin_id uuid,
  p_password text,
  p_limit integer default 200
)
returns table (
  pedido_id uuid,
  orden_dia text,
  gestor text,
  comision numeric,
  pagado_en timestamptz,
  solicitud_id uuid,
  referencia_pago text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_boveda(p_admin_id, p_password) then
    raise exception 'Acceso reservado a administradores de la Bóveda';
  end if;

  return query
  select
    p.id,
    p.orden_dia,
    p.gestor,
    coalesce(pr.importe_usd, p.comision_total)::numeric,
    coalesce(p.pago_gestor_en, pr.pagado_en),
    pr.solicitud_id,
    pr.referencia_pago
  from public.pedidos p
  left join lateral (
    select
      s.id as solicitud_id,
      s.pagado_en,
      s.referencia_pago,
      d.importe_usd
    from public.solicitudes_cobro_detalle d
    join public.solicitudes_cobro s on s.id = d.solicitud_id
    where d.pedido_id = p.id::text
      and s.estado in ('pagado', 'archivado')
      and s.pagado_en is not null
    order by s.pagado_en desc, s.creado_en desc
    limit 1
  ) pr on true
  where lower(trim(coalesce(p.pago_gestor, ''))) = 'pagado'
  order by coalesce(p.pago_gestor_en, pr.pagado_en) desc nulls last, p.id desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

revoke all on function public.listar_historial_pagos_gestores(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.listar_historial_pagos_gestores(uuid, text, integer) to anon, authenticated;
