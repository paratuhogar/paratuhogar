# Candidato preventivo de acceso por teléfono

Base: `a3557a90aa2f8705ccdfebaa573e3a680d8dd7e3`, main verificado mediante GitHub y fetch el 10 de octubre de 2026. Checkout aislado en `2026-10-10/task-2/candidate`, rama `fix/login-phone`. No se encontró AGENTS.md en el repositorio ni en sus directorios antecesores.

Autorización: implementar código y pruebas; publicación pendiente. No se consultaron cuentas, contraseñas ni sesiones reales, ni se modificó Supabase. La referencia de producción recibida es secure-data v29; debe revalidarse antes de publicar.

## Diseño y límites

El formulario recomienda el teléfono registrado, manteniendo el campo de texto y el acceso por nombre. Explica que un teléfono cubano admite ocho dígitos, +53 y espacios. La etiqueta está asociada al campo y la ayuda mediante aria-describedby.

El servidor añade la misma recomendación de teléfono al error genérico de credenciales inválidas, ausentes y ambiguas. No devuelve una señal especial de duplicidad ni cuenta, estado o número de coincidencias. No elige una cuenta activa frente a otra bloqueada. El usuario puede reintentar con teléfono y contraseña.

La selección por credenciales, bloqueo, rate limit, permisos, sesiones y normalización permanecen intactos. La ambigüedad se evalúa entre cuentas que coinciden con la contraseña suministrada, como antes: nombres iguales con contraseñas distintas pueden seguir accediendo por nombre. Detectar colisiones globales exigiría cambiar la consulta y sus costes y no forma parte de este candidato mínimo. Un teléfono duplicado con las mismas credenciales sigue rechazándose.

No se cambian teléfonos guardados ni se amplía el soporte de teléfonos extranjeros. Se verifica que un teléfono extranjero conserva su valor al acceder por nombre y que no se confunde con uno cubano. El diagnóstico de la incidencia real sigue siendo plausible, no demostrado con credenciales reales.

## Verificación

- Regresión antes del cambio: el caso ambiguo falló porque el mensaje no orientaba al teléfono; los otros 17 casos pasaron.
- Casos nuevos: 21 pruebas con fixtures. Cubren tildes, nombre único y primer nombre, duplicados activos/bloqueados, nueve combinaciones de teléfono cubano, teléfono duplicado, contraseña errónea, usuario inexistente, formatos extranjeros preservados, sesión y ambos límites de intentos. Solo se crean sesiones sintéticas.
- Suite completa: `node --test tests/*.test.mjs tests/*.test.cjs`, 580 pruebas, cero fallos ni omitidas.
- `npm run check:js`, `npm run check:guide`, sintaxis del handler y `git diff --check`: correctos. No cambia JS de frontend; los bundles existentes pasan su comprobación de coherencia.
- `node tests/login-phone-browser.mjs`: Chrome PASS, perfil temporal y tráfico localhost ficticio; ayuda accesible, nombre ambiguo, tres formatos cubanos, restauración y perfil offline. No verifica layout visual ni el formulario completo. El harness adapta el origen de su puerto aleatorio al origen localhost permitido; no cambia CORS del servidor real.
- Revisión independiente: sin bloqueantes; revisión del diff y harness, más 107 pruebas focalizadas. La ejecución Chrome y la suite completa corresponden al implementador.

No se instalaron paquetes: se reutilizó node_modules de un checkout anterior. No se usaron Docker ni PostgreSQL local. La primera suite falló por dependencias ausentes, y pasó al reutilizar las existentes. La primera ejecución Chrome detectó un origen CORS incorrecto del harness; se corrigió únicamente ese harness.

La evidencia actual se entrega en los archivos hermanos `login-red.txt`, `suite-full.txt` y `browser.txt` del directorio task-2. Los logs históricos de evidence/ no corresponden a este candidato.

## Publicación y rollback

No hubo push, PR, merge ni despliegue. Antes de publicar, obtener aprobación específica, revalidar main y secure-data vigente y preservar el bundle completo desplegado y su configuración. Publicar index.html y el handler conjuntamente; no cambiar configuración JWT, secretos ni archivos ajenos del bundle. No requiere migraciones ni cambios de datos.

Rollback local: revertir exclusivamente el commit del candidato. Rollback web: restaurar index.html de la base aprobada, preservando cambios posteriores ajenos. Rollback de secure-data: desplegar nuevamente el bundle previo preservado con su configuración exacta; se creará una versión nueva, no se asume selección directa de v29. No revocar sesiones ni modificar datos. El rollback vuelve al error genérico sin recomendación de teléfono.
