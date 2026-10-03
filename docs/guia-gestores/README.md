# Guía para gestores

La versión publicada es el PDF final aprobado, recibido desde Library sin regenerarlo. Su procedencia y huella están en `final-library-source.json`. La ruta pública estable es `https://paratuhogar.org/guias/guia-gestores.pdf`; la tarjeta añade la revisión a la URL para renovar la caché.

La versión inicial publicada tiene fecha 3 de octubre de 2026, revisión 1, veinte páginas, dieciocho con capturas y 833527 bytes. El PDF contiene vistas públicas y pantallas privadas con datos de demostración revisados para su publicación. Ningún reporte real, captura enviada por usuarios, dato de cliente ni credencial forma parte de este recurso público.

## Fuentes para mantenerla

- `contenido-final.json`: texto, bloques, formato y posiciones recuperados del PDF final aprobado. Se puede editar como base para una próxima revisión. No es el documento original de maquetación, que no se entregó a este entorno.
- `inventario-final-capturas.json`: cada imagen incorporada al PDF final, páginas, dimensiones, posición y huella. Las imágenes permanecen disponibles dentro del PDF. `python3 scripts/extract-guide-source.py` las recupera en `docs/guia-gestores/build/extracted/`, junto al texto; no modifica el PDF publicado. Requiere PyMuPDF.
- `contenido.json` e `inventario-capturas.json`: guion y capturas del borrador editorial previo. Conservan el punto de partida, pero **no reproducen la versión final aprobada**. La versión final y su inventario tienen prioridad.
- `scripts/build-guide.py`: generador del borrador para revisión, con Pillow, ReportLab, PyMuPDF y DejaVu Sans. Requiere las capturas del inventario previo en `PTH_GUIDE_CAPTURE_DIR`. Guarda únicamente en `docs/guia-gestores/build/` o en `PTH_GUIDE_BUILD_DIR`; no reemplaza el archivo publicado. Cada salida necesita revisión editorial y visual antes de su uso.

La actualización requiere capturas reales de la interfaz, revisión de privacidad y aprobación de la nueva versión. No existe captura ni publicación automática. Al cambiar una función visible, seguir `release-checklist.md` en la misma entrega o dejar documentada la actualización pendiente.

## Tarjeta y alcance

Una sola tarjeta aparece dentro de Mi Dashboard durante una sesión de trabajo existente. El Catálogo queda dedicado a buscar productos y preparar pedidos y no consulta el manifiesto de la guía. La tarjeta usa la misma navegación y sesión que la web. No aparece en la vista pública ni en el panel administrativo. Una persona con permisos administrativos que cambie a su vista de ventas la verá en su Dashboard.

«Ver bienvenida» permite repasar tres pasos prácticos: Catálogo, compartir y preparar pedidos, y Dashboard. Se puede omitir o cerrar con Escape. La primera apertura se recuerda por cuenta en este navegador, también ante recargas o interrupciones; la exclusión de la bienvenida anterior se migra sin repetirla. No activa notificaciones ni guarda contactos. El aviso privado de Problemas y mejoras espera a que se cierre esta bienvenida.

La revisión de ubicación no cambia el PDF final ni su número de revisión: ninguna de sus veinte páginas situaba la tarjeta en el Catálogo ni incluía la antigua bienvenida. Las instrucciones del PDF sobre navegación y requisitos de poca conexión siguen vigentes. El mismo archivo aprobado y el inventario extraído se conservan sin regeneración.

`guias/gestores.json` autoriza la aparición únicamente con una versión final válida. Antes de mostrar el enlace, se consulta la disponibilidad del PDF y su tipo y tamaño. No se precarga el contenido del documento. La descarga usa un enlace normal y admite navegadores móviles.

El manual es un recurso estático público revisado; ocultar la tarjeta no constituye control de acceso al PDF. Los reportes, capturas de incidencias y datos operativos siguen en sus rutas privadas existentes. Esta entrega no cambia permisos, base de datos, precios, comisiones ni pagos.

## Verificación y reversión

`npm run check:guide` comprueba PDF, tamaño real, huella y manifiesto. Las pruebas `tests/guide-release.test.cjs` y `tests/guide-download-browser.cjs` comprueban validación, descarga, móviles y cambios de sesión. Para revisar la descarga real, usar `PTH_GUIDE_TEST_PDF=guias/guia-gestores.pdf` al ejecutar la prueba de navegador.

Revertir el commit de esta entrega revierte la tarjeta, el manifiesto y el PDF juntos. Para retirar la publicación, usar `published: false`, `status: pending` y eliminar el PDF de la misma entrega; el control de publicación exige que no quede un borrador en la ruta pública. Ocultar un enlace por sí solo no retira un archivo público.
