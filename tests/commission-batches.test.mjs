import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import readStorefront from './read-storefront.cjs';

async function run(failAt) {
  const source = readStorefront().match(/async function autoAssignHalfCommissions\(\)[\s\S]*?\n    \}\n\n\n\/\/ =====================================================/)[0];
  const products = Array.from({length: 203}, (_, id) => ({id, precio: 50, comision: 10}));
  const saved = [{id: 'keep', producto_id: 0, comision_subgestor: 3}, {id: 'hidden', producto_id: 1, nuevo_precio: 60, visible_subgestor: false}];
  const writes = [], alerts = [], button = {innerHTML: '50%', disabled: false};
  let refreshed = 0;
  const write = (op, rows) => {
    writes.push({op, rows});
    return {forSession(token) {
      assert.equal(token, 'test-session');
      return {error: rows.length > 100 || writes.length === failAt ? {message: 'Datos no válidos.'} : null};
    }};
  };
  await vm.runInNewContext(source + '\nautoAssignHalfCommissions()', {
    window: {gestorName: 'Test', PTHSecureData: {token: () => 'test-session', clearCaches() {}}},
    resolveSalesHierarchy: async () => ({}), confirm: () => true, alert: s => alerts.push(s),
    event: {currentTarget: button}, document: {getElementById: () => button}, console: {error() {}},
    localStorage: {removeItem() {}}, renderGestorPricing: () => refreshed++, loadProducts() {},
    supabaseClient: {from: table => ({
      select: () => ({eq: () => ({data: table === 'productos' ? products : saved})}),
      insert: rows => write('insert', rows), upsert: rows => write('upsert', rows)
    })}
  });
  return {writes, alerts, button, refreshed};
}

test('50% divides large writes and preserves manual settings', async () => {
  const {writes, alerts} = await run();
  assert.deepEqual(writes.map(w => [w.op, w.rows.length]), [['insert', 100], ['insert', 100], ['insert', 1], ['upsert', 1]]);
  assert.ok(writes.every(w => w.rows.every(r => r.producto_id !== 0 && r.comision_subgestor === 5)));
  assert.equal(writes[3].rows[0].nuevo_precio, 60);
  assert.equal(writes[3].rows[0].visible_subgestor, false);
  assert.match(alerts[0], /202 productos/);
});

test('a failed batch stops further writes and reports only confirmed saves', async () => {
  const {writes, alerts, button, refreshed} = await run(2);
  assert.equal(writes.length, 2);
  assert.match(alerts[0], /100 de 202/);
  assert.doesNotMatch(alerts[0], /exitosa/);
  assert.equal(button.disabled, false);
  assert.equal(refreshed, 1);
});
