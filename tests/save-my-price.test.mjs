import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/storefront.js', import.meta.url), 'utf8');
const start = source.indexOf('window.saveMyPrice = async function(');
const handler = source.slice(start, source.indexOf('// Función para actualizar la etiqueta', start));

function fixture({ type = 'click', existing = false, failure = false, subgestor = false, price = '100' } = {}) {
  const button = { innerHTML: 'Guardar', disabled: false, classList: { replace() {} } };
  const event = { currentTarget: button, type };
  const calls = [], alerts = [], timers = [];
  let release;
  const hierarchy = new Promise(resolve => { release = resolve; });
  const query = {
    select() { calls.push(['select']); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    limit: async () => ({ data: existing ? [{ id: 'fixture-existing' }] : [], error: null }),
    update(payload) { calls.push(['update', payload]); return this; },
    insert: async payload => { calls.push(['insert', payload]); return { error: failure ? { message: 'fixture failure' } : null }; },
    then(resolve) { resolve({ error: failure ? { message: 'fixture failure' } : null }); }
  };
  const context = {
    gestorName: 'fixture-gestor', event,
    document: { getElementById(id) { return id.startsWith('input-price-') ? { value: price } : id.startsWith('input-sub-com-') ? { value: '5' } : { checked: true }; } },
    resolveSalesHierarchy: () => hierarchy,
    supabaseClient: { from(table) { assert.equal(table, 'precios_personalizados'); return query; } },
    alert: message => alerts.push(message),
    setTimeout: callback => timers.push(callback),
    PTHSecureData: { clearCaches() { calls.push(['clearCaches']); } },
    localStorage: { removeItem(key) { calls.push(['removeItem', key]); } },
    loadProducts() { calls.push(['loadProducts']); }
  };
  context.window = context;
  vm.runInNewContext(handler, context);
  return { button, calls, alerts, timers, async run() {
    const pending = context.saveMyPrice('fixture-product', 100, 20, event);
    // Simulate browser dispatch ending while hierarchy resolution is pending.
    event.currentTarget = null;
    context.event = undefined;
    release(subgestor ? { isSubgestor: true, parent: { nombre: 'fixture-parent' } } : {});
    await pending;
  } };
}

test('both inline callers explicitly pass their event', () => {
  const calls = source.match(/saveMyPrice\('\$\{p.id\}', \$\{p.precio\}, \$\{p.comision\}, event\)/g);
  assert.equal(calls?.length, 2);
});

for (const existing of [false, true]) {
  test(`click survives expired currentTarget and ${existing ? 'updates' : 'inserts'} unchanged payload`, async () => {
    const f = fixture({ existing });
    await f.run();
    assert.equal(f.alerts.length, 0);
    assert.equal(f.button.disabled, true);
    const write = f.calls.find(c => c[0] === (existing ? 'update' : 'insert'));
    assert.ok(write);
    const payload = JSON.parse(JSON.stringify(existing ? write[1] : write[1][0]));
    assert.deepEqual(payload, existing ? { nuevo_precio: 100, comision_subgestor: 5, visible_subgestor: true } : {
      gestor: 'fixture-gestor', producto_id: 'fixture-product', nuevo_precio: 100, comision_subgestor: 5, visible_subgestor: true
    });
    f.timers[0]();
    assert.equal(f.button.disabled, false);
    assert.ok(f.calls.some(c => c[0] === 'loadProducts'));
  });
}

test('change survives expired currentTarget without changing checkbox content', async () => {
  const f = fixture({ type: 'change' });
  await f.run();
  assert.equal(f.button.innerHTML, 'Guardar');
  assert.equal(f.button.disabled, false);
  assert.equal(f.timers.length, 0);
  assert.ok(f.calls.some(c => c[0] === 'loadProducts'));
});

test('write failure restores the clicked control', async () => {
  const f = fixture({ failure: true });
  await f.run();
  assert.equal(f.button.innerHTML, 'Guardar');
  assert.equal(f.button.disabled, false);
  assert.match(f.alerts[0], /fixture failure/);
});

for (const options of [{ subgestor: true }, { price: '79' }, { price: 'invalid' }]) {
  test(`existing validation still prevents writes: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options);
    await f.run();
    assert.equal(f.calls.length, 0);
    assert.equal(f.alerts.length, 1);
  });
}
