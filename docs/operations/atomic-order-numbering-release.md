# Numeración al guardar — 20261103-numbering1

## Estado

Implementación desde main `d62ec49`, con activación autorizada el 2026-11-03.
Migración `atomic_checkout_order_numbering` aplicada y gateway secure-data v34
activo. Se conserva la corrección de recibos vencidos del PR19. La publicación
estática y la retirada de la reserva antigua se verifican según la secuencia de
abajo; este documento no sustituye el acta final de despliegue.

## Causa comprobada

La reserva y la inserción estaban separadas: una validación fallida, abandono o
reintento podía incrementar el contador sin guardar un pedido. No implica que
los números intermedios se hayan borrado. No se recuperan ni renumeran huecos.

## Verificaciones realizadas

- 664 pruebas Node correctas, ninguna fallida.
- Nueve comprobaciones SQL PGlite: asignación, replay, rollback multi-proveedor,
  colisiones, parcialidad, subgestor movido, referencia histórica con espacios,
  permisos privados y retirada de la reserva anticipada.
- Chrome nativo, 390 y 1280 px: la reserva está prohibida en la prueba y el
  checkout funciona; WhatsApp y el payload PDF reciben A-1/B-1 del servidor.
- Ambos renderers PDF probados mediante registro de sus llamadas de dibujo:
  todas las referencias aparecen. Esto no certifica la composición visual de
  PDFs extensos; se mantiene la paginación existente de AutoTable.
- Chrome: respuesta perdida, recibos, cola IndexedDB, fallo 503, sesión 401,
  recarga sin duplicación, CI online/offline y actualización del service worker.
- PostgreSQL real de Supabase en esquema temporal aislado con clones vacíos,
  sin copiar datos ni triggers de producción. Mismo lote en conexiones distintas
  (PIDs 3367236/3367238): segundo esperó aproximadamente 18,5 s y devolvió ZZRO-1
  y ZZAA-1. Otros dos lotes, proveedores en orden inverso (3367245/3367261):
  obtuvieron 2 y 3 por proveedor, sin duplicados ni interbloqueos. Resultado:
  seis filas, dos contadores en 3. Un trigger sintético fallido revirtió todas las
  filas e incrementos del lote. Esquema y tareas temporales retirados.
- Revisión independiente: sin bloqueos pendientes; 24 pruebas focalizadas
  ejecutadas por el revisor. No se enviaron pedidos reales ni notificaciones.

## Activación ordenada — requiere autorización de publicación

1. Comparar de nuevo con main remoto y respaldar secure-data desplegado; preservar
   los cambios ajenos y sus archivos, configuración, secretos y verify_jwt.
2. Revisar tablas, constraints y triggers de producción antes de activar; los
   clones de concurrencia no ejecutaron los triggers reales ni sus notificaciones.
3. Aplicar `supabase/proposals/atomic-order-numbering.sql` mediante una migración
   identificada. Verificar EXECUTE solo para service_role y grants del contador.
   No reiniciar contadores ni escribir pedidos reales para comprobarlo.
4. Desplegar únicamente checkout.mjs modificado en el gateway actual, conservando
   todos los otros archivos de runtime. El gateway ignora cualquier referencia
   anticipada de clientes antiguos y usa el RPC para asignar la definitiva.
5. Publicar frontend, bundles y service worker coherentes. Verificar archivos
   públicos contra el commit y finalizar las solicitudes del gateway anterior.
6. Aplicar `retire-early-order-reservations.sql` como última migración: la reserva
   pública deja de consumir números y devuelve un error de actualización. Una
   página antigua puede ocultar el detalle y enseñar su aviso genérico: indicarle
   actualizar conservando los datos y revisando recibos; no inventar un número ni
   vaciar automáticamente almacenamiento. El JS nuevo no invoca esa reserva.
7. Verificar la ruta de lectura de recibos y vigilar errores sin enviar pedidos
   reales como pruebas. No declarar activados los cambios antes del readback.

Durante la transición pueden existir huecos de reservas anteriores. Los borrados
administrativos posteriores también pueden crear huecos. La garantía es que los
intentos nuevos abortados no consumen números una vez retirada la reserva antigua.

## Verificación local reproducible

```sh
node --test tests/*.test.mjs tests/*.test.cjs
PTH_PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-atomic-order-numbering-sql.mjs
NODE_PATH=/ruta/playwright/node_modules PTH_CHROMIUM=/ruta/chrome node tests/pending-service-recovery-browser.cjs
NODE_PATH=/ruta/playwright/node_modules PTH_CHROMIUM=/ruta/chrome node tests/checkout-recovery-latest-browser.cjs
NODE_PATH=/ruta/playwright/node_modules PTH_CHROMIUM=/ruta/chrome node tests/checkout-ci-browser.cjs
NODE_PATH=/ruta/playwright/node_modules PTH_CHROMIUM=/ruta/chrome node tests/checkout-atomic-numbering-browser.cjs
node scripts/build-js.cjs --check
```

El equivalente npm es `npm run check:checkout-release`; el runner local carece
de npm y se ejecutaron sus comandos directamente. CI instala PGlite y Playwright
con versiones fijadas. El resultado de CI remoto debe comprobarse para el commit
publicado; no se presupone a partir de las verificaciones locales.

## Reversión

Detener envíos con un aviso recuperable conservando borradores y recibos. No
bajar contadores, renumerar pedidos o restaurar el antiguo gateway mientras la
reserva está retirada. Conservar la inserción atómica para todo pedido ya creado.
