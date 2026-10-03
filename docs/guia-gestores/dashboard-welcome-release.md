# Guía en Dashboard y bienvenida práctica

Revisión de interfaz: 3 de octubre de 2026, sobre `248d8ca431ea9fa982055773b524bcfbe176c7be`.

La guía pasa al interior de `sec-dashboard` y solo comprueba el archivo cuando esa vista está abierta con la sesión de ventas existente. El Catálogo no carga su manifiesto ni su PDF. Sigue habiendo una sola tarjeta y la descarga conserva exactamente la versión final aprobada de Library: veinte páginas, 833527 bytes y SHA-256 `07cce5db6f9024ade52edb771676bb22d8d9675c1cf0752f4662b3b4d5dec372`. Se revisó el texto de las veinte páginas; ninguna describía la ubicación anterior de la tarjeta ni la bienvenida retirada. No hubo regeneración del PDF.

La bienvenida contiene tres pasos breves con Catálogo, compartir y preparar pedidos, y Dashboard. Se eliminan las cinco pantallas antiguas de rangos y plazos de atribución, junto con la otra bienvenida que añadía pronósticos ficticios de ventas y encadenaba la introducción de precios. La comprobación existente de niveles y las reglas de acceso a herramientas siguen a cargo de sus funciones actuales.

«Omitir», Escape y «Terminar» cierran la bienvenida. «Ver bienvenida», en la tarjeta del Dashboard, permite abrirla a voluntad. Cada cuenta recuerda la primera apertura en este navegador; una interrupción no fuerza otro aviso automático. Se migra una sola vez la exclusión anterior del navegador. Si el almacenamiento está desactivado, la sesión de página conserva ese recuerdo sin provocar errores. No puede conservarse una preferencia entre recargas si el navegador impide todo almacenamiento persistente.

El diálogo nativo conserva el foco de teclado, devuelve el foco al cerrar y usa controles de al menos 44 píxeles. Espera a otras tareas abiertas y se retira si aparece otro modal o cambia la cuenta. El aviso existente de Problemas y mejoras espera a su cierre mediante el atributo `open`. Los visitantes, mensajeros y la vista administrativa no reciben esta bienvenida; las cuentas principal y dependiente sí pueden usarla en su vista de ventas.

Validación local:

- `tests/work-welcome-browser.cjs`: tres pasos, acciones con la función real `showSection`, Dashboard y guía, 320/390/1280 píxeles, modo claro/oscuro, foco, Omitir, Escape, reapertura, recarga, cuenta distinta, migración, principal/dependiente, roles excluidos, otros modales, cierre de sesión y almacenamiento fallido. Sin llamadas de permisos ni escrituras a CRM o notificaciones.
- `tests/guide-download-browser.cjs`: guía exclusiva del Dashboard, ausencia de solicitudes desde Catálogo, descarga con huella exacta, validación, estados de error y respuestas tardías tras cerrar sesión.
- `tests/announcement-browser.cjs`: 360/390/1280 píxeles; conserva aislamiento y reconocimiento por cuenta, errores/reintentos, foco, historial y espera expresa a la nueva bienvenida nativa.
- `tests/startup-browser.cjs`: visitante, gestor, subgestor y administrador; catálogo, paginación, filtros, carrito y herramientas Story/PDF siguen funcionando. Su comprobación de cierre de Story ahora identifica esa herramienta, porque el diálogo de bienvenida cerrado permanece montado.
- Pruebas Node de aviso y publicación, `npm run check:guide`, JavaScript publicado coherente con fuentes, comprobación de sintaxis y `git diff --check`.

Alcance de publicación: interfaz, fuentes JavaScript/minificados, documentación y pruebas. Sin migración, cambios de permisos ni edición del PDF aprobado. Reversión: revertir el commit completo de esta revisión; la revisión anterior conserva su tarjeta y su archivo.

Las comprobaciones HTTP de producción siguen bloqueadas por 403 en este entorno. La comprobación de Git remoto es independiente de la disponibilidad final en Pages, que requiere la sesión autorizada del hilo principal.
