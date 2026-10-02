/* Existing secure-data access only. Generated files remain in this device's memory. */
(function (root) {
 'use strict';
 const id = product => String(product.id);
 const abortError = () => new DOMException('Preparación cancelada.', 'AbortError');
 function scope() { return root.PTHSecureData?.token() || ''; }
 function assertScope(token, signal) {
  if (signal?.aborted) throw abortError();
  if (!token || scope() !== token) throw Error('La sesión cambió. Abre de nuevo la herramienta.');
 }
 function wait(promise, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
   const abort = () => { cleanup(); reject(abortError()); }, cleanup = () => signal?.removeEventListener('abort', abort);
   signal?.addEventListener('abort', abort, { once: true });
   Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
 }
 async function pages(makeQuery, signal, token) {
  const rows = [], seen = new Set();
  for (let start = 0; start < 30000; start += 500) {
   assertScope(token, signal);
   const result = await wait(makeQuery().range(start, start + 499), signal);
   assertScope(token, signal);
   if (result.error) throw Object.assign(Error(result.error.message || 'No se pudo comprobar el catálogo.'), { status: result.error.status });
   if (!Array.isArray(result.data)) throw Error('El catálogo no devolvió una respuesta válida.');
   for (const row of result.data) { const key = row.id || row.producto_id; if (!seen.has(String(key))) { seen.add(String(key)); rows.push(row); } }
   if (result.data.length < 500) return rows;
  }
  throw Error('El catálogo es demasiado grande para esta descarga. No se usará una selección incompleta.');
 }
 // Whitelist avoids carrying customer/cost/commission fields into renderers and copy.
 function publicProduct(product) {
  const result = {};
  for (const field of ['id', 'nombre', 'precio', 'thumbnail', 'categoria', 'descripcion', 'garantia', 'mensajeria', 'disponible']) result[field] = product[field];
  return result;
 }
 async function catalogue(client, signal) {
  const profile = await wait(root.PTHSecureData.restore(), signal), token = scope();
  if (!profile?.id || !profile.nombre) throw Error('Inicia sesión para usar esta herramienta.');
  assertScope(token, signal);
  let owner = profile.parent_id ? profile.parent_nombre : profile.nombre;
  if (!owner && profile.parent_id) {
   const response = await wait(client.from('gestores').select('nombre').eq('id', profile.parent_id).maybeSingle(), signal);
   assertScope(token, signal);
   if (response.error || !response.data?.nombre) throw Error('No se pudo comprobar la cuenta principal.');
   owner = response.data.nombre;
  }
  if (!owner) throw Error('No se pudo comprobar tu cuenta.');
  const products = await pages(() => client.from('productos').select('*').eq('disponible', 'SI').order('id'), signal, token);
  const prices = await pages(() => client.from('precios_personalizados').select('producto_id, nuevo_precio, comision_subgestor, visible_subgestor').eq('gestor', owner).order('producto_id'), signal, token);
  const custom = new Map(prices.map(row => [String(row.producto_id), row]));
  const resolved = products.filter(product => !profile.parent_id || custom.get(id(product))?.visible_subgestor !== false).map(product => {
   const price = custom.get(id(product)), base = Number(product.precio), requested = Number(price?.nuevo_precio);
   const result = publicProduct(product);
   result.precio = String(product.precio_flexible).toUpperCase() === 'SI' && Number.isFinite(requested) && requested >= base ? requested : base;
   result._studioPrivateCommission = profile.parent_id ? Math.max(0, Number(price?.comision_subgestor) || 0) : Math.max(0, Number(product.comision) || 0) + Math.max(0, result.precio - base);
   return result;
  });
  assertScope(token, signal);
  return { products: resolved, profile: { id: profile.id, nombre: profile.nombre, telefono: profile.telefono || '', parent_id: profile.parent_id || null }, token, verifiedAt: Date.now() };
 }
 function signature(product) { return JSON.stringify(publicProduct(product)); }
 function validate(products, options) {
  if (!products.length) throw Error('Selecciona al menos un producto.');
  for (const product of products) {
   if (!product.id || !product.nombre || !Number.isFinite(Number(product.precio)) || Number(product.precio) <= 0 || String(product.disponible).toUpperCase() !== 'SI') throw Error('Hay un producto sin precio válido o que ya no está disponible. Actualiza la selección.');
  }
  const rules = { individual: [1, Infinity], single: [1, 1], series: [1, Infinity], bundle: [2, 4], compare: [2, 3], multi: [2, 6] };
  const rule = rules[options.mode];
  if (!rule || products.length < rule[0] || products.length > rule[1]) throw Error('Este formato requiere ' + (rule?.[0] || 1) + ' a ' + (rule?.[1] || 1) + ' productos. Puedes usar Serie para compartir más equipos.');
  const total = products.reduce((sum, p) => sum + Number(p.precio), 0), requested = Number(options.promoPrice);
  const commission = options.allowCommissionDiscount ? products.reduce((sum, p) => sum + Math.max(0, Number(p._studioPrivateCommission) || 0), 0) : 0;
  if (options.promoPrice && (!Number.isFinite(requested) || requested < 0)) throw Error('Escribe un precio válido.');
  if (['bundle', 'multi'].includes(options.mode) && requested > 0 && requested < total - commission - 0.000001) throw Error('El precio del paquete no puede bajar de ' + root.PTHStudioDesigns.money(total - commission) + ' USD' + (options.allowCommissionDiscount ? ' usando tu comisión disponible.' : '.'));
 }
 function copy(products, options) {
  const design = root.PTHStudioDesigns, result = [];
  if (options.compositionTitle) result.push(design.clean(options.compositionTitle));
  for (const product of products) {
   result.push(design.clean(product.nombre) + (options.showPrice !== false ? ' — ' + design.money(product.precio) + ' USD' : ''));
   result.push(...design.facts(product).filter(row => row[0] !== 'Garantía').slice(0, 3).map(row => row[0] + ': ' + row[1]));
   result.push(...design.conditions(product, options)); result.push('');
  }
  if (['bundle', 'multi'].includes(options.mode) && options.showPrice !== false) result.push('Total del conjunto: ' + design.money(Number(options.promoPrice) || products.reduce((sum, p) => sum + Number(p.precio), 0)) + ' USD');
  if (options.showPhone !== false && options.gestorPhone) result.push('Consulta por WhatsApp: +' + String(options.gestorPhone).replace(/\D/g, ''));
  const params = new URLSearchParams({ ref: options.gestorName || '' });
  if (options.gestorPhone) params.set('contact', String(options.gestorPhone).replace(/\D/g, ''));
  if (products.length === 1) params.set('search', products[0].nombre);
  result.push('https://paratuhogar.org/?' + params.toString());
  return result.join('\n');
 }
 const MAX_FILES = 10, MAX_BYTES = 12 * 1024 * 1024, MAX_AGE = 5 * 60 * 1000;
 class Batch {
  constructor() { this.epoch = 0; this.busy = false; this.ready = null; this.controller = null; }
  cancel() { this.epoch++; this.controller?.abort(); this.controller = null; this.ready = null; this.busy = false; }
  valid() { return this.ready && !this.busy && this.ready.token === scope() && Date.now() - this.ready.at < MAX_AGE; }
  async prepare({ products, options, token, start = 0, progress = () => {} }) {
   if (this.busy) throw Error('Ya hay una tanda en preparación.');
   this.cancel(); this.busy = true; const epoch = this.epoch;
   const controller = this.controller = new AbortController(), signal = controller.signal;
   const files = [], used = []; let bytes = 0;
   try {
    validate(products, options); assertScope(token, signal);
    const series = ['single', 'individual', 'series'].includes(options.mode);
    const items = series ? products.slice(start, start + MAX_FILES).map(p => [p]) : [products];
    for (let index = 0; index < items.length; index++) {
     assertScope(token, signal); progress(index, items.length, 'Preparando imágenes');
     const canvas = document.createElement('canvas');
     try {
      const safeProducts = items[index].map(publicProduct);
      await (series ? root.PTHStudioDesigns.single(canvas, safeProducts[0], options, signal) : root.PTHStudioDesigns.composition(canvas, safeProducts, options, signal));
      assertScope(token, signal);
      const blob = await wait(new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('No se pudo guardar la imagen.')), 'image/jpeg', .91)), signal);
      if (blob.size > MAX_BYTES) throw Error('Una imagen supera el tamaño permitido. Prueba el formato cuadrado.');
      if (files.length && bytes + blob.size > MAX_BYTES) break;
      const name = root.PTHStudioDesigns.clean(series ? items[index][0].nombre : options.mode).replace(/[^a-z0-9áéíóúñ_-]/gi, '_').slice(0, 65);
      files.push(new File([blob], String(start + index + 1).padStart(3, '0') + '_' + name + '.jpg', { type: 'image/jpeg' }));
      used.push(...items[index]); bytes += blob.size;
     } finally { canvas.width = canvas.height = 1; }
    }
    assertScope(token, signal);
    if (epoch !== this.epoch) throw abortError();
    this.ready = { files, text: copy(used, options), products: used, token, at: Date.now(), bytes, start, next: series ? start + files.length : products.length, total: products.length };
    progress(files.length, files.length, 'Tanda preparada'); return this.ready;
   } finally { if (epoch === this.epoch) { this.busy = false; this.controller = null; } }
  }
  canShare() { if (!this.valid() || !root.navigator.share || !root.navigator.canShare) return false; try { return root.navigator.canShare({ files: this.ready.files }); } catch (_) { return false; } }
  share() {
   // Deliberately synchronous through navigator.share: retain the explicit click's activation.
   if (!this.valid()) return Promise.reject(Error('La tanda venció o la sesión cambió. Vuelve a prepararla.'));
   if (!this.canShare()) return Promise.reject(Error('Este navegador no comparte archivos. Descarga la tanda y adjúntala en WhatsApp.'));
   this.busy = true; const epoch = this.epoch;
   try { return Promise.resolve(root.navigator.share({ files: this.ready.files })).finally(() => { if (epoch === this.epoch) this.busy = false; }); }
   catch (error) { this.busy = false; return Promise.reject(error); }
  }
 }
 root.PTHStudioJobs = { id, scope, assertScope, wait, catalogue, publicProduct, signature, validate, copy, Batch, MAX_FILES, MAX_BYTES, MAX_AGE };
})(window);
