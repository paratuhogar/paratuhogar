# Fichas de paneles solares: propuesta SEO y revisión móvil

Revisión: 8 de octubre de 2026. Base de código: `88bb4e853215ad9635a83a14e5742a4dfcc3678f`.
Alcance: propuesta para revisión mediante pull request; no integrar ni publicar sin aprobación.
Los datos privados de rendimiento se analizan en la conversación y no se copian a este repositorio público.

## Prioridad y diagnóstico

Se priorizan las dos fichas energéticas identificadas por el propietario en el informe de septiembre:

- [Panel 30V 400W](https://paratuhogar.org/producto/panel-30v-400w/).
- [Panel Solar 590W WAAREE](https://paratuhogar.org/producto/panel-solar-590w-waaree/).

Ambas están temporalmente agotadas en el manifiesto revisado. Conservan un precio positivo,
canonical propio, `index,follow`, inclusión en el sitemap, JSON-LD `Product`, `Offer` con
`OutOfStock`, migas de pan y compra desactivada. Esto ya está implementado y se conserva.

La [PR #15](https://github.com/paratuhogar/paratuhogar/pull/15) se integró el 25 de septiembre
 de 2026 a las 11:42:06 UTC (07:42:06 en La Habana). La hora de integración no demuestra
por sí sola la hora de despliegue de Pages ni la de nuevo rastreo de Google. Esa PR recuperó
50 fichas antes publicadas, mejoró categorías y enlaces desde la portada. No repetirla.

El código actual también contiene las guías editoriales y la navegación de referencias
incorporadas el 3 de octubre. Se conservan, aunque la documentación histórica de su propuesta
sigue describiéndolas como borrador. La presencia en main se verificó mediante Git;
no se presupone que cada commit estuviera desplegado y rastreado a esa misma hora.

| Elemento | Hallazgo actual | Propuesta |
|---|---|---|
| Título 400 W | «Panel 30V 400W» no identifica explícitamente energía solar ni modelo | Título SEO con «Panel solar 400 W JCN-M400» y Cuba |
| Título Waaree | Identifica marca y potencia | Añadir bifacial, conservando marca, potencia y Cuba |
| Descripción 400 W | Fragmento termina en «Voltaje de circuito abierto: 36.» | Resumen legible con modelo y potencia |
| Descripción Waaree | Empieza por «84% Dimensiones…» y termina en «Peso: 31.» | Resumen legible con modelo, bifacialidad y TOPCon |
| Contenido técnico | Incluye datos del catálogo, pero no un PDF del modelo en estas fichas | Conservar; no inventar compatibilidad, instalación ni autonomía |
| Datos estructurados | Product/Offer/BreadcrumbList ya existen | Conservarlos; sincronizar solo su description con el resumen visible |
| Enlaces entrantes | La grilla de Energía contiene disponibles y no enlaza estos dos agotados | Sección separada con enlaces a paneles agotados antes publicados |
| Recomendaciones | El precio hace aparecer backups entre paneles | Priorizar paneles disponibles con precio válido |
| Móvil | La fotografía ocupa espacio antes de nombre, estado y acciones | Información comercial antes de fotografía en las fichas de paneles |

## Cambios seleccionados

1. Corregir el generador de descripciones: un punto decimal no cierra una oración;
   mantener un prefijo consecutivo y no seleccionar fragmentos intermedios después
   de omitir una oración demasiado larga. Es una corrección de integridad de texto,
   no una estrategia basada en CTR por consulta, que aún falta.
2. Dos resúmenes y títulos específicos, revisados contra las descripciones existentes.
   Se aplican solo al mismo ID/nombre y mientras estén presentes los datos del modelo.
   `seo_title` y `seo_description` escritos en el catálogo conservan prioridad.
   No se fijan precios, stock ni entrega en el nuevo texto.
3. En Energía, enlazar otros modelos de paneles temporalmente agotados solo si ya
   son indexables por el historial de publicación y tienen precio válido.
   Los borradores y productos sin precio no se incluyen. La sección de disponibles
   se conserva y los agotados tienen un aviso separado y explícito.
4. En fichas de paneles, priorizar otros paneles disponibles antes de equipos distintos;
   conservar filtros de disponibilidad y precio. Son alternativas para comparar,
   no una afirmación de compatibilidad entre componentes.
5. En móviles de hasta 780 px, presentar nombre, estado, precio y acciones antes
   de la fotografía. Añadir enlaces a características y a la categoría. La disposición
   de escritorio conserva sus dos columnas y las fotos siguen presentes.

Las páginas concretas incluidas en la propuesta se obtuvieron sin red a partir del HTML
actual y el manifiesto. Se copiaron solo las dos fichas y el nuevo bloque de la categoría;
el generador/plantillas contienen los cambios para futuras actualizaciones normales.
No se ejecutó la generación contra una base de datos ni se sustituyó el inventario por
un snapshot reconstruido. No se modifican backend, pedidos, stock, precios ni comisiones.

## Comprobación

- 32 pruebas Node pasan: contenido SEO, generación, guías, navegación/referencias,
  disponibilidad, contrato del catálogo e idempotencia/bloqueo del checkout.
- El validador completo pasa: 442 fichas, nueve categorías, tres guías, 454 canonicals
  únicos y correspondencia entre páginas indexables y sitemap.
- `build-js.cjs --check` y `git diff --check` pasan. No cambia el bundle de la tienda.
- Comparación de las dos fichas contra la base: JSON-LD idéntico salvo `description`;
  precios, garantía, entrega, contenido técnico, estado, canonical, robots, scripts
  de referencias y acciones comerciales idénticos.
- La grilla de Energía es idéntica byte a byte. El manifiesto, historial de publicación
  y sitemap no cambian.
- Chromium local, anchos 320, 390, 780, 781 y 1280 px: sin desbordamiento horizontal;
  posición móvil/escritorio correcta; anclas visibles bajo la cabecera; enlaces a fichas
  existentes; UUID/contact conservados; compra agotada sigue desactivada.
- En la simulación a 390 × 844 px, las acciones del panel de 400 W pasan de empezar
  en y≈1043 a y≈553. Las del Waaree empiezan en y≈590. Esto verifica accesibilidad
  visual dentro de ese viewport, no rendimiento de red, conversiones ni posiciones.
  Las peticiones externas estaban bloqueadas y las fotografías externas no se cargaron.

No se ha medido un teléfono Android físico, Core Web Vitals de usuarios reales ni cambios
 en compras. La revisión local reduce riesgos; no equivale a una prueba de un pedido real.

## Datos necesarios de Search Console

El correo mensual contiene agregados y listas parciales. Su sección «Páginas que más han
crecido» muestra diferencias respecto al mes anterior; una cifra con «+» no debe transcribirse
como total mensual. No aporta impresiones, CTR y posición de cada una de estas fichas o consultas,
ni la serie diaria necesaria para aislar el cambio del 25 de septiembre.

Se intentó abrir Search Console, pero este navegador llegó a la página pública sin una sesión
 autenticada. El código también contiene un lector privado de estadísticas de Google reservado
al propietario: consulta fechas finales, páginas, consultas, dispositivos y países por separado,
con un máximo de 1.000 filas por ranking. Esa implementación no demuestra acceso actual ni
proporciona por sí sola el cruce consulta × ficha × dispositivo. No se modificó ni se intentó
saltar su autenticación.

### Primera comparación que ya puede exportarse

En Rendimiento → Resultados de búsqueda, propiedad de ParaTuHogar, tipo **Web**:

| Ventana | Fechas inclusivas | Motivo |
|---|---|---|
| Antes | 18–24 septiembre 2026 | Siete días completos anteriores |
| Después | 26 septiembre–2 octubre 2026 | Siete días completos posteriores |

Excluir el 25 de septiembre, que mezcla horas anteriores/posteriores. Cada ventana contiene
una vez cada día de la semana. Usar fechas finales de Search Console (zona horaria del Pacífico),
no convertir sus días a los de La Habana. Esta es una comparación descriptiva corta, no una
prueba causal. La segunda ventana evita incluir los cambios editoriales del 3 de octubre,
pero no elimina variaciones de stock, demanda, otros cambios o retrasos de rastreo.

Activar **clics, impresiones, CTR y posición** y conservar los filtros y fechas en cada exportación:

1. Comparar esas dos ventanas y exportar las tablas de Páginas, Consultas, Dispositivos y Países
   con todos los dispositivos/países. Exportar también fechas diarias de cada ventana por separado.
2. Repetir con **dispositivo móvil** y **país Cuba** para analizar el mercado principal.
3. Aplicar **Página → URL exacta** a cada ficha, por separado, manteniendo móvil/Cuba y la
   comparación de fechas. Exportar la tabla de Consultas con las cuatro métricas. Repetir
   para `/categoria/energia/` y, si hace falta, para los paneles disponibles que reciben enlaces.
4. Conservar los CSV o una exportación de Google Sheets; no subir datos privados a este
   repositorio público. Si la interfaz limita filas, anotar el límite y usar una exportación
   autorizada mediante API para más filas, sin asumir que recupera consultas anonimizadas.

Con esos datos se podrá distinguir:

- Pocas impresiones: revisar consulta, cobertura, rastreo y pertinencia del contenido.
- Impresiones pero pocos clics: estudiar título/resumen junto con posición y estado de stock.
- Clics pero escasas consultas/pedidos: revisar navegación y el flujo comercial; Search Console
  por sí sola no mide todas las acciones de compra.

No promediar porcentajes de CTR: usar clics totales / impresiones totales dentro de cada
segmento comparable. No promediar posiciones sin sus impresiones y contexto de agregación.
Las consultas anonimizadas y las diferencias de agrupación impiden que todas las tablas
reconcilien exactamente con el total de la propiedad. Separar consultas inequívocamente
relacionadas con la marca, comerciales sin marca y expresiones ambiguas como «tu hogar»;
no clasificar automáticamente toda consulta genérica como marca.

Para una ventana más larga, el período posterior **26 septiembre–23 octubre** aún no está
completo el 8 de octubre. Su comparación con **28 agosto–24 septiembre** deberá registrar
los cambios del 3 de octubre y cualquier publicación posterior como factores adicionales.
No se han calculado diferencias sin exportación ni se atribuyen clics de septiembre a la PR #15.

## Siguientes decisiones, condicionadas a evidencia

- Confirmar qué significa «Garantía: 0» con el propietario antes de sustituirlo por una promesa.
- Obtener manual/etiqueta de JCN-M400 y WAAREE BiN-08-590 antes de ampliar contenido sobre
  compatibilidad, controladores, tensión del sistema o instalación. No deducirlo del nombre «30 V».
- Priorizar nuevas fichas por impresiones, consultas y disponibilidad reales; no crear páginas
  repetidas por potencia/marca ni reescribir masivamente títulos sin esos datos.
- Tras aprobar y desplegar la PR, anotar despliegue y nuevo rastreo de las fichas, y conservar
  una línea base separada. La indexación o datos estructurados no garantizan resultados enriquecidos
  ni una posición determinada.

## Fuentes públicas

- [PR #15 y fecha de integración](https://github.com/paratuhogar/paratuhogar/pull/15).
- [Política SEO existente](https://github.com/paratuhogar/paratuhogar/blob/main/docs/seo-gratuito.md).
- [Descripciones y fragmentos de Google](https://developers.google.com/search/docs/appearance/snippet).
- [Títulos en Google](https://developers.google.com/search/docs/appearance/title-link).
- [Enlaces internos rastreables](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
- [Datos estructurados de productos](https://developers.google.com/search/docs/appearance/structured-data/product).
- [Indexación móvil](https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing).
- [Configuración del informe de rendimiento](https://support.google.com/webmasters/answer/7576553).
- [Filtros y comparaciones](https://support.google.com/webmasters/answer/17011165).
- [Agrupaciones y zonas horarias](https://support.google.com/webmasters/answer/17011259).
- [Límites de datos y agregación](https://support.google.com/webmasters/answer/17011364).
- [Exportación desde Search Console](https://support.google.com/webmasters/answer/12919797).
