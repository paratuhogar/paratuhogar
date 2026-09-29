-- Activate only after the corresponding frontend and secure-data are live.
-- Canonical finance data stays unchanged; only public API privileges change.
do $$
declare t text; f record; cols text;
begin
 foreach t in array array['productos','gestores','pedidos','pedidos_subgestores',
 'precios_personalizados','inventario_eventos','caja_gestores','solicitudes_cobro',
 'solicitudes_cobro_detalle','solicitudes_cobro_adelantos','configuracion_equipo','mensajeros']
 loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on table public.%I from public,anon,authenticated',t);
   select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
   execute format('revoke select(%s),insert(%s),update(%s),references(%s) on table public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
   execute format('grant select,insert,update,delete on table public.%I to service_role',t);
 end loop;
 -- SECURITY DEFINER routines that touch private tables are server-only.
 -- Leave only the two deliberately public aggregate/sequence entrypoints.
 for f in select p.oid::regprocedure signature from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (p.prosecdef or p.prosrc ~ 'productos|gestores|pedidos|comision')
 and p.proname not in ('contar_pedidos_entregados','reservar_consecutivo_pedido')
 loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
   execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;
$$;
-- Public SEO reads use column privileges plus invoker RLS, not a definer view.
alter view public.catalogo_publico set (security_invoker=true);
grant select(id,nombre,precio,descripcion,thumbnail,image1,image2,image3,categoria,
 mensajeria,disponible,garantia,pagos,vistas,created_at,proveedor,precio_flexible,
 cup_extra,"tamaño_envio",ficha_pdf,ficha_pdf_nombre,ficha_pdf_idioma,
 inventario_actualizado_en,slug,seo_title,seo_description)
 on public.productos to anon,authenticated;
