# Billetera de puntos: entrega y activación

Preparación local del 22 de noviembre de 2026, rama `feat/points-wallet`.
Esta guía no acredita que exista un despliegue en producción. Publicar y activar
requiere autorización expresa de Marcel. No ejecutar Docker.

## Qué entrega esta fase

- «Mis puntos», junto a las pestañas del dashboard del gestor/subgestor.
- «Puntos de gestores», al principio del panel de administración: consulta,
  reconocimientos con motivo, reversos, incidencias y reglas por producto.
- 1/2/3 puntos por unidad pequeña/mediana/grande, respectivamente. Una regla
  especial sustituye el valor base; 0 excluye y «Por tamaño» restaura el valor base.
- Crédito solo con entrega y conciliación de Bóveda. Una venta del subgestor
  pertenece solo al subgestor. Cancelar o retirar la conciliación revierte puntos;
  recuperar realmente la elegibilidad restaura el importe original.
- Sin equivalencia monetaria, canjes, transferencias, vencimiento ni backfill.
  No se alteran precios personalizados, comisiones ni el sistema de acceso.

El libro privado conserva fecha de servidor, motivo, autor, beneficiario,
referencia y vínculos entre créditos y reversos. Las reglas futuras no modifican
capturas anteriores. Los saldos no se guardan en la caché sin conexión.

## Verificación local reproducible

Instalar las dependencias fijadas con `pnpm install --frozen-lockfile --ignore-scripts`.
La prueba PostgreSQL crea un clúster temporal nativo en
localhost y lo elimina al terminar. No usa credenciales ni datos de producción.

```sh
pnpm run test:points:unit
pnpm run test:points:db
pnpm run test:points:integration
pnpm run test:points:browser
node --test tests/*.test.mjs tests/*.test.cjs
pnpm run test:checkout:browser
node tests/checkout-crm-cache-browser.cjs
node scripts/build-js.cjs --check
node scripts/build-support-css.cjs --check
git diff --check
```

Los navegadores de prueba usan Chrome local en macOS; se puede especificar otro
ejecutable con `PTH_BROWSER_EXECUTABLE` para la billetera y `PTH_CHROMIUM` para
las pruebas existentes de checkout. `PTH_POINTS_SCREENSHOTS` permite conservar
capturas de las pruebas de billetera para inspección visual.

Las pruebas validan datos sintéticos, incluido acceso cruzado, doble clic,
concurrencia real, reglas simultáneas, traslado de pedidos aprobados, cancelación,
restauración, desactivación y sesiones cambiadas. No sustituyen la comprobación
posterior del despliegue en los dispositivos de los usuarios.

Resultado local final del 22 de noviembre: 760 pruebas unitarias/integración,
31 pruebas PostgreSQL y 19 pruebas de billetera en Chrome, todas correctas.
También pasaron la cadena existente de checkout en navegador, la prueba real
de caché del service worker y los controles de bundles JS/CSS. La revisión
independiente no dejó hallazgos críticos o importantes pendientes.

La revisión corrigió dos ciclos de bloqueo introducidos por la primera versión
(conciliación masiva frente a premio vinculado, y edición masiva del catálogo
frente a captura de líneas). Las pruebas reproducen esos casos. Los reversos
exactos y únicos mantienen saldos no negativos sin bloquear globalmente la cuenta.
Se comprobó también que aprobar pedidos de subgestores anteriores a la activación
o registrados durante una pausa no les cree capturas retroactivas.

## Secuencia de publicación (pendiente de autorización)

### Ajuste aprobado: puntos automáticos solo por ventas desde enlaces

Autorizado por Marcel: completar, publicar y activar la regla estricta solo por
enlaces. Base `c388af73`. La revisión detectó y corrigió la confusión entre
propietario comercial y visita por enlace. La publicación se verifica después
de las pruebas; este documento por sí solo no acredita un despliegue.

- El navegador conserva una referencia **solo de esta entrada por enlace**, en
  memoria de página, antes de limpiar la URL. No la recupera de los clientes
  asignados, del cierre de sesión ni de la memoria comercial antigua. La
  navegación interna originada únicamente en esa memoria lleva `_pth_ref=memory`
  para no convertir una recompra orgánica en referido. Los enlaces cortos
  resueltos conservan su referencia real.
- El gateway determina `sales_channel` comprobando una referencia de entrada
  que coincida con el UUID o nombre interno del vendedor resuelto y que no
  haya sesión comercial: solo entonces usa `referral_link`. Una cuenta que
  registra el pedido usa `manual`; las otras compras usan `direct`, aunque
  tengan gestor asignado. La referencia queda vinculada a la firma del intento.
  Una página actualizada puede completar un intento antiguo sin ese campo,
  pero no convertirlo retroactivamente en una venta con puntos.
  Ningún campo `origen`, bandera o captura enviado por el navegador puede
  reemplazar esta decisión. Se conservan los enlaces antiguos admitidos por la web.
- La migración `20261122175858_points_referral_sales_only.sql` limita las
  capturas nuevas a `referral_link`. No edita capturas, movimientos, reglas,
  configuración, precios, comisiones ni autenticación. Los pedidos sin canal
  comprobado se registran normalmente, pero no generan puntos ni incidencias.
