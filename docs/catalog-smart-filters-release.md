# Filtros del catálogo — candidato 2026-10-05

Base: `fb831fce698c50aa56c529d93725da58c3d22f03`. Candidato local; sin push ni publicación.

## Definición y observación

La captura original se materializó desde Library y se inspeccionó en el Mac: JPEG 1219 × 954, 108.585 bytes, SHA-256 `9344742c6dddb0717e959569d2c64c3f5fa0f5f981767a4a3e3ae8da55d0f7d3`. Muestra 84 disponibles, 1 nuevo y 11 con ganancia +$10; Nuevos está seleccionado.

La UI documenta **Nuevos · 7 días**. Se preserva `created_at`, con el fallback existente `fecha` cuando no hay fecha de alta. El intervalo es desde hace siete días hasta ahora, inclusive. `updated_at`, reposiciones y ediciones no redefinen un producto como nuevo.

La consulta anónima al catálogo público del 5 de octubre devolvió 441 productos, 84 disponibles y exactamente una alta disponible en ese intervalo: Silla con Reposabrazos 7HOUSE (`created_at`: `2026-10-05T18:39:16.981195+00:00`). No había fechas de alta faltantes, inválidas o futuras. **El contador 1 de la captura coincide con esa definición; el arreglo no demuestra que ese contador fuera incorrecto.** La consulta pública no permite validar las 11 ganancias privadas de la cuenta fotografiada.

Ganancia mantiene el criterio **estrictamente mayor que 10 USD** sobre `product.comision` ya proyectada/personalizada para el usuario. No usa la bolsa del principal ni calcula un reparto nuevo a partir del porcentaje del perfil. `10` y `"10.00"` quedan fuera; `"10.01"` entra. No cambia valores guardados, configuración de precios o comisiones, permisos, autenticación ni datos de clientes.

## Fallos reproducidos y cambio

- El predicado de novedad aceptaba fechas futuras porque una edad negativa también era menor que siete días. Ahora requiere edad no negativa.
- El filtro de ganancia aceptaba `Infinity`. El contador, la tarjeta y el switch comparten una comprobación finita y estricta `>10`.
- `getProductsVisibleOnScreen` aplicaba una copia parcial de los filtros cuando no encontraba tarjetas. Ignoraba Nuevos y Mayor ganancia, y podía recuperar productos excluidos después de un resultado vacío. Ahora usa `getFilteredCatalogProducts`. Mantiene búsqueda, categoría, switch e inventario, y conserva el prefijo paginado cuando existen tarjetas.

Los consumidores corregidos son el mensaje de ofertas y el PDF. El ZIP de fotos sigue con su selección previa por categoría/disponibilidad; no se modifica. El guardado offline se integra mediante su candidato separado y conserva sus pruebas y rollback propios.

## Verificación

Las siete pruebas de regresión ejecutan código real de filtros, ordenación y proyección por rol. Antes del cambio fallan cuatro, con diferencias de productos esperadas; después pasan siete. La suite Node completa del arreglo de filtros pasa 449/449. `npm run check:js`, `npm run check:guide` y `git diff --check` pasan. Bundle construido con Terser 5.51.2, coincidente con el lockfile.

La revisión independiente verificó la reproducción antes/después, los consumidores del fallback y la conservación de roles, paginación y barreras de exportación. Sin hallazgos críticos, importantes o menores.

El navegador dedicado está en `tests/catalogue-smart-filters-browser.cjs`: carga la UI completa y el bundle servido, con sesiones/productos ficticios y todo el tráfico interceptado. Cubre gestores, subgestores y administradores en vista de ventas; móvil y escritorio; ambos filtros; resultados vacíos y combinaciones; ausencia de valores de otros roles. `PTH_FILTER_BASELINE=<sha>` caracteriza los fallos originales. Las rutas de Playwright/Chromium y evidencias pueden proporcionarse mediante variables `PTH_PLAYWRIGHT_PATH`, `PTH_CHROMIUM_PATH` y `PTH_FILTER_EVIDENCE`.

La candidata de filtros pasa las seis combinaciones de rol y ancho (390/1280), con cero errores de página y cero mutaciones. Se guardaron capturas de Nuevos y resultados vacíos. Los recursos externos se sustituyen por datos ficticios; no es una prueba de fidelidad de iconos o imágenes de producción.

No se identifica la cuenta de la captura ni se cambia la definición comercial de novedad. Android físico y el comportamiento de una cuenta real en producción quedan sin verificar.

## Rollback e integración

Conservar los commits individuales de filtros y guardado offline. Para retirar filtros, crear un commit que revierta solo su commit y reconstruir el bundle. Si se publica más adelante, usar una versión pública nueva para evitar recursos mezclados. No resetear, borrar almacenamiento ni revertir datos, precios, comisiones, clientes o pedidos. La reversión de offline sigue `docs/offline-pending-release.md` y conserva la cola y sus lectores.

La rama candidata conjunta parte de la misma base y conserva los dos cambios originales: filtros `851aaa1b33310e27350d03b27337788846ee6e74` y offline `5f75bb54429de24fd084d8912ac8db455927067a`. El bundle de filtros usa `20261005-filters1` en el HTML y las listas de arranque/caché del worker. La plantilla, preparación offline y caché pública mantienen `20261005-copy2`. El marcador nuevo del bundle evita reutilizar el recurso anterior desde caché HTTP.

Validación final conjunta: **452/452 pruebas Node, seis escenarios de navegador para filtros y diez para preparación offline**, con los marcadores finales. Bundle, guía y whitespace correctos. El navegador offline conserva productos/precios/clientes ficticios, copia anterior, pendientes y aislamiento por cuenta; registra cero checkout/logout y cero escrituras de pedidos. La revisión independiente conjunta pasó 59 pruebas dirigidas y volvió a pasar 23 tras el marcador final, sin hallazgos. No se repitió la suite general de 30 scripts de navegador ni las suites de DB; no hay cambios de backend.

Para retirar todo el candidato conjunto, revertir su único commit mediante otro commit. Para retirar solo un arreglo, aplicar la inversa del diff del commit individual correspondiente sobre la rama conjunta y comprobar las referencias de versión; no revertir el commit conjunto completo para una retirada parcial. Conservar siempre la cola, lectores y datos existentes. La publicación y el rollback de producción siguen pendientes de autorización posterior.
