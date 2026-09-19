import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('la Bóveda muestra el motivo del adelanto en nómina e historial', async () => {
  const master = await readFile(new URL('master.html', root), 'utf8');
  const migration = await readFile(
    new URL('supabase/migrations/20260919_mostrar_motivo_adelanto.sql', root),
    'utf8'
  );

  assert.match(master, /motivo_adelanto/);
  assert.match(master, /Motivo del adelanto/);
  assert.match(master, /item\.motivo_adelanto/);
  assert.match(migration, /listar_adelantos_solicitudes_nomina[\s\S]*motivo_adelanto/i);
  assert.match(migration, /listar_historial_solicitudes_cobro_beatriz[\s\S]*motivo_adelanto/i);
  assert.match(migration, /solicitudes_cobro_adelantos/);
});
