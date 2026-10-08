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
- SQL no ejecutado en base local: no hay Postgres/psql/Supabase CLI disponibles.
  **Constraints/índice y carreras reales de Postgres requieren staging aislado.**
- Lectura de metadatos de producción confirmó columnas ausentes, RLS activo,
  grants de tabla únicamente postgres/service_role; no se consultaron respuestas
  ni datos personales de solicitantes. Comprobar también grants de columna antes
  de publicar, y no ampliar acceso si difieren.

Dependencias de pruebas copiadas al checkout desde node_modules histórico ya
instalado; `npm ls --depth=0` sin errores. Para reproducir desde cero: `npm ci`.
Dos copias del validador son intencionales para empaquetado Edge; un test exige
igualdad byte por byte. Actualizar ambas juntas.

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
