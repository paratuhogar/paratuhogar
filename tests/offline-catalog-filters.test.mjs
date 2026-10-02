import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import low from '../js/low-connectivity.js';

const source = fs.readFileSync(new URL('../js/offline-catalog.js', import.meta.url), 'utf8');
const products = Object.freeze([
  Object.freeze({id:'panel', nombre:'Panel solar  bifacial 595 W', categoria:'ENERGIA ', precio:219.99, disponible:'SI'}),
  Object.freeze({id:'battery', nombre:'Batería portátil LiFePO₄', categoria:'  ENERGÍA', precio:850, disponible:'SI'}),
  Object.freeze({id:'cooler', nombre:'Refrigerador dos puertas', categoria:'MUNDOFRIO ', precio:510, disponible:'SI'}),
  Object.freeze({id:'freezer', nombre:'Congelador horizontal', categoria:' mundofrio', precio:290, disponible:'NO'}),
  Object.freeze({id:'bike', nombre:'Bicicleta eléctrica', categoria:'TRANSPORTE', precio:499, disponible:'SI'}),
  Object.freeze({id:'scooter', nombre:'Moto eléctrica', categoria:'TRANSPORTE\t', precio:990, disponible:'SI'}),
  Object.freeze({id:'oven', nombre:'Horno\tde\u00a0cocina', categoria:'Cocina  y\tHogar', precio:120, disponible:'SI'}),
  Object.freeze({id:'stove', nombre:'Cocina de gas', categoria:' cocina y hogar ', precio:75, disponible:'SI'}),
  Object.freeze({id:'other', nombre:'Equipo sin categoría', categoria:' \t', precio:12.5, disponible:'SI'})
]);

// Exercise the complete reader and its DOM events, with a real public cache.
function reader(rows = products) {
  class Element {
    constructor(tag) { this.tagName=tag; this.children=[]; this.value=''; this.textContent=''; this.events={}; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children=[...nodes]; }
    get options() { return this.children; }
    addEventListener(name, handler) { this.events[name]=handler; }
  }
  const elements = Object.fromEntries(['catalog-date','offline-products','offline-search','offline-category','offline-count','offline-refresh'].map(id=>[id,new Element(id)]));
  const saved = new Map();
  const storage={getItem:key=>saved.get(key)||null, setItem:(key,value)=>saved.set(key,String(value)), removeItem:key=>saved.delete(key)};
  assert.equal(low.create(storage).savePublic(rows), true);
  const snapshot=saved.get(low.CATALOG_KEY);
  const context={localStorage:storage, PTHLowConnectivity:low, PTHProductImages:{render:()=>''}, PTHPublicCatalog:{fetch:async()=>rows}, navigator:{onLine:true}, document:{getElementById:id=>elements[id], createElement:tag=>new Element(tag)}};
  context.window=context;
  vm.runInNewContext(source, context);
  return {
    elements, snapshot,
    search(value) { elements['offline-search'].value=value; elements['offline-search'].events.input(); },
    category(value) { elements['offline-category'].value=value; elements['offline-category'].events.change(); },
    names() { return elements['offline-products'].children.filter(node=>node.tagName==='article').map(node=>node.children[0].textContent); },
    cache() { return saved.get(low.CATALOG_KEY); }
  };
}

for (const query of ['panel solar bifacial', 'Panel SOLAR BIFACIAL', ' panel   solar bifacial ', 'panel\tsolar\nbifacial', 'panel\u00a0solar bifacial', 'bifacial panel solar', 'bifacial', 'solar 595 W']) {
  test(`public reader finds the double-space panel name with ${JSON.stringify(query)}`, () => {
    const view=reader(); view.search(query);
    assert.deepEqual(view.names(), ['Panel solar  bifacial 595 W']);
  });
}

for (const [query, expected] of [['bateria PORTATIL','Batería portátil LiFePO₄'], ['BATERÍA portatil','Batería portátil LiFePO₄'], ['horno de cocina','Horno\tde\u00a0cocina'], ['electricA bicicleta','Bicicleta eléctrica']]) {
  test(`public reader ignores case, diacritics and whitespace for ${JSON.stringify(query)}`, () => {
    const view=reader(); view.search(query); assert.deepEqual(view.names(), [expected]);
  });
}

test('all search words must match; clearing a whitespace-only query restores the full copy', () => {
  const view=reader(); view.search('panel refrigerador'); assert.deepEqual(view.names(), []);
  view.search(' \t\u00a0\n'); assert.equal(view.names().length, products.length);
});

test('category options merge whitespace, case and diacritic variants without empty duplicates', () => {
  const view=reader(); const options=view.elements['offline-category'].options;
  assert.deepEqual(options.map(option=>[option.value,option.textContent]), [
    ['','Todas'], ['COCINA Y HOGAR','Cocina y Hogar'], ['ENERGIA','ENERGIA'], ['MUNDOFRIO','MUNDOFRIO'], ['TRANSPORTE','TRANSPORTE']
  ]);
  for (const [value, expected] of [['ENERGIA',2], ['MUNDOFRIO',2], ['TRANSPORTE',2], ['COCINA Y HOGAR',2]]) {
    view.category(value); assert.equal(view.names().length, expected);
  }
});

test('normalized category filters combine with search and survive a public-copy refresh', async () => {
  const view=reader(); view.category('ENERGIA'); view.search('solar bifacial');
  assert.deepEqual(view.names(), ['Panel solar  bifacial 595 W']);
  await view.elements['offline-refresh'].onclick.call(view.elements['offline-refresh']);
  assert.equal(view.elements['offline-category'].value, 'ENERGIA');
  assert.deepEqual(view.names(), ['Panel solar  bifacial 595 W']);
  view.category('TRANSPORTE'); assert.deepEqual(view.names(), []);
});

test('search and category normalization leave product names, prices and the persisted copy unchanged', () => {
  const view=reader(); view.category('ENERGIA'); view.search('panel solar bifacial');
  assert.equal(view.cache(), view.snapshot);
  const card=view.elements['offline-products'].children[0];
  assert.equal(card.children[0].textContent, products[0].nombre);
  assert.equal(card.children[1].textContent, '$219.99 USD');
  assert.equal(products[0].categoria, 'ENERGIA ');
});

test('submitted name and category markup remain literal text during normalized matching', () => {
  const row={id:'literal',nombre:'Panel <script>example</script>',categoria:' <img onerror=example> ',precio:10,disponible:'SI'};
  const view=reader([row]); view.search('PANEL example');
  assert.deepEqual(view.names(), [row.nombre]);
  assert.equal(view.elements['offline-category'].options[1].textContent, '<img onerror=example>');
});
