# Captación de gestores · 16 octubre 2026

Base verificada local y remotamente: a9bac193f41bd69978399b9d9d3b71db8592ebcc.
Rama aislada: mejora/gestores-captacion-20261016. No existe AGENTS.md en /workspace.
Se revisaron docs/gestor-questionnaire-release.md y procedimientos de privacidad.
Autorización: mejoras 1, 2, 3 y 5, Sentinel_0530cd05f1b48191ba272be7ad93d4b2.
Publicación autorizada posteriormente por Marcel, Sentinel_d35087b42dd88191b314db852809e914.

Encabezado explica venta desde teléfono, comisión por venta entregada, catálogo,
enlace personal, herramientas y ausencia de inventario comprado. CTA solicita
acceso gratis. Panel fijo identificado como ejemplo con importes/métricas
ilustrativos. Cinco pasos conservan inputs originales, condicionales y validador
compartido: contacto, origen, experiencia/clientes, canales/tiendas, revisión.
El resumen usa el renderer administrativo existente, sin contraseña. Invitaciones
conservan formulario original. No se cambia backend, autenticación, permisos,
schema, almacenamiento, aprobación manual ni processRegister. WhatsApp sigue
preparándose solo después del insert confirmado y no se envía automáticamente.

## Fuentes de ejemplos

Lectura autorizada, 16 octubre 2026, proyecto existente ParaTuHogar
ljqwaovevfatkiigirhf, public.productos. Solo columnas de producto; ningún dato de
personas, sesiones, pedidos ni proveedores suspendidos. Filtro disponible='SI',
precio/comision positivos y exclusión normalizada de Casa Nativa, VoyPaTi, Fadiar
y Express Solution. No se consultaron sus servicios. No se usó proyecto v2.

| Producto | Precio USD | Comisión base del gestor USD |
| --- | ---: | ---: |
| Arrocera Decakila – 1 litros con vaporera | 28 | 5 |
| Arrocera Decakila – 1.8 litros con vaporera | 36 | 5 |
| Backups - Marsriva 1000VA/600W | 130 | 5 |

Los tres tenían disponible='SI' y precio_flexible='SI'. `projectRow` y
`calculateSale` en supabase/functions/secure-data/policy.mjs mantienen `comision`
para gestor principal: al precio base no hay ajuste; se trata de la comisión del
gestor, no una comisión del sistema. La asignación del subgestor es distinta.
La moneda USD está confirmada por las fichas oficiales de esos productos.
No se modificó ningún precio/comisión. No se afirman plazos ni medios de pago.
Estos datos son una instantánea fechada; disponibilidad futura puede cambiar.

## Verificación

- 621 tests Node: pasan todos. `node --test tests/*.test.*`.
- `npm run build:js`, `npm run check:js`, `npm run build:css`: pasan.
  CSS reproducible sin cambios; aviso no bloqueante de Browserslist antiguo.
- Caché pública, lector de compatibilidad, referencias de bundles y tests
  coordinados con 20261016-captacion1. El cuestionario compartido queda intacto.
- Revisión independiente: detectó reapertura e invitación URL; corregidos.
  Revisión posterior: 36/36 tests, sin nuevos bloqueos de código.
- Chromium local a 375 y 1280 px: contenido de landing sin overflow, pasos,
  obligatorios, recomendación opcional/No sé, experiencia, cero clientes,
  grupos/tiendas, resumen, volver sin perder datos, reapertura y guardado mock.
  Invitación URL sin storage mantiene envío original. No solicitudes ni pedidos
  reales; no mensajes enviados. Fixtures con SDK/backend removidos y connect-src
  none. Fuentes externas bloqueadas: iconos muestran texto de respaldo; imágenes
  de catálogo ausentes en este checkout no acreditan carga de fotos productivas.
- Evidencia local fuera del sitio: /workspace/pth-delivery/evidence; capturas y
  browser-results.txt. Scripts de fixture: scripts/questionnaire-demo.cjs.
  Evidencia histórica del repo no sustituida ni añadida como landing pública.
- Instalación inicial npm falló por caché /home/agent/.npm no escribible;
  `npm ci --ignore-scripts --cache /tmp/pth-npm-cache` completó correctamente.
- Consulta read-only `gh api repos/paratuhogar/paratuhogar/pages` rechazada con
  `Forbidden`. No se cambió de vía para eludirlo; estado Pages pendiente.

## Rollback

Revertir el commit de esta mejora mediante `git revert <SHA_DEL_CAMBIO>` y push
normal por el flujo existente. Conserva registros y respuestas porque no hay
migración ni cambio Edge. Base anterior arriba; no usar reset/force push.
El parche y el SHA final se entregan fuera del sitio en /workspace/pth-delivery.
