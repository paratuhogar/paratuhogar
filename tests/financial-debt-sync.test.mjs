import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la bóveda escucha cambios de pedidos y refresca la deuda', async () => {
  const html = await readFile(new URL('master.html', root), 'utf8');
  const sql = await readFile(
    new URL('supabase/migrations/20260813_boveda_realtime.sql', root),
    'utf8'
  );
  const secureSql = await readFile(
    new URL('supabase/migrations/20260813_pedidos_boveda_segura.sql', root),
    'utf8'
  );

  assert.match(html, /postgres_changes/);
  assert.match(html, /table:\s*['"]pedidos['"]/);
  assert.match(html, /scheduleVaultDebtRefresh/);
  assert.match(html, /removeChannel/);
  assert.match(html, /vaultDebtRefreshPending/);
  assert.match(html, /rpc\(['"]listar_pedidos_boveda['"]/);
  assert.match(html, /\.range\(pageStart,\s*pageStart\s*\+\s*pageSize\s*-\s*1\)/);
  assert.match(html, /while\s*\(page\.length\s*===\s*pageSize\)/);
  assert.match(html, /Error al actualizar/);
  assert.match(sql, /alter publication supabase_realtime add table public\.pedidos/i);
  assert.match(secureSql, /es_admin_boveda\(p_admin_id,p_password\)/i);
  assert.match(secureSql, /security definer/i);
  assert.match(secureSql, /revoke all on function public\.listar_pedidos_boveda/i);
});

test('Telegram separa deuda del sistema, comisiones y total combinado', async () => {
  const sql = await readFile(
    new URL('supabase/migrations/20260813_separar_saldos_telegram.sql', root),
    'utf8'
  );

  assert.match(sql, /Deuda del sistema/);
  assert.match(sql, /Comisiones pendientes de Marcel/);
  assert.match(sql, /Total combinado/);
  assert.match(sql, /total_sistema/);
  assert.match(sql, /total_mis_ventas/);
  assert.match(sql, /vault\.decrypted_secrets/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /create trigger trigger_notify_delivery\s+after update/i);
  assert.doesNotMatch(sql, /\d{8,}:[A-Za-z0-9_-]{20,}/);
});

test('la deuda del sistema tiene una sola fuente contable y liquidación atómica', async () => {
  const html = await readFile(new URL('master.html', root), 'utf8');
  const sql = await readFile(
    new URL('supabase/migrations/20260813_deuda_sistema_contable.sql', root),
    'utf8'
  );
  const repairSql = await readFile(
    new URL('supabase/migrations/20260813_reparar_lineas_mixtas_deuda.sql', root),
    'utf8'
  );

  assert.match(sql, /create table if not exists public\.deuda_sistema_detalle/i);
  assert.match(sql, /create table if not exists public\.liquidaciones_sistema/i);
  assert.match(sql, /unique\s*\(pedido_id,\s*linea\)/i);
  assert.match(sql, /create or replace function public\.materializar_deuda_sistema_pedido/i);
  assert.match(sql, /create or replace function public\.listar_deuda_sistema/i);
  assert.match(sql, /create or replace function public\.resumen_deuda_sistema/i);
  assert.match(sql, /create or replace function public\.liquidar_deuda_sistema/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /order by p\.id[\s\S]*for update;[\s\S]*pg_advisory_xact_lock/i);
  assert.match(sql, /Formato de producto no analizable/i);
  assert.match(sql, /materializar_deuda_sistema_pedido[\s\S]*pg_advisory_xact_lock/i);
  assert.match(sql, /after update of estado,\s*total,\s*costo_mensajeria,\s*producto/i);
  assert.match(sql, /old\.estado = 'Entregado'[\s\S]*new\.estado <> 'Entregado'/i);
  assert.match(sql, /create or replace function public\.validar_deuda_sistema_integridad/i);
  assert.match(sql, /deuda_sistema_detalle[\s\S]*tarifa_total/i);
  assert.match(sql, /CA-1247/);
  assert.match(sql, /CA-1324/);
  assert.match(sql, /notify_telegram_on_delivery[\s\S]*deuda_sistema_detalle/i);
  assert.match(repairSql, /pedidos'\)::integer <> 146/i);
  assert.match(repairSql, /lineas'\)::integer <> 148/i);
  assert.match(repairSql, /total'\)::numeric <> 332\.00/i);

  assert.match(html, /rpc\(['"]listar_deuda_sistema['"]/);
  assert.match(html, /rpc\(['"]resumen_deuda_sistema['"]/);
  assert.match(html, /rpc\(['"]liquidar_deuda_sistema['"]/);
  assert.match(html, /Error contable/);
  assert.match(html, /deudaSistemaResumen\s*=\s*null/);
  assert.match(html, /btn\.disabled\s*=\s*true/);
});
