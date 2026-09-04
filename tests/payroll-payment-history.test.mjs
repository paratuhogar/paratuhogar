import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la nómina carga 200 pagos y muestra la fecha real de pago', async () => {
  const html = await readFile(new URL('master.html', root), 'utf8');
  const sql = await readFile(
    new URL('supabase/migrations/20260904_historial_pagos_gestores.sql', root),
    'utf8'
  );

  assert.match(html, /listar_historial_pagos_gestores/);
  assert.match(html, /pagado_en/);
  assert.match(html, /Fecha de pago/);
  assert.match(html, /revertirPago\('\$\{p\.pedido_id\}', '\$\{p\.orden_dia\}'\)/);
  assert.match(sql, /create or replace function public\.listar_historial_pagos_gestores/i);
  assert.match(sql, /p_limit\s+integer\s+default\s+200/i);
  assert.match(sql, /estado\s+in\s*\('pagado',\s*'archivado'\)/i);
  assert.match(sql, /pago_gestor_en/);
  assert.match(sql, /grant execute on function public\.listar_historial_pagos_gestores/i);
});
