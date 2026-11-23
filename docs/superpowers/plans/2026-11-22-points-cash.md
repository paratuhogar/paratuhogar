# Canje de puntos por dinero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solicitar, reservar, aprobar y registrar cobros a razón de 3 puntos confirmados por USD, sin transferir dinero desde la web.

**Architecture:** Libros privados separados de ganancias y cobros. RPC transaccional con autorización por UUID, idempotencia y una reserva por solicitud. Gateway y UI independientes de checkout y cupones.

**Tech Stack:** PostgreSQL nativo temporal, Supabase Edge Functions ESM, JavaScript DOM, CSS existente, node:test y Playwright.

**Spec:** docs/superpowers/specs/2026-11-22-points-redemptions-design.md

**Estado:** implementación y verificación local completadas. Publicación y
activación autorizadas por Marcel el 22 de noviembre de 2026; no se han realizado pagos reales.

## Global Constraints

- 3 puntos confirmados equivalen a 1 USD para cobrar; 30 puntos equivalen a 10 USD.
- No modificar comisiones, precios, contraseñas, acceso, pedidos históricos, cupones, QR ni el número de vivienda obligatorio.
- No usar Docker. No realizar transferencias ni pagos reales durante las pruebas.
- No conectar bancos, Zelle ni otro proveedor de pagos en esta entrega.
- Publicar y activar requiere autorización específica. Banderas iniciales desactivadas.

## Contrato compartido

Gateway action `points_cash`; cliente `PTHSecureData.pointsCash(body)`; SQL
`public.pth_points_cash(p_actor_id uuid,p_operation text,p_body jsonb)`.

Operaciones y campos de body (sin actor ni importes de puntos enviados por cliente):

| Operación | Campos |
| --- | --- |
| summary | beneficiaryId opcional |
| list | beneficiaryId, state, search, offset opcionales |
| detail | requestId, offset opcional |
| request | usd, idempotencyKey |
| approve, start_payment | requestId, revision, idempotencyKey |
| reject, cancel | requestId, revision, reason, idempotencyKey |
| record_payment | requestId, revision, usd, method, reference, confirmPaid:true, idempotencyKey |
| release_payment | requestId, revision, reason, reference, confirmNotPaid:true, idempotencyKey |
| refund | requestId, revision, usd, reason, reference, confirmReturned:true, idempotencyKey |

USD entero 1..715827882; puntos canónicos USD*3. revision entero positivo.
UUID válidos; key 64 caracteres hex aleatorios y estable ante reintentos;
reason 1..1000; reference 1..200; method efectivo/transferencia/otro.
Sin campos adicionales. Listas: offset 0..1000000, search hasta120, límite50.

Estados: requested, approved, in_payment, paid, rejected, cancelled, refunded.
Cada fila pública: id, beneficiaryId, beneficiaryName, usd, points, state,
revision, createdAt, updatedAt, claimedBy, claimedByName, paymentMethod,
paymentReference, paidAt, reason. Valores no aplicables null.

summary: beneficiary:{id,name}, enabled, rate:3, earnedConfirmed, available,
reserved, redeemedPoints, paidUsd, deficit. list:{rows,nextOffset,totals:{requestedUsd,
approvedUsd,inPaymentUsd,paidUsd}}. detail:{request,events,nextOffset}; cada evento
id, operation, state, revision, actorId, actorName, reason, reference, createdAt.
Mutaciones:{request}. Errores SQL PT400/PT403/PT409/PT503 se mapean a400/403/409/503;
55P03 produce409 POINTS_CASH_BUSY; nunca invalidar la sesión por estos conflictos.

### Task 1: Reservas, decisiones y pagos transaccionales

**Files:** Create CLI migration points_cash_payouts; tests/points-cash-db.cjs.
Modify tests/helpers/points-postgres.cjs con opción cashPayouts=false para cargarla.

**Interfaces:** Produce RPC anterior y helper privado cash_snapshot(uuid).
Tablas privadas cash_config(enabled=false), cash_payouts, cash_events,
cash_entries(payment/refund), cash_operations(clave idempotente).

- [x] Escribir pruebas nativas de disponibilidad del RPC y equivalencia/reserva:

```js
assert.equal((await db.query("select to_regprocedure('public.pth_points_cash(uuid,text,jsonb)') is not null ok")).rows[0].ok,true);
await grant(31);
const created=await cash(parent,'request',{usd:10,idempotencyKey:key()});
assert.equal(created.request.points,30);
assert.equal((await cash(parent,'summary')).available,1);
assert.equal((await cash(parent,'summary')).reserved,30);
```

- [x] Ejecutar `node --test tests/points-cash-db.cjs`; verificar RED por contrato ausente.
- [x] Implementar modelo con CHECK usd*3=points, claves únicas por pago/refund,
  eventos y operaciones inmutables, estados y revisiones válidos, restricciones
  diferidas que exigen evento por revisión y contrapartida financiera al pagar.
- [x] Serializar cobros por cuenta; bloquear créditos positivos con FOR UPDATE
  NOWAIT y calcular saldo solo sobre sus UUID bloqueados y sus reversos. La FK
  reversal_of entra en conflicto con ese bloqueo. NOWAIT evita invertir el orden
  de capturas de una actualización masiva. No modificar triggers de ventas.
- [x] Añadir pruebas de solicitudes simultáneas, alias gestor/subgestor, aprobar
  contra cancelar, dos administradores tomando pago, permiso del pagador asignado,
  pago repetido, liberación explícita tras comprobar no pago y devolución íntegra.
