import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../js/storefront.js', import.meta.url), 'utf8');
const slice = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
function fixture(seller = false) {
 const nodes = new Map(['search-bar', 'sort-selector-public', 'sort-selector', 'filter-high-comm', 'marketing-cat-label'].map(id => [id, { value: '', checked: false }]));
 const data = Array.from({ length: 86 }, (_, index) => ({ id: String(index), nombre: 'Equipo ' + String(85 - index).padStart(2, '0'), precio: 17 + index, comision: index % 3 ? 20 : 5, vistas: 86 - index, created_at: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(), categoria: index % 2 ? 'COCINA' : 'HOGAR', disponible: index === 85 ? 'NO' : 'SI' })).sort((a, b) => a.nombre.localeCompare(b.nombre));
 const context = { document: { getElementById: id => nodes.get(id) || null }, localStorage: { getItem: () => seller ? 'session' : null }, gestorName: seller ? 'Gestor' : '', productosRaw: data, activeCategory: 'TODOS', catalogLoadError: null, Date, console, showCatalogLoadError() { assert.fail('unexpected load failure'); }, isProductCurrentlyAvailable: product => product.disponible === 'SI' && product.precio > 0, trackSpy() {}, renderCategories() {}, renderCatalogProducts(list) { context.visible = list.slice(0, vm.runInContext('catalogVisibleCount', context)).map(p => p.id); context.total = list.length; } };
 context.window = context; vm.createContext(context);
 vm.runInContext(slice("let gestorCatalogView = 'grid';", 'function getCatalogProductBadges('), context);
 vm.runInContext(slice('const CATALOG_PAGE_SIZE = 24;', '    // 3. DETALLE DE PRODUCTO'), context);
 vm.runInContext(slice('function applySort()', 'function getProductForQuickAction('), context);
 vm.runInContext(slice('    function filterByCategory(', '    function removeFromCart('), context);
 return { context, nodes, data, visible: () => Array.from(context.visible), choose(criteria) { nodes.get(seller ? 'sort-selector' : 'sort-selector-public').value = criteria; } };
}
for (const seller of [false, true]) for (const criterion of ['precio_asc', 'precio_desc', 'nuevo', 'demandados', 'comision_desc']) {
 test(`${seller ? 'gestor' : 'visitor'} keeps ${criterion} ordering and the existing prefix across pagination`, () => {
  const f = fixture(seller); f.choose(criterion); f.context.renderProducts(); const first = f.visible(); assert.equal(first.length, 24);
  f.context.loadMoreCatalogProducts(); const second = f.visible(); assert.equal(second.length, 48); assert.deepEqual(second.slice(0, 24), first);
  f.context.loadMoreCatalogProducts(); f.context.loadMoreCatalogProducts(); assert.equal(f.visible().length, 85); assert.deepEqual(f.visible().slice(0, 48), second);
  const field = { precio_asc: 'precio', precio_desc: 'precio', nuevo: 'created_at', demandados: 'vistas', comision_desc: 'comision' }[criterion], direction = criterion === 'precio_asc' ? 1 : -1;
  const values = f.visible().map(id => f.data.find(p => p.id === id)[field]).map(v => field === 'created_at' ? new Date(v).getTime() : v);
  assert.ok(values.every((value, index) => !index || direction * (value - values[index - 1]) >= 0));
 });
}
test('search, category and commission filters keep their values and selected sort when paginated', () => {
 const f = fixture(true); f.choose('precio_asc'); f.nodes.get('search-bar').value = 'Equipo'; f.nodes.get('filter-high-comm').checked = true; f.context.activeCategory = 'COCINA';
 f.context.renderProducts(); const before = f.visible(); f.context.loadMoreCatalogProducts();
 assert.deepEqual(f.visible().slice(0, before.length), before); assert.equal(f.nodes.get('search-bar').value, 'Equipo'); assert.equal(f.nodes.get('filter-high-comm').checked, true); assert.equal(f.context.activeCategory, 'COCINA');
 assert.ok(f.visible().every(id => { const p = f.data.find(p => p.id === id); return p.categoria === 'COCINA' && p.comision > 10; }));
 f.nodes.get('search-bar').value = 'Equipo 0'; f.context.renderProducts(); assert.equal(vm.runInContext('catalogVisibleCount', f.context), 24);
 const prices = f.visible().map(id => f.data.find(p => p.id === id).precio); assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});
test('only the explicit empty-state recovery clears filters; ordinary availability filter preserves them', () => {
 const f = fixture(true); f.choose('precio_asc'); f.nodes.get('search-bar').value = 'no match'; f.nodes.get('filter-high-comm').checked = true; f.context.activeCategory = 'COCINA';
 f.context.setGestorCatalogFilter('disponibles'); assert.equal(f.visible().length, 0); assert.equal(f.nodes.get('search-bar').value, 'no match'); assert.equal(f.context.activeCategory, 'COCINA');
 f.context.showAllAvailableCatalogProducts(); assert.equal(f.nodes.get('search-bar').value, ''); assert.equal(f.nodes.get('filter-high-comm').checked, false); assert.equal(f.context.activeCategory, 'TODOS'); assert.equal(f.nodes.get('sort-selector').value, 'precio_asc'); assert.equal(f.visible().length, 24); assert.equal(f.context.total, 85);
});
