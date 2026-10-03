# La web habitual con conexión interrumpida

La raíz `/`, `/index.html` y las fichas `/producto/...` vuelven a abrir la misma web con los recursos públicos y productos descargados previamente. Categorías, búsqueda, ficha, carrito y formulario habitual funcionan con esa copia. No se necesita abrir un catálogo alternativo. Las páginas antiguas offline se conservan para enlaces y pedidos anteriores.

En el carrito, **Guardar clientes y tarifas** solicita consentimiento para guardar en este navegador una copia propia: productos públicos, hasta 300 clientes de pedidos de la cuenta y municipios/localidades con sus costes reales. No copia la agenda general de administración, credenciales ni comisiones. La copia queda separada por cuenta y rol y vence al terminar la sesión o, como máximo, a los siete días. Una tarifa ausente obliga a revisar la entrega; no se convierte en envío gratis.

Al confirmar un pedido con la copia sin conexión, el formulario guarda un pedido independiente y muestra: «Pedido guardado en este teléfono. Sal a buscar señal y mantén esta página abierta. Cuando recuperes conexión, enviaremos tu pedido automáticamente. Te avisaremos cuando la tienda confirme que lo recibió». El mensaje plural aparece cuando hay varios pendientes. Un borrador sin confirmar no autoriza su envío.

Se conservan hasta 25 pendientes por cuenta/dispositivo, cada uno con su intención y estado. La cola se envía con la página abierta cuando la misma cuenta vuelve a validar su sesión contra el servidor. Cada pedido muestra su referencia solo después de recibir el recibo del servidor. Respuestas perdidas se recuperan con la misma intención; cambios de producto, precio o entrega requieren revisión expresa. La operación de un pendiente no reemplaza el carrito ni el formulario que la persona esté preparando.

Cerrar sesión, cambiar cuenta/rol o vencer la sesión bloquea el envío y elimina los datos privados locales. La purga deja una marca que contiene solo el identificador de cuenta mientras termina: si una recarga la interrumpe, el siguiente arranque la completa antes de permitir usar o enviar esa cola. Los recibos mínimos de intentos inciertos no conservan datos de clientes.

## Alcance y límites

- Necesita una primera descarga con conexión en el mismo navegador, una copia propia consentida y una sesión todavía vigente. No se inventa una identidad ni se amplía la duración de la sesión.
- El navegador debe permanecer abierto para enviar automáticamente. No se garantiza ejecución cerrada, push de pedidos offline ni sincronización en segundo plano del sistema operativo.
- Clientes y pedidos se guardan en IndexedDB por cuenta; Cache Storage contiene únicamente la plantilla pública, SDK local, scripts, estilos y miniaturas públicas. No cachea respuestas de API, sesiones, paneles privados, informes o capturas.
- Las ganancias y funciones administrativas que requieren datos actuales se comprueban al conectar. No se muestran importes inventados. Las herramientas pesadas de diseño siguen cargándose cuando se solicitan y no forman parte del arranque offline.
- El backend solo añade la fecha de vencimiento ya existente a sus respuestas de sesión/login. No crea tablas, cambia permisos, precios, comisiones, pagos ni datos históricos. La migración de recordatorios pertenece a otra fase.

## Validación y actualización

Pruebas con servidor y datos sintéticos: formulario normal, múltiples pedidos, pérdida de respuesta, dos pestañas, revisión de costes, cuotas, cambios de cuenta y expiración. Chromium real verifica instalación y actualización del worker, cierre/reapertura de raíz y producto sin señal, filtros, clientes separados, envío al reconectar y ausencia de datos privados en Cache Storage. Se verifica también que interrumpir una purga no conserve una cola utilizable en el siguiente arranque. La evidencia y el número final de pruebas se registran en el informe privado de publicación, sin pedidos reales.

Recursos nuevos y registradores usan `20261003-pending2`, caché `pth-public-static-2026-10-03-pending2`; el panel reciente usa `20261003-recent2`. Los tipos y permisos de push existentes se conservan. La versión antigua de frontend se migra sin perder intenciones ni historial: el formato v2 tiene un namespace separado del singleton previo.

## Rollback

Detener reintentos desde la revisión de cada pedido o cerrar la página. Revertir únicamente la integración de la interfaz mediante commits nuevos, conservando el lector de cola v2, las marcas de purga y la compatibilidad de intenciones ya guardadas. No reset ni force-push; no borrar bases IndexedDB ni pedidos del servidor. Una interfaz singleton antigua no puede leer todos los pendientes v2: retirar la ampliación requiere mantener un lector compatible. La fecha de sesión añadida es aditiva y puede permanecer; restaurar Edge anterior no extiende sesiones.
