import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture() {
 const root = { navigator: {}, PTHSecureData: { token: () => 'tenant-a' } };
 const ctx = vm.createContext({ window: root, URLSearchParams, DOMException, setTimeout, clearTimeout, AbortController, File, console });
 for (const name of ['studio-designs', 'studio-jobs']) vm.runInContext(fs.readFileSync(new URL('../js/' + name + '.js', import.meta.url), 'utf8'), ctx);
 return root;
}
const product = { id: 'p', nombre: 'Refrigerador 20 pies', descripcion: '<p>Tecnología Inverter. 900 × 697 × 1865 mm</p>', precio: 890, disponible: 'SI', garantia: '1 mes', mensajeria: 'Mensajería por costo adicional', comision: 40, costo_proveedor: 750, cliente: 'PRIVATE_SENTINEL' };
test('public artwork and copy whitelist excludes private financial/customer fields and fabricated claims', () => {
 const root = fixture(), publicRow = root.PTHStudioJobs.publicProduct(product);
 assert.equal(publicRow.comision, undefined); assert.equal(publicRow.cliente, undefined); assert.equal(publicRow.costo_proveedor, undefined);
 const text = root.PTHStudioJobs.copy([product], { mode: 'single', gestorName: 'Gestor', gestorPhone: '' });
 assert.match(text, /890/); assert.match(text, /1 mes/); assert.match(text, /costo adicional/);
 assert.doesNotMatch(text, /PRIVATE_SENTINEL|5356071095|24h|Factura|oferta|comisi[oó]n/i);
 assert.deepEqual(Array.from(root.PTHStudioDesigns.conditions({}), String), []);
 assert.equal(root.PTHStudioDesigns.facts(product).find(row => row[0] === 'Capacidad')[1], '20 pies cúbicos');
});
test('validation preserves existing Studio discount bounds, rejects invalid and unavailable products', () => {
 const { PTHStudioJobs: J } = fixture(), products = [{ ...product, _studioPrivateCommission: 40 }, { ...product, id: 'q', _studioPrivateCommission: 10 }];
 assert.throws(() => J.validate([{ ...product, precio: NaN }], { mode: 'single' }), /precio/);
 assert.throws(() => J.validate([{ ...product, disponible: 'NO' }], { mode: 'single' }), /disponible/);
 assert.throws(() => J.validate(products, { mode: 'bundle', promoPrice: '1750' }), /bajar/);
 assert.doesNotThrow(() => J.validate(products, { mode: 'bundle', promoPrice: '1750', allowCommissionDiscount: true }));
 assert.throws(() => J.validate(products, { mode: 'bundle', promoPrice: '1729', allowCommissionDiscount: true }), /bajar/);
 assert.throws(() => J.validate(products, { mode: 'bundle', promoPrice: '-1' }), /válido/);
 assert.doesNotThrow(() => J.validate(Array.from({ length: 1500 }, (_, i) => ({ ...product, id: String(i) })), { mode: 'series' }));
});
test('file sharing capability is exact and share invoked synchronously; cancellation, expiry and scope block reuse', async () => {
 const root = fixture(), batch = new root.PTHStudioJobs.Batch(), file = new File(['image'], 'p.jpg', { type: 'image/jpeg' });
 batch.ready = { files: [file], token: 'tenant-a', at: Date.now() };
 let calls = 0, capability;
 root.navigator.canShare = payload => { capability = payload; return true; };
 root.navigator.share = payload => { calls++; assert.equal(payload.files[0], file); return Promise.resolve(); };
 const shared = batch.share(); assert.equal(calls, 1); assert.deepEqual(Object.keys(capability), ['files']); await shared;
 root.navigator.canShare = () => false; assert.equal(batch.canShare(), false); await assert.rejects(batch.share(), /navegador/);
 root.navigator.canShare = () => true; root.PTHSecureData.token = () => 'tenant-b'; await assert.rejects(batch.share(), /sesión/);
 root.PTHSecureData.token = () => 'tenant-a'; batch.ready.at = 0; assert.equal(batch.valid(), false);
 batch.cancel(); assert.equal(batch.ready, null);
});
test('cancel stops awaiting interrupted operations promptly without using their eventual response', async () => {
 const root = fixture(), controller = new AbortController();
 const pending = root.PTHStudioJobs.wait(new Promise(() => {}), controller.signal); controller.abort();
 await assert.rejects(pending, error => error.name === 'AbortError');
});

