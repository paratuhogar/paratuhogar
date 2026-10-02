# Pedido pendiente con conexión interrumpida

El botón **Dejar pendiente de envío** guarda expresamente un pedido por cuenta y dispositivo. El formulario estático también se abre desde el catálogo guardado, después de haber iniciado sesión y guardado una copia con conexión. Un borrador corriente no autoriza el envío automático.

Los productos, cantidades y datos necesarios del formulario se guardan en IndexedDB del dispositivo, separados por cuenta. Los datos del cliente se eliminan al confirmar recepción, cancelar o cerrar sesión. El plazo de siete días se comprueba al volver a abrir o leer el pendiente. Los metadatos mínimos de un intento incierto permiten comprobar el recibo; no contienen datos del cliente.

Con la web abierta, se comprueba la cuenta y se usa el checkout existente: inventario, precios propios, garantía, entrega, controles de venta, cotización, envío y recibo. Una respuesta perdida se recupera por el mismo intento. Los cambios de condiciones exigen revisión. Una revisión firmada conserva sus datos originales; para cambiarlos se detienen los reintentos y se comprueba primero la recepción.

La tarjeta aparece tanto en el catálogo como en el Dashboard habitual. Permite consultar el estado y abrir la revisión o cancelación. No se abre WhatsApp ni se genera un PDF automáticamente. Cancelar los reintentos no anula un pedido que el servidor ya recibió.

## Límites de esta publicación

- Requiere una copia previa de productos y una sesión previa en el mismo navegador.
- El envío y la limpieza por caducidad necesitan volver a abrir la web. No se garantiza ejecución con el navegador cerrado.
- Si faltan productos, datos de entrega o una sesión válida, el pedido requiere revisión; no se omiten las comprobaciones actuales.
- Cache Storage contiene solo recursos estáticos públicos. No se guardan respuestas de API, clientes, pedidos ni sesiones en esa caché.
- No cambia el backend, los permisos, precios, comisiones, cobros ni historial. Los recordatorios de solicitudes pertenecen a otra fase.

## Verificación y recuperación

Pasaron 294 pruebas Node integradas y las pruebas del checkout real con servidor sintético a 320 píxeles en oscuro y 390 en claro. Cubren reapertura offline, pérdida del socket tras aceptación, dos pestañas, cambios de cuenta durante guardado y recibo, respuestas de una revisión anterior, edición durante un lease, cuota de almacenamiento, revisión de recogidas y limpieza de detalles privados. Se verificaron los cuatro roles, Story y la actualización real de caché conservando catálogo y carrito. No se hicieron pedidos ni envíos reales.

Los nuevos recursos y la caché estática usan `20261002-pending1`. Las versiones de Story y de la interfaz de solicitudes se conservan. El registro y los manejadores de push permanecen intactos.

Para retirar la fase, revertir únicamente sus commits mediante un commit nuevo, conservando Story, solicitudes y las páginas generadas desde otras sesiones. Revertir no borra pedidos del servidor ni almacenamiento local de recibos. Una pestaña que ya ejecuta el código debe recargarse o detener sus reintentos desde la revisión; el navegador cerrado no realiza envíos en segundo plano.
