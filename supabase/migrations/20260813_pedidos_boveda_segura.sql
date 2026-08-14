create or replace function public.listar_pedidos_boveda(
  p_admin_id uuid,
  p_password text
)
returns table (
  id uuid,
  fecha timestamptz,
  estado text,
  total numeric,
  comision_total numeric,
  costo_mensajeria numeric,
  producto text,
  gestor text,
  proveedor text,
  pago_sistema text,
  orden_dia text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $function$
begin
  if not public.es_admin_boveda(p_admin_id,p_password) then
    raise exception 'Acceso reservado a administradores de la Bóveda';
  end if;

  return query
  select
    p.id, p.fecha, p.estado, p.total, p.comision_total,
    p.costo_mensajeria, p.producto, p.gestor, p.proveedor,
    p.pago_sistema, p.orden_dia
  from public.pedidos p
  where p.estado = 'Entregado'
  order by p.fecha;
end;
$function$;

revoke all on function public.listar_pedidos_boveda(uuid,text)
  from public, anon, authenticated;
grant execute on function public.listar_pedidos_boveda(uuid,text)
  to anon, authenticated;
