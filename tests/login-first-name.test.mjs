import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el acceso permite el primer nombre además del nombre completo o teléfono', async () => {
  const source = await readFile(new URL('index.html', root), 'utf8');
  assert.match(source, /\.ilike\('nombre',\s*`\$\{loginNamePrefix\}%`\)/);
  assert.match(source, /loginNamePrefix/);
});