test('customer copy provides the current gestor WhatsApp link without a fallback contact', () => {
 const { PTHStudioJobs: J } = fixture();
 assert.match(J.copy([product], { mode: 'single', gestorPhone: '+53 (5555) 1234' }), /Consulta por WhatsApp: https:\/\/wa\.me\/5355551234/);
 for (const gestorPhone of ['', 'abc']) assert.doesNotMatch(J.copy([product], { mode: 'single', gestorPhone }), /wa\.me\//);
 assert.doesNotMatch(J.copy([product], { mode: 'single', gestorPhone: '5355551234', showPhone: false }), /wa\.me\//);
});

for (const count of [1, 3]) test(`native sharing sends only ${count} images while retaining separate customer copy`, async () => {
 const root = fixture(), batch = new root.PTHStudioJobs.Batch();
 const files = Array.from({ length: count }, (_, i) => new File(['image'], `${i}.jpg`));
 const text = 'Refrigerador 20 pies — $890 USD\nConsulta por WhatsApp: https://wa.me/5355551234';
 batch.ready = { files, text, token: 'tenant-a', at: Date.now() };
 root.navigator.canShare = () => true;
 let payload; root.navigator.share = data => { payload = data; return Promise.resolve(); };
 await batch.share();
 assert.deepEqual(Object.keys(payload), ['files'], 'no automatic text, title or URL accompanies artwork');
 assert.equal(payload.files, files);
 assert.equal(batch.ready.text, text, 'the explicit copy action still has its prepared information');
});

test('all artwork themes and sizes display the complete gestor link and respect hidden contact', async () => {
 const root = {}, drawn = [];
 const drawing = new Proxy({ measureText: value => ({ width: value.length * 12 }), fillText: value => drawn.push(value) }, { get: (target, key) => key in target ? target[key] : () => {} });
 class ImageFixture { naturalWidth = 500; naturalHeight = 700; set src(value) { if (value) queueMicrotask(() => this.onload?.()); } }
 class FontFixture { load() { return Promise.resolve(this); } }
 const context = vm.createContext({ window: root, Image: ImageFixture, FontFace: FontFixture, document: { fonts: { add() {} } }, setTimeout, clearTimeout, queueMicrotask, DOMException });
 vm.runInContext(fs.readFileSync(new URL('../js/studio-designs.js', import.meta.url), 'utf8'), context);
 for (const theme of ['essential', 'premium', 'technical', 'editorial']) for (const isStory of [true, false]) {
  const canvas = { getContext: () => drawing };
  for (const method of ['single', 'composition']) {
   drawn.length = 0;
   await root.PTHStudioDesigns[method](canvas, method === 'single' ? { ...product, thumbnail: 'test.jpg' } : [{ ...product, thumbnail: 'test.jpg' }, { ...product, id: 'q', thumbnail: 'test.jpg' }], { theme, isStory, gestorPhone: '+53 5555 1234', mode: 'bundle' });
   assert.ok(drawn.includes('wa.me/5355551234'), `${theme}/${isStory}/${method}: complete link missing`);
  }
 }
 drawn.length = 0;
 await root.PTHStudioDesigns.single({ getContext: () => drawing }, { ...product, thumbnail: 'test.jpg' }, { gestorPhone: '5355551234', showPhone: false });
 assert.ok(!drawn.some(text => text.includes('5355551234')));
});
