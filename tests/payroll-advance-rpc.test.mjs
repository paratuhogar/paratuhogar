import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la nómina consulta los adelantos mediante una RPC administrativa', async () => {
  const [master, sql] = await Promise.all([
    readFile(new URL('master.html', root), 'utf8'),
    readFile(new URL('payroll-request-advances.sql', root), 'utf8')
  ]);
  const payroll = master.match(/async function loadNomina\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(payroll, /rpc\(\s*'listar_adelantos_solicitudes_nomina'/);
  assert.doesNotMatch(payroll, /from\('solicitudes_cobro'\)/);
  assert.match(sql, /create or replace function public\.listar_adelantos_solicitudes_nomina/i);
  assert.match(sql, /public\.es_admin_boveda\(p_admin_id,\s*p_password\)/i);
});
