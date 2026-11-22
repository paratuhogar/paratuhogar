# Cupones exclusivos para clientes directos

Estado: diseño y protección aprobados por Marcel el 22 de noviembre de 2026;
implementado y verificado localmente, pendiente de autorización de publicación
y activación. Base inspeccionada: `origin/main`, `9182c8e0`.

## Alcance aprobado y límites

Marcel confirmó códigos de descuento de importe o porcentaje, configurados por
administración con vigencia y límite de usos. Se aplican exclusivamente al valor
de los productos: la mensajería ordinaria o exprés se cobra íntegra. Los gestores,
subgestores y los clientes vinculados a ellos no pueden usarlos.

No crear descuentos reales por defecto. No cambiar precios del catálogo,
precios personalizados, reparto de comisiones, reglas de puntos, contraseñas,
roles ni pedidos históricos. El importe final de una venta directa con cupón
sí disminuye por el descuento expresamente autorizado. No usar Docker.

La propuesta de Word aporta contexto; no amplía esta entrega a campañas de
vídeos, canjes, concursos, recargas ni equivalencias monetarias de puntos.
El QR personal tiene un diseño separado y no depende de los cupones.

## Enfoque recomendado

Integrar el cupón opcional en el checkout actual y confirmar descuento, uso y
pedido en una sola transacción. Se conservan sus claves firmadas, recibos,
consecutivos y separación por proveedor.

Alternativas consideradas: un checkout separado para ventas directas permitiría
aislar campañas, pero duplicaría el circuito de pedidos; la validación manual
por administración reduciría la automatización y no reservaría usos concurrentes.
No se propone ninguna de las dos para esta entrega.

## Condición de seguridad previa a la activación

La inspección de permisos confirmó que la información de asignación de clientes
todavía admite escrituras directas del navegador. Por eso, consultar solamente
esa tabla no garantiza el bloqueo de un cliente vinculado: la ausencia de una
asignación puede haber sido manipulada.

Se propone mover el registro y actualización de la asignación al servidor,
validando el pedido confirmado y su vendedor, y bloquear las escrituras directas
que eludan ese control. Los seguimientos legítimos deben migrar a operaciones
acotadas, sin permitir que cualquier visitante reasigne o libere un teléfono.
Se conservarán las asignaciones existentes; no se cambiará el destinatario de
comisiones ni el acceso de las cuentas.

Marcel autorizó expresamente esta ampliación junto con el diseño. Se preparan
los permisos y las operaciones acotadas localmente; la activación sigue
requiriendo autorización separada. Otros avisos de seguridad quedan fuera del alcance.

## Reglas propuestas para el primer lanzamiento

- Un código por carrito confirmado, aunque genere varios pedidos por proveedor.
- Código normalizado a mayúsculas, de 4 a 32 caracteres ASCII: letras, números
  y guion. Un código retirado no se reutiliza para una campaña diferente.
- Tipo: importe fijo en USD o porcentaje. Valores positivos; porcentaje de hasta
  100 %. El descuento nunca supera el subtotal elegible ni reduce la mensajería.
- El subtotal mínimo se calcula sobre productos, antes del descuento y sin envío.
- Administración configura inicio, fin, límite total y límite por teléfono;
  el límite por teléfono propuesto por defecto es un uso, editable antes de activar.
- Cálculo en centavos sobre el subtotal canónico en USD. No introducir tipos de
  cambio nuevos: las otras formas de pago conservan sus conversiones existentes.
- Si hay varios proveedores, distribuir proporcionalmente el descuento en
  centavos, asignando los restos por un orden estable. La suma de los descuentos
  parciales coincide exactamente con el descuento del carrito.
- Una cotización no consume usos. Se consume un uso al confirmar el lote completo;
  un reintento devuelve el recibo y no consume otro uso.
- Una cancelación posterior conserva el registro del uso; no libera cupos
  automáticamente. Una corrección administrativa futura debe quedar auditada.
- Un pedido sin código conserva exactamente el circuito y los importes actuales.

## Elegibilidad comprobada por el servidor

Rechazar el cupón si hay sesión comercial, vendedor atribuido, enlace de gestor
o subgestor, o un teléfono asociado a una cuenta comercial. Comprobar también
las asignaciones existentes y el historial comercial protegido, no solo el
texto `origen` que envía el navegador.

Normalizar los teléfonos cubanos con y sin prefijo 53 y contemplar el cero
inicial de los registros históricos; comparar sus variantes en los vínculos y
pedidos existentes sin reescribir estos datos. Para aplicar un cupón, exigir
un teléfono normalizable, sin cambiar las validaciones de pedidos sin cupón.
Si aparecen asignaciones
contradictorias, una lectura incompleta o un error de infraestructura, no afirmar
que el cliente es directo: conservar el formulario e informar que no se pudo
validar el cupón. Nunca retirar el descuento y confirmar un precio mayor sin
que el cliente revise y acepte otra vez el resumen.

