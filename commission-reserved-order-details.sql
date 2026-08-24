-- Expone únicamente los pedidos ya reservados por solicitudes activas del propio gestor.
-- La interfaz usa esta lista para impedir que un pedido se solicite dos veces.

create or replace function public.mis_pedidos_solicitudes_cobro(
  p_gestor_id uuid,
  p_password text
) returns table (pedido_id text)
language sql
security definer
set search_path = public
as $$
  select distinct d.pedido_id
  from public.solicitudes_cobro_detalle d
  join public.solicitudes_cobro s on s.id = d.solicitud_id
  join public.gestores g on g.id = s.gestor_id
  where g.id = p_gestor_id
    and g.password = p_password
    and s.estado in ('pendiente', 'procesando')
$$;

revoke all on function public.mis_pedidos_solicitudes_cobro(uuid,text) from public, anon, authenticated;
grant execute on function public.mis_pedidos_solicitudes_cobro(uuid,text) to anon, authenticated;
