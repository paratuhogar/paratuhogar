# Numeración de pedidos al confirmar el guardado

## Objetivo y evidencia

Evitar que las validaciones, cotizaciones, abandonos y reintentos consuman
consecutivos. El navegador publicado reserva mediante
`reservar_consecutivo_pedido` antes de solicitar la cotización al gateway.
La reserva se confirma en una transacción independiente de la inserción.
Por eso puede avanzar el contador sin existir un pedido correspondiente.
La inspección de RO encontró RO-7, RO-12 y RO-21 y un contador en 21; no
demuestra que cada hueco corresponda a un borrado o a un reintento particular.

## Alcance

- Solo la creación de pedidos nuevos, normales y de subgestores.
- No renumerar, editar ni borrar pedidos históricos ni reiniciar contadores.
- No modificar precios, comisiones, garantías, tarifas, autenticación o roles.
- Conservar la recuperación de recibos vencidos publicada en el PR 19.
- No incluir aquí el cambio pendiente sobre la hora del teléfono.

## Alternativas

1. Reutilizar la reserva en el navegador reduce algunos huecos, pero un
   abandono o fallo posterior sigue consumiendo un número. No cumple el objetivo.
2. Asignar en una transacción PostgreSQL que también inserta el pedido permite
   rollback del contador y serialización por proveedor. Es la opción elegida.
3. Renumerar periódicamente rompe referencias de WhatsApp, documentos y
   auditorías. Se descarta.

## Diseño elegido

El gateway conserva sus validaciones canónicas y las firmas del intento y de
las condiciones. Una cotización no solicita ni consume números. Tras validar
un envío, entrega únicamente las filas canónicas a una operación PostgreSQL
interna de inserción y numeración. Solo `service_role` puede ejecutarla; no
se abre una vía de inserción directa desde el navegador.

La operación recibe el destino permitido (`pedidos` o `pedidos_subgestores`),
la clave exacta del intento y las filas con sus IDs deterministas existentes.
Valida la forma del lote y utiliza listas explícitas de columnas: no acepta
nombres de tabla arbitrarios ni SQL procedente del cliente. No recalcula
importes ni cambia las atribuciones comerciales aprobadas por el gateway.

Primero serializa el intento mediante su identidad determinista. Si ya existe
el lote íntegro para la misma clave, devuelve las referencias guardadas sin
incrementar contadores. Una colisión de ID con otra clave o un lote parcial
se detiene y exige revisar el resultado; nunca sobrescribe ni completa
silenciosamente un pedido aceptado.

Para un lote nuevo bloquea los proveedores en orden estable, coordina los
contadores compartidos por ambas tablas y asigna las referencias. Las filas
y los contadores se escriben en la misma transacción. Un fallo de cualquier
fila, constraint o trigger revierte todo el lote, incluidos los incrementos.
No se utiliza `nextval` para prometer ausencia de huecos, porque las secuencias
no revierten sus incrementos con un rollback.

El punto inicial por proveedor respeta tanto el contador existente como las
referencias persistidas. No se recuperan huecos históricos ni números que
pudieran haberse comunicado anteriormente. Una eliminación posterior puede
seguir dejar un hueco: el cambio evita reservas desperdiciadas, no promete
numeración contable estrictamente sin huecos ante borrados administrativos.

## Navegador y comunicación

La web nueva deja de reservar referencias antes de cotizar. La confirmación
usa exclusivamente las referencias devueltas por el servidor. WhatsApp, PDF,
protección del cliente y recibos deben usar esos mismos números; nunca IDs
provisionales ni valores preparados antes de recibir la confirmación.
Si se pierde la respuesta se consulta el recibo del mismo intento. No se
crea otro intento automáticamente ni se cambia el número ya asignado.

## Compatibilidad y despliegue

1. Preparar la operación SQL interna sin cambiar los caminos activos.
2. Activar el gateway que usa la inserción atómica y comprobar sus permisos.
   Debe tolerar que páginas anteriores envíen referencias previamente
   reservadas, pero no tomarlas como autoridad para numerar pedidos nuevos.
3. Publicar la web nueva y las versiones coherentes del service worker.
4. Retirar la reserva anticipada cuando no pueda quedar un gateway anterior
   insertando referencias del cliente. Una página antigua que todavía necesite
   reservar debe recibir una instrucción explícita de actualizar, sin perder
   sus datos ni recibir un código ficticio que pudiera terminar en un pedido.

La fase transitoria puede seguir tener huecos por reservas de páginas antiguas;
no se declara resuelto para esas páginas hasta retirar esa vía. La aprobación
de un pedido de subgestor conserva su referencia y no genera otra numeración.

## Verificación requerida

- Prueba que falle antes del cambio: cotizar y abortar no incrementa el contador.
- Inserción nueva: una referencia por proveedor y recibo consistente.
- Reintento y respuesta perdida: mismos IDs y referencias, sin incrementar.
- Dos conexiones reales: mismo intento simultáneo produce un único lote.
- Dos intentos distintos, mismo proveedor: números únicos y consecutivos.
- Lotes con proveedores en orden inverso: sin interbloqueos por el orden elegido.
- Fallo de una fila, trigger o auditoría: ningún pedido ni incremento parcial.
- Colisiones con otra clave, lotes parciales y tablas inválidas: rechazo seguro.
- Aprobación de subgestor y recibos vencidos: regresiones conservadas.
- Navegador móvil/escritorio: WhatsApp y PDF usan referencias confirmadas.
- Página antigua: mensaje de actualización y datos conservados; no código falso.
- Comparación con main remoto y función desplegada: conservar cambios ajenos.

Las pruebas usan datos ficticios y un entorno aislado. No se envían pedidos
reales ni notificaciones a clientes como prueba. La publicación requiere
verificar la migración, el gateway, los archivos públicos y la caché.

## Reversión

Si se detecta un problema, detener nuevos envíos con un mensaje recuperable y
conservar los recibos. No restaurar indiscriminadamente la reserva anticipada,
no borrar la auditoría ni bajar contadores. Cualquier reversión de runtime debe
mantener compatibles los pedidos ya creados y sus referencias definitivas.
