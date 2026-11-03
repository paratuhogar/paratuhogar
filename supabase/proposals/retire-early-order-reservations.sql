-- LAST activation step, after atomic SQL, new gateway, new web and old requests drain.
-- Older cached pages stop before submitting; no fake reference and no increment.
begin;
create or replace function public.reservar_consecutivo_pedido(p_proveedor text)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 raise exception 'Actualiza la página para confirmar el pedido. Los números se asignan ahora al guardarlo; conserva los datos y revisa la recepción antes de reintentar.';
end;
$$;
commit;
