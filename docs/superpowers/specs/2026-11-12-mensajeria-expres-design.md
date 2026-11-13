# Mensajería exprés — primera versión

## Panel de administración

Ampliar las tarifas existentes de cada municipio y localidad con un precio exprés final en USD y un plazo entero positivo en minutos por tamaño: pequeño, mediano y grande. Ambos campos vacíos significan que no se ofrece ese tamaño; no se guarda un par incompleto. Solo los administradores pueden editar. Las tarifas ordinarias no cambian ni se precargan los precios de ejemplo.

## Carrito y confirmación

Ordinaria sigue siendo la opción predeterminada. Mostrar Exprés con precio y plazo únicamente si el destino y el tamaño mayor del carrito tienen una configuración válida. No ofrecerlo para recogida en almacén. Exprés requiere conexión para consultar la tarifa vigente; los borradores existentes y los pedidos ordinarios conservan su comportamiento. Si cambia el carrito, la zona o la tarifa y la opción seleccionada deja de ser válida, pedir una nueva elección explícita sin confirmar automáticamente un servicio distinto.

El precio exprés configurado es el importe de envío de esa compra, no un recargo sobre la tarifa ordinaria. Al guardar debe superar la tarifa ordinaria configurada del mismo tamaño. En el carrito y en el servidor debe superar además el importe ordinario efectivo, incluidas las excepciones por proveedor y el multiplicador por cantidad. Si no lo supera, o si no se puede calcular la ordinaria para comparar, no se ofrece Exprés. No acumular las excepciones ni el multiplicador de la ordinaria con el precio exprés. El servidor calcula el tamaño y el importe y vincula servicio, precio y plazo a la cotización aceptada. Si cambia cualquiera de esos datos antes de confirmar, pedir nueva confirmación; el cliente no dicta ni el precio ni el plazo.

## Pedido y logística

Guardar el servicio y el plazo aceptados junto con el importe de envío existente. En compras de varios proveedores, conservar la marca Exprés en todas las filas y cobrar el envío una sola vez, siguiendo la distribución actual. Conservar los datos al aprobar pedidos de subgestores y mostrarlos en logística y en la confirmación. Los pedidos históricos y las solicitudes antiguas sin selección de servicio se tratan como ordinarios. Una edición posterior de tarifas no cambia los pedidos guardados.

No se activa envío gratis por demora, reembolso automático, cronómetro ni fecha límite garantizada. El plazo se muestra como plazo estimado del servicio.

## Pruebas y despliegue

Verificar con datos sintéticos: permisos de edición; pares vacíos e incompletos; los tres tamaños; mezcla de tamaños y proveedores; recogida y zona no configurada; cambios de precio o plazo después de cotizar; conservación de datos al aprobar un pedido; recuperación de confirmaciones sin duplicados; y regresión de ordinaria y borradores.

Preparar primero el esquema compatible con los clientes existentes, luego el servidor y por último la interfaz versionada. Mantener Exprés inactivo hasta que un administrador configure cada tarifa. No ejecutar compras de prueba ni cambiar precios reales durante el despliegue.
