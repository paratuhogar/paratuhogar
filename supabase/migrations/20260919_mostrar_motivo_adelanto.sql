-- Expone en la Bóveda la nota que acompaña cada adelanto.
-- Los importes y la selección de solicitudes no cambian.

begin;

drop function if exists public.listar_adelantos_solicitudes_nomina(uuid, text);

create function public.listar_adelantos_solicitudes_nomina(
  p_admin_id uuid,
  p_password text
) returns table (
  solicitud_id uuid,
  gestor_nombre text,
  adelantado_usd numeric,
  motivo_adelanto text
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
    s.id,
    s.gestor_nombre,
    coalesce(s.adelantado_usd, 0),
    (
      select string_agg(nullif(trim(a.nota), ''), ' · ' order by a.creado_en)
        from public.solicitudes_cobro_adelantos a
       where a.solicitud_id = s.id
    )
    from public.solicitudes_cobro s
   where s.estado in ('pendiente', 'procesando')
     and coalesce(s.adelantado_usd, 0) > 0;
end;
$$;

revoke all on function public.listar_adelantos_solicitudes_nomina(uuid, text) from public, anon, authenticated;
grant execute on function public.listar_adelantos_solicitudes_nomina(uuid, text) to anon, authenticated;

drop function if exists public.listar_historial_solicitudes_cobro_beatriz(uuid, text, integer, text);

create function public.listar_historial_solicitudes_cobro_beatriz(
  p_admin_id uuid,
  p_password text,
  p_limit integer default 200,
  p_gestor_nombre text default null
) returns table (
  solicitud_id uuid,
  gestor_nombre text,
  gestor_telefono text,
  parent_nombre text,
  tipo_solicitante text,
  importe_usd numeric,
  metodo_pago text,
  estado text,
  creado_en timestamptz,
  pagado_en timestamptz,
  fecha_pago_prevista date,
  referencia_pago text,
  pedidos jsonb,
  motivo_adelanto text
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
    s.id,
    s.gestor_nombre,
    s.gestor_telefono,
    s.parent_nombre,
    s.tipo_solicitante,
    s.importe_usd,
    s.metodo_pago,
    s.estado,
    s.creado_en,
    s.pagado_en,
    s.fecha_pago_prevista,
    s.referencia_pago,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'pedido_id', d.pedido_id,
          'importe_usd', d.importe_usd,
          'orden_dia', p.orden_dia,
          'producto', p.producto,
          'fecha', p.fecha
        ) order by p.fecha, d.id
      ) filter (where d.id is not null),
      '[]'::jsonb
    ),
    (
      select string_agg(nullif(trim(a.nota), ''), ' · ' order by a.creado_en)
        from public.solicitudes_cobro_adelantos a
       where a.solicitud_id = s.id
    )
  from public.solicitudes_cobro s
  left join public.solicitudes_cobro_detalle d on d.solicitud_id = s.id
  left join public.pedidos p on p.id::text = d.pedido_id
  where s.estado in ('pagado', 'archivado')
    and (
      nullif(trim(coalesce(p_gestor_nombre, '')), '') is null
      or lower(trim(s.gestor_nombre)) = lower(trim(p_gestor_nombre))
    )
  group by
    s.id, s.gestor_nombre, s.gestor_telefono, s.parent_nombre,
    s.tipo_solicitante, s.importe_usd, s.metodo_pago, s.estado,
    s.creado_en, s.pagado_en, s.fecha_pago_prevista, s.referencia_pago
  order by coalesce(s.pagado_en, s.creado_en) desc nulls last, s.creado_en desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

revoke all on function public.listar_historial_solicitudes_cobro_beatriz(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.listar_historial_solicitudes_cobro_beatriz(uuid, text, integer, text) to anon, authenticated;

commit;
