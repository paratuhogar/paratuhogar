# Ranking de 30 días: candidato para revisión

Preparado desde main `20bfc9e8006127db63efc2e0b3379d3201a470e8`, verificado mediante fetch al comenzar. Rama local `ranking-rolling30`. Sin push, migración remota ni despliegue de este criterio. El checkout original no se modificó.

## Regla y alcance

Cuenta pedidos únicos cuyo `pedidos.fecha` de creación esté entre la primera medianoche de Cuba de hace 29 días y el instante inclusivo del servidor, y cuyo estado actual sea `Entregado`. No exige `fecha_entrega`. Hoy incluido: 30 fechas calendario, no 720 horas fijas. Se mantienen atribución única, elegibilidad actual, privacidad, empates 1,1,3, top3 y vecinos. La ventana avanza cada medianoche sin reset mensual ni cuenta atrás.

La migración `20261004124731_rolling_30_day_created_delivered_ranking.sql` reemplaza solo `pth_ranking_summary(uuid)`, mantiene SECURITY INVOKER/search_path/ACL y no concede accesos. DTO identifica y valida el criterio y los límites. La UI no reinterpreta una respuesta mensual antigua como 30 días. Caché expira a los 60 segundos o en la primera medianoche siguiente. Podio/liderazgo solo celebran crecimiento propio, no la salida de otros de la ventana; claves estables evitan repetición al cambiar de día.

La adjudicación mensual conserva su excepción incondicional y CHECK false anteriores. Sin nuevos ganadores, premios, permisos, autenticación, precios, comisiones, pagos, clientes, fechas históricas ni modificaciones de pedidos.

## Evidencia

- Suite Node completa: 405/405. Un primer intento encontró la fluctuación temporal ya conocida de pending-checkout, archivo sin cambios; la repetición completa pasó.
- PostgreSQL 17 y 18: 37 comprobaciones en cada versión. Creación exacta en inicio/ahora, futuro/fuera/null, Entregado sin fecha de entrega, Pendiente/Cancelado, atribución/child/ambigüedad, empates y cero/admin, cambio de mes, DST Havana, ACL y cierre bloqueado.
- QA DOM: gestor/subgestor/admin, cero/un líder/empates/top3/vecinos, alias como texto, metas, eventos duplicados y clearing/navegación; QA rolling confirma criterio, ausencia de exclusión por fecha_entrega/countdown, caché de medianoche y rechazo UI de datos mensuales antiguos.
- CSS compilado y JavaScript generado verificado. PDF y manifiesto coherentes; diff sin errores de espacios.
- Chrome real con frontend completo y solicitudes de datos interceptadas: gestor en 1280×1000 y 390×844, admin y subgestor en móvil. Sin desbordamiento horizontal; admin explícitamente no participa; CTA subgestor abre catálogo sin registrar pedidos. No se usaron pedidos reales en QA. Navegador tuvo operaciones intermitentes lentas; se completó sin modificar configuración ni repetir la reparación anterior. Escenarios de cero/un líder y saltos de reloj se cubren mediante tests, no capturas separadas de Chrome.

La comparación de producción fue solo lectura agregada el 4 oct 2026 aprox. 12:52 UTC: 149 pedidos elegibles, 65 cuentas con conteo positivo, 2 líderes con 7 y tercera cuenta con 6; 4 pedidos de atribución ambigua excluidos. Es una observación del nuevo criterio, no un resultado desplegado ni adjudicación mensual. Los datos pueden cambiar.

## Guía y Library

Revisión candidata `2026-10-04.3`, 1.061.573 bytes, SHA256 `6b56c59e5bcbd7beb5ad8fc7dfea81ae24f232cab27be72f1cf33a3a09f40b37`. Solo página 18 sustituida con regla nueva y recorte real de progreso DEMO. Las otras 19 páginas conservan texto y píxeles idénticos. El frontend local muestra Revisión 3; el sitio conserva Revisión 2.

- PDF, misma identidad Library: `libfile_19a5c74f815c81919bced7981cc57a23`, versión 3.
- Gestor escritorio: `libfile_5aadae89f724819180c6ba0adc8746b9`.
- Gestor móvil: `libfile_7dfa824372488191a7b20205f1f586e6`.
- Sección completa móvil: `libfile_48e49360405881919fb534423e80060c`.
- Admin móvil: `libfile_2b40dd5503fc819189bc9f319fa7b863`.
- Subgestor móvil: `libfile_709a71c2c86081918bc3e91bc621a9a8`.
- Página 18: `libfile_e3f2c5c73d108191ad1b2e6c9a13055b`.

Artefactos locales, servidor QA, logs y rollback en `../rolling30-review/`, fuera del árbol publicado. Revisión independiente de SQL/UI/DTO/tests sin hallazgos accionables; guía verificada visualmente y mediante comparación completa.

## Reproducción y futura publicación

`node --test tests/*.test.mjs tests/*.test.cjs`; `NODE_PATH=/tmp/pth-ranking-qa/node_modules node tests/ranking-dom-qa.cjs` y `tests/ranking-rolling-dom-qa.cjs`; `NODE_PATH=/tmp/pth-ranking-db17/node_modules node tests/ranking-rolling-db-qa.cjs` y con `/tmp/pth-ranking-db/node_modules` para PostgreSQL 18. Dependencias temporales externas no incluidas en el sitio. `npm run build:css`, `npm run check:js`, `npm run check:guide`.

Publicar requiere revisar este resultado y una autorización nueva para el criterio de creación/30 días. Orden compatible: DTO secure-data conservando restantes archivos y configuración actuales; migración solo del agregado; frontend/guía; verificar agregado autenticado y artefactos publicados. No ejecutar adjudicaciones. Conservar main remoto actual antes de publicar si cambia.

Rollback preparado: restaurar DTO de secure-data 23 desde `../rolling30-review/rollback/secure-data-ranking-v23.mjs`, resumen mensual desde `restore-monthly-summary.sql`, y frontend/guía del commit base. SQL rollback no altera tablas, ACL ni barrera mensual. PDF/manifiesto de revisión 2 guardados en el mismo directorio. No se ha ejecutado rollback.
