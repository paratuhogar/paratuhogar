begin;

-- Ejecutar después de 20260813_deuda_sistema_contable.sql cuando la primera
-- instalación materializó estos pedidos mixtos con el parser anterior.
delete from public.deuda_sistema_detalle d
using public.pedidos p
where d.pedido_id = p.id
  and d.liquidacion_id is null
  and p.orden_dia in ('CA-1247','CA-1324');

select public.materializar_deuda_sistema_pedido(p.id)
from public.pedidos p
where p.orden_dia in ('CA-1247','CA-1324')
order by p.orden_dia;

-- Corte histórico conocido antes de la primera liquidación. Si la reparación
-- no produce exactamente el saldo auditado, toda la transacción se revierte.
do $block$
declare
  v_validacion jsonb;
begin
  v_validacion := public.validar_deuda_sistema_integridad();
  if (v_validacion->>'pedidos')::integer <> 146
     or (v_validacion->>'lineas')::integer <> 148
     or (v_validacion->>'incidencias')::integer <> 0
     or (v_validacion->>'total')::numeric <> 332.00 then
    raise exception 'Corte contable inesperado: %', v_validacion;
  end if;
end;
$block$;

commit;
