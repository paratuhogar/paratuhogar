# Candidato: cuestionario de solicitud de gestor

Base aislada: `origin/main` 76dce7ad6f01342893a264d8406f078c3bcdd1ae.
Rama local: `candidate/gestor-questionnaire`. No se publicó ni se aplicó SQL.
Autorización recibida: diseño aprobado por Marcel el 8 de octubre de 2026,
mensaje Sentinel_09af18cef5b48191852784648b27d57f. Cubre implementación y pruebas.
No existe AGENTS.md aplicable ni `.agents/skills` en este checkout; se revisaron
instrucciones y tests presentes. Los checkouts históricos permanecen intactos.

## Comportamiento

Cuestionario para solicitantes principales en el registro existente. Mantiene
el flujo invitado de subgestores. Condicionales para recomendación, origen otro,
tiempo de experiencia, canales y otras tiendas. Referente opcional, opción
«No sé», experiencia «No», cero clientes y cero tiendas aceptados. No hay
puntuación, exclusión automática ni decisiones sobre solicitudes.

Cada solicitud pendiente conserva nombre, fecha y contacto existente. Respuestas
agrupadas desplegables; etiqueta «Solicitud anterior al cuestionario» cuando
faltan. Se conserva paginación completa, incluyendo meses anteriores.
No se modificó la sección de lista negra ni las acciones de aprobación/rechazo.

Validación compartida entre navegador y Edge; respuestas como texto, nunca HTML.
Solo los administradores existentes reciben respuestas. No se alteraron roles,
permisos, autenticación, precios, comisiones, pagos o pedidos. La versión de
caché pública y su comprobación de compatibilidad se avanzan juntas para que
un worker antiguo no sustituya el formulario nuevo por una mezcla de versiones.

El botón impide doble envío concurrente. Una clave UUID por intento y un índice
único evitan duplicar la solicitud al reintentar una respuesta perdida. La clave
solo vive en memoria: tras recargar, un teléfono ya registrado produce un aviso
para contactar administración, sin modificar la solicitud existente. Se guardan
respuestas y clave en el mismo insert. Legacy clients siguen funcionando sin
cuestionario; nunca se convierte una solicitud pendiente en activa.

## Evidencia y límites

- `node --test tests/*.test.*`: 501 pruebas pasan, cero fallos.
- `npm run check:js`: pasa; bundles regenerados.
- `npm run build:css`: compilación; revisar salida en evidence/css-build.txt.
- `npm run check:guide`: salida en evidence/guide-check.txt.
- Tests específicos: validación y condicionales, novato sin referente, otras
  tiendas, doble clic, error y reintento de respuesta perdida, insert atómico,
  token diferente rechazado sin duplicar, datos privados y filtros, renderer
  de solicitudes antiguas y texto malicioso. Tests existentes cubren 1201
  solicitudes y fallos de páginas sin publicar un listado parcial.
- `evidence/independent-review.md`: revisión externa y resolución de hallazgos.
- `evidence/questionnaire-demo.html`: fixture local generado desde código real,
  sin SDK, fetch ni backend. No se enviaron solicitudes reales ni mensajes.
- Demo aislada revisada en navegador integrado: formulario de 375 px y escritorio
  de 1280 px, condicionales, envío ficticio, agrupación administrativa, etiqueta
  antigua y un avance de foco por Tab. Capturas en evidence/questionnaire-mobile.jpg
  y questionnaire-desktop.jpg; no prueban el modal completo de producción.
- Modal real: se reprodujo recorte superior a 1280×720 antes del arreglo. Se cambió
  justify-center por justify-start conservando my-auto. La verificación visual
  posterior está pendiente: navegador y reset devolvieron `Transport closed`.
  questionnaire-modal-before-fix-1280x720.jpg documenta únicamente el fallo previo.
- Evidencia histórica: 17 comprobaciones en PGlite/PostgreSQL 18.3 antes de la
  restricción actual. No certifica PostgREST, despliegue Edge ni carreras MVCC.
  No se ejecutó Docker ni PostgreSQL local en esta continuación.
- Lectura de metadatos de Supabase: PostgreSQL 17.6; columnas propuestas ausentes;
  RLS activo, grants de tabla solo postgres/service_role, sin grants de columna
  para anon/authenticated. No se consultaron datos personales ni se escribió.
  Véase evidence/supabase-schema-readonly.md.
- La integración real SQL + Edge + REST permanece sin probar: requiere cambios
  que todavía no están autorizados en producción. No se crea otro entorno.

Dependencias de pruebas copiadas al checkout desde node_modules histórico ya
instalado; `npm ls --depth=0` sin errores. Para reproducir desde cero: `npm ci`.
Dos copias del validador son intencionales para empaquetado Edge; un test exige
igualdad byte por byte. Actualizar ambas juntas.

## Almacenamiento privado y alcance del despliegue

Las respuestas se almacenan en la misma fila de `public.gestores`, como JSONB
versionado, junto a la clave UUID del intento. `created_at` y WhatsApp son los
campos existentes, no copias ni datos de terceros. No se añaden tablas, Storage,
URLs públicas ni índices sobre respuestas. No se cambia la autorización de
administradores: `secure-data` usa su service_role existente y solo los actores
administradores actuales reciben `questionnaire` al consultar solicitudes.
Los demás actores no reciben respuestas; login/restauración las elimina incluso
para el propio solicitante. La clave `application_token` se elimina de toda
proyección, también administrativa. Filtros/ordenación privados se rechazan.

