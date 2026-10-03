# Corrección de navegación y referencias en páginas SEO

Base: `b73d0245c77c708a3b18414cb63891204f5ac170`. Destino existente: repositorio `paratuhogar/paratuhogar`, rama `main`, GitHub Pages, CNAME `paratuhogar.org`.

Las fichas estáticas escribían su propia memoria de referencia con una caducidad artificial de 30 días. Las categorías no recogían una referencia de primera visita. El lector de enlaces cortos de las fichas tampoco reconocía el parámetro actual `contact`. Los botones Consultar/Pedir abrían el producto, pero la tienda no consumía su intención.

Ahora categorías y fichas usan `PTHAffiliate`, el mismo lector que el catálogo principal. Aceptan UUID/contact y las formas históricas ref/nombre, gestor/tel, r opaco y s corto. Una referencia explícita posterior sigue sustituyendo la anterior. Los datos antiguos ya vencidos se eliminan y no se recuperan desde la segunda clave de memoria. Los nuevos recuerdos no añaden un plazo artificial; duran mientras el navegador conserve esa memoria y no se cambien o borren. Esto no equivale a una asignación permanente de clientes: las reglas de pedidos y la autorización del servidor no cambian.

La referencia acompaña únicamente enlaces de navegación a inicio, categorías y productos del mismo origen. No se añade a PDF externos, imágenes, canonical, metadatos, enlaces explícitamente atribuidos ni analíticas. No se consultan clientes ni perfiles privados. La lectura existente de enlaces cortos usa exclusivamente la clave pública, sin cookies ni token de sesión; un fallo conserva el código para reintentar al navegar. Una respuesta tardía no sustituye una referencia más reciente.

`accion` admite solo `consultar` y `pedido`, una vez por documento y para el producto exacto disponible con precio válido. Consultar enfoca el botón de WhatsApp: requiere un toque posterior. Pedir abre el carrito local con el producto; conserva la cantidad si ya estaba añadido. No envía el pedido, abre WhatsApp ni registra un lead automáticamente. Respeta el bloqueo de un carrito pendiente y la separación mayorista ya existente. Las acciones manuales originales conservan su comportamiento.

El generador incorpora `--refresh-navigation`: actualiza solo scripts de navegación de las páginas existentes, sin consultar inventario. Se regeneraron 430 fichas y nueve categorías. Se comparó el HTML completo ajeno a la navegación de las 439 páginas contra la base: no cambió. `sitemap.xml`, `producto/manifest.json` y `producto/publicados.json` son idénticos. Precios, descripciones, opiniones, datos estructurados y estados de indexación se conservaron. Las plantillas normales también están corregidas para las próximas regeneraciones programadas.

Validación realizada:

- 27 pruebas Node: lector compartido, navegación SEO, generación, caché de arranque e idempotencia del checkout.
- Chromium local: páginas generadas y funciones reales de acción en un fixture de componente a 390/1280; categorías/fichas, UUID/contact, retirada/caducidad, preparación de carrito, enlaces repetidos y acción inválida. Todo tráfico externo bloqueado.
- Arranque completo de la tienda con datos sintéticos para visitante, gestor, subgestor y admin: catálogo, filtros, precios propios, carrito, Story/PDF y acceso privado a reportes.
- Validador SEO completo: 430 fichas, nueve categorías, canonical únicos y sitemap coherente.
- Build/check JS, check guía y git diff --check. El PDF aprobado conserva su identidad y bytes.

Publicación limitada al arreglo técnico y actualización de caché de sus assets. No modifica permisos, autenticación, esquema, precios, pagos, analíticas ni contenido comercial/SEO. La publicación de fuentes se confirma mediante Git; el estado de producción y GitHub Pages/Actions no se afirma tras las denegaciones HTTP403 existentes.

Rollback: revertir el commit de esta corrección con `git revert`, conservando los demás cambios de `main`. Si una regeneración posterior produce conflictos, restaurar el lector/plantillas/acciones de la base y actualizar solo navegación; no restaurar inventario o precios de una fecha anterior. No hay migración de base de datos que revertir. La retirada del fix no recupera recuerdos previamente eliminados ni crea asociaciones de clientes.
