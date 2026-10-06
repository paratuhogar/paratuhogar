# Candidato: conservar la sesión ante errores de consulta

Estado: verificado localmente, sin push ni despliegue. No confirma la causa del caso de Yoarlet en su dispositivo.

Base del checkout: `890134bbc40417d6c0ed718b613a806493fb735c`. Referencia de producción observada en el diagnóstico: `secure-data` versión 25. No se consultaron credenciales ni se modificaron sesiones o pedidos reales durante la implementación.

## Cambio

`handler.mjs` separa los errores devueltos o lanzados al consultar sesión, gestor, principal y mensajero de la ausencia o invalidez comprobada de esos registros. Los errores de consulta responden `503 SERVICE_UNAVAILABLE` con un mensaje genérico y detienen el flujo antes de acceder a operaciones protegidas. Una petición posterior puede verificar la misma sesión cuando el servicio se recupera.

Los casos de sesión ausente, vencida o revocada; cuenta inexistente, inactiva o deshabilitada; credencial cambiada; principal inválido y mensajero inválido conservan sus controles y `401 SESSION_INVALID`. Los permisos siguen rechazando acciones prohibidas con 403. La duración, los permisos, la revocación, las consultas de validación, la creación de sesiones y la idempotencia no cambian. No se introduce reintento automático de pedidos ni acceso alternativo sin protección.

No requiere cambios de frontend: el cliente ya conserva sus credenciales ante un 503 y permite repetir una restauración fallida. La validación del servidor se ejecuta en cada operación protegida, incluso si el cliente conserva una restauración anterior.

## Evidencia

- Pruebas nuevas antes del cambio: 12 fallos esperados; se observan 401 para errores devueltos y 403 para excepciones, en lugar del 503 requerido.
- Suite específica final: 27/27. Incluye bloqueo de lecturas/escrituras, recuperación sin login, concurrencia, red, 401/403 y pedido recuperado una sola vez con repetición rechazada por la misma restricción de clave.
- Suite Node completa: `node --test tests/*.test.mjs tests/*.test.cjs`, 489/489, cero omitidas.
- `npm run check:js`, `npm run check:guide`, comprobación de sintaxis y `git diff --check`: correctos.
- `tests/session-infrastructure-browser.cjs`: cuatro escenarios en Google Chrome del Mac con perfiles aislados, tráfico interceptado y handler/base sintéticos. Cubre sesión, gestor, principal y `mensajeros.html`; conserva credenciales ante 503, bloquea escrituras concurrentes, recupera sin login y elimina credenciales ante un 401 real. Gestores y subgestores también mantienen el rechazo 403 de una modificación de rol.
- Revisión independiente: sin hallazgos de corrección o seguridad. El revisor ejecutó 108 pruebas relevantes y, tras ampliar cobertura, 27/27 de la suite específica. Revisó el script de Chrome; su ejecución fue realizada por el implementador.

Las dependencias se instalaron con `npm ci --ignore-scripts` según el lockfile; no se actualizaron paquetes. No se repitieron todos los scripts históricos de navegador ni las suites externas de PostgreSQL. El dispositivo real sigue pendiente.

## Producción y rollback

No desplegar sin aprobación explícita. Antes de un eventual despliegue, revalidar la versión 25 o la versión vigente, conservar su bundle y metadatos completos y comparar el handler desplegado con la base del candidato. Integrar únicamente este cambio del handler en ese bundle; conservar todos los demás archivos, entrypoint, import map, opciones JWT, dependencias y secretos. Este checkout no constituye una copia verificada de todos los archivos del despliegue 25.

Rollback local: revertir únicamente el commit del candidato. Rollback de producción, si se autoriza desplegar después: volver a desplegar el bundle previo preservado con su configuración exacta, sin modificar secretos ni datos. Supabase creará una versión nueva; no asumir que puede seleccionarse el número 25 para restaurarlo. El rollback devuelve también el comportamiento defectuoso anterior ante fallos de consulta.
