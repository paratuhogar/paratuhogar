-- Reserva consecutivos por proveedor dentro de una transacción.
-- El contador vive en un esquema privado para que el cliente no pueda alterarlo.
create schema if not exists pth_private;

create table if not exists pth_private.pedido_consecutivos (
  proveedor text primary key,
  ultimo_numero bigint not null default 0 check (ultimo_numero >= 0),
  actualizado_en timestamptz not null default now()
);

alter table pth_private.pedido_consecutivos enable row level security;
revoke all on schema pth_private from public, anon, authenticated;
revoke all on table pth_private.pedido_consecutivos from public, anon, authenticated;

create or replace function public.reservar_consecutivo_pedido(p_proveedor text)
returns text
language plpgsql
security definer
set search_path = public, pth_private, pg_temp
as $function$
declare
  v_proveedor text := upper(trim(coalesce(p_proveedor, '')));
  v_maximo bigint := 0;
  v_numero bigint;
begin
  if v_proveedor = '' or v_proveedor !~ '^[A-Z0-9]{1,12}$' then
    raise exception 'Proveedor inválido para generar el consecutivo';
  end if;

  -- Serializa solo los pedidos del mismo proveedor.
  perform pg_advisory_xact_lock(hashtext('pedido-consecutivo:' || v_proveedor));

  select coalesce(max(numero), 0)
    into v_maximo
  from (
    select ((regexp_match(trim(p.orden_dia), '^[^-]+-([0-9]+)$'))[1])::bigint as numero
      from public.pedidos p
     where upper(trim(p.proveedor)) = v_proveedor
    union all
    select ((regexp_match(trim(s.orden_dia), '^[^-]+-([0-9]+)$'))[1])::bigint as numero
      from public.pedidos_subgestores s
     where upper(trim(s.proveedor)) = v_proveedor
  ) existentes;

  insert into pth_private.pedido_consecutivos (proveedor, ultimo_numero)
  values (v_proveedor, v_maximo)
  on conflict (proveedor) do update
    set ultimo_numero = greatest(pedido_consecutivos.ultimo_numero, excluded.ultimo_numero),
        actualizado_en = now();

  update pth_private.pedido_consecutivos
     set ultimo_numero = ultimo_numero + 1,
         actualizado_en = now()
   where proveedor = v_proveedor
   returning ultimo_numero into v_numero;

  return v_proveedor || '-' || v_numero;
end;
$function$;

revoke all on function public.reservar_consecutivo_pedido(text)
  from public, anon, authenticated;
grant execute on function public.reservar_consecutivo_pedido(text)
  to anon, authenticated;
