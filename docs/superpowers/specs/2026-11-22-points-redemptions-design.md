# Canje de puntos por dinero

Fecha: 22 de noviembre de 2026. Base publicada inspeccionada: `f669a3aa`.
Estado: implementado y verificado localmente; publicación y activación autorizadas
por Marcel el 22 de noviembre de 2026. Los puntos se cambian por dinero, no por descuentos.
Este documento sustituye el diseño anterior de descuentos por puntos. Marcel
aprobó estas reglas de integración antes del plan y de la implementación.
No se han cambiado saldos, creado canjes ni activado funciones en producción.

## Alcance confirmado

- 3 puntos confirmados equivalen a 1 USD para cobrar; 30 puntos equivalen a 10 USD.
- El pago es una ganancia adicional del gestor o subgestor, independiente de sus
  comisiones y sin obligación de comprar productos.
- Los descuentos se mantienen exclusivamente mediante códigos para clientes,
  con sus restricciones actuales. Los puntos no crean cupones ni rebajan pedidos.
- Solicitar un cobro reserva puntos; rechazar libera la reserva; registrar el
  pago completo consume definitivamente los puntos.
- Mantener la acumulación actual, incluida la atribución exclusiva al subgestor
  por compras desde su enlace. No modificar comisiones, precios, contraseñas,
  acceso, pedidos históricos, cupones, QR ni el número de vivienda obligatorio.
- No usar Docker. No realizar transferencias ni pagos reales durante las pruebas.

## Enfoque y automatización

Extender la billetera existente con solicitudes, reservas y un registro inmutable
de cobros separado del libro de puntos ganados. El servidor calcula la equivalencia,
reserva el saldo y registra las decisiones y el pago en transacciones.

La automatización no mueve dinero: administración entrega el efectivo o hace la
transferencia por sus medios y registra el pago real. No conectar bancos, Zelle
ni otro proveedor de pagos en esta entrega. Aprobar una solicitud no significa
haberla pagado y no debe descontar definitivamente los puntos.

Se descarta toda integración de puntos en el checkout, descuentos en productos,
catálogo de premios físicos o conversión de puntos en códigos promocionales.

## Reglas económicas propuestas

1. Cobros en USD enteros, desde 1 USD, utilizando múltiplos de tres puntos.
   Con 31 puntos se pueden cobrar 10 USD y conservar un punto, sin redondear
   tercios de centavo ni perder puntos por fracciones.
2. Solo se reservan puntos confirmados, no gastados y no reservados. Los puntos
   pendientes de validar no forman parte del saldo canjeable.
3. Cada solicitud conserva titular UUID, puntos e importe exactos y la relación
   aplicada de tres puntos por USD. No calcular el pago a partir de un saldo
   enviado por el navegador ni cambiar solicitudes anteriores al editar opciones.
4. Un gestor no puede gastar puntos de un subgestor ni solicitar pagos a nombre
   de otra cuenta. Administración puede revisar todas las solicitudes, pero no
   cambiar su titular, puntos ni importe una vez registradas.
5. Registrar el pago exige el importe completo aprobado, medio de pago, referencia
   o constancia y confirmación administrativa explícita. Guardar actor y hora
   del servidor. No incluir contraseñas ni números de cuenta bancaria en el
   historial general de puntos.
6. No aplicar tarifas, vencimientos ni deducciones sobre el canje. No transferir
   puntos entre cuentas ni mezclar este pago con la liquidación de comisiones.
7. Mostrar por separado USD pendientes, aprobados y pagados, identificados como
   incentivo por puntos. No alterar cobros ni pagos registrados de pedidos.
   La integración contable adicional con Bóveda no forma parte de esta entrega.

## Estados, reservas y registro de pago

- Solicitado: reserva puntos y espera decisión administrativa.
- Aprobado: mantiene la reserva; el dinero todavía no se ha pagado.
- En pago: un administrador toma la solicitud antes de desembolsar. La asignación
  exclusiva impide que otro administrador inicie simultáneamente el mismo pago.
  No liberar este estado por un temporizador o por perder la conexión.
- Pagado: el administrador asignado confirma el desembolso real; se consume la
  reserva y se registra un único débito definitivo con su constancia.
- Rechazado: libera toda la reserva con motivo obligatorio, siempre que no esté
  en pago ni pagado.
- Cancelado: el titular puede cancelar su solicitud todavía no aprobada;
  administración puede cancelar una aprobada que no se haya empezado a pagar.
  Libera la reserva y conserva motivo y autoría.

