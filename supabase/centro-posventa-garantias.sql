-- Centro ligero de posventa y garantías para gestores.
-- No almacena fotos, videos, audios, carnets ni documentos.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

alter table public.pedidos
    add column if not exists garantia_venta text,
    add column if not exists garantia_dias integer,
    add column if not exists fecha_entrega timestamptz;

alter table public.pedidos_subgestores
    add column if not exists garantia_venta text,
    add column if not exists garantia_dias integer;

create table if not exists public.casos_garantia (
    id uuid primary key default gen_random_uuid(),
    pedido_id text not null,
    gestor text not null,
    producto text not null,
    proveedor text,
    garantia_texto text not null,
    garantia_dias integer,
    garantia_inicio date,
    garantia_fin date,
    problema varchar(1000) not null,
    fecha_inicio_problema date,
    enciende text,
    dano_visible text,
    probado_al_recibir text,
    instalacion_tecnica text,
    tiene_factura text,
    solucion_esperada varchar(400),
    notas_gestor varchar(700),
    estado text not null default 'Pendiente de enviar a Ángel'
        check (estado in (
            'Pendiente de enviar a Ángel',
            'Enviado a Ángel',
            'Esperando respuesta',
            'Esperando información del cliente',
            'Coordinando con proveedor',
            'Revisión técnica',
            'Reparación',
            'Cambio autorizado',
            'Resuelto',
            'Fuera de garantía',
            'Cerrado'
        )),
    ultima_actualizacion timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists casos_garantia_gestor_idx
    on public.casos_garantia (gestor, ultima_actualizacion desc);

create index if not exists casos_garantia_pedido_idx
    on public.casos_garantia (pedido_id);

create or replace function public.actualizar_fecha_caso_garantia()
returns trigger
language plpgsql
as $$
begin
    new.ultima_actualizacion = now();
    return new;
end;
$$;

drop trigger if exists casos_garantia_actualizados on public.casos_garantia;
create trigger casos_garantia_actualizados
before update on public.casos_garantia
for each row execute function public.actualizar_fecha_caso_garantia();

alter table public.casos_garantia enable row level security;

-- Estas políticas mantienen compatibilidad con la sesión actual de la web.
-- Cuando la plataforma migre a Supabase Auth deben reemplazarse por políticas
-- ligadas al usuario autenticado.
drop policy if exists "gestores_consultan_casos" on public.casos_garantia;
create policy "gestores_consultan_casos"
on public.casos_garantia for select to anon
using (true);

drop policy if exists "gestores_crean_casos" on public.casos_garantia;
create policy "gestores_crean_casos"
on public.casos_garantia for insert to anon
with check (true);

drop policy if exists "gestores_actualizan_casos" on public.casos_garantia;
create policy "gestores_actualizan_casos"
on public.casos_garantia for update to anon
using (true)
with check (true);
