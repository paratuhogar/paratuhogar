# Billetera de puntos de ParaTuHogar

Fecha: 22 de noviembre de 2026. Base revisada: `origin/main`, commit
`c30c8f96c447ec252df480ad708ceb36736fc412`.

Estado: diseño aprobado por Marcel el 22 de noviembre de 2026; implementación
local validada con pruebas y revisión independiente. Todavía no publicado ni activado.
No se han creado tablas ni acreditado puntos en producción.

## Objetivo y alcance

Crear una billetera de incentivos separada de las comisiones. La primera fase
incluye saldo, historial, puntos automáticos por ventas, reglas por producto y
asignaciones manuales auditadas. No incluye descuentos, QR, campañas de vídeos,
premios, canjes, transferencias, caducidad ni equivalencia monetaria.

Se conservarán precios personalizados, importes, autenticación, pedidos y pagos
existentes. El trabajo se mantiene en una rama independiente; no incorpora el
cambio pendiente del número de vivienda. No usar Docker.

## Reglas confirmadas

- Cada unidad pequeña genera 1 punto; mediana, 2; grande, 3.
- Administración puede establecer puntos especiales por producto y otorgar
  puntos manuales por retos, vídeos u otros reconocimientos.
- Cuando vende un subgestor, los puntos pertenecen únicamente a ese subgestor,
  no a su gestor principal. En una venta propia del principal, pertenecen a él.
- No se modifican ni comparten las comisiones por conceder puntos.
- Solo las ventas entregadas y cobradas generan el crédito automático.
- Cada operación se audita y debe resistir reintentos y concurrencia sin
  acreditar dos veces una misma venta.

## Decisiones aprobadas para esta primera activación

Estas decisiones forman parte del diseño aprobado, no de una
configuración aplicada en la base de datos.

1. Comenzar con pedidos nuevos registrados después de activar el programa;
   no calcular ni rellenar puntos de pedidos históricos automáticamente.
2. Tomar la conciliación de Bóveda como confirmación operativa del cobro:
   `estado = 'Entregado'` y `estado_financiero` igual a `Conciliado_Prov` o
   `Liquidado_Gestor`. No usar `pago_gestor` como cobro del cliente.
3. Mostrar los pedidos nuevos registrados como puntos pendientes de validar,
   separados del saldo ganado. Nunca presentarlos como saldo utilizable.
4. Usar la clasificación pequeña, mediana o grande vigente al registrar el
   pedido. El tamaño de mensajería puede servir como clasificación inicial,
   con revisión administrativa y regla de puntos independiente por producto.
   Una clasificación ausente o desconocida queda para revisión, no se adivina.
5. Los puntos especiales por producto sustituyen los puntos base por unidad;
   no se suman silenciosamente. Cero permite excluir un producto del programa.
6. Fijar los puntos y el beneficiario al registrar el pedido. Los cambios de
   reglas posteriores solo afectan a pedidos nuevos.
7. No fijar valor en USD, vencimiento ni posibilidad de gastar puntos en esta
   fase. Eso requiere una aprobación económica posterior.

## Evidencia del sistema actual

- El gateway `secure-data` valida la sesión y resuelve vendedor y jerarquía.
  No se necesita un sistema nuevo de acceso.
- `checkout.mjs` recibe líneas con identificadores y cantidades, pero el pedido
  persistido conserva principalmente el resumen de equipos como texto.
- `pth_insert_checkout` y su variante exprés asignan consecutivos y crean el
  lote dentro de una transacción. El diseño conserva ese contrato y sus recibos.
- `pth_review_subgestor` aprueba pedidos conservando su identidad. La captura
  de puntos debe conservar el UUID original del subgestor durante ese traslado.
- `master.html` usa `Conciliado_Prov` para confirmar cobro y después puede pasar
  a `Liquidado_Gestor`. Hay pedidos entregados aún pendientes de conciliación;
  entregar, conciliar y pagar comisión no son el mismo hecho.
