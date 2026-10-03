# Propuesta editorial local: Mundo Frío y Energía

Estado: borrador para revisión. No publicado ni enviado a origin/main.
Base: `286f6f6625f49d5dcb08012c3f22db0f5e691351`.
Rama aislada: `feat/seo-cold-energy-proposal`.

## Alcance preparado

Las dos categorías añaden tres tarjetas de orientación antes de la grilla actual, tres fichas candidatas después de la grilla y enlaces a guías de compra originales. Se conserva la grilla con sus precios, títulos y fotografías; también los metadatos, canonicals y bloques de atribución existentes. No se modifica ninguna ficha de producto.

Se propone ayudar a preparar una consulta concreta y reducir las preguntas que faltan al hacer el pedido. No se presenta el contenido como una promesa de autonomía, compatibilidad, stock físico, instalación o plazos de entrega.

## Tres guías originales

1. **Qué revisar antes de elegir un equipo de energía**
   `/categoria/energia/que-revisar-antes-de-elegir/`.
   Lista de equipos y etiquetas; datos de la ficha; componentes incluidos; preguntas sobre el modelo y la instalación; consulta antes del pedido.
2. **Cómo comparar equipos de frío antes de comprar**
   `/categoria/mundo-frio/como-comparar-equipos/`.
   Refrigeradores y medidas; exhibidoras y accesorios; modelos de unidades del split; servicios separados; datos pendientes antes de elegir.
3. **Qué confirmar sobre entrega y garantía antes del pedido**
   `/categoria/mundo-frio/antes-de-confirmar-el-pedido/`.
   Modelo y unidades disponibles; coste y coordinación de entrega; garantía de la unidad; revisión del carrito; comprobante y piezas al recibir.

Las tres páginas nuevas son `noindex,follow` y quedan fuera del sitemap mientras se revisa la propuesta. Usan las mismas herramientas de atribución que las categorías. No añaden medición, permisos, claves, cuentas ni acceso a datos privados.

## Fichas candidatas y límites de las fuentes

| Categoría | Ficha | Garantía informada en el catálogo |
|---|---|---|
| Energía | Estación de energía 800W Gnercell | 1 mes |
| Energía | Estación Marsriva MP6 Pro | 1 mes |
| Energía | Bateria 15kWh Must | 15 días |
| Mundo Frío | Refrigerador 19pies LG Smart Inverter | 1 mes |
| Mundo Frío | Nevera Exhibidora Vertical 7pies AUCMA | 1 mes |
| Mundo Frío | Split 1.5 T REYMO (inverter) | 1 mes |

En las seis fichas, la condición registrada es «Mensajería por costo adicional». Son campos del catálogo propio; no se sustituyen por condiciones de otras tiendas. No hay un PDF técnico adjunto en estas fichas ni en los 34 productos marcados disponibles de las dos categorías revisadas. Los nueve y 25 productos marcados disponibles no indican cantidades físicas.

Antes de ampliar el contenido a comparaciones técnicas se necesita el manual o etiqueta del modelo exacto y confirmar piezas incluidas. La garantía requiere confirmar cobertura, exclusiones, documentación y canal de atención. La entrega requiere destino, importe, plazo y servicios incluidos o separados. El contenido local se limita a indicar cómo consultar estos datos.

Se excluyen de comparaciones técnicas Delta 3 Clásica (potencias discordantes), Infinisolar 3 kW (versiones/tensiones ambiguas), la ficha 6 kW SACO/AlphaESS (nombre y modelo discordantes) y el panel de 595 W (corrientes discordantes). No se corrigen sus fichas dentro de esta propuesta.

## Cómo revisar el borrador

`node scripts/preview-category-editorial.mjs --json=/ruta/al/snapshot-publico-revisado.json`

El comando utiliza un snapshot público previamente revisado, el manifiesto y las grillas existentes. No hace consultas de red. Solo destaca fichas que siguen marcadas disponibles y presentes en la grilla. Valida las anclas de las dos categorías antes de escribir las cinco páginas; repetirlo no duplica bloques.

El generador habitual de inventario sigue intacto. Esta es una propuesta local, no una integración final en ese generador: antes de publicar habrá que aprobar los textos, integrar los bloques en `generate-product-pages.mjs`, revisar indexación/sitemap de las guías y revalidar disponibilidad y condiciones. No se debe mezclar este borrador con una regeneración de inventario.

## Verificación

- 18 pruebas Node: generación SEO anterior, atribución anterior, escape de texto, condiciones por ficha, exclusión de agotados, conservación de grilla/metadatos/atribución, idempotencia y detención ante anclas inesperadas.
- Chromium local en 320, 390 y 1280 píxeles: cinco páginas sin desbordamiento, enlaces internos existentes, conservación del UUID/contacto al entrar y regresar de una guía. Conexiones externas bloqueadas y ninguna escritura API.
- Validador SEO: 430 fichas, nueve categorías, canonicals únicos y sitemap completo.
- `build-js.cjs --check` y comprobación de la guía existente pasan.
- Ningún cambio en producto, sitemap, historial de publicación, manifiesto, aplicación, paquetes CSS, backend, precios, comisiones, pagos o información de clientes.

## Publicación y reversión

La revisión previa de outlines y datos pendientes está exigida por el alcance actual. No se hace push ni publicación en esta fase. El destino ya comprobado en el repositorio es GitHub Pages, rama main y raíz, con CNAME paratuhogar.org; no se afirma verificación HTTP de producción. Las comprobaciones HTTP anteriores de Pages/Actions y producción quedaron denegadas y no se reintentan.

El borrador está aislado en su propia rama/worktree. Puede descartarse esa rama local conservando main y los otros worktrees. Una eventual publicación necesitará un commit separado con la integración final y su reversión acotada.
