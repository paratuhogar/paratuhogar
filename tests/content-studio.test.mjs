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