- La inspección de columnas públicas no encontró una billetera de puntos.

## Enfoque elegido

Usar un libro de movimientos inmutable en la base de datos, acompañado de una
captura de las líneas elegibles del pedido. Un único campo de saldo es más
simple pero no explica errores ni reversos; recalcular desde el catálogo actual
cambiaría premios antiguos al editar productos. El libro conserva el origen de
cada punto y permite reconciliar saldos.

### Datos privados

Usar tablas privadas del programa, fuera de la lectura anónima del catálogo:

- Configuración: programa habilitado y fecha UTC de activación.
- Reglas: producto UUID, clasificación, puntos por unidad, vigencia, autor y
  fecha. Reglas no solapadas por producto; enteros no negativos.
- Captura de pedido: pedido UUID, tipo de origen, beneficiario UUID, fecha
  original del registro y clave estable del envío. Cada línea conserva producto
  UUID, nombre de referencia, cantidad, regla y puntos aplicados.
- Estado de devengo: captura UUID, estado elegible y revisión. Permite pasar de
  pendiente a ganado y de ganado a revertido sin duplicar créditos.
- Movimientos: beneficiario, captura o reconocimiento manual, puntos enteros
  con signo, tipo, fecha de servidor, motivo, autor y clave de idempotencia.
  Un reverso referencia el movimiento corregido; no se borra ni edita el original.

No guardar datos personales del cliente en el libro. Los UUID, no los nombres ni
el teléfono enviado desde el navegador, identifican al beneficiario. Desactivar
una cuenta no borra su historial de puntos. No añadir borrados en cascada desde
pedidos, productos o gestores hacia el libro.

### Registro y validación de ventas

1. El gateway verifica vendedor, productos, cantidades y reglas. El navegador
   no elige destinatario ni importe de puntos autorizado.
2. La creación del pedido y su captura de líneas deben confirmar en la misma
   transacción de registro, sin alterar consecutivos ni idempotencia. Extender
   o envolver las funciones existentes con compatibilidad para clientes antiguos;
   no crear el pedido primero y guardar los puntos en una segunda petición HTTP.
3. Si es un subgestor, la captura mantiene su UUID al aprobarse el pedido. No
   acredita al aprobador ni al principal por el hecho de aprobar.
4. Un cambio de entrega o conciliación evalúa la elegibilidad dentro de la
   base de datos. Sin entrega o sin conciliación, los puntos siguen pendientes.
5. Al cumplir ambas condiciones, crear un crédito con los puntos capturados.
   Un cambio repetido que conserva la elegibilidad no produce otro movimiento.
6. Una cancelación, devolución completa o retirada de la conciliación revierte
   el crédito neto de esa venta. Una corrección posterior que recupera de verdad
   la elegibilidad puede restaurarlo, conservando todos los movimientos.
7. Bloquear por captura el cálculo de la transición y usar claves únicas por
   revisión. Entregas, conciliaciones y reintentos concurrentes deben terminar
   con el mismo saldo neto, no con créditos independientes por cada llamada.

No inferir productos o cantidades leyendo texto histórico. Una entrada nueva
sin líneas verificables o sin clasificación conserva la venta y se muestra como
incidencia sin puntos automáticos. Administración puede reconocerla manualmente
con motivo; la operación no debe acreditarse también por la vía automática.
Las devoluciones parciales sin líneas estructuradas quedan para una corrección
administrativa trazable, no para adivinar qué equipo se devolvió.

### Reconocimientos manuales

Administración selecciona destinatario, cantidad positiva y motivo obligatorio.
El servidor registra quién actuó y genera un único crédito por solicitud.
Un doble clic o reintento devuelve el mismo resultado. Una corrección revierte
el reconocimiento concreto, sin editarlo ni permitir revertirlo dos veces.
No incluir débitos libres, canjes ni saldo negativo en esta primera fase.

Para corregir una venta con reconocimiento manual, el registro debe vincularse
a esa captura y marcarse como resuelta por vía manual, impidiendo un crédito
automático posterior por la misma venta. Los premios de retos sin pedido no
requieren esa vinculación.

