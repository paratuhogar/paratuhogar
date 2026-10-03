# Recordatorios privados de solicitudes pendientes

Alcance aprobado: recordatorio diario a Ángel y escalación a Marcel para solicitudes principales pendientes de las últimas 168 horas. Marcel recibe aviso solo cuando alguna supera 48 horas. El cron existente evalúa la ventana de 08:00 a 08:59, hora de Cuba; el aviso vence a las 09:00. Cada dispositivo necesita seleccionar manualmente «Recordatorios de solicitudes pendientes» en Notificaciones. No se inscriben dispositivos ni se envían pruebas automáticamente.

La publicación es independiente de la ampliación offline y del cambio visual local del panel. Conserva pedidos, precios, comisiones, cobros, permisos de revisión y los tres canales previos. Las notificaciones contienen únicamente texto genérico y abren el panel después de validar la sesión y la autorización.

## Preparación y activación

El proyecto verificado es `ljqwaovevfatkiigirhf`, dominio `paratuhogar.org`, repositorio `paratuhogar/paratuhogar`, GitHub Pages desde `main` y la raíz. Las fuentes live anteriores son secure-data v18 y admin-push-dispatch v6, capturadas privadamente para rollback sin consultar secretos. El handler de secure-data conserva exactamente la fuente publicada antes de esta fase.

1. Aplicar `supabase/proposals/application-reminders-prepare.sql`: dos tablas con RLS, sin permisos ni políticas para PUBLIC/anon/authenticated. La configuración comienza apagada. El servicio tiene permisos mínimos para configuración y ledger; las RPC son invoker, search_path vacío y solo ejecutables por el servicio.
2. Verificar RLS, grants, restricciones, configuración apagada y cambios de advisors. Desplegar ambos Edge con las dependencias y lockfiles del commit revisado, manteniendo su autenticación personalizada actual.
3. Publicar el frontend y el worker de esta fase, versión `20261002-reminders1`, y comprobar el workflow de Pages correspondiente al commit exacto.
4. Aplicar `supabase/proposals/application-reminders-activate.sql`: revalida las dos cuentas administrativas exactas y enciende la configuración. Mantiene el cron por minuto, sin crear secretos, credenciales, Vault ni trabajos nuevos.

El ledger deduplica persona/fecha local/tipo y conserva 30 fechas locales. Cada dispositivo inscrito puede recibir su propia entrega. Se vuelve a comprobar identidad, sesión, contraseña vigente, opt-in, lease y pendientes actuales inmediatamente antes de HTTP. La aceptación del proveedor no garantiza que el sistema operativo muestre el aviso; una notificación ya aceptada no puede retirarse universalmente.

## Validación

309/309 pruebas Node integradas aprobadas. El agente verificó 14 escenarios Chromium de componente, cinco perfiles en la página, nueve interrupciones y el SQL real en PGlite, incluidas 17 revocaciones tardías y contención/restauración. La comprobación de versiones y del build de JavaScript está incluida. No se usaron clientes, pedidos, envíos ni prompts reales como fixtures.

## Rollback

Primero aplicar `application-reminders-contain.sql`: apaga únicamente los recordatorios nuevos y expira sus entregas pendientes. Conservar las dos tablas y el ledger para no perder deduplicación. Restaurar las fuentes Edge capturadas v18/v6 y revertir solo el commit frontend correspondiente sobre main actual, sin reset ni force-push. `application-reminders-restore-claim.sql` restaura la función claim previa y debe compararse con el snapshot de producción antes de ejecutarla. Los CHECK ampliados pueden conservarse; no borrar registros ni apagar los otros canales.

El estado real de migraciones, versiones Edge, commit publicado y workflow se registra en el informe privado de publicación después de ejecutar los pasos. Este documento describe el alcance y procedimiento, no acredita por sí solo un despliegue.
