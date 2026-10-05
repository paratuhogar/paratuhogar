import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectRow } from '../supabase/functions/secure-data/policy.mjs';

const source = fs.readFileSync(new URL('../js/storefront.js', import.meta.url), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const now = Date.parse('2026-10-05T19:00:00Z');
class Clock extends Date { static now() { return now; } }
const row = (id, changes = {}) => ({ id, nombre: id, categoria: 'HOGAR', precio: '100.00', disponible: 'SI', created_at: '2026-10-04T19:00:00Z', comision: '11.00', ...changes });

function fixture(products, seller = true) {
    const nodes = new Map(['search-bar', 'sort-selector', 'sort-selector-public', 'filter-high-comm', 'gestor-catalog-available', 'gestor-catalog-new', 'gestor-catalog-high-commission', 'gestor-catalog-result-label'].map(id => [id, { value: '', checked: false, textContent: '' }]));
    let headings = [], copy = false;
    const context = {
        Date: Clock, console, productosRaw: products, activeCategory: 'TODOS', catalogLoadError: null,
        gestorName: seller ? 'Gestor sintético' : '',
        localStorage: { getItem: () => seller ? 'synthetic-session' : null },
        offlineStorefront: { usingCopy: () => copy, current: () => null, status() {} },
        document: { getElementById: id => nodes.get(id) || null, querySelectorAll: selector => selector === '#productos-container h3' ? headings.map(textContent => ({ textContent })) : [] },
        renderCatalogProducts(list) { context.rendered = list.slice(0, vm.runInContext('catalogVisibleCount', context)); context.renderGestorCatalogSummary(list.length); }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(slice('function isProductCurrentlyAvailable(', 'function parseCommercialNumber('), context);
    vm.runInContext(slice("let gestorCatalogView = 'grid';", 'function getCatalogProductBadges('), context);
    vm.runInContext(slice('const CATALOG_PAGE_SIZE = 24;', '    // 3. DETALLE DE PRODUCTO'), context);
    vm.runInContext(slice('function applySort()', 'function getProductForQuickAction('), context);
    vm.runInContext(slice('function getProductsVisibleOnScreen()', '// Optional sales tools'), context);
    return { context, nodes, select: filter => context.setGestorCatalogFilter(filter), ids: () => Array.from(context.rendered, p => p.id), fallback: () => Array.from(context.getProductsVisibleOnScreen(), p => p.id), headings: values => { headings = values; }, copy: value => { copy = value; } };
}

test('Nuevos includes the existing seven-day boundary and legacy fecha, but excludes future, stale and unavailable rows', () => {
    const f = fixture([
        row('today', { created_at: new Date(now).toISOString() }),
        row('boundary', { created_at: '2026-09-28T19:00:00Z' }),
        row('stale', { created_at: '2026-09-28T18:59:59.999Z', updated_at: new Date(now).toISOString() }),
        row('future', { created_at: '2026-10-05T19:00:00.001Z' }),
        row('legacy', { created_at: null, fecha: '2026-10-03T19:00:00Z' }),
        row('invalid', { created_at: 'not-a-date' }), row('missing', { created_at: null }),
        row('unavailable', { disponible: 'NO' })
    ]);
    f.select('nuevos');
    assert.deepEqual(f.ids().sort(), ['boundary', 'legacy', 'today']);
    assert.equal(f.nodes.get('gestor-catalog-new').textContent, 3);
});

test('Mayor ganancia and the switch use strictly more than ten for numeric and numeric-string commissions', () => {
    const rows = [row('below', { comision: 9.99 }), row('exact', { comision: '10.00' }), row('above', { comision: '10.01' }), row('number', { comision: 11 }), row('spaced', { comision: ' 12.50 ' }), row('missing', { comision: null }), row('invalid', { comision: 'unknown' }), row('infinite', { comision: 'Infinity' }), row('unavailable', { disponible: 'NO' })];
    for (const mode of ['card', 'switch']) {
        const f = fixture(rows);
        if (mode === 'card') f.select('comision');
        else { f.nodes.get('filter-high-comm').checked = true; f.context.renderProducts(); }
        assert.deepEqual(f.ids().sort(), ['above', 'number', 'spaced']);
        assert.equal(f.nodes.get('gestor-catalog-high-commission').textContent, 3);
    }
});

test('both smart filters combine with search, category and the commission switch without filling an empty result', () => {
    const f = fixture([row('recent-low', { comision: '10.00' }), row('recent-high'), row('old-high', { created_at: '2026-09-01T00:00:00Z' }), row('kitchen', { categoria: 'COCINA' })]);
    f.nodes.get('filter-high-comm').checked = true;
    f.nodes.get('search-bar').value = 'recent';
    f.context.activeCategory = 'HOGAR';
    f.select('nuevos'); assert.deepEqual(f.ids(), ['recent-high']); assert.deepEqual(f.fallback(), ['recent-high']);
    f.nodes.get('search-bar').value = 'old';
    f.context.renderProducts(); assert.deepEqual(f.ids(), []); assert.deepEqual(f.fallback(), []);
    f.select('comision'); assert.deepEqual(f.ids(), ['old-high']); assert.deepEqual(f.fallback(), ['old-high']);
    f.context.activeCategory = 'COCINA';
    f.context.renderProducts(); assert.deepEqual(f.ids(), []); assert.deepEqual(f.fallback(), []);
    assert.equal(f.nodes.get('search-bar').value, 'old');
    assert.equal(f.nodes.get('filter-high-comm').checked, true);
});

test('empty DOM fallback preserves Mayor ganancia even when the separate switch is off', () => {
    const f = fixture([row('low', { comision: '5.00' }), row('exact', { comision: '10.00' }), row('high')]);
    f.select('comision');
    assert.deepEqual(f.fallback(), ['high']);
    f.context.productosRaw = [row('low', { comision: '5.00' })];
    f.context.renderProducts(); assert.deepEqual(f.ids(), []); assert.deepEqual(f.fallback(), []);
});

test('tools still use the rendered pagination prefix when cards exist', () => {
    const f = fixture(Array.from({ length: 30 }, (_, i) => row(`Product ${i}`)));
    f.select('nuevos');
    f.headings(f.context.rendered.map(p => p.nombre));
    assert.equal(f.fallback().length, 24);
    assert.deepEqual(f.fallback(), f.ids());
});

test('commission filters use the existing role projection instead of base pools or account percentages', () => {
    const sourceRows = [row('base-high-assigned-low', { comision: '40.00' }), row('base-low-assigned-high', { comision: '5.00' }), row('exact-assigned', { comision: '30.00' })];
    const assigned = new Map([['base-high-assigned-low', { comision_subgestor: '5.00' }], ['base-low-assigned-high', { comision_subgestor: '12.00' }], ['exact-assigned', { comision_subgestor: '10.00' }]]);
    const original = JSON.stringify(sourceRows);
    for (const [actor, expected] of [[{ id: 'parent', rol: 'gestor' }, ['base-high-assigned-low', 'exact-assigned']], [{ id: 'child', parent_id: 'parent', rol: 'gestor', comision_sub_pct: 99 }, ['base-low-assigned-high']], [{ id: 'admin', rol: 'admin' }, ['base-high-assigned-low', 'exact-assigned']]]) {
        const f = fixture(sourceRows.map(p => projectRow('productos', p, actor, assigned)));
        f.select('comision'); assert.deepEqual(f.ids().sort(), expected);
        assert.equal(f.nodes.get('gestor-catalog-high-commission').textContent, expected.length);
    }
    assert.equal(JSON.stringify(sourceRows), original);
});

test('public catalogues retain availability and private-copy mode does not expose a commission filter', () => {
    const publicView = fixture([row('old', { created_at: '2026-09-01T00:00:00Z' }), row('low', { comision: 5 }), row('unavailable', { disponible: 'NO' })], false);
    publicView.select('nuevos'); assert.deepEqual(publicView.ids().sort(), ['low', 'old']);
    const copyView = fixture([row('low', { comision: 0 })]); copyView.copy(true);
    copyView.nodes.get('filter-high-comm').checked = true;
    copyView.select('comision'); copyView.context.renderProducts();
    assert.deepEqual(copyView.ids(), ['low']); assert.equal(copyView.nodes.get('gestor-catalog-high-commission').textContent, '—');
});