## Pantallas y permisos

### Gestor o subgestor

Entrada «Mis puntos» en su centro de trabajo. Muestra puntos ganados, pendientes
de validación, reversos e historial paginado con fecha, concepto, referencia de
pedido y motivo. No muestra equivalencia en dólares ni botón de canje.

Cada cuenta solo consulta su propio saldo. Un principal no hereda permisos para
consultar ni editar la billetera de sus subgestores. La pantalla no expone
comisiones ajenas ni datos de clientes.

### Administración

Sección «Puntos de gestores»: buscar una cuenta, consultar movimientos, otorgar
un reconocimiento y revertir una asignación errónea. Configurar puntos por
producto y consultar ventas pendientes de clasificación. Toda confirmación
identifica destinatario, cantidad y motivo; los errores conservan el formulario.

Usar permisos explícitos de administración, sin conceder acceso por el solo
hecho de ser mensajero o tener funciones logísticas. El saldo no es un campo
editable ni una suma que se mande desde el navegador.

## Seguridad y operación

- Acceso exclusivamente mediante el gateway y funciones de base de datos
  restringidas a su rol de servicio. No habilitar lectura o escritura directa
  para `anon`, `authenticated` ni `PUBLIC` sobre tablas o funciones privadas.
- Activar RLS como defensa adicional sin abrir políticas genéricas. Conservar
  el sistema de sesión existente y verificar destinatario y permisos en servidor.
- Consultas con paginación, índices por cuenta y fecha, captura y clave única.
  No descargar la cartera completa de todas las cuentas para filtrarla en JS.
- El saldo debe coincidir con los movimientos, y las transiciones de venta
  usar transacciones cortas sin llamadas externas dentro de bloqueos.
- La copia sin conexión no permite otorgar, revertir ni confirmar puntos.
  El saldo consultado con anterioridad no se presenta como saldo en tiempo real.
- Detener el programa conserva movimientos y reversos de obligaciones ya
  generadas; no borra saldos ni altera las ventas. La desactivación impide nuevas
  capturas elegibles, no la reconciliación de capturas existentes.

## Verificación antes de publicar

1. Venta de una unidad pequeña, dos medianas y una grande: 8 puntos tras
   entrega y conciliación; cero ganados mientras falte una condición.
2. Venta de subgestor: crédito solo en su cuenta, incluso si aprueba un admin.
   Venta propia del principal: crédito únicamente en el principal.
3. Repetir o ejecutar simultáneamente entregas, conciliaciones y reintentos:
   saldo idéntico al de una sola operación.
4. Cancelar y volver a validar una venta: reverso y restauración trazables,
   sin crecimiento artificial del saldo por repetir el mismo estado.
5. Cambiar producto, clasificación, nombre o regla después del pedido: la
   captura anterior mantiene su beneficiario, cantidades y puntos originales.
6. Pedidos históricos y recibos antiguos: no se rellenan puntos ni cambian datos.
7. Doble clic en premio manual: un solo movimiento. Revertirlo dos veces:
   un solo reverso. Incidencia resuelta manualmente: sin crédito automático doble.
8. Cuenta ajena, usuario anónimo, mensajero y cliente que manipula el formulario:
   no pueden consultar otra billetera ni modificar puntos.
9. Probar móvil, escritorio, pérdida de red, sesión vencida y nueva versión de
   caché sin perder borradores ni alterar precios, comisiones o recibos.
10. Verificar conciliación de saldo contra movimientos y ejecutar controles de
    seguridad de base de datos antes de cualquier activación.

## Secuencia de entrega

Después de la aprobación de Marcel, preparar plan y pruebas,
implementar en la rama independiente y validar con datos sintéticos sin Docker.
La migración, el despliegue del gateway y la web deben coordinarse dejando el
programa desactivado hasta completar las comprobaciones. Publicar y activar
solo tras autorización expresa y registrar el instante UTC real de inicio.
