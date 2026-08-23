-- Adelantos vinculados a solicitudes de cobro.
-- El importe_usd de la solicitud es el total originalmente solicitado.
-- adelantado_usd registra lo ya entregado y permite calcular el restante.

begin;

alter table public.solicitudes_cobro
  add column if not exists adelantado_usd numeric(12,2) not null default 0
  check (adelantado_usd >= 0);

create table if not exists public.solicitudes_cobro_adelantos (
  id bigint generated always as identity primary key,
  solicitud_id uuid not null references public.solicitudes_cobro(id) on delete restrict,
  gestor_id uuid not null references public.gestores(id) on delete restrict,
  importe_usd numeric(12,2) not null check (importe_usd > 0),
  nota text,
  registrado_por uuid references public.gestores(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists solicitudes_cobro_adelantos_solicitud_idx
  on public.solicitudes_cobro_adelantos(solicitud_id, creado_en desc);

alter table public.solicitudes_cobro_adelantos enable row level security;
revoke all on public.solicitudes_cobro_adelantos from anon, authenticated;

create or replace function public.registrar_adelanto_solicitud_cobro(
  p_admin_id uuid,
  p_password text,
  p_solicitud_id uuid,
  p_importe_usd numeric,
  p_nota text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_cobro%rowtype;
  v_restante numeric(12,2);
begin
  if not public.es_admin_boveda(p_admin_id, p_password) then
    raise exception 'Acceso reservado a administradores de la Bóveda';
  end if;
  if round(coalesce(p_importe_usd, 0), 2) <= 0 then
    raise exception 'El adelanto debe ser mayor que cero';
  end if;

  select * into v_solicitud
    from public.solicitudes_cobro
   where id = p_solicitud_id
     and estado in ('pendiente','procesando')
   for update;
  if not found then
    raise exception 'La solicitud no está activa o no existe';
  end if;

  v_restante := round(v_solicitud.importe_usd - v_solicitud.adelantado_usd, 2);
  if round(p_importe_usd, 2) > v_restante then
    raise exception 'El adelanto supera el saldo pendiente de $%', to_char(v_restante, 'FM999999990.00');
  end if;

  insert into public.solicitudes_cobro_adelantos(
    solicitud_id, gestor_id, importe_usd, nota, registrado_por
  ) values (
    v_solicitud.id, v_solicitud.gestor_id, round(p_importe_usd, 2), nullif(trim(p_nota), ''), p_admin_id
  );

  update public.solicitudes_cobro
     set adelantado_usd = round(adelantado_usd + p_importe_usd, 2)
   where id = v_solicitud.id;

  return jsonb_build_object(
    'solicitud_id', v_solicitud.id,
    'solicitado_usd', v_solicitud.importe_usd,
    'adelantado_usd', round(v_solicitud.adelantado_usd + p_importe_usd, 2),
    'restante_usd', round(v_restante - p_importe_usd, 2)
  );
end;
$$;

revoke all on function public.registrar_adelanto_solicitud_cobro(uuid,text,uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.registrar_adelanto_solicitud_cobro(uuid,text,uuid,numeric,text) to anon, authenticated;

commit;
