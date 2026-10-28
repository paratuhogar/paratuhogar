# Revisión administrativa de pedidos de subgestores

## Objetivo aprobado

Añadir «Pedidos de subgestores» al panel administrador: consultar todos los
pendientes, buscar por referencia/cliente/comercial, corregir datos de entrega,
aprobar para logística o rechazar con motivo. Conservar referencia, precios,
comisiones y atribución al gestor principal. Registrar quién decide y cuándo.
Evitar que administrador y gestor aprueben el mismo pedido dos veces.

## Hallazgo que amplía el alcance

`subgestores.html:aprobarPedido` actualmente inserta en `pedidos` y después
elimina de `pedidos_subgestores` mediante dos solicitudes independientes.
`rechazarPedido` elimina permanentemente el pendiente sin registrar motivo.
El gateway ya permite a administradores leer pendientes de cualquier gestor
y valida la aprobación contra el registro original, pero no engloba el traslado
y la decisión en una sola transacción. Añadir únicamente la pestaña no satisface
el requisito de concurrencia y auditoría aprobado.

## Diseño recomendado

1. **Una decisión transaccional compartida.** El gateway usará la sesión ya
   verificada para una operación de aprobación/rechazo en PostgreSQL. Bloqueará
   el pendiente, volverá a comprobar su estado y los permisos actuales, conservará
   el mismo ID y referencia y, al aprobar, copiará los importes de la fila guardada.
   El alta logística, la salida de la cola y el registro de auditoría se confirmarán
   juntos o no se aplicará nada. Un reintento de la misma aprobación devolverá su
   resultado ya confirmado; una decisión incompatible informará del conflicto.
2. **Permisos existentes.** Los administradores podrán revisar cualquier equipo;
   un gestor principal, solo su propia red. Los subgestores no podrán aprobar.
   La nueva función interna no será ejecutable directamente por clientes públicos.
   No se cambian contraseñas, duración de sesiones, roles ni visibilidad de
   comisiones para subgestores.
3. **Auditoría privada.** Se conservará una instantánea del pendiente y la decisión,
   actor verificado, fecha del servidor y motivo obligatorio al rechazar. Un rechazo
   no se convertirá en pedido logístico ni se perderá sin rastro. La lectura de esta
   auditoría quedará reservada a administración. No se reconstruirá un historial
   anterior que no existe.
4. **Edición controlada.** Solo cliente, teléfono, CI, municipio, dirección y vuelto.
   El vuelto tendrá un campo explícito y se integrará en la indicación de entrega
   sin destruir otras notas. Ni precios ni comisiones serán editables. Una edición
   posterior a otra revisión exigirá recargar antes de aprobar; nunca se comunicará
   éxito cuando el pendiente ya haya cambiado o salido de la cola.
5. **Panel administrador.** Pestaña independiente con contador, filtros de referencia,
   cliente, subgestor y gestor principal. Datos paginados y consultados al abrirla,
   sin añadir cargas al inicio de logística. Acciones con confirmación explícita,
   estado ocupado y mensajes de error recuperables. Los textos se renderizarán como
   datos, no como HTML ejecutable. Al aprobar se ofrecerá actualizar logística.
6. **Panel del gestor principal.** Sustituir las dos solicitudes actuales de aprobar
   y el borrado directo de rechazo por la misma operación compartida. Conservar sus
   herramientas y la generación del vale. Las páginas antiguas en caché no podrán
   duplicar un ID; la transición deberá probarse y explicitar cualquier incompatibilidad
   antes de publicar.

## Componentes afectados

- `index.html`, nuevo controlador de revisión y estilos del panel.
- `js/secure-data.js`, `supabase/functions/secure-data/handler.mjs` y módulo de revisión.
- Migración PostgreSQL para decisión transaccional y auditoría privada.
- `subgestores.html`, integración del flujo compartido.
- Caché/versiones públicas y pruebas de frontend, permisos y concurrencia.

## Verificación y publicación

- Inspeccionar primero columnas, restricciones y triggers reales en Supabase.
- Pruebas con datos sintéticos: actor no autorizado, red ajena, precios manipulados,
  editar, rechazar, dos aprobaciones simultáneas, aprobación contra rechazo,
  reintento tras pérdida de conexión y rollback completo ante error.
- Verificar que se conserva ID, referencia, gestor, comisiones e importes; el
  subgestor nunca recibe la comisión del principal.
- Verificar búsqueda más allá de 1.000 filas, errores, móvil, escape de texto,
  cambio de cuenta y que logística no espera a esta pestaña.
- No aprobar, rechazar ni editar CA-1587 ni ningún pedido real como prueba.
- Mantener cambios locales ajenos y remotos recientes. Publicar solo después de
  pruebas y revisión, con autorización de publicación del usuario.

## Fuera de alcance

Cambiar tarifas, precios, comisiones, credenciales, jerarquías, histórico de pagos,
aprobaciones automáticas o aprobar pedidos existentes en nombre de los usuarios.

## Punto de revisión

El usuario confirmó la ampliación del flujo del gestor principal y la operación
transaccional compartida. La publicación y activación en producción requieren
autorización posterior; no se deben operar pedidos reales como pruebas.
