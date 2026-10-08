# Confirmación de pedidos y revisión de posibles repetidos

Preparado localmente el 8 de octubre de 2026 desde main publicado
`3fc44f935338e72f5ba0c10a3d6c5f3e1e44ef9c`. Versión de archivos: `20261008-orders1`.
Este documento no acredita un despliegue en producción.

## Comportamiento

- Tras un recibo confirmado, queda una tarjeta con las referencias reales y
  un botón de WhatsApp, incluso si el navegador bloquea la apertura automática.
  WhatsApp requiere que el usuario pulse Enviar: no hay envío automático del mensaje.
- Se conservan hasta 25 grupos de referencias durante 7 días, no el mensaje,
  la dirección del cliente, su teléfono ni credenciales. Después de recargar,
  un usuario autenticado recupera el vale mediante el gateway protegido y un
  segundo clic abre WhatsApp. Un visitante conserva solo el aviso de referencia.
- El destino existente no cambia: gestor principal a Elizabeth, subgestor a
  su principal y cliente público según su enlace comercial. El vale recuperado
  de un subgestor muestra únicamente su comisión asignada.
- Una alerta revisa ventas similares del mismo actor verificable en las últimas
  24 horas: cliente normalizado, teléfono o CI, proveedor, detalle e importe.
  Solo se admite una identidad firmada, nunca un nombre como prueba de propiedad.
  Los cancelados y las ventas de otros actores no participan.
- La cola queda bloqueada para revisión cuando existe una coincidencia. Solo una
  confirmación explícita de que es otra compra permite continuar. La aprobación
  firmada queda ligada al intento y al conjunto de referencias comprobadas.
- Un reintento del mismo intento recupera su recibo sin una segunda inserción.
  No se fusionan, cancelan ni borran ventas automáticamente.
- La limpieza del formulario es inmediata y acotada al envío confirmado; el PDF
  diferido no borra otro carrito. Fallos del almacenamiento no eliminan la tarjeta
  que ya existe en memoria.

## Límites y alcance

La revisión es preventiva, no una restricción transaccional global: dos intentos
distintos que lleguen simultáneamente pueden superar la comprobación antes de
insertarse. El control existente del mismo intento sí conserva su idempotencia.
No se buscan históricos de visitantes ni registros con claves antiguas/no
verificables. Una consulta fallida o superior a 200 filas por tabla detiene el
envío y conserva los datos para reintentar.

No se modifican precios, fórmulas de comisión, autenticación, roles, cuentas,
esquema, datos históricos ni borradores ajenos. No se usa Docker.

## Procedimiento de publicación autorizado

1. Publicar `secure-data` con su paquete completo sin alterar secretos/configuración;
   solo cambia `checkout.mjs`. No hay migración SQL.
2. Publicar los archivos web y el bundle generado, incluidos el nuevo módulo,
   index y service worker de `20261008-orders1`.
3. Comprobar la versión instalada, una confirmación real controlada y el botón
   de WhatsApp, sin borrar almacenamiento de teléfonos con pendientes.

El backend es compatible con el cliente anterior: añade campos a la cotización;
si detecta una coincidencia, un cliente antiguo no puede aprobarla silenciosamente.
Debe actualizar la web para revisarla. Publicar el backend antes del frontend.

## Verificación local

Pruebas unitarias de recibos, privacidad entre cuentas, almacenamiento rechazado,
subgestores homónimos, aprobación firmada y coincidencias revisadas; pruebas de
navegador con servidor/DB ficticios para popup bloqueado, recarga, nuevo carrito,
cola offline, segundo dispositivo, pérdida de respuesta y caducidad de sesión.
Suite Node: 525 pruebas aprobadas. Bundle construido y comprobado; diff sin
errores de espacios. El navegador local completó todos los casos con datos
ficticios. Se actualizaron pruebas antiguas para esperar la copia realmente
preparada y distinguir la caducidad con/sin contexto offline; no cambió la
implementación de autenticación ni sus políticas.
