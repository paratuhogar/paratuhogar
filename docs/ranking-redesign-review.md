# Ranking: cambios preparados para revisión, sin publicar

Base main remoto verificado: `e0e493405c10fcc301161043305702f6cd644810`. Rama `ranking-redesign` en copia aislada `/Users/marcel/Documents/Codex/2026-10-04/task/paratuhogar`. Checkout original limpio y sin modificar. No hay AGENTS.md ni .agents/skills en este checkout.

Referencia Library `libfile_46e76e0af6f881918f03b5d0acf924bb` materializada en este Mac y píxeles inspeccionados. Implementación UI autorizada en Sentinel_3e63f0154f40819182807082dab6601f. Ampliación backend autorizada en Sentinel_4c0301415144819180a2b0f93cd8aa4d, 2026-10-04 10:19 UTC.

## Interfaz

Cima azul/dorado, corona y reconocimiento equivalente para empates. Con backend antiguo declara selección parcial; con `leaderCount` indica total y cuántos aliases muestra. Todos los líderes conservan puesto #1 en su tarjeta personal aunque su alias no esté en top3. Cero sin puesto, metas 1/3/5, distancia exacta con `self.nextHigherCount`; fallback prudente con vecinos si aún no está desplegado.

Podio y vecinos compactos, reglas plegables y avisos de exclusiones accesibles. Admin no participa ni ve “tus entregas”. Historial de seis meses cerrados y hasta tres aliases por mes, con total de empatados; insignias propias. No hay premios económicos. PNG por pulsación explícita, marcado provisional; no envío automático. Hitos observados primera/3/5/podio/liderazgo, sin repetición por navegación/refresh; identidad fiable en ambos snapshots; sin sonidos ni modales.

Mes y cierre Havana; días calendario restantes excluyen el día actual, con Último día en cierre. Caché de memoria no suprime recarga después del cierre; actualización/retorno carga nuevo mes. Recursos estáticos versionados; datos privados no se cachean.

## Backend preparado, NO aplicado

Migración generada por CLI oficial: `supabase/migrations/20261004102540_monthly_ranking_recognition.sql`.

- Nueva tabla `private.ranking_monthly_results`: mes único, límites de periodo, cierre, fiabilidad y todos los ganadores empatados `{id,alias,count}` internamente. RLS habilitado sin políticas cliente. Revoca todos los privilegios de tabla a PUBLIC/anon/authenticated/service_role; devuelve únicamente SELECT/INSERT al servicio. USAGE del schema para servicio; no revoca ni modifica acceso de objetos privados existentes.
- `public.pth_finalize_monthly_ranking(text)`: SECURITY INVOKER, EXECUTE solo service_role. Servidor controla fecha; rechaza mes abierto o anterior a noviembre 2026. Exige trigger prospectivo activo; valida fechas/atribución relevantes del mes; ventas directas sin vendedor colaborador quedan fuera del concurso. Advisory lock y clave única hacen cierre idempotente; sin UPDATE/DELETE ni endpoint genérico de cierre. No cron.
- Amplía `public.pth_ranking_summary(uuid)` manteniendo autorización y agregación previa: `leaderCount`, `self.nextHigherCount`, historial <=6 meses con <=3 aliases por mes, insignias propias <=120. Nunca UUID ajeno histórico ni filas de pedidos/clientes/dinero. `ranking.mjs` valida y proyecta estrictamente estos campos, compatible con respuesta antigua.

No se alteran pedidos, trigger existente, auth, permisos de tablas anteriores, precios, comisiones, pagos o clientes. No se completan fechas históricas. Ninguna escritura remota ni cierre real ejecutado.

## Condiciones antes de un cierre real

Noviembre es primer candidato, no ganador automático. El operador debe comprobar cobertura prospectiva completa, fechas, atribución, trigger vigente y elegibilidad en el momento de adjudicación. La función usa estado/activo y nombres actuales, igual que el ranking existente; la base actual no conserva un snapshot de elegibilidad al último segundo del mes. Cambios posteriores de nombres/estado antes de ejecutar cierre pueden cambiar candidatos. Si no se puede verificar esa elegibilidad, NO ejecutar el cierre. No se inventan estados históricos. Los resultados, una vez cerrados, no se recalculan.

