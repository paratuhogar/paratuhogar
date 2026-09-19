import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el frontend no muestra ni ejecuta el temporizador de baja por inactividad', async () => {
  const index = await readFile(new URL('index.html', root), 'utf8');
  const master = await readFile(new URL('master.html', root), 'utf8');
  const squad = await readFile(new URL('sistema-escuadron.js', root), 'utf8');

  assert.doesNotMatch(index, /gestor-inactivity-warning|renderGestorInactivityCountdown|gestorInactivityTimer/);
  assert.doesNotMatch(index, /aplicar_inactividad_gestores|Cuenta dada de baja por inactividad/);
  assert.doesNotMatch(master, /runVaultInactivityPolicy|aplicar_inactividad_gestores|Revisar 30 días/);
  assert.doesNotMatch(squad, /dias\s*>=\s*30|kickSoldier\(/);
});

test('la migración conserva la función antigua como no-op y evita nuevas bajas', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20260919_desactivar_inactividad_gestores.sql', root),
    'utf8'
  );

  assert.match(migration, /create or replace function public\.aplicar_inactividad_gestores/i);
  assert.match(migration, /return 0;/i);
  assert.doesNotMatch(migration, /update\s+public\.gestores\s+g\s+set\s+estado\s*=\s*['"]bloqueado/i);
});
