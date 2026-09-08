-- Restauración única de visibilidad para los productos hoy disponibles.
-- Aprobada para corregir configuraciones históricas que ocultaron la red completa.
-- No modifica precios ni comisiones; los gestores podrán ocultar equipos manualmente después.

begin;

with actualizados as (
  update public.precios_personalizados pp
     set visible_subgestor = true
    from public.productos p
   where p.id = pp.producto_id
     and p.disponible = 'SI'
     and pp.visible_subgestor is false
     and exists (
       select 1
         from public.gestores g
        where g.nombre = pp.gestor
          and g.parent_id is null
     )
  returning pp.id
)
select count(*) as productos_reactivados
  from actualizados;

commit;
