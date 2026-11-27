# Registro comercial de clientes compradores

Al crear una nueva cuenta comercial (gestor o subgestor, incluidas invitaciones),
Supabase rechaza el alta si su teléfono figura en algún pedido de `pedidos` o
`pedidos_subgestores` que no esté cancelado o rechazado. Los pendientes cuentan;
una consulta/asignación en `customer_bindings`, por sí sola, no cuenta.

Se reconocen los formatos cubanos existentes, con/sin +53 y prefijos históricos.
Los teléfonos internacionales conservan su registro sin exigir formato cubano.
No se modifican cuentas existentes, contraseñas, roles, importes, comisiones,
pedidos históricos ni reglas de sesión. Un alta de mensajero no es una solicitud
comercial. Los upserts de cuentas con ID existente mantienen su comportamiento.

La migración `20261127101214_prevent_customer_commercial_registration.sql` añade
únicamente funciones privadas invoker, índices parciales y tres triggers. No
publica consultas de compradores ni amplía permisos. La denegación `PT409` tiene
un mensaje genérico sin nombre, teléfono ni detalles de compra.

Los registros y las compras comparten el bloqueo transaccional por teléfono que
ya usa checkout. Si una compra confirma primero, el registro espera y se deniega;
si se confirma el registro primero, la cuenta existente se conserva. Los inserts
directos y cambios de teléfono/estado de pedidos también participan. La aplicación
usa READ COMMITTED; no se cambia el aislamiento global. Las escrituras masivas
administrativas deben mantener el orden de bloqueo de teléfonos de checkout.

## Verificación y activación

1. `node --test tests/customer-registration-guard.test.cjs`
2. `npm run build:js && npm run check:js`
3. Regresión completa y revisión independiente antes de publicar.
4. Aplicar la migración a Supabase y comprobar triggers/permisos.
5. Verificar rechazos con una transacción que siempre revierta, sin dejar cuentas
   de prueba ni pedidos reales. Publicar el aviso web `20261127-registration1`.

El bloqueo del servidor funciona también en clientes web anteriores. La versión
nueva distingue esta denegación de un error de red y conserva el formulario.
Para revertir la política, retirar exclusivamente `pth_guard_new_commercial_account`
de `public.gestores`; no borrar cuentas ni pedidos. Los demás objetos no cambian
datos y pueden retirarse posteriormente mediante una migración revisada.