- Las capturas anteriores conservan su saldo, obligaciones pendientes,
  incidencias, reversos y restauraciones. Un reintento permite únicamente el
  campo nuevo de canal sobre una captura antigua sin reescribirla; el resto
  del contenido debe coincidir. Un pedido manual sin captura nunca se rellena
  posteriormente, aunque un reintento reclame otro canal.
- Los reconocimientos administrativos siguen disponibles. Los puntos de un
  enlace de subgestor no se acreditan también al principal ni al aprobador.
- La ayuda de «Mis puntos» explica la regla. «Puntos de gestores» se integra
  en la cuadrícula administrativa, después de «Notificaciones», con los mismos
  permisos. La caché web preparada es `20261122-pointref1`; los archivos de
  Studio y sus enlaces de WhatsApp mantienen la versión publicada más reciente.

Para publicar este ajuste, desplegar primero el gateway que añade el canal
(sin cambiar secretos ni la bandera activa), verificarlo, aplicar **solo** la
migración nueva y después publicar los assets web coherentes. No volver a
ejecutar la migración inicial ni cambiar `started_at`. Comprobar que el corte
no alteró el historial previo y revisar privilegios de ambas funciones; la
comprobación nativa cubre permisos, concurrencia y el paso de la versión anterior.
Las pruebas no requieren Docker ni ventas de prueba en producción. La copia
previa del gateway y de ambas funciones SQL queda fuera del repositorio,
en la carpeta local de respaldo de esta publicación.

La secuencia siguiente corresponde a la **activación inicial**, no a este ajuste.

1. Confirmar la revisión de código, las pruebas y la base remota. Conservar por
   separado el worktree del número de vivienda. Comprobar que están instaladas
   las funciones actuales `pth_insert_checkout`, `pth_insert_express_checkout`
   y `pth_review_subgestor` y que sus contratos coinciden con los probados.
   Respaldar la base antes de aplicar la migración nueva.
2. Aplicar `supabase/migrations/20261122115426_points_wallet.sql`. La configuración
   comienza con `enabled=false` y `started_at=null`. No hay puntos históricos.
   Verificar privilegios, RLS y que anon/authenticated no ejecutan los RPC nuevos.
3. Desplegar el gateway con `PTH_POINTS_WALLET_ENABLED` ausente o `false`.
   Conservar las demás variables y secretos. El checkout usa entonces su RPC
   anterior, sin cambios de precios ni comisiones.
4. Publicar los archivos web de esta rama y su service worker coherente.
   Comprobar que la billetera informa que el programa está desactivado, consulta
   solo la cuenta autorizada y no expone datos de clientes ni comisiones ajenas.
5. Tras las comprobaciones, configurar `PTH_POINTS_WALLET_ENABLED=true` y
   redesplegar el gateway. La captura sigue desactivada hasta el siguiente paso.
   Verificar el catálogo, las cotizaciones y consultas con cuentas autorizadas;
   no crear ventas o premios ficticios en producción para probarlos.
6. Solo con autorización para activar, ejecutar como operador desde el entorno
   administrativo SQL:

```sql
update pth_points.config
set enabled = true,
    started_at = coalesce(started_at, clock_timestamp())
where singleton = true;

select enabled, started_at from pth_points.config;
```

Registrar el instante UTC devuelto por el servidor y el commit desplegado.
La fecha del teléfono no establece la activación. Supervisar las primeras ventas
reales y sus transiciones, sin cambiar pedidos anteriores.

## Pausa y recuperación

Para detener nuevas capturas y reconocimientos manuales, un operador autorizado
puede cambiar únicamente `enabled=false`. **No borrar `started_at`, tablas,
triggers, capturas ni movimientos.** Las obligaciones capturadas anteriormente
siguen conciliándose y revirtiéndose aunque el programa esté pausado. Reanudar
conserva el instante de inicio; los pedidos del intervalo pausado no se rellenan.

No retirar la migración como rollback: perder los triggers detendría los reversos
de obligaciones existentes. Ante un fallo de captura, pausar primero y mantener
los datos para investigar. No habilitar un fallback que guarde la venta sin la
captura cuando la transacción nueva falle: el registro y su recibo deben seguir
siendo atómicos e idempotentes.

## Incidencias y correcciones

Una clasificación ausente, un producto no identificable o un ingreso heredado sin
líneas verificables conserva la venta y crea una incidencia; no inventa puntos.
Administración debe comprobar el pedido y, si está entregado y conciliado,
resolverlo con un reconocimiento vinculado y motivo. Si falta el beneficiario,
debe identificarlo expresamente; la captura original permanece inmutable.
No usar un premio independiente para corregir una incidencia, porque no quedaría
vinculado a las futuras cancelaciones de esa venta.

Un reconocimiento incierto conserva la misma clave al reintentarlo. Si el
servidor ya lo aplicó, devuelve el mismo resultado; no crea otro movimiento.
Cambiar destinatario, cantidad o motivo constituye una nueva operación, no un
reintento del reconocimiento anterior.

El intento y su formulario se conservan en memoria mientras la ventana y esa
sección sigan abiertas; no se persisten datos privados en el dispositivo. Ante
un resultado incierto, no cerrar ni cambiar de pestaña de la billetera antes de
reintentarlo. Si se cerró, consultar primero el historial antes de crear otro
reconocimiento. No asumir que un error de red significa que no se registró.
