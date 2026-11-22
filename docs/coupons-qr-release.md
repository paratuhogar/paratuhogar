# Cupones directos y QR: preparación de publicación

Preparado sobre `origin/main` `9182c8e0`, en la copia aislada `coupons-qr`.
Implementación, publicación y activación autorizadas el 22 de noviembre de 2026.
Las migraciones y el servidor se despliegan antes que la web y su activación.
No se crean campañas reales ni se cambian contraseñas, roles, comisiones,
precios del catálogo, precios personalizados, puntos anteriores ni pedidos históricos.

## Uso previsto

- Administración → **Cupones**: crear o editar importe fijo USD o porcentaje entero,
  mínimo de productos, inicio/fin, usos totales y usos por teléfono. Todo cambio
  exige motivo y crea una revisión. Un código no cambia de campaña ni se reutiliza.
- Cliente directo → formulario → **Tengo un código de descuento**. **Aplicar**
  solo cotiza; el cliente revisa el neto y confirma expresamente el pedido.
- Gestor/subgestor → **Mi QR**, junto a su enlace. Administración → **QR de gestores**.
  El archivo PNG lleva únicamente el enlace HTTPS y el UUID de esa cuenta.

Los cupones no descuentan la mensajería. No aplican a sesiones comerciales,
enlaces de gestores/subgestores ni teléfonos con cuenta, asignación o historial
comercial. La regla se basa en el teléfono declarado, no verifica identidad física.
Una cotización no consume usos. Uso y lote de pedidos se confirman juntos;
los reintentos recuperan el recibo, no consumen otro cupón. Cancelar no devuelve el cupo.

La Bóveda usa el ingreso **neto** ya almacenado y mantiene intacto el costo del
proveedor. Conciliación muestra bruto y descuento; Excel, vale, WhatsApp y factura
incluyen el desglose guardado. No se reconstruyen descuentos históricos desde notas.

## Antes de publicar (requiere autorización)

1. Confirmar que `main` remoto sigue siendo la base esperada; conservar cualquier
   cambio posterior de inventario/SEO antes de preparar el release.
2. Revisar copia de seguridad y permisos actuales. Aplicar, en este orden,
   `20261122222020_protect_customer_assignment.sql` y
   `20261122222039_direct_customer_coupons.sql` con la herramienta de migraciones.
   Si el despliegue asigna otro timestamp, alinear el historial local, no duplicar SQL.
3. Verificar privilegios en producción: navegador sin escrituras de asignaciones;
   tablas privadas y RPC de cupones solo para el servidor; sin campañas creadas.
   Ejecutar asesores de seguridad y revisar los avisos de este cambio.
4. Desplegar `secure-data` con ambos módulos y dependencias. Mantener
   `PTH_DIRECT_COUPONS_ENABLED` ausente o `false`; conservar todos los secretos y
   banderas existentes, en especial `PTH_POINTS_WALLET_ENABLED`.
5. Publicar los archivos web, plantillas y caché de esta revisión. El QR es
   independiente del flag. Comprobar HTTPS, assets y versión instalada sin pedidos reales.
6. Crear las promociones que administración decida, sin códigos de prueba reales.
   Activar `PTH_DIRECT_COUPONS_ENABLED=true` **solo con autorización específica**.
   Comprobar el campo visible y la cotización sin consumir usos ni enviar pedidos.

## Retirada segura

Desactivar primero la bandera del cupón; el servidor rechaza nuevos envíos con
cupón, no los convierte silenciosamente en ventas de precio completo. Conservar
base, ledgers, snapshots y recibos. No borrar asignaciones ni volver a conceder
escrituras al navegador. No restablecer un gateway anterior incompatible con la
protección sin una revisión; mantener la versión validada con cupones desactivados.
Los QR impresos siguen sujetos a la validación de cuentas existente.

## Verificación local, sin Docker ni producción

```sh
node --test tests/*.test.mjs tests/*.test.cjs
pnpm run test:coupons:db
PTH_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm run test:coupons:browser
PTH_CHROMIUM='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm run test:checkout:browser
node scripts/build-js.cjs --check
node scripts/build-support-css.cjs --check
node scripts/validate-seo-pages.mjs
```

Los tests PostgreSQL usan clústeres nativos temporales y datos sintéticos.
Los navegadores usan loopback y bloquean las peticiones externas. El PNG se
decodifica realmente. Se prueban límites concurrentes, pérdida de respuesta,
reintentos, cambios de revisión, bloqueo telefónico, privilegios, subgestor,
homónimos, aprobación tras renombrar/desactivar y respuestas tardías.

## Resultado de la preparación local

- 791 pruebas generales: aprobadas.
- 135 pruebas de base de datos e interfaces (incluidas las regresiones de puntos): aprobadas.
- Flujo real del formulario de cupones, preparación anónima desde QR de subgestor,
  cadena de recuperación de checkout, caché real y navegación SEO: aprobados.
- Compilados JS/CSS reproducibles, validación SEO y `git diff --check`: correctos.
- Revisión independiente final: sin hallazgos críticos ni importantes pendientes.

La protección añade pruebas privadas e inmutables de UUID para asignaciones y
confirmaciones **nuevas**, sin rellenar el histórico. Los roles operativos
preexistentes conservan sus permisos, incluso si heredan `authenticated`;
las funciones efectivas del navegador `anon` y `authenticated` no pueden escribir.
El cierre de implementación se concentra en un commit local para mantener
juntos el requisito de seguridad y sus consumidores.

## Despliegue autorizado

El 22 de noviembre se aplicaron `20261122222020_protect_customer_assignment`
y `20261122222039_direct_customer_coupons`; los contadores confirmaron que
los pedidos, asignaciones e historial existentes permanecieron intactos.
`secure-data` versión 43 incorpora los módulos. La configuración inicial
devuelve `enabled:false`; la bandera se cambia a `true` después de verificar
la publicación web. No se crean campañas reales durante el despliegue.
