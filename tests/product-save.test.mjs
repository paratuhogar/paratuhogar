import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual form listener and secure adapter; mock only DOM and transport.
const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = source.indexOf("document.getElementById('form-nuevo-prod').addEventListener('submit', async function(e) {");
assert.ok(start > 0);
const listener = source.slice(start, source.indexOf('// Función mágica de compresión', start));
function fixture({ select, save, refresh, marker, confirm = true, editId = '', descriptionError = false } = {}) {
  const fields = {
    'p-nombre': 'Nevera Royal 10 pies', 'p-categoria': 'Refrigeración', 'p-id-edit': editId,
    'p-ficha-pdf': '', 'p-ficha-pdf-nombre': '', 'p-ficha-pdf-idioma': 'ES',
    'p-precio': '370', 'p-comision': '10', 'p-disponible': 'SI', 'p-create-inactive': '',
    'p-mensajeria': '', 'p-tamano-envio': 'Grande', 'p-proveedor': 'ANEB',
    'p-flexible': 'NO', 'p-garantia': '1 mes',
    'img-path-0': 'nevera.webp', 'img-path-1': '', 'img-path-2': '', 'img-path-3': ''
  };
  const nodes = Object.fromEntries(Object.entries(fields).map(([id, value]) => [id, { value, checked: false, focus() {} }]));
  const classList = { add() {}, remove() {} };
  nodes['editor-container'] = { innerHTML: '<p>Con luz interior. Medidas: 103 × 63 × 89 cm.</p>', setAttribute() {}, classList };
  nodes['modal-producto'] = { classList:{ add:() => { closed++; }, remove() {} } };
  nodes['btn-save-prod'] = { disabled: false, innerText: 'Guardar Cambios' };
  let submit;
  nodes['form-nuevo-prod'] = { inert:false, reset:() => { for (const id of Object.keys(fields)) nodes[id].value = ''; }, addEventListener: (event, callback) => { assert.equal(event, 'submit'); submit = callback; } };
  const items = new Map();
  const storage = { getItem: k => items.get(k) || null, setItem: (k,v) => items.set(k,String(v)), removeItem: k => items.delete(k), key: i => [...items.keys()][i], get length() { return items.size; } };
  const requests = [], alerts = [], confirms = [], logs = [];
  let closed = 0;
  const sdk = { from: table => {
    assert.equal(table, 'control_sistema', 'protected products must never use direct REST');
    return { upsert: async () => marker ? marker() : { error: null } };
  }, rpc() { throw Error('Unexpected RPC'); } };
  const context = {
    localStorage: storage, document: { body:{style:{}}, getElementById: id => nodes[id] || null },
    location: { origin: 'https://paratuhogar.org' }, Set, Map, Promise, AbortSignal, URL,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    supabase: { createClient: () => sdk },
    fetch: async (url, options) => {
      assert.ok(url.endsWith('/functions/v1/secure-data'));
      const body = JSON.parse(options.body); requests.push(body);
      const result = body.op === 'select' ? (select ? await select(body) : { data: [], error: null })
        : (save ? await save(body) : { data: null, error: null });
      return { status: 200, json: async () => result };
    },
    quill: null, normalizeTechnicalSheetUrl: () => '',
    alert: message => alerts.push(message), confirm: message => { confirms.push(message); return confirm; },
    updateFormCategories() {}, updateFormProviders() {}, previewGithubImage() {},
    productosRaw:[{id:'other-product',nombre:'Lavadora',precio:900}],
    loadAdminData: async () => { if (refresh) await refresh(); }
  };
  context.window = context;
  for (const file of ['secure-data.js', 'product-description-editor.js', 'product-availability-form.js']) {
    vm.runInNewContext(fs.readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  }
  context.supabaseClient = context.supabase.createClient();
  if (descriptionError) context.ProductDescriptionEditorApi.readProductDescription = () => { throw Error('Editor no disponible'); };
  const modalStart = source.indexOf('// --- FUNCIONES PARA EL FORMULARIO DE PRODUCTOS ---');
  vm.runInNewContext(source.slice(modalStart, source.indexOf('// --- FUNCIÓN PARA PROCESAR Y SUBIR IMAGEN ---', modalStart)), context);
  const editStart = source.indexOf('function editProduct(id)');
  vm.runInNewContext(source.slice(editStart, source.indexOf('// --- 3. HERRAMIENTAS DE MARKETING', editStart)), context);
  vm.runInNewContext(listener, context);
  return { context, nodes, requests, alerts, confirms, logs, submit: () => submit({ preventDefault() {} }), get closed() { return closed; } };
}
const writes = f => f.requests.filter(r => r.op === 'insert' || r.op === 'update');
function preserved(f) {
  assert.equal(f.nodes['p-nombre'].value, 'Nevera Royal 10 pies');
  assert.match(f.nodes['editor-container'].innerHTML, /Con luz interior/);
  assert.equal(f.nodes['btn-save-prod'].disabled, false);
  assert.equal(f.nodes['form-nuevo-prod'].inert, false);
}

test('new product saves through the secure adapter with same-category word filters', async () => {
  const f = fixture(); f.nodes['p-create-inactive'].checked = true;
  await f.submit();
  const lookup = f.requests[0];
  assert.equal(lookup.op, 'select'); assert.equal(lookup.limit, 3);
  assert.deepEqual(lookup.filters, [
    { method:'eq', column:'categoria', value:'Refrigeración' },
    { method:'ilike', column:'nombre', value:'%nevera%' },
    { method:'ilike', column:'nombre', value:'%royal%' },
    { method:'ilike', column:'nombre', value:'%pies%' }
  ]);
  assert.equal(writes(f).length, 1);
  assert.equal(writes(f)[0].values[0].disponible, 'NO');
  assert.equal(writes(f)[0].values[0].descripcion, f.nodes['editor-container'].innerHTML);
  assert.equal(f.closed, 1); assert.match(f.alerts[0], /Guardado correctamente/); preserved(f);
});
test('duplicate warning cancels safely or permits explicit override', async () => {
  for (const confirm of [true, false]) {
    const f = fixture({ confirm, select: () => ({ data:[{nombre:'Royal Nevera 10 pies',precio:370,categoria:'Refrigeración'}],error:null }) });
    await f.submit(); assert.equal(f.confirms.length, 1); assert.equal(writes(f).length, confirm ? 0 : 1); preserved(f);
  }
});
test('failed duplicate lookup is visible, keeps the draft and permits a later retry', async () => {
  let failed = true;
  const f = fixture({ select: () => ({ data:null,error:failed ? {message:'Consulta no disponible'} : null }) });
  await f.submit(); assert.equal(writes(f).length, 0); assert.match(f.alerts[0], /Consulta no disponible/); preserved(f);
  failed = false; await f.submit(); assert.equal(writes(f).length, 1);
});
test('transport failure does not write, discard the draft or leave the button disabled', async () => {
  const f = fixture({ select: () => { throw Error('Offline'); } });
  await f.submit(); assert.equal(writes(f).length, 0); assert.match(f.alerts[0], /conectar/); preserved(f);
});
test('duplicate clicks during the preflight send only one product write', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ select: async () => { await pending; return { data:[],error:null }; } });
  const first = f.submit(); const second = f.submit();
  release(); await Promise.all([first, second]); assert.equal(writes(f).length, 1); preserved(f);
});
test('pending save cannot be closed, reopened, edited or unlocked by resetting the button', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ select: async () => { await pending; return {data:[],error:null}; } });
  const first = f.submit();
  try {
    f.context.closeModalProd(); assert.equal(f.closed, 0);
    f.context.openModalProd(); preservedDraft(f);
    f.context.editProduct('other-product'); preservedDraft(f);
    // Regression: even if another UI path resets the button, the mutex holds.
    f.nodes['btn-save-prod'].disabled = false;
    await f.submit();
    assert.equal(f.nodes['form-nuevo-prod'].inert, true);
  } finally { release(); await first; }
  assert.equal(writes(f).length, 1); preserved(f);
});
function preservedDraft(f) {
  assert.equal(f.nodes['p-nombre'].value, 'Nevera Royal 10 pies');
  assert.equal(f.nodes['p-precio'].value, '370');
  assert.match(f.nodes['editor-container'].innerHTML, /Con luz interior/);
}
test('all saved fields belong to one snapshot taken before the async duplicate lookup', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture({ select: async () => { await pending; return {data:[],error:null}; } });
  const first = f.submit();
  f.nodes['p-precio'].value = '900';
  f.nodes['editor-container'].innerHTML = '<p>Otro borrador</p>';
  release(); await first;
  assert.equal(writes(f)[0].values[0].nombre, 'Nevera Royal 10 pies');
  assert.equal(writes(f)[0].values[0].precio, 370);
  assert.match(writes(f)[0].values[0].descripcion, /Con luz interior/);
});
test('edit skips duplicate search and preserves exact id and availability', async () => {
  const f = fixture({ editId:'product-fixture' }); f.nodes['p-disponible'].value = 'NO';
  await f.submit(); assert.equal(f.requests.length, 1);
  assert.equal(writes(f)[0].op, 'update'); assert.equal(writes(f)[0].filters[0].value, 'product-fixture');
  assert.equal(writes(f)[0].values.disponible, 'NO'); preserved(f);
});
test('save and description errors are handled without losing fields', async () => {
  for (const options of [
    { editId:'product-fixture', save: () => ({data:null,error:{message:'No se pudo actualizar'}}) },
    { descriptionError:true }
  ]) {
    const f = fixture(options); await f.submit(); assert.equal(f.closed, 0);
    assert.match(f.alerts[0], /No se pudo/); preserved(f);
  }
});
test('missing image validation does not query or lock the form', async () => {
  const f = fixture(); f.nodes['img-path-0'].value = '';
  await f.submit(); assert.equal(f.requests.length, 0); assert.match(f.alerts[0], /foto/); preserved(f);
});
test('post-save refresh failure is reported as saved, not as a failed insert', async () => {
  for (const options of [
    { marker: () => { throw Error('Marker unavailable'); } },
    { marker: () => ({error:{message:'Marker unavailable'}}) },
    { refresh: () => { throw Error('Refresh unavailable'); } }
  ]) {
    const f = fixture(options); await f.submit();
    assert.equal(writes(f).length, 1); assert.equal(f.closed, 1);
    assert.ok(f.alerts.some(message => /guardado/i.test(message)));
    assert.ok(f.alerts.some(message => /actualiz/i.test(message)));
    assert.ok(f.alerts.every(message => !/No se pudo guardar el producto/.test(message))); preserved(f);
  }
});
test('literal percent, underscore and backslash in names are not query wildcards', async () => {
  const f = fixture(); f.nodes['p-nombre'].value = '100% MOD_ABC ruta\\usb';
  await f.submit();
  assert.deepEqual(f.requests[0].filters.filter(x => x.method === 'ilike').map(x => x.value), ['%100\\%%', '%mod\\_abc%', '%ruta\\\\usb%']);
});
