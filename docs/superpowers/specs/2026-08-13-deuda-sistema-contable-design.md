# Deuda del sistema contable — Diseño

## Objetivo

Convertir la deuda de mantenimiento en un registro financiero único, reproducible y auditable. La tarjeta, el desglose, Telegram y la liquidación deben mostrar exactamente el mismo importe, calculado en Supabase por cada línea de producto y no reconstruido de forma independiente en el navegador.

## Regla financiera

La mensajería nunca forma parte del precio del equipo. Cada línea del pedido se evalúa individualmente con la tarifa vigente:

- Hasta $60: $0.50 por unidad.
- De $60.01 a $150: $1 por unidad.
- De $150.01 a $399: $2 por unidad.
- De $399.01 a $999: $3 por unidad.
- Más de $999: $5 por unidad.

En pedidos de varias unidades iguales se multiplica la tarifa unitaria por la cantidad. En pedidos mixtos se calcula cada línea por separado. Para los pedidos históricos todavía no liquidados, el precio de cada línea se reconstruye desde el catálogo; si la suma del catálogo difiere del total neto vendido, el ajuste se distribuye proporcionalmente entre las líneas. El importe resultante se congela al instalar la migración para que futuros cambios de catálogo no alteren deuda ya generada.

## Fuente única de verdad

Se crearán las tablas:

- `deuda_sistema_detalle`: una fila por pedido y línea, con producto, cantidad, precio unitario aplicado, tramo, tarifa unitaria, tarifa total y fecha de cálculo.
- `liquidaciones_sistema`: cabecera inmutable del pago recibido, con total, administrador, fecha y referencia.
- `liquidaciones_sistema_detalle`: relación entre liquidación, pedido y tarifa pagada.

Una función idempotente registrará la deuda cuando un pedido pase a `Entregado`. Otra función reparará pedidos históricos pendientes sin duplicarlos. El identificador de pedido y número de línea formarán una restricción única.

## Interfaces

- `listar_deuda_sistema(p_admin_id, p_password)`: devuelve las líneas pendientes y un total derivable exacto.
- `resumen_deuda_sistema(p_admin_id, p_password)`: devuelve conteo de pedidos, conteo de líneas y total.
- `liquidar_deuda_sistema(p_admin_id, p_password, p_referencia)`: bloquea las filas pendientes, crea cabecera y detalle, marca la deuda como liquidada y actualiza `pedidos.pago_sistema` dentro de una sola transacción.
- El trigger de Telegram consultará `resumen_deuda_sistema`; no volverá a implementar los tramos.

Todas las funciones serán `SECURITY DEFINER`, validarán `es_admin_boveda`, fijarán `search_path` y limitarán permisos a `anon` y `authenticated` solamente mediante ejecución explícita.

## Bóveda

`master.html` dejará de calcular la deuda desde `total`, `costo_mensajeria` y `producto`. Cargará el resumen y las líneas desde las funciones financieras. El modal mostrará pedido, fecha, producto por línea, precio unitario aplicado, tarifa, cantidad y total. El total del encabezado se obtendrá sumando las mismas líneas y se rechazará la renderización si difiere del resumen del servidor.

El botón Liquidar llamará únicamente a `liquidar_deuda_sistema`. El mensaje de éxito incluirá identificador de liquidación, cantidad de pedidos y total. Un error nunca se representará como `$0`.

## Compatibilidad y migración

La migración corregirá específicamente los pendientes existentes, incluidos:

- `CA-1247`: $3 de tarifa total.
- `CA-1324`: $1 de tarifa total.

El total esperado al momento de la auditoría es $332.00 en 146 pedidos. Los pedidos ya liquidados no se recalcularán ni generarán deuda nueva.

`pago_sistema` se mantiene temporalmente como campo compatible para pantallas antiguas, pero deja de ser la fuente del monto.

## Manejo de errores

- Pedido sin líneas analizables: queda marcado como incidencia y no puede liquidarse silenciosamente.
- Producto no encontrado: se registra incidencia con el pedido y se excluye del pago hasta revisión.
- Diferencia entre detalle y resumen: la Bóveda muestra error contable y deshabilita Liquidar.
- Liquidación concurrente: bloqueo transaccional y restricción única impiden pagar dos veces.
- Fallo parcial: la transacción completa se revierte.

## Verificación

1. Pruebas estáticas comprueban que `master.html` y Telegram no contienen fórmulas duplicadas.
2. Pruebas SQL cubren una unidad, varias unidades, pedido mixto, mensajería aparte, producto no encontrado, idempotencia y doble liquidación.
3. La suma independiente de las líneas debe ser idéntica al resumen y al modal.
4. Antes de publicar se valida $332.00/146 y las tarifas $3/$1 de `CA-1247`/`CA-1324`.
5. Después de una liquidación de prueba transaccional revertida, ninguna fila debe cambiar permanentemente.

## Fuera de alcance

No se modifica la nómina de gestores, costos de proveedores, comisiones ni reglas de mensajería. Tampoco se reabre ni recalcula deuda histórica ya pagada.