- [x] Probar reversos antes y durante reserva/pago: cancelar reservas nuevas no
  protegidas; preservar en_pago; mostrar déficit tras pago y compensar con ganancias.
  Rebalancear al consultar o mutar cada cuenta, no bajo locks de las ventas.
- [x] Probar cruce real FK/bloqueos y lotes con créditos en orden inverso; aceptar
  únicamente éxito serializable o conflicto busy sin escrituras parciales.
- [x] Activar RLS, revocar PUBLIC/anon/authenticated, solo servicio; conceder
  UPDATE(id) de movements solo para FOR UPDATE: su trigger inmutable sigue
  prohibiendo UPDATE/DELETE/TRUNCATE. Ejecutar pruebas de permisos y rollback.
- [x] Ejecutar nuevas pruebas y las de puntos existentes; commit solo SQL/tests.

### Task 2: Gateway autenticado y transporte

**Files:** Create supabase/functions/secure-data/points-cash.mjs;
tests/points-cash-gateway.test.mjs; Modify handler.mjs, index.ts,
points-wallet.mjs, js/secure-data.js.

**Interfaces:** export pointsCash(db,body,actor); usa solo RPC del contrato.
createHandler añade pointsCashEnabled=false. Env PTH_POINTS_CASH_ENABLED.
pointsWallet(db,body,actor,pointsCashEnabled=false) añade data.cash al summary
mediante pointsCash summary, sin cambiar data.balance ni data.movements.

- [x] Escribir pruebas con handler real: sin sesión no consulta SQL; principal
  no lee hijo; rol logístico no cobra; subgestor sí solicita para sí; admin no
  puede forjar titular/puntos; flags desactivados no disparan SQL inexistente.

```js
const reply=await pointsCash(db,{operation:'request',usd:10,idempotencyKey:'a'.repeat(64)},actor);
assert.equal(reply.data.request.points,30);
assert.deepEqual(call.args,{p_actor_id:actor.id,p_operation:'request',p_body:{usd:10,idempotencyKey:'a'.repeat(64)}});
```

- [x] Verificar RED, implementar campos estrictos del contrato, autorización,
  validaciones, ownership de respuestas y errores genéricos, sin exponer SQL.
- [x] Añadir pointsCash a PTHSecureData con transporte autenticado actual;
  conservar sesión ante409/503, borrar datos privados al cambiar de cuenta.
- [x] Verificar tests gateway, sesión y puntos; commit del gateway/transporte.

### Task 3: Solicitud de cobro e interfaz administrativa

**Files:** Create js/points-cash.js, css/points-cash.css,
tests/points-cash-browser.cjs; Modify js/points-wallet.js (hooks), index.html,
service-worker.js. No modificar la lógica de storefront.js, master.html ni checkout.
Los HTML anfitriones solo actualizan la versión del adaptador compartido y la
comprobación del paquete offline solo actualiza su versión coherente con el SW.

**Interfaces:** PTHPointsCash.mount({container,admin,profile,request,onChanged});
request(body) llama al transporte con guard de cuenta de la billetera;
onChanged refresca summary y contador sin cerrar formularios erróneos.
Hook summary usa data.cash.available para contador y UI de disponibles;
mantener hitos y celebración basados en puntos ganados, no en cobros liberados.

- [x] Escribir test navegador de flujo 31p→solicitar10USD→reservados30/disponible1,
  doble clic una petición, rechazar libera30, paid no equivale a transferencia.
- [x] Verificar RED. Implementar UI azul/dorada actual con resguardo de cobro,
  ratio3:1, botón Solicitar cobro y tabla/tarjetas de estados paginadas. Texto
  explícito: «Administración realiza el pago y lo registra aquí».
- [x] Implementar admin aprobar/rechazar/iniciar pago/registrar pago. Confirmación
  visible de USD y puntos; constancia requerida y checkbox sobre desembolso real.
  Resolver en_pago solo tras confirmar no pago; refund exige devolución real.
- [x] Cada gesto conserva su key y payload ante red incierta; no permitir otra
  solicitud a ciegas. Comprobar estado usando misma key/consulta, sin repetir dinero.
- [x] Probar móvil320/390 y escritorio1280, foco/teclado, sin conexión, textos
  hostiles, sesión cambiada, respuesta tardía y permisos de administrador falsos.
- [x] Versionar assets nuevos y hooks; SW coherente, flags ausentes no muestran
  acciones ni afirman equivalencia activa. Reejecutar tests de billetera/QR/cupones.
- [x] Commit de UI y tests, sin publicar.

### Task 4: Verificación final y entrega local

**Files:** docs/points-cash-release.md; estado de este plan.

- [x] Ejecutar `node --test tests/*.test.mjs tests/*.test.cjs` y suite nativa de
  puntos/cupones/protección de clientes. Ejecutar nuevas pruebas browser y checkout.
- [x] Ejecutar build-js --check, build-support-css --check, validate-seo-pages y
  git diff --check. Comparar diff con base: ningún cambio de precios/comisiones/auth.
- [x] Revisión independiente solo lectura; corregir hallazgos con RED/GREEN.
- [x] Documentar migración, flag SQL+env inicialmente false y retirada segura
  que mantiene obligaciones pendientes. No solicitar ni registrar pagos reales.
- [x] Entregar qué quedó implementado/probado y aclarar que falta autorización
  para desplegar/activar en Supabase y web. No afirmar publicación.
