-- Adelantos de solicitudes visibles únicamente para administradores de Bóveda.
-- Evita leer directamente la tabla protegida solicitudes_cobro desde master.html.

create or replace function public.listar_adelantos_solicitudes_nomina(
  p_admin_id uuid,
  p_password text
) returns table (
  gestor_nombre text,
  adelantado_usd numeric
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
  select s.gestor_nombre, coalesce(s.adelantado_usd, 0)
    from public.solicitudes_cobro s
   where s.estado in ('pendiente', 'procesando')
     and coalesce(s.adelantado_usd, 0) > 0;
end;
$$;

revoke all on function public.listar_adelantos_solicitudes_nomina(uuid,text) from public, anon, authenticated;
grant execute on function public.listar_adelantos_solicitudes_nomina(uuid,text) to anon, authenticated;