Los reintentos y dobles clics devuelven la misma solicitud o decisión, sin
duplicar reservas, débitos ni registros de pago. Después de una respuesta perdida
se consulta el estado; nunca se interpreta un fallo de red como prueba de que el
pago no ocurrió. Un administrador no puede cambiar silenciosamente la asignación
de una solicitud en pago. Una incidencia en ese estado requiere comprobación y
resolución administrativa auditada antes de reasignar o liberar su reserva.

Un pago registrado no se puede borrar ni convertir simplemente en rechazado.
La corrección exige constancia de devolución completa del dinero y un movimiento
compensatorio auditado, que reintegra los puntos una sola vez. No deshacer
automáticamente un pago real al cancelar una venta.

## Reversión de puntos ganados

Las reservas no pueden impedir una devolución de venta ni la reversión legítima
de puntos. Si se pierden puntos que respaldaban reservas, cancelar primero las
reservas más recientes que no estén en pago ni pagadas, dejando un motivo visible.

Si una solicitud ya está en pago, conservar su reserva y abrir una incidencia:
hay que comprobar el desembolso antes de liberarla. Si el dinero ya se pagó,
mostrar cero puntos disponibles y la diferencia como ajuste pendiente. Las nuevas
ganancias compensan esa diferencia antes de permitir otro canje. No exigir un
pago de dinero al gestor ni inventar créditos para ocultar el ajuste.

## Modelo, concurrencia y permisos

Ampliar el esquema privado `pth_points` con solicitudes de cobro, eventos inmutables,
asignación de pago, consumos y reintegros. Guardar claves idempotentes distintas
para solicitud, decisión, inicio de pago, registro del pago y devolución.
No guardar datos personales de clientes ni introducir borrados en cascada.

Calcular el disponible usando el libro original, pagos netos y reservas.
Conservar el significado del saldo ganado y de los reversos originales; exponer
también disponibles, reservados, canjeados y ajustes pendientes. El contador
«Mis puntos» muestra disponibles confirmados, sin pendientes ni reservas.

El gateway verifica la sesión existente. Cada titular ve sus solicitudes;
únicamente administradores principales con rol admin, administrador o superadmin
deciden y registran pagos. No ampliar permisos de subgestores, mensajeros o
logística. No abrir acceso directo a `PUBLIC`, `anon` o `authenticated`; usar RLS,
índices por cuenta/estado/fecha y paginación.

Las operaciones que afectan al disponible comparten bloqueo por cuenta. Establecer
orden estable para cuentas, solicitudes y claves idempotentes, también en los
reversos de ventas y actualizaciones masivas. No hacer llamadas externas ni mover
dinero dentro de transacciones de base de datos.

## Pantallas

«Mis puntos»: disponibles, reservados, pendientes y canjeados; equivalencia en USD;
botón «Solicitar cobro»; importe y puntos a reservar; confirmación explícita;
historial con fecha, estado, motivos y pago registrado. No mostrar botones para
comprar, aplicar descuentos o emitir cupones.

«Puntos de gestores»: bandeja de solicitudes con búsqueda y filtros; aprobar,
rechazar con motivo, iniciar pago, registrar pago y gestionar incidencias.
Antes de pagar mostrar claramente titular, importe, puntos y estado actual.
Informar «pago registrado» y no afirmar que la web transfirió dinero.

Sin conexión, permitir solo consultar la última información identificada como
guardada; no solicitar, aprobar ni registrar pagos. Conservar datos de formulario
ante errores, borrar información privada al cambiar de cuenta y no confirmar
ningún pago a partir de un estado local o una respuesta incompleta.

## Verificación y publicación

Probar 30 puntos por 10 USD; 31 puntos conservan uno; importes no enteros; falta
de saldo; puntos pendientes; propiedad gestor/subgestor; sesiones ajenas; doble
clic; dos solicitudes contra el último saldo; aprobar contra cancelar; dos
administradores iniciando el mismo pago; pago contra reversión de ganancias;
respuesta perdida después de registrar el pago; reapertura de solicitud en pago;
devoluciones repetidas; ajustes compensados por nuevas ganancias y bloqueo de
operaciones sin conexión.

Usar PostgreSQL nativo temporal y navegadores aislados. Comprobar sumas, auditoría,
permisos, bloqueos masivos y regresiones de puntos, cupones, QR, vivienda,
comisiones y checkout. Preparar banderas desactivadas y no crear pagos ni puntos
ficticios en producción. Publicar y activar requiere autorización específica.
