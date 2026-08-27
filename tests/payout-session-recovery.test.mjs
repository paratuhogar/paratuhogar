import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('el cobro recupera una sesión inválida y reintenta solo fallos temporales de red', async () => {
  const source = await readFile(new URL('index.html', root), 'utf8');

  assert.match(source, /function isInvalidGestorSessionError\(error\)/);
  assert.match(source, /function isTransientPayoutNetworkError\(error\)/);
  assert.match(source, /async function requestCommissionPayoutWithRetry\(/);
  assert.match(source, /localStorage\.removeItem\('pth_session'\)/);
  assert.match(source, /intentosRestantes\s*=\s*1/);
  assert.match(source, /isInvalidGestorSessionError\(error\)/);
});
