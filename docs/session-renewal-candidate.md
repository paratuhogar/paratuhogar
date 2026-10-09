# Sesiones de gestores: 30 días con renovación por actividad

Estado al finalizar la implementación: candidato local verificado. Publicación autorizada el 9 de octubre de 2026. Versión de recursos: `20261009-session1`. Base de implementación: `9b7fad280338e64f80a4d36f459074483b526600`. No modifica precios, comisiones, contraseñas, roles ni datos reales.

## Comportamiento

- Gestores y subgestores reciben una sesión de 30 días al entrar. Una operación autenticada válida renueva el plazo a 30 días desde ese momento, como máximo una vez al día.
- Las sesiones antiguas que todavía sean válidas se amplían al utilizarlas. Las ya vencidas requieren entrar de nuevo una vez: no se recuperan automáticamente.
- Administradores mantienen 7 días; mensajeros mantienen su plazo actual de 1 día. La copia preparada para trabajar sin conexión conserva su límite independiente de 7 días.
- El servidor comprueba vencimiento, bloqueo, cuenta deshabilitada, contraseña cambiada y principal activo antes de renovar. La actualización condicional no recrea sesiones eliminadas o revocadas.
- Un error de infraestructura conserva el comportamiento `503`, sin ejecutar operaciones protegidas ni cerrar una sesión por una caída temporal.
- El navegador guarda la expiración confirmada por el servidor. Una respuesta tardía no reduce el plazo del mismo token ni restablece una sesión cerrada.
- Con conexión, la expiración muestra el acceso con un aviso claro, también después de cerrar y volver a abrir la página y cuando haya una copia offline preparada. Un indicador booleano separado por tipo de sesión conserva el aviso, sin identidad ni autoridad. Se elimina al entrar correctamente o cerrar sesión manualmente.
- Los pedidos ya pendientes se conservan aislados para su cuenta original; no se envían sin volver a autenticarse. Si no hay copia offline válida, se ocultan sus detalles. Una copia offline válida conserva únicamente el modo local ya existente. La configuración protegida no se consulta sin token. Cerrar sesión manualmente mantiene la limpieza anterior.

## Verificación

- Pruebas de regresión creadas antes de los cambios, con fallos observados y corregidos.
- Suite Node: 555/555, sin fallos ni pruebas omitidas.
- `npm run check:js`, `npm run check:guide` y `git diff --check`: correctos; bundle generado con `npm run build:js`.
- Chrome real con respuestas y base sintéticas: renovación, aviso, rechazo de guardado sin sesión, conservación de pedido original y nuevo login para gestor y subgestor.
- Chrome: fallos de consulta de sesión, perfil, principal y mensajero conservan credenciales ante `503`; recuperación sin login y rechazo de `401/403` reales verificados.
- Prueba completa de pedidos pendientes en Chrome y prueba focal final de arranque con/sin copia offline: confirmaciones independientes, respuesta perdida sin duplicación, formulario/carrito conservados, revisión de entrega, rechazo de almacenamiento, expiración y aislamiento de pendientes. Todo el tráfico usa datos simulados.
- Revisión independiente: corregidas regresiones de aviso al arrancar, respuestas de refresh fuera de orden y referencias de caché; sin bloqueos críticos o importantes restantes.

No se probó en el teléfono afectado ni se modificó producción durante la implementación. El procedimiento de publicación actualiza tanto la función `secure-data` como los recursos web. Antes del despliegue, verificar `main` y el bundle vigente de la función, preservar el bundle completo y su configuración, e integrar solo el handler revisado. No cambiar opciones JWT, secretos, dependencias u otros archivos de la función. No requiere migración de base de datos.

Rollback: restaurar los recursos web y el bundle previo de la función. Las sesiones ya emitidas con 30 días no se acortan automáticamente al revertir el código; revocarlas sería una operación independiente que necesita autorización.
