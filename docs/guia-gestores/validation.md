# Validación de la publicación inicial

Fecha: 3 de octubre de 2026. Base del repositorio: `4b3df03bc4962d5376570e7e0d9de3fe30b7ccdc`.

- PDF recibido de Library, versión 1: igualdad de bytes con el archivo autorizado materializado. SHA-256 `07cce5db6f9024ade52edb771676bb22d8d9675c1cf0752f4662b3b4d5dec372`, 833527 bytes, veinte páginas y dieciocho con imágenes. Se revisaron las cuatro hojas de contacto que contienen las veinte páginas. No se regeneró el archivo.
- `npm run check:guide`: pasó con revisión `2026-10-03.1` y tamaño real.
- `node --test tests/guide-release.test.cjs`: pasó. Rechaza borradores, PDF ausente, tamaños o huellas incorrectos, fechas inválidas y archivos excesivos.
- Chromium local, `PTH_GUIDE_TEST_PDF=guias/guia-gestores.pdf node tests/guide-download-browser.cjs`: pasó. Descarga con huella exacta; tarjeta única; visitante y panel administrativo sin tarjeta; sesiones de venta principal y dependiente; anchos 320, 390 y 1280; modo claro y oscuro; foco visible; texto ampliado; archivo no disponible o de tipo/tamaño incorrecto; respuestas tardías tras cerrar sesión; vuelta a la página. Sin errores de JavaScript.
- `node tests/startup-browser.cjs`: pasó para visitante, gestor, subgestor y administrador. Verifica navegación única, paginación, filtros, búsqueda, carrito, precios propios, enlace de incidencias, vista móvil y herramientas Story/PDF desde una ficha donde corresponden.
- `npm run check:js`: pasó utilizando `NODE_PATH=/workspace/paratuhogar/node_modules`, con Terser 5.51.2 ya instalado y coincidente con el repositorio. El nuevo worktree no tenía dependencias propias; no fue necesario cambiar paquetes.
- Sintaxis JavaScript/Python y `git diff --check`: pasaron.
- Fuente recuperada: veinte páginas y veintitrés imágenes únicas inventariadas desde el mismo PDF aprobado. El original editable usado por su autor no se recibió; la fuente recuperada está identificada expresamente como tal.

Alcance: tarjeta compartida, archivo estático revisado, manifiesto, fuentes y comprobaciones. Sin cambios de servidor ni migración.

El destino existente es GitHub Pages desde `main`, raíz, con `CNAME` `paratuhogar.org`. Las consultas HTTP de producción y las API de Pages/Actions habían respondido 403 en este entorno; no se reintentaron ni se usaron rutas alternativas para eludirlo. La validación local y la confirmación del commit remoto no prueban por sí solas que Pages ya sirva el archivo. La comprobación HTTP final requiere el acceso autorizado disponible en el hilo principal.
