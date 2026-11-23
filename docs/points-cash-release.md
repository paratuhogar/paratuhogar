# Cobros de puntos: entrega y activación

Publicación y activación autorizadas por Marcel el 22 de noviembre de 2026.
Este documento conserva el procedimiento de despliegue y retirada segura;
la configuración efectiva se comprueba en Supabase y los archivos publicados.
Diseño aprobado: 3 puntos confirmados = 1 USD para cobrar, no para descuentos.
La web reserva, aprueba y registra; no entrega efectivo ni realiza transferencias.

## Alcance

- «Mis puntos»: disponibles, reservados, canjeados, ajuste pendiente y solicitudes
  de cobro en USD enteros. Los puntos pendientes de validar no se pueden cobrar.
- «Puntos de gestores» → «Solicitudes de cobro»: revisar, aprobar, rechazar,
  cancelar, asignar un pago, registrar el desembolso y consultar su auditoría.
- Aprobar no paga. «En pago» identifica un administrador asignado y no caduca
  automáticamente. Solo ese administrador registra el pago completo efectuado.
- Para liberar un pago incierto hay que confirmar expresamente que no hubo
  desembolso, con motivo y constancia. Un dinero pagado solo reintegra puntos
  tras registrar su devolución completa, sin borrar el pago original.
- Las comisiones, el checkout, los cupones para clientes, QR y vivienda obligatoria
  mantienen sus reglas. No se crean pagos de Bóveda ni gastos automáticos allí;
  el costo del incentivo aparece separado en el historial administrativo de puntos.

## Protección y concurrencia

Tablas privadas cash_config/cash_payouts/cash_events/cash_entries/cash_operations
en pth_points. RLS sin políticas para navegador; RPC SECURITY INVOKER solo para
service_role. Claves idempotentes, revisiones, eventos inmutables y contrapartida
financiera obligatoria en la misma transacción. No hay datos de clientes en estos libros.

Las operaciones de cobro se serializan por cuenta. Los créditos positivos usados
para calcular el disponible se bloquean FOR UPDATE NOWAIT. La FK de los reversos
exactos toma KEY SHARE y no puede cruzar ese límite sin esperar. Solo se suman los
UUID realmente bloqueados, evitando incluir créditos posteriores sin protección.
Los triggers de ventas y sus bloqueos originales no se modifican.

Un cruce de locks devuelve POINTS_CASH_BUSY (409), nunca un pago exitoso ficticio
ni una sesión vencida. Refrescar o reintentar conserva la clave y los datos. Las
pantallas no afirman que no hubo pago cuando se perdió una respuesta.

Una reversión de ganancias cancela reservas sin respaldo en la siguiente consulta
o acción, empezando por las más recientes. No cancela una solicitud «En pago» ni
un pago real: muestra un ajuste pendiente, compensado por futuras ganancias.
La bandeja revalida sus candidatos hasta que la página filtrada es estable.

El gateway ejecuta una sola operación RPC de cobro por transacción. No agrupar
manualmente varias llamadas de cuentas distintas en una transacción de servicio:
el primer bloqueo por cuenta puede esperar; los siguientes usan intento inmediato
para evitar inversiones entre lotes concurrentes.

## Verificación local completada

- 856 pruebas unitarias y de contrato, incluidas pruebas del gateway contra PostgreSQL.
- 185 pruebas combinadas de base de datos y navegador, con flujo completo de cobro.
- Regresiones de checkout, reloj del servidor, numeración, CI, cupones, QR y caché real.
- Compilación JavaScript, CSS de soporte, SEO y limpieza del diff comprobados.
- Revisión independiente sin hallazgos pendientes; selección adicional 144/144, exit 0.

Las pruebas no crearon solicitudes, puntos ni pagos en producción. Ambas banderas
de este módulo se inicializan desactivadas; la activación se realiza por separado.

## Antes de cualquier publicación

1. Obtener autorización expresa para desplegar y activar este módulo. La aprobación
   del diseño y de la implementación local no autoriza desembolsos ni publicación.
2. Actualizar main remoto y comparar árboles sin sobrescribir borradores ajenos.
3. Repetir las pruebas unitarias, PostgreSQL nativo y navegador del plan aprobado.
4. Revisar los permisos locales de todos los objetos nuevos. Preparar respaldo de
   gateway, configuración y recuentos; no descargar secretos ni contraseñas.

## Despliegue coordinado, después de la autorización

1. Aplicar la migración generada por CLI
   `20261122233906_points_cash_payouts.sql`, inicialmente cash_config.enabled=false.
   No cambiar pth_points.config ni rellenar puntos de pedidos históricos.
2. Comprobar RLS y permisos y revisar asesores de Supabase sin corregir incidencias
   ajenas automáticamente. El permiso UPDATE(id) del libro original solo permite
   SELECT FOR UPDATE; su trigger inmutable sigue bloqueando actualizaciones reales.
3. Desplegar secure-data con points-cash.mjs incluido y su configuración existente;
   PTH_POINTS_CASH_ENABLED ausente/false mantiene el módulo oculto y no consulta su RPC.
   No alterar verify_jwt, autenticación, otros secretos ni banderas existentes.
4. Publicar conjuntamente HTML, scripts, estilos y service worker cash1. Las
   versiones nuevas del adaptador siguen siendo compatibles con las otras páginas.
5. Habilitar PTH_POINTS_CASH_ENABLED=true y comprobar lecturas autorizadas y
   vistas sin solicitudes nuevas mientras la admisión SQL sigue cerrada.
6. Cuando esas comprobaciones pasen, habilitar únicamente la admisión:

```sql
update pth_points.cash_config set enabled=true where singleton;
```

7. Verificar el estado mediante consultas de solo lectura, sin crear puntos,
   solicitudes ni pagos de demostración en producción. Registrar SHA, versiones,
   banderas e instante UTC real. La prueba completa ya debe pasar con datos sintéticos.

## Cerrar admisión sin abandonar obligaciones

```sql
update pth_points.cash_config set enabled=false where singleton;
```

Mantener gateway flag=true y las tablas/API/web disponibles: se ocultan nuevas
solicitudes pero se conserva el historial y la gestión de cobros pendientes.
No apagar el gateway ni revertir la migración mientras existan pagos sin resolver.
No borrar tablas ni deshacer un pago real para retirar una versión de interfaz.

## Comandos locales

- pnpm test:cash:unit
- pnpm test:cash:db
- PTH_CHROMIUM='<ruta Chrome>' pnpm test:cash:browser
- node --test tests/*.test.mjs tests/*.test.cjs
- pnpm test:checkout:browser y pnpm test:coupons:browser
- node scripts/build-js.cjs --check
- node scripts/build-support-css.cjs --check
- node scripts/validate-seo-pages.mjs

Todas las pruebas usan PostgreSQL temporal y navegador aislado, sin Docker,
llamadas a producción ni transferencias. Las claves de intento guardadas por
el navegador se aíslan por cuenta y sesión; se borran al cambiar de identidad.
