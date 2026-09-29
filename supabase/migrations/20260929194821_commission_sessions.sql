-- Additive stage: deploy the gateway before revoking legacy table access.
create table public.pth_secure_sessions (
 token_hash text primary key check(length(token_hash)=64),
 gestor_id uuid references public.gestores(id) on delete cascade,
 mensajero_id uuid references public.mensajeros(id) on delete cascade,
 credential_hash text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 check ((gestor_id is not null)::int + (mensajero_id is not null)::int = 1)
);
create index pth_secure_sessions_expiry_idx on public.pth_secure_sessions(expires_at);
alter table public.pth_secure_sessions enable row level security;
revoke all on public.pth_secure_sessions from public,anon,authenticated;
grant select,insert,delete on public.pth_secure_sessions to service_role;
create table public.pth_login_rate (
 key_hash text primary key,
 started_at timestamptz not null default now(),
 attempts integer not null default 1
);
alter table public.pth_login_rate enable row level security;
revoke all on public.pth_login_rate from public,anon,authenticated;
grant select,insert,update,delete on public.pth_login_rate to service_role;
create function public.pth_check_login_rate(p_key text,p_limit integer default 12)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
 if length(p_key)<>64 or p_limit<1 or p_limit>200 then return false; end if;
 insert into public.pth_login_rate(key_hash) values(p_key)
 on conflict(key_hash) do update set
 attempts=case when pth_login_rate.started_at<now()-interval '10 minutes' then 1 else pth_login_rate.attempts+1 end,
 started_at=case when pth_login_rate.started_at<now()-interval '10 minutes' then now() else pth_login_rate.started_at end
 returning attempts into v_count;
 return v_count<=p_limit;
end;
$$;
revoke all on function public.pth_check_login_rate(text,integer) from public,anon,authenticated;
grant execute on function public.pth_check_login_rate(text,integer) to service_role;
-- Intentionally owner-executed projection: no commission, cost or account fields.
-- Predicates can only address this view's explicitly named public columns.
create view public.catalogo_publico with (security_barrier=true) as
 select id,nombre,precio,descripcion,thumbnail,image1,image2,image3,categoria,mensajeria,
 disponible,garantia,pagos,vistas,created_at,proveedor,precio_flexible,cup_extra,
 "tamaño_envio",ficha_pdf,ficha_pdf_nombre,ficha_pdf_idioma,inventario_actualizado_en,
 slug,seo_title,seo_description from public.productos;
revoke all on public.catalogo_publico from public,anon,authenticated;
grant select on public.catalogo_publico to anon,authenticated,service_role;
