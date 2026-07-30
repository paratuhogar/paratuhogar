-- URLs permanentes y metadatos SEO de productos · ParaTuHogar
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists unaccent;

alter table public.productos
    add column if not exists slug text,
    add column if not exists seo_title text,
    add column if not exists seo_description text;

create or replace function public.crear_slug_producto(valor text)
returns text
language sql
immutable
strict
set search_path = public
as $$
    select trim(both '-' from regexp_replace(
        lower(public.unaccent(valor)),
        '[^a-z0-9]+',
        '-',
        'g'
    ));
$$;

with candidatos as (
    select
        id,
        public.crear_slug_producto(nombre) as base_slug,
        row_number() over (
            partition by public.crear_slug_producto(nombre)
            order by created_at nulls last, id
        ) as repetido
    from public.productos
    where nullif(trim(slug), '') is null
)
update public.productos p
set slug = case
    when c.repetido = 1 then c.base_slug
    else c.base_slug || '-' || left(p.id::text, 8)
end
from candidatos c
where p.id = c.id;

create unique index if not exists productos_slug_unico_idx
    on public.productos (slug)
    where slug is not null;

create or replace function public.asignar_slug_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    candidato text;
begin
    if nullif(trim(new.slug), '') is not null then
        new.slug := public.crear_slug_producto(new.slug);
        return new;
    end if;

    candidato := public.crear_slug_producto(new.nombre);
    if exists (select 1 from public.productos where slug = candidato and id is distinct from new.id) then
        candidato := candidato || '-' || left(new.id::text, 8);
    end if;
    new.slug := candidato;
    return new;
end;
$$;

drop trigger if exists productos_slug_permanente on public.productos;
create trigger productos_slug_permanente
before insert or update of slug on public.productos
for each row execute function public.asignar_slug_producto();

-- El slug queda estable aunque después se edite el nombre.
-- seo_title y seo_description son opcionales: el generador usa valores
-- profesionales automáticos mientras esos campos permanezcan vacíos.