SQL valida integridad observable, pero no sustituye esa comprobación de cobertura/eligibilidad. Antes de despliegue revisar permisos/advisors del proyecto real y verificar fuentes Edge existentes para preservar autenticación y archivos no relacionados. Este paquete no despliega.

## Verificación

- Ejecución anterior 404/404; última general 403/404 por prueba existente intermitente de checkout `duplicate explicit saves and concurrent tabs retain one stable intent and single active lease` (INVALID_INTENT). Mezcla `setup()` con reloj congelado y `Date.now()` posterior, que puede superar ese reloj por 1 ms. Los dos archivos de checkout son idénticos a main y no se modificaron. Una ejecución previa de esta sesión tuvo dos fallos del mismo patrón. Ranking y cache específicos: 15/15. Logs incluidos, sin ocultar este límite.
- QA DOM con Linkedom: gestor/subgestor/admin por representación, cero, líder único, empates, top3/vecinos, texto seguro, hitos una vez, lecturas concurrentes, CTA y limpieza; historial/insignia y nuevo total/gap.
- SQL local: 34 comprobaciones en PostgreSQL embebido 17.5 y 18.3. SQL productivo probado con reloj real para rechazar octubre/mes abierto; solo literales de reloj sustituidos en una instalación local aislada para ejercitar noviembre cerrado y meses posteriores. No parámetro/GUC/override de reloj en producción. Roles/RLS, servicio sin UPDATE/DELETE, fechas inválidas, identidad ambigua, ventas directas excluidas, todos los empatados, cierre repetido, fold Havana, seis meses/tres aliases y badges propios.
- Build CSS, check JS generado, sintaxis y diff --check correctos.
- Revisión independiente: corrigió celebración por cambio de fiabilidad y bloqueo de cierres por Venta Directa, ambos reproducidos con test antes de corregir.

## Navegador y capturas

Chrome instalado lanzado con Playwright desde terminal terminó SIGABRT. No se reparó ni cambió configuración. Chrome por extensión SÍ abrió la pestaña local de QA mediante cua_repl. El primer ERR_CONNECTION_REFUSED fue servidor bloqueado por sandbox; el arranque autorizado fuera del sandbox resolvió el servidor, sin cambios del Mac.

Capturas reales del componente productivo con fixtures etiquetados: 320/390 y 1440 px; cero, líder único, 1/1/3, cuatro líderes, vecinos, admin/subgestor e historial/insignia ficticios de noviembre con reloj DEMO 3/12/2026. Medición de scrollWidth igual a viewport en 320 y 390. PNG descargado 1080x1080 y píxeles revisados.

Rama CSS de movimiento reducido comprobada en navegador como `animation:none`, activando en fixture la rama exacta del stylesheet bajo `@media all`. Preferencia real del Mac seguía false; no se cambió ni se afirma prueba end-to-end de esa preferencia. Animación normal y eliminación de aviso al refrescar también comprobadas.

Storefront completo local usa index/CSS/JS productivos con SDK/respuestas de datos ficticios y CSP connect-src self. CTA Preparar próxima venta abrió compositor real; retorno a dashboard conservó ranking; Crear pedido con carrito vacío abrió catálogo. Sin pulsar envío/WhatsApp ni registrar pedidos reales. Evidencia integrada por roles guardada aparte; no confundir fixture aislado con integración.

## Reproducción y rollback

`npm ci`; `npm run build:css`; `npm run check:js`; `node --test tests/*.test.mjs tests/*.test.cjs`.
DOM: instalar Linkedom externo y `NODE_PATH=/tmp/pth-ranking-qa/node_modules node tests/ranking-dom-qa.cjs`.
SQL: instalar `@electric-sql/pglite@0.3.14` externo y `NODE_PATH=/tmp/pth-ranking-db17/node_modules node tests/ranking-db-qa.cjs`.
Componente: `python3 -m http.server 8765 --bind 127.0.0.1`; URL `/qa/ranking/`.
Integración: `python3 qa/ranking/server.py`; URL `http://127.0.0.1:8766/?role=gestor` (también admin/subgestor).

Rollback frontend: revert de los commits preparados. Backend no aplicado: basta no aplicar migración. Si se aplica después, rollback debe restaurar summary original y retirar acceso al finalizer, conservando resultados fiables ya registrados; no borrar fechas ni resultados legítimos. Los archivos QA solo son fixtures, no una nueva funcionalidad pública.
