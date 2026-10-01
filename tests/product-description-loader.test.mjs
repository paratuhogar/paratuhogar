import test from 'node:test';
import assert from 'node:assert/strict';
import loader from '../js/product-description-loader.js';

test('deduplicates overlapping detail/copy requests and never overwrites prices or commission', async () => {
  let complete, calls = 0;
  const api = loader.create({ getScope: () => 'account-a:1', fetchRows: ids => { calls++; assert.deepEqual(ids, ['a']); return new Promise(resolve => complete = resolve); } });
  const first = { id: 'a', precio: 250, comision: 30 }, second = { id: 'a', precio: 280 };
  const requests = [api.hydrate([first]), api.hydrate([second])];
  await Promise.resolve();
  complete([{ id: 'a', descripcion: '<p>Details</p>', precio: 1, comision: 0 }]);
  await Promise.all(requests);
  assert.equal(calls, 1);
  assert.deepEqual(first, { id: 'a', precio: 250, comision: 30, descripcion: '<p>Details</p>' });
  assert.equal(second.precio, 280);
});

test('switching account or reloading catalogue rejects late responses without mutating products', async () => {
  for (const next of ['account-b:1', 'account-a:2']) {
    let scope = 'account-a:1', complete;
    const product = { id: 'a' };
    const api = loader.create({ getScope: () => scope, fetchRows: () => new Promise(resolve => complete = resolve) });
    const request = api.hydrate([product]); await Promise.resolve();
    scope = next; complete([{ id: 'a', descripcion: 'Private details' }]);
    await assert.rejects(request, /sesión o el catálogo cambió/);
    assert.equal(Object.hasOwn(product, 'descripcion'), false);
  }
});

test('failed, missing and incomplete responses remain retryable and do not create blank descriptions', async () => {
  for (const failure of [new Error('Offline'), [], [{ id: 'a' }]]) {
    let calls = 0;
    const api = loader.create({ getScope: () => 'a:1', fetchRows: async () => {
      calls++;
      if (calls === 1) { if (failure instanceof Error) throw failure; return failure; }
      return [{ id: 'a', descripcion: 'Recovered' }];
    } });
    const product = { id: 'a' };
    await assert.rejects(api.hydrate([product]));
    assert.equal(Object.hasOwn(product, 'descripcion'), false);
    await api.hydrate([product]); assert.equal(product.descripcion, 'Recovered');
  }
});

test('bulk PDF hydration bounds requests, preserves intentional empty descriptions and fails atomically', async () => {
  const sizes = [];
  const products = Array.from({ length: 85 }, (_, index) => ({ id: String(index), precio: index }));
  products.push({ id: 'empty', descripcion: null });
  const api = loader.create({ getScope: () => 'a:1', fetchRows: async ids => {
    sizes.push(ids.length); return ids.map(id => ({ id, descripcion: `Product ${id}` }));
  } });
  await api.hydrate(products);
  assert.deepEqual(sizes, [40, 40, 5]);
  assert.equal(products[84].descripcion, 'Product 84');
  assert.equal(products[85].descripcion, null);
  const missing = [{ id: 'a' }, { id: 'b' }];
  const failing = loader.create({ getScope: () => 'a:1', fetchRows: async () => [{ id: 'a', descripcion: 'OK' }] });
  await assert.rejects(failing.hydrate(missing));
  assert.deepEqual(missing, [{ id: 'a' }, { id: 'b' }]);
});
