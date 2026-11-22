# QR personal para gestores y subgestores

Estado: diseño aprobado por Marcel el 22 de noviembre de 2026; implementado y
verificado localmente, pendiente de publicación. Base inspeccionada: `origin/main`, `9182c8e0`.

## Objetivo y alcance

Cada gestor o subgestor podrá mostrar y descargar un QR de su enlace personal.
Administración podrá obtenerlo para una cuenta seleccionada. El QR debe abrir
el circuito actual de referido y conservar su UUID; no crea otra cuenta ni
otro sistema de atribución.

Esta entrega es independiente de los cupones y no necesita alterar tablas,
permisos, autenticación, precios ni comisiones. No usar Docker. No incorpora
campañas, vídeos, premios, canjes ni métricas nuevas de escaneos.

## Enfoque recomendado

Generar el QR en el dispositivo mediante una biblioteca local, fijada y revisada,
aprovechando la capacidad QR que ya existe en las herramientas de imágenes.
La alternativa de un servicio externo simplificaría el renderizado, pero añadiría
una dependencia de red y entregaría el enlace a un tercero. Un generador en el
servidor no aporta una necesidad operativa en este alcance.

## URL y atribución

Codificar una URL HTTPS del dominio de la tienda con `ref` igual al UUID de la
cuenta activa seleccionada. Usar las utilidades actuales de enlaces; no inventar
códigos públicos ni usar nombres como identificador. No incluir sesiones,
credenciales, comisiones, puntos, datos del comprador ni parámetros de memoria
comercial. No hace falta incluir el teléfono en el QR: el sistema resuelve los
datos públicos del gestor por su identificador.

Un QR de subgestor apunta al UUID del subgestor, no al principal. Al escanearlo,
la web debe reconocer una entrada real por enlace; los puntos de una venta
elegible corresponden solo al subgestor, como en el enlace publicado actual.
Generar o escanear un QR no concede puntos por sí mismo.

Si la cuenta está inactiva, la interfaz administrativa muestra ese estado y
no ofrece generar un QR nuevo. Los enlaces ya impresos conservan las reglas
de validación de cuentas de la web; el QR no permite saltárselas.

## Experiencia

Añadir «Mi QR» junto a «Mi enlace» en el dashboard del gestor/subgestor.
Abrir una ventana accesible con QR, nombre público de la cuenta, dirección del
enlace y botones «Descargar PNG», «Copiar enlace» y «Cerrar».

En administración, permitir seleccionar una cuenta y abrir su QR, sin mostrar
ni mezclar datos privados de su billetera o del principal.

El PNG propuesto tiene 1024 × 1024 píxeles, fondo blanco, código oscuro, contraste
alto y margen de al menos cuatro módulos. No colocar logos sobre los módulos
del QR ni presentar un diseño decorativo que impida escanearlo. La marca y el
nombre público pueden acompañarlo en la ventana, sin cambiar su contenido.

Compartir el archivo de forma nativa será una mejora opcional cuando el navegador
lo permita; siempre habrá descarga manual. Ninguna acción abre WhatsApp o
descarga archivos sin que la persona pulse el botón correspondiente.

## Aislamiento y fallos

Usar diálogo nativo con foco visible, Escape y retorno al botón que lo abrió.
Cerrar y limpiar el contexto al cambiar de cuenta, cerrar sesión o perder el
permiso administrativo. Una respuesta tardía de búsqueda no puede reemplazar
el QR de otra cuenta.

Cargar la biblioteca solo al pedir el QR. Si falla, mostrar un mensaje con
reintento y mantener disponible el enlace como texto. No depender de un servicio
externo de generación. No afirmar que una descarga o un envío se completó si el
navegador lo canceló.

## Aceptación

- Decodificar el PNG generado y comprobar dominio, HTTPS y UUID exacto.
- Probar gestor principal, subgestor y selección administrativa; no cruzar cuentas.
- Recorrer en navegador aislado el QR hasta preparar un pedido sin enviarlo.
- Validar que se conserva la referencia de entrada utilizada por la billetera.
- Reutilizar la regresión que acredita al subgestor y no al principal tras
  aprobación, entrega y conciliación, sin crear pedidos reales.
- Comprobar móvil/escritorio, foco, Escape, cambio de cuenta, fallo de carga,
  descarga cancelada y ausencia de credenciales o comisiones en el contenido.

Después de aprobar este diseño se redactará su plan de implementación separado.
La publicación requiere autorización expresa; el módulo de QR puede publicarse
sin activar los cupones si estos siguen pendientes de la condición de seguridad.
