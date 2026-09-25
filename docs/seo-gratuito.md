# SEO de ParaTuHogar con recursos gratuitos

## Alcance aprobado

Mejorar el SEO existente sin suscripciones, API de pago ni campañas publicitarias.
El propietario confirmó el 25 de septiembre de 2026 que los productos no disponibles
normalmente están agotados temporalmente y que Search Console está verificada.

## Cambios

- Las fichas con un precio positivo y finito permanecen indexables cuando se agotan.
  Conservan `OutOfStock`, el aviso de agotamiento y la compra desactivada. Su URL sigue
  incluida en el sitemap. No se cambia el inventario ni el precio en la base de datos.
- Las categorías permanecen accesibles sin existencias y muestran un aviso honesto.
  Su listado y las recomendaciones no presentan productos sin un precio válido.
- Las nueve categorías tienen textos específicos y enlaces HTML desde la portada.
  Se mantienen las URLs actuales y los metadatos particulares de cada producto.
- El control que abre los términos de garantía es un botón.
- El validador y cuatro pruebas de integración protegen la política de indexación,
  las categorías vacías y la correspondencia entre fichas y sitemap.

Esta política presupone agotamiento temporal. Si un modelo se retira definitivamente
o se necesita un borrador que no aparezca en Google, hay que distinguir ese estado
de la falta de stock antes de aplicarle una política diferente. Marcar `disponible=NO`
ya no significa excluir la ficha de los buscadores; sigue excluyéndola de las ofertas
disponibles del catálogo. No se ha creado un nuevo campo de publicación.

## Comprobaciones locales, sin API de pago

```sh
node --test tests/seo-generation.test.mjs
node scripts/generate-product-pages.mjs
node scripts/validate-seo-pages.mjs
```

El generador lee el catálogo y las opiniones públicas del servicio que ya utiliza
la tienda y escribe archivos locales. No modifica la base de datos. Para probar
sin red, las pruebas ejecutan el generador con `--json` y datos ficticios en carpetas
temporales. No añadir esos datos ficticios al catálogo publicado.

La automatización existente de GitHub conserva su frecuencia. Se añade únicamente
la ejecución de las pruebas sin dependencias externas. El repositorio es público;
no se han contratado runners ni servicios adicionales.

Lighthouse se puede ejecutar gratuitamente desde Chrome DevTools, o con la versión
utilizada en esta revisión:

```sh
npx --yes lighthouse@13.5.0 https://paratuhogar.org/ --chrome-flags='--headless' --only-categories=seo --output=html --output-path=./lighthouse-seo.html
```

## Medición con Google Search Console

1. Antes de publicar, exportar Rendimiento > Resultados de búsqueda, tipo Web, para
   los últimos 28 días completos y los 28 anteriores. Conservar consultas y páginas,
   clics, impresiones, CTR y posición. Anotar los filtros y las fechas exactas.
2. Anotar la fecha real de publicación. Comprobar el sitemap
   `https://paratuhogar.org/sitemap.xml` y la inspección de una ficha agotada y una
   categoría. Permitir indexación no garantiza que Google indexe una URL.
3. Cuando Google haya vuelto a rastrear las páginas, comparar períodos completos
   equivalentes con los mismos filtros. Separar consultas de marca y sin marca,
   páginas modificadas, países y dispositivos; considerar estacionalidad y stock.
4. Priorizar páginas con impresiones y pocos clics. Ajustar sus títulos y contenido
   según las consultas reales. No inventar volúmenes de búsqueda ni resultados.

No se configuró un seguimiento automático ni se accedió a los datos privados de
Search Console en esta sesión: la herramienta de navegador falló al iniciarse.
Una exportación CSV/ZIP permite analizar esos datos sin contratar herramientas.

## Evidencia de esta revisión

- Lighthouse 13.5.0, perfil móvil: la portada publicada obtuvo SEO 92/100 por un
  enlace sin `href` en los términos de garantía; la copia local corregida, 100/100.
  La propuesta aplicada sobre el código actual de GitHub también obtuvo 100/100
  en una ejecución independiente sin advertencias, usando la URL local versionada.
- La medición de rendimiento de la portada publicada fue 25/100, pero Lighthouse
  advirtió CPU más lenta que la esperada y una redirección a `?v=2807a`. Es una
  medición de laboratorio, no Core Web Vitals de usuarios reales, ni una comparación
  de rendimiento antes/después. No se ha realizado una optimización integral.
- El catálogo leído contenía 426 productos. El sitemap generado contiene 436 URLs:
  425 fichas con precio válido, nueve categorías y dos páginas generales. Una ficha
  sin precio válido conserva `noindex`.

Los informes completos se guardaron en la carpeta local `output/seo-2026-09-25/`.
La puntuación SEO de Lighthouse no mide la posición en Google ni predice el aumento
de clics. Search Console será la fuente de resultados comerciales de búsqueda.

## Referencias gratuitas

- [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [Guía SEO de Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Mantener la presencia en búsqueda ante interrupciones temporales](https://developers.google.com/search/docs/crawling-indexing/pause-online-business)
- [Rendimiento en Search Console](https://support.google.com/webmasters/answer/7576553?hl=es)
