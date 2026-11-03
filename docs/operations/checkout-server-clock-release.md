# Checkout con hora del servidor

## Estado

Implementación desde main `1c07cc1`, activación autorizada el 2026-11-03.
Migración `checkout_server_clock` aplicada; secure-data v35 activo. La hora de
inicio queda registrada en el servidor sin reiniciar ni reenviar intentos
antiguos. Verificar CI y readback del commit publicado antes de dar por cerrado
el despliegue; este documento no sustituye el acta final.

## Causa y alcance

El servidor emitía claves firmadas con `intentCreatedAt` del navegador y luego
comparaba ese valor con su propia hora. Un reloj adelantado podía provocar un
falso vencimiento. Un cambio normal de zona horaria no debería modificar el
epoch; no se afirma que el cambio estacional, por sí solo, causara el caso real.

Los intentos nuevos usan claves `pthn2` con hora asignada por PostgreSQL. La tabla
privada guarda únicamente nonce HMAC y hora: sin cliente, teléfono, dirección,
producto ni precio. La misma identidad siempre obtiene la misma hora. No se
purga ni renueva automáticamente un registro vencido. Service_role puede leer e
insertar; no actualizar ni borrar. Anon/authenticated no tienen acceso.

La fecha local se conserva como metadato compatible de entrada, pero no determina
la validez, el payload firmado de v2 ni la obligatoriedad del CI de un intento
nuevo. Para un intento antiguo firmado v1 se preserva la semántica anterior.
Un borrador antiguo sin clave firmada que se cotiza por primera vez es un nuevo
intento del servidor y debe completar el CI si corresponde a la fecha de alta.

Los recibos de v1/v2 usan la clave firmada exacta sin filtrar por la fecha del
teléfono. Devuelven solo proveedor y referencia. Una clave v1 futura puede
recuperar su recibo, pero no autoriza reenvío ni migración silenciosa a v2.
Los envíos antiguos vencidos siguen bloqueados; requieren revisión, no borrado
automático de su estado. No cambian precios, comisiones, tarifas ni login.

La protección cubre el reloj utilizado por la validación del servidor. No cambia
la retención local de datos offline, los avisos del sistema operativo ni TLS:
poner una fecha extrema en el dispositivo puede causar otros problemas locales.

## Pruebas

- 670 pruebas Node correctas, ninguna fallida.
- SQL aislado PGlite: reloj real del motor, identidad estable, no renovación de
  identidad antigua, formato de nonce, permisos e inmutabilidad del registro.
- Nueve regresiones SQL de numeración, con claves v1 y v2 intercaladas.
- Chrome nativo a 390/1280 px: reloj del navegador +1h/-1h, servidor correcto,
  referencias confirmadas y payload PDF correctos, un solo lote insertado.
- Navegador: recuperación de respuesta perdida, recibos y últimos avisos.
- Revisión independiente sin bloqueos; 24 pruebas focalizadas pasaron también
  en la sesión del revisor.
- No se crean pedidos reales para probar. CI remoto queda pendiente de publicar.

## Activación ordenada (requiere autorización)

1. Comparar main y secure-data vivo con la base; respaldar archivos y metadata.
2. Aplicar `supabase/proposals/checkout-server-clock.sql` con historia de migración.
   Verificar RLS, EXECUTE solo de service_role y ausencia de UPDATE/DELETE.
3. Aplicar la función actualizada de `atomic-order-numbering.sql` para admitir
   claves v1/v2. No tocar la reserva anticipada, que permanece deshabilitada;
   no aplicar nuevamente `retire-early-order-reservations.sql` por este cambio.
4. Desplegar checkout.mjs y la guardia de prefijos de handler.mjs. Conservar todos
   los demás archivos, verify_jwt, configuración, secretos y autenticación.
5. Publicar el commit y verificar CI y readback. El frontend no necesita un
   bundle nuevo: recibe el token como valor opaco y no calcula su vencimiento.
6. Probar únicamente rutas de rechazo/lectura sin pedidos reales. Guardar el acta
   final fuera del repositorio público. No reiniciar borradores ni cuentas.

No desplegar el gateway antes del SQL: un RPC de reloj ausente falla cerrado y
la versión anterior de la inserción SQL rechaza correctamente el prefijo nuevo.
Si se revierte el runtime después de emitir v2, conservar soporte de v2 y sus
recibos; no volver ciegamente a un parser exclusivamente v1. No bajar contadores
ni borrar relojes para forzar nuevos intentos.
