/* One verified product, one vertical image. The full editor stays in Magic Studio. */
(function (root) {
 'use strict';
 const D = root.PTHStudioDesigns, J = root.PTHStudioJobs;
 const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
 let active;
 class QuickStory {
  constructor(dialog, client, { productId = '', productName = '', onUsage = () => {} } = {}) {
   this.dialog = dialog; this.client = client; this.onUsage = onUsage;
   this.requestedId = String(productId || ''); this.requestedName = productName;
   this.products = []; this.selectedId = ''; this.theme = 'essential'; this.limit = 40;
   this.token = J.scope(); this.batch = new J.Batch(); this.epoch = 0; this.downloadURLs = new Set();
   this.build();
   this.sessionListener = () => { if (this.token && (this.token !== J.scope() || this.profile)) this.expire(); };
   this.storageListener = event => { if (['pth_secure_token', 'pth_session'].includes(event.key) || event.key === null) this.sessionListener(); };
   root.addEventListener('pth:session-changed', this.sessionListener); root.addEventListener('storage', this.storageListener);
   this.prepare();
  }
  node(selector) { return this.dialog.querySelector(selector); }
  build() {
   // Constant markup only. Product, contact and server text never becomes HTML.
   this.dialog.innerHTML = `<div class="pth-content-studio pth-quick-story"><header class="pth-studio-heading"><div><span class="pth-studio-brand">paratuhogar</span><h1 id="pth-quick-story-title">Story rápida</h1><p>Una imagen lista para responder a tu cliente.</p></div><button type="button" data-close>Cerrar</button></header>
    <main class="pth-quick-story-body"><section class="pth-quick-story-product"><h2 data-name>Comprobando el producto…</h2><p data-price></p></section>
     <div class="pth-quick-story-layout"><section class="pth-quick-story-design"><fieldset><legend>Elige un diseño</legend><div data-themes class="pth-quick-story-themes"></div></fieldset>
      <details data-picker><summary>Cambiar producto</summary><label>Buscar un equipo<input data-search type="search" placeholder="Nombre o modelo"></label><div data-products class="pth-quick-story-products"></div><button type="button" data-more hidden>Mostrar más equipos</button></details>
     </section><div data-preview class="pth-quick-story-preview" aria-label="Vista previa de la Story"><p>La imagen aparecerá aquí.</p></div></div>
    </main><footer class="pth-studio-actions"><p data-status role="status" aria-live="polite">Comprobando precio y disponibilidad…</p><div><button type="button" data-share class="pth-studio-primary" disabled>Compartir imagen</button><button type="button" data-download disabled>Descargar imagen</button><button type="button" data-retry hidden>Reintentar</button><button type="button" data-copy disabled>Copiar información</button></div><p class="pth-studio-hint">Elige WhatsApp y el destinatario en el menú de tu dispositivo.</p></footer></div>`;
   this.dialog.setAttribute('aria-labelledby', 'pth-quick-story-title');
   for (const [key, theme] of Object.entries(D.themes)) {
    const button = el('button', theme.name); button.type = 'button'; button.dataset.theme = key;
    button.addEventListener('click', () => { if (this.theme === key || this.sharing || this.downloading || this.expired) return; this.theme = key; this.prepare(); });
    this.node('[data-themes]').append(button);
   }
   this.node('[data-close]').addEventListener('click', () => this.close());
   this.node('[data-search]').addEventListener('input', () => { this.limit = 40; this.renderPicker(); });
   this.node('[data-more]').addEventListener('click', () => { this.limit += 40; this.renderPicker(); });
   this.node('[data-retry]').addEventListener('click', () => this.prepare());
   this.node('[data-share]').addEventListener('click', () => this.share());
   this.node('[data-download]').addEventListener('click', () => this.download());
   this.node('[data-copy]').addEventListener('click', () => this.copy());
   this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
   this.buttons();
  }
  message(text, error = false) { const node = this.node('[data-status]'); node.textContent = text; node.dataset.error = String(error); }
  options() { return { theme: this.theme, isStory: true, mode: 'single', showPrice: true, showWarranty: true, showDelivery: true, showPhone: true, gestorName: this.profile?.nombre || '', gestorPhone: this.profile?.telefono || '', allowCommissionDiscount: false }; }
  releasePreview() { clearTimeout(this.expiryTimer); if (this.previewURL) URL.revokeObjectURL(this.previewURL); this.previewURL = null; this.node('[data-preview]').replaceChildren(); }
  renderPicker() {
   const term = this.node('[data-search]').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
   const rows = this.products.filter(p => (p.nombre + ' ' + p.categoria).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term));
   const host = this.node('[data-products]'); host.replaceChildren();
   for (const product of rows.slice(0, this.limit)) {
    const button = el('button'); button.type = 'button'; button.dataset.productId = J.id(product);
    button.setAttribute('aria-pressed', String(J.id(product) === this.selectedId));
    button.append(el('span', product.nombre), el('strong', D.money(product.precio) + ' USD'));
    button.disabled = !!(this.sharing || this.downloading || this.expired);
    button.addEventListener('click', () => { if (this.sharing || this.downloading || this.expired) return; this.selectedId = J.id(product); this.requestedId = ''; this.requestedName = ''; this.product = null; this.node('[data-picker]').open = false; this.prepare(); });
    host.append(button);
   }
   if (!rows.length) host.append(el('p', 'No hay equipos con esta búsqueda.', 'pth-studio-hint'));
   this.node('[data-more]').hidden = rows.length <= this.limit;
  }
  buttons() {
   const ready = !!this.batch.valid() && !!this.previewURL, sharing = this.sharing || this.downloading;
   const blocked = this.loading || this.expired || this.disposed || sharing, canShare = ready && this.batch.canShare();
   this.node('[data-share]').hidden = ready && !canShare; this.node('[data-share]').disabled = !!(blocked || !canShare);
   this.node('[data-download]').disabled = !!(blocked || !ready); this.node('[data-download]').classList.toggle('pth-studio-primary', ready && !canShare);
   this.node('[data-copy]').disabled = !!(blocked || !ready);
   this.node('[data-retry]').hidden = !!(ready || this.loading || this.expired || (!this.product && !this.failed));
   this.node('[data-retry]').disabled = !!sharing; this.node('[data-retry]').textContent = this.product ? 'Actualizar imagen' : 'Reintentar';
   this.dialog.querySelectorAll('[data-theme]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.theme === this.theme)); button.disabled = !!(this.expired || sharing); });
   this.dialog.querySelectorAll('[data-product-id]').forEach(button => { button.disabled = !!(this.expired || sharing); });
  }
  async prepare() {
   if (this.expired || this.disposed || this.sharing || this.downloading) return;
   const epoch = ++this.epoch; this.controller?.abort(); this.batch.cancel(); this.releasePreview();
   const controller = this.controller = new AbortController(); this.loading = true; this.failed = false; this.buttons(); this.message('Comprobando precio y disponibilidad…');
   try {
    const before = this.product && J.signature(this.product), oldContact = this.profile && JSON.stringify([this.profile.nombre, this.profile.telefono]);
    const fresh = await J.catalogue(this.client, controller.signal);
    if (epoch !== this.epoch || this.disposed || this.expired) return;
    this.products = fresh.products; this.profile = fresh.profile; this.token = fresh.token;
    const wanted = this.selectedId || this.requestedId, requested = !!(wanted || this.requestedName);
    const product = wanted ? this.products.find(p => J.id(p) === wanted) : this.products.find(p => this.requestedName && p.nombre === this.requestedName);
    this.requestedId = ''; this.requestedName = '';
    if (!product) {
     this.selectedId = ''; this.product = null; this.node('[data-name]').textContent = 'Elige un equipo'; this.node('[data-price]').textContent = '';
     this.renderPicker(); this.node('[data-picker]').open = true;
    this.node('[data-picker] summary').textContent = 'Elegir producto';
    this.message(requested ? 'Este equipo ya no está disponible para tu cuenta. Elige otro para crear su Story.' : 'Elige un equipo. Prepararemos su Story automáticamente.', requested); return;
    }
    this.product = J.publicProduct(product); this.selectedId = J.id(product);
    this.node('[data-name]').textContent = product.nombre; this.node('[data-price]').textContent = D.money(product.precio) + ' USD'; this.node('[data-picker] summary').textContent = 'Cambiar producto'; this.renderPicker();
    if (before && (before !== J.signature(product) || oldContact !== JSON.stringify([this.profile.nombre, this.profile.telefono]))) {
     this.message('Cambió el precio, la disponibilidad, los datos del equipo o tu contacto. Revisa los datos y toca Actualizar imagen.', true); return;
    }
    this.message('Preparando tu Story…');
    const ready = await this.batch.prepare({ products: [product], options: this.options(), token: fresh.token });
    if (epoch !== this.epoch || this.disposed || this.expired) return;
    this.previewURL = URL.createObjectURL(ready.files[0]);
    const image = el('img'); image.src = this.previewURL; image.alt = 'Story de ' + product.nombre; image.width = 1080; image.height = 1920;
    this.node('[data-preview]').append(image);
    this.message(this.batch.canShare() ? 'Tu Story está lista. Toca Compartir imagen y elige el destinatario.' : 'Tu Story está lista. Descarga la imagen y adjúntala en WhatsApp.');
    this.expiryTimer = setTimeout(() => { if (epoch !== this.epoch || this.disposed) return; this.batch.cancel(); this.releasePreview(); this.message('Actualiza la imagen antes de compartir para comprobar los datos otra vez.'); this.buttons(); }, Math.max(1, ready.at + J.MAX_AGE - Date.now() + 1));
   } catch (error) {
    if (epoch === this.epoch && !this.disposed && !this.expired && error.name !== 'AbortError') {
     if ([401, 403].includes(error.status)) this.expire();
     else { this.failed = true; this.message(error.message + ' Puedes reintentar sin salir de aquí.', true); }
    }
   } finally { if (epoch === this.epoch && !this.disposed) { this.loading = false; this.buttons(); } }
  }
  ready() {
   if (this.disposed || this.expired || !this.batch.valid() || !this.previewURL) { if (!this.disposed) { this.message('Actualiza la imagen antes de compartir.', true); this.buttons(); } return false; }
   return true;
  }
  share() {
   if (this.sharing || this.downloading || !this.ready()) return;
   const epoch = this.epoch; this.sharing = true;
   // Native sharing must run directly in the click, before any await or clipboard.
   const operation = this.batch.share(); this.buttons();
   operation.then(() => { if (epoch !== this.epoch || this.disposed) return; this.onUsage('compartir', 1); this.message('Imagen entregada al menú de compartir. Comprueba el envío en la aplicación elegida.'); })
    .catch(error => { if (epoch === this.epoch && !this.disposed) this.message(error.name === 'AbortError' ? 'Compartido cancelado. Tu imagen sigue lista para intentarlo de nuevo.' : error.message + ' También puedes descargar la imagen.', error.name !== 'AbortError'); })
    .finally(() => { this.sharing = false; if (!this.disposed) this.buttons(); });
  }
  download() {
   if (this.sharing || this.downloading || !this.ready()) return;
   this.downloading = true; this.buttons(); let url;
   try {
    const file = this.batch.ready.files[0]; url = URL.createObjectURL(file); this.downloadURLs.add(url);
    const link = el('a'); link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => { URL.revokeObjectURL(url); this.downloadURLs.delete(url); }, 30000);
    this.onUsage('descargar', 1); this.message('Descarga iniciada. Adjunta la imagen en el chat que elijas.');
   } catch (_) { if (url) { URL.revokeObjectURL(url); this.downloadURLs.delete(url); } this.message('No se pudo descargar. Puedes volver a intentarlo.', true); }
   finally { this.downloading = false; this.buttons(); }
  }
  async copy() {
   if (!this.ready()) return; const epoch = this.epoch, text = this.batch.ready.text;
   try { await root.navigator.clipboard.writeText(text); if (epoch === this.epoch && !this.disposed) this.message('Información copiada. Pégala junto a la imagen.'); }
   catch (_) { if (epoch !== this.epoch || this.disposed) return; this.node('[data-preview] textarea')?.remove(); const textarea = el('textarea'); textarea.value = text; textarea.setAttribute('aria-label', 'Información para copiar'); this.node('[data-preview]').append(textarea); textarea.select(); this.message('Selecciona y copia la información que aparece debajo de la imagen.'); }
  }
  expire() {
   if (this.disposed) return; this.expired = true; this.loading = false; this.epoch++; this.controller?.abort(); this.batch.cancel(); this.releasePreview();
   this.products = []; this.product = null; this.profile = null; this.selectedId = ''; this.requestedId = ''; this.requestedName = '';
   this.node('[data-name]').textContent = 'La sesión cambió'; this.node('[data-price]').textContent = ''; this.node('[data-products]').replaceChildren(); this.node('[data-picker]').hidden = true;
   this.message('Cierra Story e inicia sesión de nuevo para continuar.', true); this.buttons();
   for (const url of this.downloadURLs) URL.revokeObjectURL(url); this.downloadURLs.clear();
  }
  close() {
   if (this.disposed) return; this.disposed = true; this.epoch++; this.controller?.abort(); this.batch.cancel(); this.releasePreview();
   root.removeEventListener('pth:session-changed', this.sessionListener); root.removeEventListener('storage', this.storageListener);
   for (const url of this.downloadURLs) URL.revokeObjectURL(url); this.downloadURLs.clear();
   this.dialog.close(); this.dialog.remove(); this.returnFocus?.focus(); if (active === this) active = null;
  }
 }
 function open(client, options) {
  const previous = active?.dialog.contains(document.activeElement) ? active.returnFocus : document.activeElement;
  active?.close(); const dialog = el('dialog', null, 'pth-studio-dialog pth-quick-story-dialog'); document.body.append(dialog);
  active = new QuickStory(dialog, client, options); active.returnFocus = previous; dialog.showModal(); active.node('[data-close]').focus(); return active;
 }
 root.PTHQuickStory = { open, close: () => active?.close() };
})(window);
