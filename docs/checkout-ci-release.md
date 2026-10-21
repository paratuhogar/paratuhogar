# Carnet obligatorio — solo pedidos nuevos

La interfaz nueva exige 11 dígitos ASCII y conserva ceros iniciales. No se
comprueba la identidad legal del portador, solo el formato del campo.

Las colas nuevas guardan `identityRequired: true`. Un pendiente anterior sin
esa marca conserva su formulario y puede enviarse/revisarse sin añadir CI.
No hay actualizaciones, migraciones ni relleno de pedidos históricos.

## Activación autorizada

Corte programado según la hora comprobada de Supabase:
**2026-10-21T21:07:00.000Z**. El `index.ts` fija esa fecha pública como valor
predeterminado; la variable opcional de entorno permite un corte explícito sin
alterar secretos existentes. La validación debe comprobarse tras el despliegue.

1. Registrar un instante UTC real de activación en formato ISO en el punto de
   entrada o en `PTH_CHECKOUT_CI_REQUIRED_FROM` con ese mismo instante.
   No usar la fecha del commit: el corte debe coincidir con la publicación.
2. Desplegar la función conservando el gateway personalizado y sus ajustes.
   La función usa la fecha fijada en el punto de entrada cuando no existe la
   variable opcional; no declarar la regla publicada antes de verificarla.
3. Publicar la interfaz y sus versiones de recursos/caché coordinadamente.
4. Verificar los archivos servidos y, con datos sintéticos, rechazo de pedidos
   nuevos sin CI, aceptación de 11 dígitos y envío de un pendiente anterior.

El servidor compara la fecha original `intentCreatedAt` con el instante de
activación. Conserva las claves e intenciones firmadas y responde primero a
recibos completos. No revalida pedidos ya aceptados ni aprobaciones antiguas.
La fecha de un borrador sin enviar proviene del dispositivo, dentro del límite
existente de siete días; no constituye una prueba legal de su antigüedad.
