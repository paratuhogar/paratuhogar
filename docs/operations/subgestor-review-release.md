# Activación de revisión de pedidos de subgestores

Versión: `20261027-subreview1`.

## Verificación y activación del 27 de octubre

- 651 pruebas Node: 651 correctas, ninguna fallida.
- PostgreSQL 17.6 de Supabase: esquema aislado, tablas vacías clonadas y datos
  exclusivamente ficticios; ninguna aprobación sobre pedidos reales.
- Dos conexiones independientes (una lanzada con una tarea temporal pg_cron):
  aprobación/aprobación esperó el bloqueo y devolvió `replayed: true`; quedó una
  fila logística y una decisión final. Aprobación/rechazo esperó el bloqueo y
  rechazó la decisión incompatible con `El pedido ya fue revisado`.
- Se verificó rollback ante fallo de inserción y ante fallo de auditoría.
- Migración `subgestor_review_atomic` aplicada. Gateway `secure-data` versión 32
  activo, conservando su configuración y los archivos desplegados no modificados.
- RLS de auditoría activado; sin lectura para anon/authenticated ni borrado para
  service_role. La publicación estática se verifica después de esta activación.

## Orden de activación (requiere autorización de publicación)

1. Comparar la rama con `main` remoto y conservar cambios recientes ajenos.
2. Verificar en un entorno PostgreSQL de pruebas las columnas y triggers de
   `pedidos`, `pedidos_subgestores` y `gestores`. Ejecutar la propuesta
   `supabase/proposals/subgestor-review.sql` allí, no sobre pedidos reales de prueba.
3. Probar con dos conexiones: aprobación/aprobación y aprobación/rechazo del
   mismo ID. Debe quedar una sola decisión final y, si se aprobó, un solo pedido
   logístico. Verificar rollback ante un fallo de inserción y ante un fallo de
   auditoría. PGlite prueba SQL real pero serializa su conexión y no certifica MVCC.
4. Tras validar, ejecutar la propuesta SQL en producción como una transacción.
   No modifica pedidos históricos. Comprobar RLS, permisos y ausencia de grants
   de ejecución a `anon`/`authenticated`; la función es interna para `service_role`.
5. Respaldar e inspeccionar la versión desplegada de `secure-data`; conservar sus
   archivos, configuración y secretos. Desplegar la nueva dependencia
   `subgestor-review.mjs` junto con el gateway y el cambio mínimo de checkout para
   excluir rechazados de las alertas de duplicados. No cambiar autenticación,
   secretos ni `verify_jwt` respecto de la versión anterior.
6. Esperar a que terminen solicitudes de la versión anterior antes de habilitar
   la UI. El gateway nuevo rechaza operaciones antiguas de aprobación/edición/
   borrado de pendientes con una instrucción de actualizar; no reabre ese camino.
7. Publicar los archivos estáticos y versiones coherentes. Comprobar el HTML,
   bundle, nueva pestaña y carga bajo demanda en móvil y escritorio. No aprobar
   ni rechazar pedidos reales como verificación.

## Cambios intencionados de compatibilidad

- El navegador ya no envía importes ni tokens de pedido para aprobar: solo ID y
  versión del registro que se mostró. El servidor toma la instantánea guardada.
- Los gestores principales y administradores usan la misma operación segura.
- Las páginas antiguas deben actualizarse antes de revisar; siguen pudiendo usar
  las rutas de pedidos nuevos, que no se sustituyen por este flujo.
- Un rechazo conserva la fila con estado `Rechazado`, fuera de la cola activa,
  para que un teléfono pueda recuperar su recibo sin resucitar el pedido.
  No se crea una orden logística y se conserva el motivo en auditoría privada.
- Si un pedido existe simultáneamente en cola y logística por una aprobación
  interrumpida anterior, se bloquean edición y decisiones: requiere conciliación,
  nunca un rechazo aparentemente exitoso ni una sobrescritura de la entrega.
- La pantalla del principal muestra las comisiones guardadas del pedido, sin
  recalcularlas desde un catálogo que pudo cambiar. No se modifica su importe.

## Comprobaciones locales realizadas

- Suite Node de regresión, incluyendo checkout, privacidad, sesiones y caché.
- `scripts/verify-subgestor-review-sql.mjs`: PostgreSQL WASM con datos ficticios,
  incluidos permisos, auditoría, rollback, reintentos, rechazo, conflicto heredado
  y búsqueda/paginación sobre más de 1.000 pendientes.
- `tests/subgestor-review-browser.cjs`: Chrome nativo, 1280 px y 390 px, sin acceso
  a API externa; texto hostil, edición/vuelto, búsqueda y confirmación de aprobación.
- `tests/checkout-crm-cache-browser.cjs`: instalación y recuperación offline del
  service worker con los scripts de la nueva versión.

El motor SQL de pruebas se instala solo en una carpeta temporal. Ejecutar:

```sh
PTH_PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-subgestor-review-sql.mjs
PTH_PLAYWRIGHT_MODULE=/ruta/playwright PTH_CHROMIUM=/ruta/chrome node tests/subgestor-review-browser.cjs
```

## Reversión operativa

Ante un problema, deshabilitar el acceso a la nueva pestaña manteniendo los
registros de auditoría y la protección del gateway. No borrar la tabla de auditoría
ni restaurar el antiguo borrado directo. No revertir indiscriminadamente estados
de pedidos. Conservar las filas rechazadas para sus recibos y revisar cualquier
reconciliación por separado, con autorización.
