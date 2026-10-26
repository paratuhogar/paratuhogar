import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/storefront.js', import.meta.url), 'utf8');
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
const tick = () => new Promise(resolve => setImmediate(resolve));
function page() {
    const requests = new Map(), rendered = [], notes = [];
    const context = { console: { log() {}, error() {} }, Promise,
        document: { getElementById: () => null },
        supabaseClient: { from(table) {
            const request = deferred();
            if (!requests.has(table)) requests.set(table, []);
            requests.get(table).push(request);
            return { select() { return this; }, order() { return this; }, then(a, b) { return request.promise.then(a, b); } };
        } },
        loadMensajerosEnAdmin: () => {
            const request = deferred();
            if (!requests.has('mensajeros')) requests.set('mensajeros', []);
            requests.get('mensajeros').push(request);
            return request.promise;
        },
        populateLogisticaFilters() {}, renderAdminCortes() {}, updateAdminStats() {},
        renderAdminLogistica() { rendered.push('orders'); },
        populateInventarioProveedorFilter() {}, renderAdminInventario() { rendered.push('products'); },
        calculateProductSales() { rendered.push('sales'); }, renderAnaliticaGestores() {}, renderAnaliticaProveedores() {},
        renderAnaliticaCancelacion() {}, renderAnaliticaZombies() {},
        renderAnaliticaConversion() { rendered.push('views'); },
        loadPendingGestores() { notes.push('pending'); }, loadAdminReports() {}, loadAdminCategorias() {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('let pedidosRawAdmin ='), source.indexOf('// =================================================================\n// 🚴')), context);
    const finish = (table, index = 0, error = null) => requests.get(table)[index].resolve({ data: error ? null : [{ id: table }], error });
    return { context, requests, rendered, notes, finish };
}

test('independent requests start together and orders render before slow products or views', { timeout: 1000 }, async () => {
    const p = page(); const loading = p.context.loadAdminData(); await tick();
    assert.ok(p.requests.has('pedidos'), 'orders must not wait for messengers');
    assert.ok(p.requests.has('productos'), 'inventory starts in parallel');
    p.finish('pedidos'); await tick();
    assert.ok(!p.rendered.includes('orders'), 'messenger names must be ready before logistics');
    p.finish('mensajeros'); await tick();
    assert.ok(p.rendered.includes('orders'), 'slow inventory/analytics must not block orders');
    p.finish('productos'); await loading;
    assert.ok(p.rendered.includes('products'));
    assert.ok(p.rendered.includes('sales'), 'sales statistics must not wait for visit metrics');
    p.finish('metricas_vistas'); await tick();
    assert.ok(p.rendered.includes('views'));
});

test('failed metrics cannot hide current orders or prevent completing the operational refresh', { timeout: 1000 }, async () => {
    const p = page(); const loading = p.context.loadAdminData(); await tick();
    p.finish('mensajeros'); await tick(); p.finish('pedidos'); await tick(); p.finish('productos');
    await loading;
    assert.ok(p.rendered.includes('orders'));
    p.finish('metricas_vistas', 0, { message: 'unavailable' }); await tick();
    assert.ok(!p.rendered.includes('views'), 'an unavailable metric must not look like zero visits');
});

test('overlapping refreshes serialize one trailing reload so a just-saved change is not lost', { timeout: 1000 }, async () => {
    const p = page(); const first = p.context.loadAdminData(); await tick();
    const second = p.context.loadAdminData(); const third = p.context.loadAdminData(); await tick();
    assert.equal(p.requests.get('mensajeros').length, 1);
    for (const table of ['mensajeros', 'pedidos', 'productos', 'metricas_vistas']) p.finish(table);
    await tick(); await tick();
    assert.equal(p.requests.get('pedidos').length, 2, 'one trailing refresh catches writes during the first request');
    for (const table of ['mensajeros', 'pedidos', 'productos', 'metricas_vistas']) p.finish(table, 1);
    await Promise.all([first, second, third]);
    assert.equal(p.requests.get('pedidos').length, 2);
});

test('late analytics from an earlier refresh cannot replace newer statistics', async () => {
    const p = page(); const first = p.context.loadAdminData(); await tick();
    for (const table of ['mensajeros', 'pedidos', 'productos']) p.finish(table);
    await first;
    const second = p.context.loadAdminData(); await tick();
    for (const table of ['mensajeros', 'pedidos', 'productos', 'metricas_vistas']) p.finish(table, 1);
    await second; await tick();
    assert.equal(p.rendered.filter(name => name === 'views').length, 1);
    p.finish('metricas_vistas'); await tick();
    assert.equal(p.rendered.filter(name => name === 'views').length, 1);
});

test('an account change prevents delayed orders, inventory and analytics rendering', async () => {
    const p = page(); p.context.currentUserData = { id: 'first-admin' };
    const loading = p.context.loadAdminData(); await tick();
    p.context.currentUserData = { id: 'other-admin' };
    for (const table of ['mensajeros', 'pedidos', 'productos', 'metricas_vistas']) p.finish(table);
    await loading; await tick();
    assert.deepEqual(p.rendered, []);
    assert.deepEqual(p.notes, []);
});

test('failed orders retain the previous list and a later refresh can recover', async () => {
    const p = page(); const loading = p.context.loadAdminData(); await tick();
    p.finish('mensajeros'); p.finish('pedidos', 0, { message: 'network' });
    p.finish('productos'); p.finish('metricas_vistas'); await loading; await tick();
    assert.ok(!p.rendered.includes('orders'));
    const retry = p.context.loadAdminData(); await tick();
    for (const table of ['mensajeros', 'pedidos', 'productos', 'metricas_vistas']) p.finish(table, 1);
    await retry; await tick();
    assert.ok(p.rendered.includes('orders'));
});
