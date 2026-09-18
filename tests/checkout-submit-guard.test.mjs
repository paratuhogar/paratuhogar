import test from 'node:test';
import assert from 'node:assert/strict';
import guardModule from '../js/checkout-submit-guard.js';

const { createCheckoutSubmitGuard } = guardModule;

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test('rechaza un segundo envío mientras el primero sigue en curso', () => {
  const guard = createCheckoutSubmitGuard(memoryStorage(), 'checkout', () => 'token-1');
  assert.deepEqual(guard.acquire(), { accepted: true, token: 'token-1' });
  assert.deepEqual(guard.acquire(), { accepted: false, token: 'token-1' });
});

test('conserva la misma clave al reintentar después de un error', () => {
  const guard = createCheckoutSubmitGuard(memoryStorage(), 'checkout', () => 'token-1');
  guard.acquire();
  guard.fail();
  assert.deepEqual(guard.acquire(), { accepted: true, token: 'token-1' });
});

test('borra la clave únicamente después de un envío confirmado', () => {
  const storage = memoryStorage();
  const guard = createCheckoutSubmitGuard(storage, 'checkout', () => 'token-1');
  guard.acquire();
  guard.succeed();
  assert.equal(guard.token(), null);
  assert.deepEqual(guard.acquire(), { accepted: true, token: 'token-1' });
});
