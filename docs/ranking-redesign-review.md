# Ranking: revisión pendiente, sin publicar

Implementación en copia aislada de main remoto verificado `e0e493405c10fcc301161043305702f6cd644810`, rama `ranking-redesign`. Checkout original `/Users/marcel/Documents/paratuhogar-actual` limpio y sin modificar. No hay AGENTS.md ni .agents/skills en el checkout actual.

Referencia Library `libfile_46e76e0af6f881918f03b5d0acf924bb` materializada en este Mac y píxeles inspeccionados. La vista admin original tenía un líder y avisos dominantes.

## Cambios

Cima azul profundo y dorado, corona discreta y mismo tratamiento para líderes empatados devueltos. Podio sin cuentas inventadas. Tarjeta personal conserva cero sin puesto y metas 1/3/5; distancia exacta cuando los vecinos permiten comprobar el siguiente grupo superior. Cuando un empate grande oculta ese grupo, no inventa la distancia. Reglas plegables, exclusiones por fechas visibles y administración sin lenguaje de participación.

Tarjeta PNG descargable por pulsación explícita; indica mes en curso/provisional. No hay envío automático. Hitos solo ante aumentos observados con identidad fiable en ambos estados; primera/3/5 acumulados, podio y liderazgo mensual. Claves de hitos realizadas por cuenta en almacenamiento local, sin guardar resumen, pedidos ni ranking. Movimiento reducido sin animación, sin sonido ni modal.

Fecha y días calendario restantes en America/Havana (excluye el día actual; muestra Último día en la fecha de cierre). Caché en memoria deja de suprimir recarga después del cierre. Nuevo mes se obtiene al actualizar o volver a cargar la tarjeta. Recursos estáticos versionados en el service worker; datos privados continúan sin caché.

## Propuesta mínima pendiente de autorización

El backend actual limita top a tres cuentas y vecinos a cinco. No garantiza todos los líderes empatados ni el siguiente grupo superior dentro de un empate grande. Para igualdad completa y distancia exacta siempre, añadir al resumen agregado `leaderCount`, lista acotada de aliases líderes con indicación explícita de resto empatado, y `nextHigherCount` calculado por el mismo agregado. Esto modifica el contrato de secure-data y requiere revisión antes de tocar backend.

Para reconocimiento permanente: tabla privada de cierres mensuales con clave única mes+cuenta ganadora, mes cerrado en Havana, count/rank/alias al cierre y estado de fiabilidad. Inicio: primer mes completo con fechas fiables tras el registro prospectivo (octubre de 2026 solo si revisión de fiabilidad lo confirma). Proceso idempotente tras cierre, todos los empatados rank1 reconocidos. Nunca completar fechas históricas. Leer únicamente agregados de últimos meses cerrados a través del gateway existente, sin abrir tablas a anon/authenticated. Requiere aprobación del almacenamiento, proceso de cierre y acceso agregado. No se aplicó SQL, permisos ni Edge deployment. UI actual no adjudica premios ni fabrica historia o insignias mensuales.

## Verificación

- Verificación final: 403/403 tests Node locales pasaron tras todas las correcciones; QA DOM también pasó. La prueba de upgrade estático se actualizó a la nueva versión de caché e incluye recursos del ranking.
- QA DOM con linkedom y datos ficticios: gestor/subgestor/admin, cero, líder único, empates 1/1/3, top3/vecinos, alias como texto, hitos una vez, deduplicación de lecturas, CTA y clear.
- Build CSS, check JS generado y diff --check pasaron.
- Revisión independiente de código: un hallazgo de celebración por cambio de fiabilidad, corregido con prueba que falló antes y pasó después.
- Navegador Google Chrome local: un intento de launch Playwright terminó SIGABRT. No se repitió reparación, no se cambió configuración de app. No hay capturas reales nuevas ni verificación visual responsiva; pendiente móvil 320/390 y escritorio, reduced motion visual, descarga canvas e integración storefront completa.
- No se usaron pedidos reales ni se contactó a terceros. Backend, auth, RLS, precios, comisiones, pagos y clientes sin cambios. No publicación.

## Reproducción y rollback

`npm ci`; `npm run build:css`; `npm run check:js`; `node --test tests/*.test.mjs tests/*.test.cjs`.
QA DOM: instalar linkedom en directorio temporal, luego `NODE_PATH=/tmp/pth-ranking-qa/node_modules node tests/ranking-dom-qa.cjs`.

Aplicar el patch entregado solo sobre la base indicada, tras revisión. Rollback con revert del commit de frontend que se apruebe; la entrega actual no modifica main ni despliega. El ZIP incluye patch, fuentes nuevas y este informe. No está listo para publicación hasta resolver revisión visual y decidir alcance backend pendiente.