La regla identifica el teléfono declarado, no demuestra la identidad física
de una persona que utiliza otro número. Este alcance no incorpora SMS, OTP ni
un nuevo registro de clientes.

La consulta pública valida únicamente el código introducido: no lista campañas,
usos ni el gestor asociado a un teléfono. Usar mensajes genéricos para rechazo
y un límite propio del módulo de diez comprobaciones por minuto para la
combinación de IP y teléfono normalizado. No alterar los límites de login.

## Datos y responsabilidades

Crear un esquema privado del módulo, no tablas consultables desde el catálogo:

- Campañas: UUID, código único normalizado, tipo, valor entero, mínimo en
  centavos, vigencia UTC, límites, activo, revisión y autoría.
- Usos: campaña y revisión, clave del intento, fecha del servidor, hash del
  teléfono normalizado, subtotal bruto, descuento y pedidos generados.
- Distribución: pedido UUID, subtotal bruto, descuento y total neto. Conservar
  la captura para explicar el importe aun después de editar o retirar el cupón.
- Auditoría: creador y cambios de campaña con motivo. No sobrescribir el
  significado de una campaña ya usada; los cambios producen una nueva revisión.

Los límites y registros económicos se operan solo mediante funciones privadas
del servidor. No conceder lectura o escritura a `anon` o `authenticated`.
Las comprobaciones administrativas reutilizan la sesión verificada actual:
cuentas principales con rol admin, administrador o superadmin; no subgestores
ni cuentas únicamente de logística.

## Flujo de confirmación

1. El cliente abre «Tengo un código de descuento» junto a los datos del pedido.
   Se muestra solo cuando el contexto parece directo; el servidor decide.
2. La cotización valida campaña, identidad comercial, catálogo y mensajería.
   Devuelve subtotal bruto, descuento separado, envío íntegro y total neto.
3. La firma vincula código, revisión, teléfono, productos, entrega e importes.
4. En la confirmación, la base vuelve a validar vigencia, revisión, elegibilidad
   y cupos; bloquea la campaña y el cupo del teléfono con orden estable.
5. Inserta lote, uso y distribución en una transacción, envolviendo el circuito
   de pedidos existente. Un fallo revierte todo, incluidos consecutivos.
6. Un recibo ya existente tiene prioridad sobre un cambio posterior de campaña.
   El reintento no recalcula ni modifica una venta aceptada.

No inferir descuentos leyendo notas del cliente. No permitir que el navegador
envíe un importe de descuento autorizado. Sin conexión, se puede conservar un
borrador, pero no prometer ni consumir un cupón hasta validar con el servidor.

## Pantallas y documentos

Administración: entrada «Cupones» en las herramientas administrativas, con crear,
activar/desactivar, vigencia, límites y resumen de usos. Empezará sin campañas
activas; no entregar códigos de demostración utilizables.

Cliente: campo plegado y opcional, botón «Aplicar» y resumen con la línea
«Descuento». Al perder elegibilidad o caducar una oferta, conservar los datos
y pedir revisión explícita antes de enviar.

Vale, WhatsApp, factura, Excel y Bóveda deben mostrar de forma coherente subtotal,
descuento, mensajería y neto. La ganancia utiliza el ingreso neto; no cambia el
costo del proveedor ni oculta el descuento como si fuera una comisión.
Los pedidos históricos carecen de descuento y mantienen sus documentos.

## Verificación y publicación

Probar rechazos por sesión comercial, referido y asignación telefónica; formatos
53 y locales; importes y porcentajes; vigencia con reloj del servidor; varias
monedas sin cambiar conversiones; distribución entre proveedores; agotamiento
concurrente del último uso; dos pestañas con el mismo intento; pérdida de respuesta;
cancelación y cambios de campaña después de confirmar. Verificar resumen,
WhatsApp, factura, Excel y Bóveda con el mismo total neto.

Usar PostgreSQL nativo temporal y navegadores aislados, sin pedidos ni pagos de
prueba en producción. Revisar permisos y la condición previa de asignación.
Preparar migraciones y flags desactivados; desplegar servidor y base antes de
mostrar el campo. La activación en producción requiere autorización específica.

El plan de implementación está en `docs/superpowers/plans/2026-11-22-direct-coupons.md`.
La guía de publicación y retirada segura está en `docs/coupons-qr-release.md`.
