begin;

do $repair$
declare
  v_id uuid := 'ac37b5b4-2ca5-46fd-a61c-ce35a8c7637f';
  v_estado text;
  v_telefono text;
begin
  select estado, telefono
    into v_estado, v_telefono
    from public.gestores
   where id = v_id
   for update;

  if not found then
    raise exception 'No existe la cuenta de Acelia';
  end if;
  if regexp_replace(coalesce(v_telefono,''), '\D', '', 'g') <> '5353611398' then
    raise exception 'El teléfono de la cuenta no coincide: %', v_telefono;
  end if;
  if v_estado not in ('ausente_definitivo','activo') then
    raise exception 'Estado no reparable automáticamente: %', v_estado;
  end if;
  if not exists (
    select 1
      from public.pedidos
     where gestor = 'Acelia Martínez Torres'
       and estado = 'Entregado'
       and fecha::timestamptz >= timestamptz '2026-08-06 00:00:00 America/Havana'
  ) then
    raise exception 'Acelia no tiene una venta entregada desde el inicio del nuevo período';
  end if;

  update public.gestores
     set estado = 'activo',
         fecha_rescate = null
   where id = v_id;

  if not exists (
    select 1
      from public.gestores
     where id = v_id
       and estado = 'activo'
       and fecha_rescate is null
  ) then
    raise exception 'La reactivación de Acelia no quedó aplicada';
  end if;
end;
$repair$;

commit;
