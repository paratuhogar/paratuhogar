-- Synthetic prerequisite schema only. The actual existing insertion/approval SQL
-- is loaded from supabase/proposals, so numbering and transfer contracts are real.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema pth_private;
create table pth_private.pedido_consecutivos (
 proveedor text primary key, ultimo_numero bigint not null, actualizado_en timestamptz default now()
);
create table public.gestores (
 id uuid primary key, nombre text, rol text default 'gestor', parent_id uuid,
 estado text default 'activo', activo boolean default true
);
create table public.productos (
 id uuid primary key, nombre text, "tamaño_envio" text, proveedor text default 'TEST', disponible text default 'SI'
);
create table public.pedidos (
 id uuid primary key, submission_token text, proveedor text, cliente text, telefono text,
 ci text, direccion text, municipio text, producto text, total numeric, costo_mensajeria numeric,
 comision_total numeric, comision_subgestor numeric, comision_parent numeric,
 estado text default 'Pendiente', estado_financiero text default 'Pendiente',
 garantia_venta text, garantia_dias integer, gestor text, origen text, pago_gestor text,
 pago_subgestor text, subgestor_nombre text, orden_dia text,
 servicio_mensajeria text, plazo_mensajeria_minutos integer, fecha timestamptz default now()
);
create table public.pedidos_subgestores (
 id uuid primary key, submission_token text, proveedor text, cliente text, telefono text,
 ci text, direccion text, municipio text, producto text, total numeric, costo_mensajeria numeric,
 comision_total numeric, comision_subgestor numeric, estado text default 'Pendiente Aprobacion',
 estado_financiero text default 'Pendiente', garantia_venta text, garantia_dias integer,
 subgestor_id uuid, subgestor_nombre text, parent_gestor_id uuid, parent_gestor_nombre text,
 orden_dia text, servicio_mensajeria text, plazo_mensajeria_minutos integer,
 created_at timestamptz default now()
);
create unique index on public.pedidos(submission_token,proveedor);
create unique index on public.pedidos_subgestores(submission_token,proveedor);
create table public.tarifas_mensajeria (
 municipio text, localidad text, precio_pequeno numeric, precio_mediano numeric, precio_grande numeric,
 precio_expres_pequeno numeric, precio_expres_mediano numeric, precio_expres_grande numeric,
 minutos_expres_pequeno integer, minutos_expres_mediano integer, minutos_expres_grande integer
);
grant usage on schema public,pth_private to service_role;
grant select,insert,update,delete on all tables in schema public,pth_private to service_role;
