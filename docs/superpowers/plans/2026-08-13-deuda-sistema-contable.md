# Deuda del Sistema Contable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralizar, congelar, desglosar y liquidar con exactitud auditable la deuda de mantenimiento del sistema.

**Architecture:** Supabase será la única fuente de cálculo y conservará una fila por línea de pedido. La Bóveda y Telegram solo leerán funciones seguras; la liquidación se ejecutará en una transacción que crea comprobante y marca las líneas pagadas.

**Tech Stack:** PostgreSQL/Supabase, PL/pgSQL, Supabase JS v2, HTML/JavaScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-13-deuda-sistema-contable-design.md`

## Global Constraints

- Mensajería excluida del precio del equipo.
- Tramos por unidad: `<=60:0.50`, `<=150:1`, `<=399:2`, `<=999:3`, `>999:5`.
- No recalcular pedidos ya pagados.
- Un fallo no puede representarse como deuda cero.
- Toda escritura financiera debe ser transaccional, autenticada e idempotente.

---

### Task 1: Contrato contable y pruebas de regresión

**Files:**
- Modify: `tests/financial-debt-sync.test.mjs`
- Create: `supabase/migrations/20260813_deuda_sistema_contable.sql`

**Interfaces:**
- Produces: `listar_deuda_sistema(uuid,text)`, `resumen_deuda_sistema(uuid,text)`, `liquidar_deuda_sistema(uuid,text,text)`.

- [ ] **Step 1: Write the failing test**

Añadir aserciones para tablas de deuda/liquidación, funciones seguras, idempotencia, parsing de pedidos mixtos y ausencia de fórmula de tramos en `master.html`/trigger Telegram.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: FAIL porque la migración y las RPC nuevas no existen.

- [ ] **Step 3: Write minimal implementation**

Crear tablas, parser de líneas `[USD] +`, función de tarifa, materialización histórica, trigger de entrega, resumen, listado y liquidación transaccional con permisos mínimos.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: PASS.

### Task 2: Bóveda consumiendo la fuente única

**Files:**
- Modify: `master.html`
- Test: `tests/financial-debt-sync.test.mjs`

**Interfaces:**
- Consumes: `listar_deuda_sistema`, `resumen_deuda_sistema`, `liquidar_deuda_sistema`.
- Produces: tarjeta y modal derivados de las líneas persistidas.

- [ ] **Step 1: Write the failing test**

Exigir llamadas a las tres RPC, verificación de igualdad detalle/resumen y ausencia del cálculo local `calculateDevFee(precioUnitario)` dentro de `renderSystemDebt`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: FAIL por consumo todavía local.

- [ ] **Step 3: Write minimal implementation**

Reemplazar carga/cálculo/liquidación por RPC; renderizar cada línea, comprobar total centavo por centavo y mostrar incidencia si no coincide.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: PASS.

### Task 3: Telegram desde el resumen contable

**Files:**
- Modify: `supabase/migrations/20260813_deuda_sistema_contable.sql`
- Test: `tests/financial-debt-sync.test.mjs`

**Interfaces:**
- Consumes: deuda materializada por pedido.
- Produces: mensajes Telegram cuyo saldo coincide con `resumen_deuda_sistema`.

- [ ] **Step 1: Write the failing test**

Exigir que el trigger sume `deuda_sistema_detalle.tarifa_total` y no contenga una segunda tabla de tramos.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: FAIL con la función Telegram anterior.

- [ ] **Step 3: Write minimal implementation**

Recrear el trigger para materializar primero la deuda y leer después los totales persistidos, conservando secretos en Vault y bloqueo de concurrencia.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/financial-debt-sync.test.mjs`
Expected: PASS.

### Task 4: Instalación, verificación financiera y publicación

**Files:**
- Execute: `supabase/migrations/20260813_deuda_sistema_contable.sql`
- Publish: `master.html`, migration, tests, spec and plan.

**Interfaces:**
- Consumes: migración y frontend verificados.
- Produces: Bóveda pública y base de datos sincronizadas.

- [ ] **Step 1: Install migration**

Ejecutar la migración en Supabase y comprobar que es idempotente.

- [ ] **Step 2: Verify financial invariants**

Consultar resumen/listado: total `332.00`, 146 pedidos, `CA-1247=3.00`, `CA-1324=1.00`, suma de líneas igual al resumen.

- [ ] **Step 3: Publish code**

Commit y push a `main` después de `node --test` y validación sintáctica del JavaScript.

- [ ] **Step 4: Verify production**

Confirmar que GitHub Pages sirve el commit y que la Bóveda autenticada muestra exactamente el resumen de Supabase.
