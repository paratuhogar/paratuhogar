/* Complete Magic Studio preparation. Only generated artwork enters temporary local storage. */
(function (root) {
 'use strict';
 const J = root.PTHStudioJobs, MAX_OUTPUT_BYTES = 128 * 1024 * 1024, MAX_CACHE_BYTES = 2 * MAX_OUTPUT_BYTES;
 const abortError = () => new DOMException('Preparación cancelada.', 'AbortError');
 const missingError = () => Object.assign(Error('Falta una imagen temporal. Vuelve a preparar la selección.'), { code: 'ARTWORK_MISSING' });
 const tick = () => new Promise(resolve => setTimeout(resolve, 0));
 class ArtworkCache {
  constructor() { this.transactions = new Set(); }
  open() {
   if (!this.promise) this.promise = new Promise((resolve, reject) => {
    if (!root.indexedDB) { reject(Error('El navegador no permite guardar temporalmente las imágenes. Habilita su almacenamiento y vuelve a intentar.')); return; }
    const request = root.indexedDB.open('pth_studio_artwork_v1', 1);
    request.onupgradeneeded = () => {
     const files = request.result.createObjectStore('files', { keyPath: ['job', 'index'] }); files.createIndex('job', 'job');
     request.result.createObjectStore('usage');
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Cierra otras ventanas de Magic Studio y vuelve a intentar.'));
   }).catch(error => { this.promise = null; throw error; });
   return this.promise;
  }
  async transaction(mode, run, signal) {
   const db = await this.open(); if (signal?.aborted) throw abortError();
   return new Promise((resolve, reject) => {
    const tx = db.transaction(['files', 'usage'], mode); this.transactions.add(tx); let value, failure;
    const abort = () => { try { tx.abort(); } catch (_) {} };
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => { this.transactions.delete(tx); signal?.removeEventListener('abort', abort); };
    tx.oncomplete = () => { cleanup(); resolve(value); };
    tx.onabort = tx.onerror = () => { cleanup(); reject(signal?.aborted ? abortError() : failure || tx.error || Error('No se pudo guardar la preparación.')); };
    run(tx, result => value = result, error => { failure = error; abort(); });
   });
  }
  put(row, signal) {
   return this.transaction('readwrite', (tx, done, fail) => {
    const usage = tx.objectStore('usage'), request = usage.get('bytes');
    request.onsuccess = () => {
     const bytes = (request.result || 0) + row.blob.size;
     if (bytes > MAX_CACHE_BYTES) { fail(Error('El almacenamiento temporal está lleno. Cierra otras preparaciones o reduce la selección.')); return; }
     tx.objectStore('files').put(row); usage.put(bytes, 'bytes'); done(row.blob.size);
    };
   }, signal);
  }
  get(job, index, signal) {
   return this.transaction('readonly', (tx, done) => {
    const request = tx.objectStore('files').get([job, index]); request.onsuccess = () => done(request.result);
   }, signal);
  }
  remove(job) {
   return this.transaction('readwrite', (tx, done) => {
    const usage = tx.objectStore('usage'), files = tx.objectStore('files'); let removed = 0;
    const request = files.index('job').openCursor(root.IDBKeyRange.only(job));
    request.onsuccess = () => {
     const cursor = request.result;
     if (cursor) { removed += cursor.value.blob.size; cursor.delete(); cursor.continue(); }
     else { const count = usage.get('bytes'); count.onsuccess = () => usage.put(Math.max(0, (count.result || 0) - removed), 'bytes'); done(removed); }
    };
   });
  }
  sweep() {
   return this.transaction('readwrite', (tx, done) => {
    const usage = tx.objectStore('usage'); let remaining = 0;
    const request = tx.objectStore('files').openCursor();
    request.onsuccess = () => {
     const cursor = request.result;
     if (cursor) { if (cursor.value.at < Date.now() - 2 * 60 * 60 * 1000) cursor.delete(); else remaining += cursor.value.blob.size; cursor.continue(); }
     else { usage.put(remaining, 'bytes'); done(); }
    };
   });
  }
 }
 const crcTable = Uint32Array.from({ length: 256 }, (_, value) => { for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
 async function crc(blob, token, signal) {
  let value = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += 64 * 1024) {
   J.assertScope(token, signal); const bytes = new Uint8Array(await J.wait(blob.slice(offset, offset + 64 * 1024).arrayBuffer(), signal));
   for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
   await tick();
  }
  return (value ^ 0xffffffff) >>> 0;
 }
 // Standard UTF-8 ZIP, STORE: disk-backed Blob references, never an array of all JPEG bytes.
 function header(name, size, checksum, offset, central) {
  const encoded = new TextEncoder().encode(name), bytes = new Uint8Array((central ? 46 : 30) + encoded.length), view = new DataView(bytes.buffer);
  view.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  if (central) { view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x0800, true); view.setUint16(14, 33, true); view.setUint32(16, checksum, true); view.setUint32(20, size, true); view.setUint32(24, size, true); view.setUint16(28, encoded.length, true); view.setUint32(42, offset, true); }
  else { view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true); view.setUint16(12, 33, true); view.setUint32(14, checksum, true); view.setUint32(18, size, true); view.setUint32(22, size, true); view.setUint16(26, encoded.length, true); }
  bytes.set(encoded, central ? 46 : 30); return bytes;
 }
 async function archive(cache, job, text, token, signal, progress) {
  const parts = [], directory = []; let offset = 0;
  for (let index = 0; index <= job.entries.length; index++) {
   J.assertScope(token, signal);
   const row = index < job.entries.length ? await cache.get(job.id, index, signal) : { name: 'Texto_para_compartir.txt', blob: new Blob([text], { type: 'text/plain;charset=utf-8' }) };
   if (!row?.blob) throw missingError();
   const checksum = await crc(row.blob, token, signal), local = header(row.name, row.blob.size, checksum, 0, false);
   directory.push(header(row.name, row.blob.size, checksum, offset, true)); parts.push(local, row.blob); offset += local.length + row.blob.size;
   progress(index + 1, job.entries.length + 1, 'Creando ZIP completo');
  }
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0), end = new Uint8Array(22), view = new DataView(end.buffer);
  if (offset + directorySize + end.length > MAX_OUTPUT_BYTES) throw Error('El ZIP supera 128 MB. Reduce la selección para cuidar los recursos del dispositivo.');
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, directory.length, true); view.setUint16(10, directory.length, true); view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  J.assertScope(token, signal); return new File([...parts, ...directory, end], 'paratuhogar_seleccion_completa.zip', { type: 'application/zip' });
 }
 class Collection {
  constructor() { this.cache = new ArtworkCache(); this.epoch = 0; this.busy = false; this.ready = null; this.cleanup = Promise.resolve(); }
  cancel() {
   this.epoch++; this.controller?.abort(); this.controller = null; clearTimeout(this.expiryTimer); this.ready = null; this.busy = false;
   if (this.job) { const id = this.job.id; this.job = null; this.cleanup = this.cleanup.then(() => this.cache.remove(id)).catch(() => {}); }
  }
  valid() { return !!(this.ready && !this.busy && this.ready.token === J.scope() && Date.now() - this.ready.at < J.MAX_AGE); }
  async prepare({ products, options, token, progress = () => {} }) {
   if (this.busy) throw Error('Ya estamos preparando la selección.');
   J.validate(products, options); J.assertScope(token);
   const fingerprint = JSON.stringify([token, options, products.map(p => [J.signature(p), options.allowCommissionDiscount ? p._studioPrivateCommission : null])]);
   if (this.ready || this.job?.fingerprint !== fingerprint) this.cancel();
   this.ready = null; this.busy = true; const epoch = this.epoch, controller = this.controller = new AbortController(), signal = controller.signal;
   try {
    await this.cleanup; J.assertScope(token, signal);
    if (!this.job) { await this.cache.sweep(); J.assertScope(token, signal); this.job = { id: root.crypto.randomUUID(), fingerprint, entries: [], bytes: 0 }; }
    const job = this.job, series = ['single', 'individual', 'series'].includes(options.mode), count = series ? products.length : 1;
    for (let index = job.entries.length; index < count; index++) {
     J.assertScope(token, signal); progress(index, count, 'Preparando todas las imágenes');
     const group = series ? [products[index]] : products, canvas = document.createElement('canvas');
     try {
      const safe = group.map(J.publicProduct);
      await (series ? root.PTHStudioDesigns.single(canvas, safe[0], options, signal) : root.PTHStudioDesigns.composition(canvas, safe, options, signal));
      J.assertScope(token, signal);
      const blob = await J.wait(new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('No se pudo guardar la imagen.')), 'image/jpeg', .91)), signal);
      if (blob.size > J.MAX_BYTES) throw Error('Una imagen supera 12 MB. Prueba el formato cuadrado.');
      if (job.bytes + blob.size > MAX_OUTPUT_BYTES) throw Error('La selección supera 128 MB. Reduce la selección para cuidar los recursos del dispositivo.');
      const name = String(index + 1).padStart(3, '0') + '_' + root.PTHStudioDesigns.clean(series ? group[0].nombre : options.mode).replace(/[^a-z0-9áéíóúñ_-]/gi, '_').slice(0, 65) + '.jpg';
      await this.cache.put({ job: job.id, index, name, blob, at: Date.now() }, signal); J.assertScope(token, signal);
      job.entries.push({ name, size: blob.size }); job.bytes += blob.size;
     } finally { canvas.width = canvas.height = 1; }
     progress(index + 1, count, 'Preparando todas las imágenes'); await tick();
    }
    const text = J.copy(products, options), file = count === 1 ? await this.cache.get(job.id, 0, signal).then(row => { if (!row?.blob) throw missingError(); return new File([row.blob], row.name, { type: 'image/jpeg' }); }) : await archive(this.cache, job, text, token, signal, progress);
    J.assertScope(token, signal); if (epoch !== this.epoch) throw abortError();
    this.ready = { archive: file, files: [], text, products: products.map(J.publicProduct), token, at: Date.now(), bytes: job.bytes, total: count, shareStart: 0, shareNext: 0 };
    await this.loadShare(0, signal);
    this.expiryTimer = setTimeout(() => { this.cancel(); this.onExpire?.(); }, J.MAX_AGE);
    progress(count, count, 'Selección completa preparada'); return this.ready;
   } catch (error) {
    if (epoch === this.epoch) this.ready = null;
    if (error.code === 'ARTWORK_MISSING') this.cancel();
    if (error.name === 'QuotaExceededError') throw Error('No queda espacio temporal en el navegador. Libera espacio o reduce la selección y vuelve a intentar.');
    throw error;
   } finally { if (epoch === this.epoch) { this.busy = false; this.controller = null; } }
  }
  async loadShare(start, signal) {
   const ready = this.ready, job = this.job; if (!ready || !job) return;
   ready.files = []; ready.shareStart = start; ready.shareNext = start;
   if (!root.navigator.share || !root.navigator.canShare || !J.sharePolicyAllowed() || start >= job.entries.length) return;
   // Chrome's canShare can accept >10 files even though share then rejects them as Permission denied.
   const limit = Math.min(J.MAX_FILES, job.shareLimit || J.MAX_FILES); let bytes = 0;
   for (let index = start; index < job.entries.length && ready.files.length < limit; index++) {
    const entry = job.entries[index]; if (ready.files.length && bytes + entry.size > J.MAX_BYTES) break;
    J.assertScope(ready.token, signal); const row = await this.cache.get(job.id, index, signal); J.assertScope(ready.token, signal);
    if (!row?.blob) throw missingError();
    ready.files.push(new File([row.blob], row.name, { type: 'image/jpeg' })); bytes += entry.size;
   }
   const supports = count => { try { return !!root.navigator.canShare({ files: ready.files.slice(0, count) }); } catch (_) { return false; } };
   if (!supports(ready.files.length)) {
    let low = 1, high = ready.files.length - 1, accepted = 0;
    while (low <= high) { const count = Math.floor((low + high) / 2); if (supports(count)) { accepted = count; low = count + 1; } else high = count - 1; }
    ready.files.length = accepted;
   }
   ready.shareNext = start + ready.files.length;
  }
  canShare() { if (!this.valid() || !this.ready.files.length || !root.navigator.share || !root.navigator.canShare || !J.sharePolicyAllowed()) return false; try { return !!root.navigator.canShare({ files: this.ready.files }); } catch (_) { return false; } }
  share() {
   if (!this.valid()) return Promise.reject(Error('La selección venció o la sesión cambió. Vuelve a prepararla.'));
   const contextError = J.shareContextError(); if (contextError) return Promise.reject(contextError);
   if (!this.canShare()) return Promise.reject(Error('Descarga el ZIP completo para adjuntar las imágenes en WhatsApp.'));
   const ready = this.ready, epoch = this.epoch, next = ready.shareNext; this.busy = true;
   // No await before the native call: this uses the user's actual click activation.
   let operation; try { operation = root.navigator.share({ files: ready.files }); } catch (error) { operation = Promise.reject(error); }
   return Promise.resolve(operation).catch(error => {
    if (epoch === this.epoch && this.ready === ready && error.name === 'NotAllowedError' && ready.files.length > 1) {
     // Never retry the native API automatically: it consumes the user's activation.
     // Keep the full ZIP and position; prepare a smaller group for a fresh explicit click.
     this.job.shareLimit = 1; ready.files = ready.files.slice(0, 1); ready.shareNext = ready.shareStart + 1;
    }
    throw error;
   }).then(async () => {
    if (epoch !== this.epoch) return;
    const controller = this.controller = new AbortController();
    await this.loadShare(next, controller.signal);
   }).finally(() => { if (epoch === this.epoch) { this.busy = false; this.controller = null; } });
  }
 }
 J.Collection = Collection; J.ArtworkCache = ArtworkCache; J.MAX_OUTPUT_BYTES = MAX_OUTPUT_BYTES; J.MAX_CACHE_BYTES = MAX_CACHE_BYTES;
})(window);
