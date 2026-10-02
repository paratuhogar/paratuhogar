# Conexión limitada y pedidos nuevos — 2 octubre 2026

## Alcance aprobado

Catálogo público compacto y lector independiente sin SDK, búsqueda/filtros locales, fecha de copia y caducidad de siete días (aviso de actualización desde dos horas). Solo la copia anónima alimenta este almacenamiento; no contiene descripciones largas, comisiones, costes, perfiles, credenciales, clientes ni pedidos. Fotos al tocar con las miniaturas existentes y caché limitada; ninguna imagen de producto se precarga durante la instalación. El lector permite actualizar la copia mediante una petición pública explícita.

Borradores de carrito separados por ID de cuenta, y visitante separado. Guardan únicamente IDs/cantidades y metadatos de versión, fecha e ID aleatorio del borrador. Ese ID **no autoriza lecturas**. Recuperación explícita; no hay login offline ni envío al regresar la conexión. La nueva funcionalidad no amplía el autosave anterior de campos del formulario.

La aprobación específica incluye recuperar el recibo de un **intento nuevo** sin sesión y revalidar entrega en el servidor. No existe migración, backfill, cambio de políticas de historial o reasignación de pedidos. `policy.mjs`, SQL de comisiones/pagos y la fórmula `calculateSale` permanecen intactos. Las comprobaciones de identidad propias de v16 continúan en la función canónica.

## Pedido nuevo y privacidad

La operación `checkout/quote` liga cuenta, tabla, productos/cantidades, cliente y entrega mediante HMAC. Reutiliza la instalación existente de secretos del servidor; no añade credenciales, variables de entorno ni acceso persistente. Separación de dominios para las firmas; ningún valor secreto se exporta. La clave firmada `pthn1` lleva un nonce de 256 bits derivado de un intento aleatorio y vencimiento de siete días; la cotización vence a los dos minutos. La clave del recibo se conserva solamente en la pestaña (sessionStorage o memoria), nunca en URL, enlaces, WhatsApp, cachés offline ni logs de aplicación. El contenido del cliente no se incluye en la clave: se liga mediante MAC con nonce.

`checkout/receipt` acepta únicamente una clave firmada y vigente de este flujo nuevo, con referencia/confirmación por proveedor. Rechaza claves históricas, manipuladas y vencidas antes de consultar pedidos. Sigue las aprobaciones nuevas de secundarios mediante el mismo token, sin resolver nombres ni inferir propiedad histórica. Permite comprobar un envío después de vencer la sesión, con una acción explícita en la pestaña original. Un intento vencido se detiene y requiere comprobar el historial; nunca obtiene automáticamente otra clave para reenviar.

`checkout/submit` vuelve a consultar precios, disponibilidad y la tarifa única de `tarifas_mensajeria`, aplicando las reglas de envío existentes (tamaño, proveedor A y recargo por más de tres unidades). Las condiciones cambiadas requieren una nueva confirmación. Las comisiones se calculan mediante la función canónica existente. Todos los proveedores de un intento se insertan en **una** operación multi-row, sin UPDATE/upsert. Los índices existentes `(submission_token, proveedor)`, una PK común para la primera fila del intento y PKs deterministas para las demás filas impiden duplicados, incluidos intentos simultáneos con contenido discrepante del mismo borrador. Ninguna colisión actualiza una fila existente. Una confirmación parcial se detiene para revisión; no recrea filas de un lote aceptado. La prueba adicional de carreras con conjuntos de proveedores completamente distintos también guarda un único lote. Antes del ajuste final se verificaron, mediante un conteo agregado, cero filas con el nuevo prefijo; no se leyeron clientes ni importes. Solo la confirmación completa del servidor llega a la ruta de éxito.

Al reintentar una respuesta incierta, la UI consulta primero el recibo y conserva la clave. Si ya está confirmado, muestra las referencias y no repite comunicaciones, PDF ni efectos secundarios. Los clientes antiguos mantienen el flujo anterior; el prefijo reservado nuevo requiere la nueva operación, salvo la aprobación existente de una fila pendiente.

## Evidencia y límites

- 250 pruebas Node: regresiones existentes, aislamiento/validación/almacenamiento, recibos sin sesión, reintentos, tarifas, roles, claves inválidas/vencidas y carreras.
- Chromium móvil 390 px: los cuatro roles, catálogo, Stories desde ficha y PDF. Formulario real con HTTP/DB sintéticos: doble toque, pérdida de respuesta, offline/retorno sin autoenvío y recibo anónimo; un único lote guardado y fila histórica idéntica.
- Lector público con 430 productos sintéticos, HTTP local gzip y CDP: 900 ms de latencia, 50 kbps ≈6,3 s y 100 kbps ≈4,6 s para la primera copia; segunda visita offline ≈0,1 s. Son mediciones locales, **no conexión cubana real ni SLA de producción**.
- Build CSS completo. Sin pedidos reales ni avisos a terceros en las pruebas.
- Offline exige una primera carga válida y almacenamiento/SW del navegador. No se probaron teléfonos Android/iOS físicos ni se promete compatibilidad universal; Web Locks es una ayuda, la protección final es del servidor. Cuota/almacenamiento denegado mantiene la lectura online o el carrito de la pestaña, sin afirmar que esté guardado.
- La validación de disponibilidad no reserva unidades ni inventario: mantiene el modelo actual. Cambiar reserva/stock requeriría un diseño independiente.
- No se guardan nuevos datos del cliente para continuar después de cerrar la pestaña. Si se interrumpe antes de una confirmación y faltan campos, hay que rellenar los datos originales; el MAC rechaza un contenido diferente. La rotación del secreto existente invalida recibos pendientes, que requieren revisión manual y nunca auto-reenvío.

## Publicación y rollback

Base anterior: `f09171b0d43aa039e6ae412f8f10eeb407c2655c`, secure-data v16, bundle SHA-256 `4eb008a842f6e2a7ff5e3e8c91a2906ff61d32348d700a3178a10845dde08f50`.

Servidor desplegado: commit `6fcf1173e44aeaf0e455480dc80270d0c3d7d435`, secure-data **v18 ACTIVE**, bundle SHA-256 `d8b2b7fd0e23803a2fdef4dc7ad56a14d753a19e6cec89b6e4a4cac0b28385d5`. Fuente recuperada del despliegue idéntica al paquete probado; `verify_jwt:false` conserva la autenticación propia anterior. No se ejecutó ninguna escritura SQL ni se crearon pedidos de prueba en producción. La validación pública final del padre y dispositivos reales quedan fuera de estas pruebas locales.

Publicar primero backend compatible; después assets `20261002-lowdata1`, SW `pth-public-static-2026-10-02-lowdata1`. El SW cambia a lector público mínimo y elimina solamente cachés estáticas anteriores; jamás intercepta APIs/POST ni páginas privadas. Las versiones del registrador push coinciden con el SW; no se cambian sus permisos o configuración.

Rollback preferido: revertir interfaz y mantener el backend nuevo para resolver los recibos ya emitidos. Conservar los pedidos aceptados y los índices existentes. Volver al backend v16 también elimina la consulta de esos recibos; coordinar la revisión de intentos pendientes antes de hacerlo. No revertir datos ni restaurar filtros distintos para históricos. El respaldo exacto de v16 se conserva fuera del sitio público en `/workspace/private-order-diagnosis/lowdata-v16-backup/`.

Referencias: [inserciones múltiples de Supabase](https://supabase.com/docs/reference/javascript/insert), [simulación de red de Chrome](https://developer.chrome.com/docs/devtools/network/reference#throttling), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
