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
