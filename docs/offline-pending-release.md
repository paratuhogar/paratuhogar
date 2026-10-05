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

## Corrección del aviso de preparación, pendiente de publicación

Base `8a1b69766c84f33a763f7079b209ce0534e89672`, que incluye la entrada en frío `65bfb84`. El gateway ACTIVE v25 se verificó en modo lectura: sus once archivos coinciden con la base. Esta corrección es exclusivamente de frontend y recursos públicos; no cambia el gateway, autenticación, permisos, precios, clientes, validación de la copia, retención ni formato de los pendientes.

El aviso sobre el catálogo incluye su propio botón, progreso y resultado; no hace falta abrir el carrito. Ambos botones comparten un intento. «Actualizar copia de trabajo» guarda los productos ya cargados y obtiene clientes recientes propios y tarifas: no refresca el catálogo visible ni instala otra versión de la app. Un dato que incumple los límites locales sigue siendo rechazado, con un mensaje sin valores personales; no se omite ni trunca para pasar la validación. Si el guardado falla, conserva la copia anterior vigente y la cola. Si los datos ya se guardaron pero falta completar la preparación local o los archivos, lo indica sin declarar preparación completa. La comprobación distingue datos guardados de archivos disponibles; solo declara preparación completa después de releer la copia y comprobar la app.

Versión de interfaz/registro `20261005-copy1`, caché `pth-public-static-2026-10-05-copy1`. El reintento solicita al worker recuperar únicamente entradas ausentes de la lista fija de recursos públicos. Usa GET del mismo origen, sin credenciales ni redirecciones; comprueba MIME, versión de plantilla y dependencias esenciales. También detecta una plantilla incompatible ya presente sin borrarla. Las fuentes/iconos externos existentes y el script de medición siguen siendo opcionales, sin recuperación. Se alinearon las referencias públicas existentes de bienvenida, guía y formulario con el shell; no se regeneró la guía PDF.

La operación de datos tiene un límite de 45 segundos; una respuesta tardía no puede guardar ni mostrar resultado después de ese límite o de un cambio de cuenta. Los botones vuelven a permitir un nuevo intento. Los recursos públicos tienen un límite de 12 segundos por descarga; intentos concurrentes comparten una reparación. Si no hay red, falla una descarga, hay cuota insuficiente o la plantilla pertenece a otra versión, el aviso conserva un resultado incompleto y permite reintentar o indica la actualización de app correspondiente. No usa `CLEAR_PUBLIC_CACHE`, no borra IndexedDB, no cierra sesión y no envía pedidos como parte de preparar la copia.

Pruebas de esta corrección: 442/442 pruebas Node, bundle y guía correctos, cuatro suites de base de datos local correctas y nueve escenarios dedicados Chromium real cloud con perfiles nuevos, servidor y cuentas sintéticos. Estos casos cubren rechazo de dato inválido sin pérdida de copia/cola, doble clic, ausencia de red, archivo público inaccesible y recuperación posterior sin cookies, recarga durante el intento, deadline acelerado con respuesta tardía y cambio A→B con pendientes aislados. El navegador dedicado mantiene cero solicitudes checkout/logout y cero escrituras de pedidos. La suite general ejecutó sus 30 scripts de navegador: 22 pasan y ocho fallan; los mismos ocho errores se reprodujeron sobre la base sin modificar (432/432 Node correctos). Los fallos heredados incluyen fixtures desactualizadas, servidor local no iniciado, una expectativa antigua de versión del worker y esperas/assertions de interfaz. Los detalles y logs están en el informe de entrega; no se declara toda la suite de navegador correcta. La revisión independiente terminó sin bloqueos, tras reforzar la comprobación de plantillas incompatibles. No constituye aceptación en un Android físico ni verificación de publicación; esta fase no publica ni despliega.

Rollback de esta corrección: revertir únicamente su commit mediante un commit nuevo sobre la rama de publicación; conserva los lectores v2, la identidad local y el gateway v25 de la base. La instantánea íntegra de la base y un archivo de los recursos principales se conservaron en el entorno de trabajo (`/workspace/scratch/offline-copy-baseline/` y `/workspace/scratch/working-copy-rollback-8a1b697.tar`). Nunca revertir `65bfb84` ni limpiar almacenamiento del dispositivo para retirar este aviso. La publicación y cualquier rollback requieren la autorización posterior del usuario.
