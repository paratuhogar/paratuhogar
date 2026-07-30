-- CRM de seguimientos ParaTuHogar.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.seguimientos_clientes (
    id uuid primary key default gen_random_uuid(),
    gestor text not null,
    subgestor text,
    cliente text not null,
    telefono text not null,
    producto text,
    estado text not null default 'nuevo'
        check (estado in ('nuevo', 'interesado', 'esperando_pago', 'vendido', 'no_interesado', 'cerrado')),
    proximo_contacto timestamptz,
    ultimo_contacto timestamptz,
    nota_corta varchar(300),
    pedido_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists seguimientos_gestor_proximo_idx
    on public.seguimientos_clientes (gestor, proximo_contacto);

create index if not exists seguimientos_gestor_updated_idx
    on public.seguimientos_clientes (gestor, updated_at desc);

create index if not exists seguimientos_gestor_estado_idx
    on public.seguimientos_clientes (gestor, estado);

create or replace function public.set_seguimiento_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists seguimientos_set_updated_at on public.seguimientos_clientes;
create trigger seguimientos_set_updated_at
before update on public.seguimientos_clientes
for each row execute function public.set_seguimiento_updated_at();

alter table public.seguimientos_clientes enable row level security;

-- La web actual usa sesiones propias y la clave anon. Estas políticas mantienen
-- ese modelo para que el módulo funcione. Cuando se migre a Supabase Auth,
-- reemplazarlas por políticas basadas en auth.uid().
drop policy if exists "seguimientos_anon_select" on public.seguimientos_clientes;
create policy "seguimientos_anon_select"
on public.seguimientos_clientes for select to anon
using (true);

drop policy if exists "seguimientos_anon_insert" on public.seguimientos_clientes;
create policy "seguimientos_anon_insert"
on public.seguimientos_clientes for insert to anon
with check (true);

drop policy if exists "seguimientos_anon_update" on public.seguimientos_clientes;
create policy "seguimientos_anon_update"
on public.seguimientos_clientes for update to anon
using (true) with check (true);

drop policy if exists "seguimientos_anon_delete" on public.seguimientos_clientes;
create policy "seguimientos_anon_delete"
on public.seguimientos_clientes for delete to anon
using (true);
