-- La actividad comercial ya no controla el acceso de los gestores.
-- Conservamos la función antigua como no-op para que clientes antiguos no
-- fallen si todavía intentan llamarla durante la actualización.

begin;

create or replace function public.aplicar_inactividad_gestores(
  p_admin_id uuid,
  p_password text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_admin_boveda(p_admin_id, p_password) then
    raise exception 'Acceso reservado a administradores de la Bóveda';
  end if;

  return 0;
end;
$$;

comment on function public.aplicar_inactividad_gestores(uuid, text) is
  'Compatibilidad histórica. La baja por inactividad está desactivada y esta función no modifica cuentas.';

update public.gestores
   set estado = 'activo',
       fecha_rescate = null
 where estado = 'ausente_definitivo';

commit;