En el navegador las respuestas viven en el formulario; no se guardan en
localStorage/sessionStorage. La clave del intento vive en memoria. El schema
no cifra específicamente este campo: su privacidad depende de los grants
existentes y el gateway, como el resto de la tabla protegida. RLS/grants no se
cambian. Los tests locales simulan ese modelo; no certifican una configuración
remota que pudiera cambiar posteriormente.

**Publicación exige tres piezas: SQL + Edge Function `secure-data` + Pages.**
Solo publicar Pages perdería las respuestas porque el backend anterior descarta
campos adicionales. No hay nuevas Edge Functions, secretos o variables de entorno;
se redepliega la función existente con handler/policy y el validador nuevo.
No cambia `index.ts` ni el mecanismo de autenticación. Se requieren además los
assets frontend y versiones de worker compatibles.

## Esquema y publicación, solo después de aprobación

1. Revisar este candidato y SQL `supabase/proposals/gestor-questionnaire.sql`.
   Añade dos columnas anulables (`questionnaire jsonb`, `application_token uuid`),
   check de objeto/versión/tamaño e índice único parcial de token. Sin backfill,
   sin cambios de grants/RLS y sin alterar filas antiguas.
2. Completar la revisión visual del modal real con fixtures al reconectar el
   navegador integrado. Generar con `node scripts/questionnaire-demo.cjs` y servir
   desde localhost; abrir evidence/questionnaire-modal-demo.html a 375×812 y
   1280×900. Revisar desplazamiento superior/inferior, teclado y reintento.
3. Revisar el límite de integración pendiente y aprobar explícitamente SQL y
   publicación por el flujo existente de Supabase; sin Docker, PostgreSQL local,
   nuevas credenciales ni otro entorno. La sintaxis propuesta usa funciones
   compatibles con PostgreSQL 17.6; esto no sustituye ejecución real.
4. Revalidar main remoto y conciliar nuevos cambios sin sobrescribir trabajo.
   Repetir tests/build. Obtener aprobación de publicación y migración.
5. Antes de SQL productivo, verificar backups existentes y exportación privada
   aprobada del esquema. Aplicar SQL revisado con la conexión existente.
6. Desplegar `secure-data` incluyendo questionnaire-validation.js primero,
   mediante el procedimiento existente y credenciales ya configuradas. No crear
   claves. Viejo frontend sigue compatible. Confirmar acceso sin datos reales.
7. Publicar frontend por el flujo habitual de main/GitHub Pages, con bundles,
   CSS, validador y worker/versiones coordinados. Nunca desplegar frontend nuevo
   antes de backend y columnas. No publicar fixtures/evidence como páginas
   enlazadas al producto ni usarlos para solicitudes reales.
8. En producción realizar solo comprobaciones de lectura autorizadas, sin
   crear solicitudes reales ni decidir sobre solicitantes. Observar errores del
   flujo normal y revertir frontend/Edge si aparecen, conservando respuestas.

## Rollback

Guardar SHA anterior y artefacto Edge anterior antes del despliegue. Restaurar
frontend/worker y Edge anteriores mediante commits de reversión/pipeline
existente, sin reset destructivo ni cambios a decisiones. Mantener columnas
anulables e índice: el código anterior los ignora y conserva respuestas nuevas.
SQL incluye procedimiento opcional de retirada, **solo después de backup privado
aprobado y decisión de retención**; eliminar columnas borraría respuestas. No
es necesario eliminarlas para rollback funcional. No cambiar grants ni roles.

## Acceso administrativo explícito — 8 octubre 2026

Ubicación: iniciar sesión con una cuenta administradora existente → Master Control
→ Solicitudes de gestores → «Ver respuestas» en la fila del solicitante. La tarjeta
«Revisar solicitudes» también abre esta pestaña. Respuestas debajo de esa misma
solicitud, con nombre, fecha y contacto existentes. Solo principales pendientes;
no se añade una vista de encuestas a gestores activos. Solicitudes sin respuestas
conservan «Solicitud anterior al cuestionario». La mejora añade el botón, su
estado accesible y una instrucción visible, sin cambiar Activar/Rechazar.

502 tests pasan, check:js y revisión independiente sin hallazgos bloqueantes.
Fixture generado desde markup y renderer reales mediante
`node scripts/admin-questionnaire-demo.cjs`, sin SDK, sesión ni conexiones.
Navegador integrado verificó el acceso por pestaña, siete grupos del solicitante,
solicitud de julio, apertura/cierre por Enter, 1280 px y 375 px. Capturas
`evidence/admin-questionnaire-desktop.jpg` y `admin-questionnaire-mobile.jpg`.
La página móvil tiene scrollWidth 375; tabla 417 dentro de viewport 325, con
desplazamiento horizontal existente. No se verificó sesión administrativa real
ni se consultaron solicitantes reales. Permisos/roles/grants/RLS intactos.

Rollback de esta mejora: revertir este commit de frontend, manteniendo la primera
publicación y todas las respuestas en Supabase. Sin nueva migración ni redeploy Edge.
