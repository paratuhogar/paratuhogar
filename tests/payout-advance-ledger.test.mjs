import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('los adelantos conservan la solicitud original y reducen únicamente el saldo pendiente', async () => {
  const [sql, master] = await Promise.all([
    readFile(new URL('payout-advances.sql', root), 'utf8'),
    readFile(new URL('master.html', root), 'utf8')
  ]);

  assert.match(sql, /create table if not exists public\.solicitudes_cobro_adelantos/i);
  assert.match(sql, /add column if not exists adelantado_usd/i);
  assert.match(sql, /create or replace function public\.registrar_adelanto_solicitud_cobro/i);
  assert.match(sql, /(?:round\()?p_importe_usd[\s\S]{0,12}>\s*v_restante/i);
  assert.match(sql, /adelantado_usd\s*=\s*round\(adelantado_usd\s*\+\s*p_importe_usd,\s*2\)/i);
  assert.match(master, /Solicitado/);
  assert.match(master, /Adelantado/);
  assert.match(master, /Restante/);
  assert.match(master, /registerVaultPayoutAdvance/);
  assert.match(master, /tieneAdelantoSolicitud/);
  assert.match(master, /Gestionar desde solicitudes/);
});
