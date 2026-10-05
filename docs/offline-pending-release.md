# Entrada en frío sin conexión

Después de un login real con Internet, la web habitual prepara automáticamente productos y precios, hasta 300 clientes recientes de pedidos propios, municipios/localidades y tarifas de mensajería. «Listo para trabajar sin conexión» solo aparece después de releer la copia persistida de esta cuenta y comprobar todos los recursos públicos mínimos del Service Worker. Si falta la copia, se reinicia la preparación al conectar. Si falta un recurso público, el aviso deja de declarar preparación completa.

Cerrar y reabrir la misma raíz `/`, `/index.html` o una ficha `/producto/...` permite consultar el catálogo, buscar, usar el carrito y completar el formulario habitual. No se crea otro catálogo ni se cambia el diseño familiar. La búsqueda de cliente propio completa sus campos; una entrada parcial no los reemplaza. Una tarifa ausente obliga a revisar la entrega y nunca se convierte en envío gratis.

## Identidad local y autenticación

`pth_offline_context_v1` conserva exclusivamente una identidad de presentación minimizada, durante un máximo de siete días desde la preparación. No guarda contraseñas; `__session__` es el marcador preexistente, nunca una credencial. Adoptar esta identidad no crea token ni una restauración autenticada. No amplía sesiones, permisos, RLS ni políticas del servidor.

La copia privada se limita a la cuenta y alcance de nombre/rol/parent_id preparados. No incluye agenda administrativa general, ganancias, credenciales ni datos de otra cuenta. La expiración de credenciales conserva el contexto preparado y los pendientes para redactar; al recuperar Internet se pide login de la misma cuenta. Consultas protegidas y envíos siguen pasando por el gateway y requieren sesión válida del servidor.

Cerrar sesión elimina token, sesión y contexto, borra la copia de trabajo y deja los pendientes aislados por cuenta. La marca de aislamiento `pth_pending_private_purge_v1:<owner> = 2` evita borrar sus intenciones mientras termina la limpieza. La marca antigua `1` mantiene la purga anterior para dispositivos no preparados. Una marca persistida o volátil pendiente impide uso/envío hasta completar la limpieza. No se pierde un pedido preparado silenciosamente por logout o cambio de cuenta; se recupera al volver a entrar en su misma cuenta. Los campos aún sin guardar y el carrito también usan claves por cuenta con vencimiento de siete días; no se adoptan datos de cliente de las antiguas claves globales en una cuenta nueva.

## Pedidos y recepción

El formulario puede guardar hasta 25 pedidos independientes por cuenta/dispositivo. «Guardado» significa persistido localmente, no recibido. Con la página abierta o reabierta, cada reintento vuelve a verificar sesión y permisos del mismo actor antes del checkout. No se envía un borrador no confirmado ni se interrumpe el formulario que la persona esté editando.

La misma intención y el recibo firmado preexistentes conservan idempotencia ante respuestas perdidas, reintentos y dos pestañas. Cada referencia aparece solo tras confirmación real del servidor. Cambios de productos, precios o mensajería exigen revisión. SESSION_CHANGED, SESSION_INVALID y SESSION_EXPIRED conservan la intención para reautenticación. Los datos del pedido se minimizan al confirmar/cancelar; la retención máxima preexistente de pendientes es siete días.

## Almacenamiento y límites

- Primer acceso en dispositivo/navegador nuevo requiere Internet. La misma URL y el mismo perfil del navegador deben conservar sus recursos y almacenamiento.
- IndexedDB guarda copia propia y cola separadas por cuenta. Cache Storage solo contiene shell, SDK, scripts, estilos y miniaturas públicas, nunca API, credenciales, reportes ni paneles privados.
- El navegador puede desalojar almacenamiento. Si falta la copia o el shell no se muestra disponibilidad completa; no puede recuperarse un pedido cuyo almacenamiento el usuario o navegador haya borrado.
- No hay garantía de envío con la web cerrada ni ejecución en segundo plano del sistema operativo. Fotos no guardadas y herramientas secundarias necesitan conexión.
- La copia usa el máximo local de siete días ya existente, separado de la fecha de sesión. Los importes finales siempre se comprueban en servidor. No cambia backend, migraciones, precios, comisiones, pagos ni registros reales.

## Verificación de esta candidata

Versiones `20261005-cold7`, caché `pth-public-static-2026-10-05-cold7`. Capturas Chrome reales con servidor local y datos DEMO: login, preparación automática, cierre/reapertura sin servidor, cliente propio y tarifa $6, dos pedidos $106/$206, recarga y nueva apertura, reconexión con A00001/A00002 y exactamente dos escrituras. Otra sesión Chrome verificó inicio con credenciales vencidas, CRM y guardado normal; reconectar mantuvo cero escrituras antes de reautenticar.

La conexión de herramientas del Mac se interrumpió durante logout. Al retomarla, Chrome/CUA no está expuesto en esta sesión: las comprobaciones finales de logout/cuenta B/regreso a A, desalojo y caché incompleta se ejecutan con código de producción, handler real y almacenamiento controlado en Node. No se presentan como pruebas Chrome. Las pruebas integradas verifican dos intenciones recuperadas, dos escrituras y cero duplicados, bloqueo de datos ajenos y readiness falsa si falta shell/copia. El informe de entrega contiene resultados finales y archivos de evidencia. Ningún pedido real ni cambio de red del Mac forma parte de la prueba.

Falta aceptación en un teléfono físico: mismo navegador/URL con modo avión del teléfono, cierre completo de navegador y reapertura, cuota/evicción de su sistema operativo y reconexión con una cuenta autorizada de pruebas. No se ha probado ni desplegado en producción.

## Rollback sin perder pendientes

Antes de publicar, conservar el commit base y copia binaria de la guía V3. Esta candidata vive en rama aislada; volver a main local no publica nada ni altera datos del servidor.

Si una futura publicación necesitara revertirse, cerrar la web para detener reintentos y preparar un commit nuevo que retire solo la preparación/UI. Mantener lector de cola v2, marcas de aislamiento `2`, protección por cuenta y compatibilidad de intenciones/recibos. Revertir directamente todo a una versión que purga al expirar/logout puede borrar pendientes locales; no es un rollback seguro con dispositivos que ya usaron esta candidata. No borrar IndexedDB, reset, force-push ni pedidos del servidor. Una reversión posterior requiere prueba de lectura y reautenticación de intenciones guardadas antes de publicarse.
