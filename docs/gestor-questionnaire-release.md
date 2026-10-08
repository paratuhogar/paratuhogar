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

- `node --test tests/*.test.*`: 499 pruebas pasan, cero fallos.
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
- Chrome falló dos veces con «Unable to load browser request-header policy».
  **No hay capturas ni verificación visual real móvil/escritorio/teclado.**
- SQL ejecutado exactamente como propuesto en PGlite 0.5.8 / PostgreSQL 18.3
  embebido local, con 17 comprobaciones correctas; evidencia en
  `evidence/sql-local-verification.txt`. Incluye handler real con adapter local.
  No hay Postgres/psql/Supabase CLI nativos; Docker no tiene daemon activo.
  PGlite tiene una única conexión exclusiva: dos llamadas simultáneas del handler
  prueban convergencia e índice, **no carreras MVCC con sesiones independientes**.
  Supabase de producción usa PostgreSQL 17: compatibilidad/deploy/REST y concurrencia
  multisesión todavía requieren un staging autorizado.
- Inventario conectado: solo `paratuhogar` está activo y es producción.
  `paratuhogar-v2` y el proyecto genérico están INACTIVE, sin autorización de
  staging ni coste confirmado. No se reactivaron ni se creó infraestructura.
  No se repitió Chrome en esta continuación ni se consultó/mutó producción.
- Lectura de metadatos de producción confirmó columnas ausentes, RLS activo,
  grants de tabla únicamente postgres/service_role; no se consultaron respuestas
  ni datos personales de solicitantes. Comprobar también grants de columna antes
  de publicar, y no ampliar acceso si difieren.

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

## Reproducir SQL local sin infraestructura ni credenciales

Se instaló únicamente un paquete de pruebas en `/tmp`; no se añadió dependencia
a `package.json` de la aplicación ni se iniciaron servidores externos. Los roles
`anon/authenticated/service_role` del fixture son NOLOGIN y no tienen contraseñas.
Los nombres, teléfonos y valores de contraseña del fixture son cadenas ficticias;
no constituyen cuentas ni credenciales de servicios.

```sh
npm install --prefix /tmp/pth-questionnaire-pg --cache /tmp/pth-questionnaire-npm-cache --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
PTH_PGLITE_MODULE=/tmp/pth-questionnaire-pg/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-questionnaire-sql.mjs
```

El script ejecuta el SQL, las restricciones y la retirada opcional solamente en
una base efímera en memoria; la cierra al finalizar. La retirada que borra las dos
columnas fue comprobada con datos desechables y **no es el rollback recomendado
para producción**. En producción se conservan las respuestas.

## Esquema y publicación, solo después de aprobación

1. Revisar este candidato y SQL `supabase/proposals/gestor-questionnaire.sql`.
   Añade dos columnas anulables (`questionnaire jsonb`, `application_token uuid`),
   check de objeto/versión/tamaño e índice único parcial de token. Sin backfill,
   sin cambios de grants/RLS y sin alterar filas antiguas.
2. En staging aislado con fixtures, ejecutar SQL y verificar constraints,
   duplicados concurrentes, idempotencia, compatibilidad con registros legacy,
   errores de esquema faltante y acceso denegado a anon/authenticated por REST.
   Confirmar que el gateway actual usa service_role y proyecta solo al admin.
3. Resolver Chrome y abrir demo local: `node scripts/questionnaire-demo.cjs`,
   `python3 -m http.server 8080 --bind 127.0.0.1`, luego
   `http://127.0.0.1:8080/evidence/questionnaire-demo.html`.
   Revisar 375×812 y 1280×900: desplazamiento completo, condicionales, labels,
   foco/teclado, legibilidad, envío y grupos administrativos. Solo fixtures.
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
8. Verificar recepción únicamente en staging; en producción realizar solo
   comprobaciones de lectura/autorizadas, sin crear solicitudes ni decidir.

## Rollback

Guardar SHA anterior y artefacto Edge anterior antes del despliegue. Restaurar
frontend/worker y Edge anteriores mediante commits de reversión/pipeline
existente, sin reset destructivo ni cambios a decisiones. Mantener columnas
anulables e índice: el código anterior los ignora y conserva respuestas nuevas.
SQL incluye procedimiento opcional de retirada, **solo después de backup privado
aprobado y decisión de retención**; eliminar columnas borraría respuestas. No
es necesario eliminarlas para rollback funcional. No cambiar grants ni roles.
