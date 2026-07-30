-- Prueba social verificable para ParaTuHogar.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.opiniones_verificadas (
    id uuid primary key default gen_random_uuid(),
    pedido_id text not null unique,
    producto_id text,
    producto_nombre text not null,
    producto_imagen_url text,
    comentario varchar(700) not null,
    valoracion_atencion smallint check (valoracion_atencion between 1 and 5),
    valoracion_mensajeria smallint check (valoracion_mensajeria between 1 and 5),
    municipio varchar(80),
    mostrar_municipio boolean not null default false,
    foto_url text,
    foto_autorizada boolean not null default false,
    consentimiento_publicacion boolean not null default false,
    consentimiento_fecha timestamptz,
    aprobada boolean not null default false,
    fecha_entrega date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Las opiniones históricas pueden incluir un comentario autorizado sin que el
-- cliente haya seleccionado una puntuación. Nunca inventamos estrellas.
alter table public.opiniones_verificadas
    alter column valoracion_atencion drop not null;

create index if not exists opiniones_verificadas_publicas_idx
    on public.opiniones_verificadas (aprobada, consentimiento_publicacion, fecha_entrega desc);

create index if not exists opiniones_verificadas_producto_idx
    on public.opiniones_verificadas (producto_id, aprobada, consentimiento_publicacion);

-- Compatibilidad para instalaciones donde la tabla ya había sido creada.
alter table public.opiniones_verificadas
    add column if not exists producto_imagen_url text;

create or replace function public.set_opinion_verificada_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists opiniones_verificadas_set_updated_at on public.opiniones_verificadas;
create trigger opiniones_verificadas_set_updated_at
before update on public.opiniones_verificadas
for each row execute function public.set_opinion_verificada_updated_at();

-- Impide marcar como verificable una opinión cuyo pedido no exista o no esté entregado.
create or replace function public.validar_opinion_compra_entregada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not exists (
        select 1
        from public.pedidos p
        where p.id::text = new.pedido_id
          and lower(coalesce(p.estado, '')) = 'entregado'
    ) then
        raise exception 'La opinión debe pertenecer a un pedido entregado.';
    end if;

    if new.consentimiento_publicacion and new.consentimiento_fecha is null then
        raise exception 'Debe registrarse la fecha del consentimiento.';
    end if;

    if new.foto_autorizada and coalesce(trim(new.foto_url), '') = '' then
        raise exception 'Una foto autorizada necesita una URL.';
    end if;

    return new;
end;
$$;

drop trigger if exists opiniones_validar_compra_entregada on public.opiniones_verificadas;
create trigger opiniones_validar_compra_entregada
before insert or update on public.opiniones_verificadas
for each row execute function public.validar_opinion_compra_entregada();

alter table public.opiniones_verificadas enable row level security;

-- La web pública solo puede leer opiniones que cumplen las dos condiciones.
drop policy if exists "opiniones_publicas_verificadas" on public.opiniones_verificadas;
create policy "opiniones_publicas_verificadas"
on public.opiniones_verificadas for select to anon
using (aprobada = true and consentimiento_publicacion = true);

-- No se concede INSERT, UPDATE ni DELETE al visitante anónimo.
-- La moderación se realiza desde Supabase o desde un panel administrativo
-- autenticado con permisos seguros.

-- Indicador público agregado: devuelve solo una cifra, nunca datos de clientes.
create or replace function public.contar_pedidos_entregados()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
    select count(*)::bigint
    from public.pedidos
    where lower(coalesce(estado, '')) = 'entregado';
$$;

revoke all on function public.contar_pedidos_entregados() from public;
grant execute on function public.contar_pedidos_entregados() to anon;

-- Ejemplo de alta manual DESPUÉS de obtener autorización escrita:
-- insert into public.opiniones_verificadas (
--   pedido_id, producto_id, producto_nombre, comentario,
--   valoracion_atencion, valoracion_mensajeria,
--   municipio, mostrar_municipio,
--   foto_url, foto_autorizada,
--   consentimiento_publicacion, consentimiento_fecha,
--   aprobada, fecha_entrega
-- ) values (
--   'ID_REAL_DEL_PEDIDO', 'ID_DEL_PRODUCTO', 'Producto adquirido',
--   'Comentario autorizado por el cliente',
--   5, 5, 'Playa', false,
--   null, false,
--   true, now(), true, current_date
-- );
