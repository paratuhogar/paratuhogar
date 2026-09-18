import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el checkout bloquea reenvíos y conserva una clave idempotente por proveedor', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const subgestores = await readFile(new URL('subgestores.html', root), 'utf8');
  const migration = await readFile(
    new URL('supabase/migrations/20260918_checkout_idempotencia.sql', root),
    'utf8'
  );

  assert.match(html, /PTHCheckoutSubmitGuard/);
  assert.match(html, /checkoutSubmitGuard\.acquire\(\)/);
  assert.match(html, /submission_token:\s*submissionToken/);
  assert.match(html, /checkoutSubmitGuard\.succeed\(\)/);
  assert.match(html, /checkoutSubmitGuard\.fail\(\)/);
  assert.match(subgestores, /submission_token:\s*p\.submission_token/);
  assert.match(migration, /alter table public\.pedidos[\s\S]*add column if not exists submission_token/i);
  assert.match(migration, /alter table public\.pedidos_subgestores[\s\S]*add column if not exists submission_token/i);
  assert.match(migration, /unique index[\s\S]*pedidos[\s\S]*submission_token[\s\S]*proveedor/i);
  assert.match(migration, /unique index[\s\S]*pedidos_subgestores[\s\S]*submission_token[\s\S]*proveedor/i);
});
