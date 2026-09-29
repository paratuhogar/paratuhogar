import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el acceso permite el primer nombre además del nombre completo o teléfono', async () => {
  const source = await readFile(new URL('supabase/functions/secure-data/handler.mjs', root), 'utf8');
  assert.match(source, /normalized\(g\.nombre\)\.startsWith\(`\$\{identity\} `\)/);
  assert.match(source, /normalized\(g\.nombre\)===identity/);
  assert.match(source, /phone\.length===8/);
});
