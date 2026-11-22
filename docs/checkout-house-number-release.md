# Número de vivienda obligatorio en pedidos a domicilio

La interfaz pide un número no vacío, permite formatos como `123-A` y acepta
`S/N` si la vivienda no tiene numeración. La recogida está exenta. Se conserva
el número en la dirección del pedido; no hay migración ni cambios en pedidos
existentes. Los pendientes locales antiguos sin número se abren para revisión
antes de su primer envío; los intentos ya firmados conservan sus datos.

## Activación coordinada

1. Desplegar `secure-data` con su configuración existente. Sin
   `PTH_CHECKOUT_HOUSE_NUMBER_REQUIRED_FROM`, la nueva regla del servidor
   queda desactivada mientras se actualiza la web.
2. Publicar juntos el formulario, sus scripts y el service worker del mismo
   release. Verificar el formulario visible, el modo sin conexión y la
   recuperación de un intento anterior en un entorno de prueba.
3. Configurar `PTH_CHECKOUT_HOUSE_NUMBER_REQUIRED_FROM` en el instante UTC
   acordado para el cambio, con formato ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`).
   Desde ese instante, también se rechazan los pedidos nuevos sin número
   que lleguen desde una versión anterior del formulario. Para esos usuarios
   se debe actualizar la página sin borrar pedidos pendientes.
4. Verificar la regla activa con un intento sintético de solo cotización
   (sin crear un pedido real), y comprobar que el historial y las consultas
   de recibos previos siguen disponibles.

## Release 20261122-house1

Integrado sobre `85f723a7`, conservando puntos, cupones, QR y la protección de
reintentos. No cambia autenticación, precios, comisiones ni pedidos históricos.
La activación usa la hora del servidor, no la del teléfono. No se debe borrar
la cola local para actualizar. Los intentos ya firmados antes del corte conservan
su payload; una cotización fallida sin firma no queda exenta de la nueva regla.
