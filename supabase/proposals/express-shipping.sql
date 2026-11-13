-- Apply before updating the order insert and subgestor approval RPCs.
begin;
do $$
declare tier text;
begin
  foreach tier in array array['pequeno','mediano','grande'] loop
    execute format('alter table public.tarifas_mensajeria
      add column %1$I numeric(12,2), add column %2$I integer,
      add constraint %3$I check (
        (%1$I is null and %2$I is null) or
        (%1$I is not null and %2$I is not null and %4$I is not null
         and %1$I >= 0 and %1$I > round(%4$I,2) and %1$I < ''Infinity''::numeric and %2$I > 0))',
      'precio_expres_'||tier,'minutos_expres_'||tier,'tarifa_expres_'||tier,'precio_'||tier);
  end loop;
end $$;

alter table public.pedidos
  add column servicio_mensajeria text not null default 'ordinary',
  add column plazo_mensajeria_minutos integer,
  add constraint pedido_mensajeria_snapshot check (
    (servicio_mensajeria='ordinary' and plazo_mensajeria_minutos is null) or
    (servicio_mensajeria='express' and plazo_mensajeria_minutos is not null and plazo_mensajeria_minutos>0));

alter table public.pedidos_subgestores
  add column servicio_mensajeria text not null default 'ordinary',
  add column plazo_mensajeria_minutos integer,
  add constraint pedido_subgestor_mensajeria_snapshot check (
    (servicio_mensajeria='ordinary' and plazo_mensajeria_minutos is null) or
    (servicio_mensajeria='express' and plazo_mensajeria_minutos is not null and plazo_mensajeria_minutos>0));

notify pgrst, 'reload schema';
commit;
