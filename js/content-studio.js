/* Shared private Stories / Magic Studio interface. No automatic messaging. */
(function (root) {
 'use strict';
 const D = root.PTHStudioDesigns, J = root.PTHStudioJobs;
 const byId = J.id, modes = { series: 'Serie · una imagen por equipo', single: 'Un equipo', bundle: 'Paquete · 2 a 4 equipos', compare: 'Comparar · 2 o 3 equipos', multi: 'Varios · 2 a 6 equipos' };
 const el = (tag, value, className) => { const node = document.createElement(tag); if (value != null) node.textContent = value; if (className) node.className = className; return node; };
 function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }
 function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Storage is optional. */ } }
 let storyInstance;
 class Studio {
  constructor(host, client, { story = false, productName = '', query = '', category = 'TODOS', onUsage = () => {} } = {}) {
   this.host = host; this.client = client; this.story = story; this.productName = productName; this.onUsage = onUsage;
   this.products = []; this.selected = new Set(); this.favorites = new Set(); this.recent = []; this.limit = 40;
   this.token = J.scope(); this.batch = new J.Batch(); this.next = 0; this.previewEpoch = 0; this.queueEpoch = 0;
   this.build(query, category);
   this.sessionListener = () => { if (this.token && (this.token !== J.scope() || this.profile)) this.expire(); };
   root.addEventListener('pth:session-changed', this.sessionListener);
   this.storageListener = event => { if (['pth_secure_token', 'pth_session'].includes(event.key) || event.key === null) this.sessionListener(); };
   root.addEventListener('storage', this.storageListener);
   this.load();
  }
  node(selector) { return this.host.querySelector(selector); }
  message(text, error = false) { const node = this.node('[data-status]'); node.textContent = text; node.dataset.error = String(error); }
  build(query, category) {
   // This markup is constant; all catalogue/profile/submitted text uses textContent.
   this.host.className = 'pth-content-studio';
   this.host.innerHTML = `<header class="pth-studio-heading"><div><span class="pth-studio-brand">paratuhogar</span><h1>${this.story ? 'Stories' : 'Magic Studio'}</h1><p>Elige equipos, revisa el diseño y prepara las imágenes para compartir.</p></div><button type="button" data-close>${this.story ? 'Cerrar' : 'Volver al panel'}</button></header>
    <div class="pth-studio-layout"><aside class="pth-studio-controls"><details data-controls-details open><summary>Diseño y formato</summary><div class="pth-studio-controls-body">
     <label>Diseño<select data-theme></select></label><label>Formato<select data-format><option value="story">Story · 1080 × 1920</option><option value="square">Publicación · 1080 × 1080</option></select></label>
     <label>Cómo organizar los equipos<select data-mode></select></label><p class="pth-studio-hint">Serie crea una imagen por cada equipo. Paquete, comparación y varios reúnen los seleccionados en una imagen.</p>
     <div data-composition hidden><label>Título<input data-title maxlength="54" placeholder="Ej. Equipa tu hogar"></label><div data-price-wrap><label>Precio del paquete (opcional)<input data-promo type="number" min="0" step="0.01" inputmode="decimal" placeholder="Usar la suma de los equipos"></label><label data-discount-wrap class="pth-studio-check" hidden><input data-discount type="checkbox">Autorizar descuento desde mi comisión</label><p data-price-help class="pth-studio-hint">La suma de los precios publicados se usa si lo dejas vacío.</p></div></div>
     <fieldset><legend>Qué incluir</legend><label class="pth-studio-check"><input data-option="showPrice" type="checkbox" checked>Precio</label><label class="pth-studio-check"><input data-option="showWarranty" type="checkbox" checked>Garantía del catálogo</label><label class="pth-studio-check"><input data-option="showDelivery" type="checkbox" checked>Condiciones de mensajería</label><label class="pth-studio-check"><input data-option="showPhone" type="checkbox" checked>Mi contacto</label></fieldset>
     <p class="pth-studio-hint">Usamos la fotografía original y los datos del equipo. No inventamos garantías ni plazos de entrega. Las ganancias quedan en tu vista privada.</p>
     <button type="button" data-refresh>Actualizar catálogo</button><p data-verified class="pth-studio-hint"></p>
    </div></details></aside><main class="pth-studio-workspace"><section class="pth-studio-picker" aria-label="Elegir equipos">
     <div class="pth-studio-filter"><label>Buscar<input data-search type="search" placeholder="Modelo, equipo o categoría"></label><label>Categoría<select data-category><option value="TODOS">Todas las categorías</option></select></label><label>Ver<select data-collection><option value="all">Todos los equipos</option><option value="favorites">Mis favoritos</option><option value="recent">Usados recientemente</option></select></label></div>
     <div class="pth-studio-selection"><button type="button" data-select-results>Seleccionar resultados</button><button type="button" data-select-all>Seleccionar todo el catálogo</button><button type="button" data-clear>Quitar selección</button><label class="pth-studio-check"><input data-only type="checkbox">Solo seleccionados</label></div>
     <p data-count class="pth-studio-count" aria-live="polite">Cargando catálogo…</p><div data-products class="pth-studio-products"></div><button type="button" data-more hidden>Mostrar más equipos</button>
    </section><section class="pth-studio-review" aria-label="Revisar el diseño"><div><h2>Así quedará</h2><p data-preview-caption class="pth-studio-hint">Selecciona un equipo para ver tu diseño.</p><div data-preview class="pth-studio-preview"></div></div><div class="pth-studio-review-list"><h2>Tu selección</h2><p class="pth-studio-hint">Puedes quitar equipos antes de prepararlos. Cambiar de búsqueda conserva la selección.</p><div data-selected></div></div></section></main></div>
    <footer class="pth-studio-actions"><p data-status role="status" aria-live="polite">Comprobando tu sesión y el catálogo…</p><progress data-progress value="0" max="1" hidden></progress><div><button type="button" data-prepare class="pth-studio-primary" disabled>Preparar imágenes</button><button type="button" data-share class="pth-studio-primary" hidden>Compartir imágenes</button><button type="button" data-download hidden>Descargar tanda</button><button type="button" data-copy hidden>Copiar texto</button><button type="button" data-next hidden>Preparar siguiente tanda</button><button type="button" data-cancel hidden>Cancelar preparación</button></div><p class="pth-studio-hint">Cada tanda contiene hasta 10 imágenes y 12 MB. El menú de tu dispositivo permite elegir WhatsApp y el destinatario. Si no admite archivos, descarga la tanda. El texto se copia por separado.</p></footer>`;
   if (root.innerWidth < 641) this.node('[data-controls-details]').open = false;
   for (const [key, theme] of Object.entries(D.themes)) { const option = el('option', theme.name); option.value = key; this.node('[data-theme]').append(option); }
   for (const [key, label] of Object.entries(modes)) { const option = el('option', label); option.value = key; this.node('[data-mode]').append(option); }
   this.node('[data-mode]').value = this.productName ? 'single' : 'series';
   this.node('[data-search]').value = query; this.initialCategory = category;
   const click = (attr, action) => this.node('[data-' + attr + ']').addEventListener('click', action);
   click('close', () => this.story ? this.close() : root.location.assign('index.html'));
   click('refresh', () => this.load(true)); click('select-results', () => this.select(this.filtered())); click('select-all', () => this.select(this.products));
   click('clear', () => { this.selected.clear(); this.changed(); this.render(); });
   click('more', () => { this.limit += 40; this.renderProducts(); });
   click('prepare', () => this.prepare(0)); click('next', () => this.prepare(this.next));
   click('share', () => this.share()); click('download', () => this.download()); click('copy', () => this.copy());
   click('cancel', () => { this.changed(); this.message('Preparación cancelada. Puedes volver a preparar.'); });
   for (const attribute of ['search', 'category', 'collection', 'only']) this.node('[data-' + attribute + ']').addEventListener(attribute === 'search' ? 'input' : 'change', () => { this.limit = 40; this.renderProducts(); });
   for (const attribute of ['theme', 'format', 'mode', 'title', 'promo', 'discount']) this.node('[data-' + attribute + ']').addEventListener(['title', 'promo'].includes(attribute) ? 'input' : 'change', () => { this.changed(); this.modeUI(); this.preview(); });
   this.host.querySelectorAll('[data-option]').forEach(node => node.addEventListener('change', () => { this.changed(); this.preview(); }));
   const extraCollections = { recommended: 'Sugerencias para hoy', budget: 'Menos de $100', delivery: 'Entrega rápida confirmada' };
   if (!this.story) extraCollections.commission = 'Alta ganancia · privado';
   for (const [value, label] of Object.entries(extraCollections)) { const option = el('option', label); option.value = value; this.node('[data-collection]').append(option); }
   this.modeUI();
  }
  options() {
   const options = { theme: this.node('[data-theme]').value, isStory: this.node('[data-format]').value === 'story', mode: this.node('[data-mode]').value, compositionTitle: this.node('[data-title]').value.trim(), promoPrice: this.node('[data-promo]').value, allowCommissionDiscount: !this.story && this.node('[data-discount]').checked, gestorName: this.profile?.nombre || '', gestorPhone: this.profile?.telefono || '' };
   this.host.querySelectorAll('[data-option]').forEach(node => { options[node.dataset.option] = node.checked; });
   if (!['bundle', 'multi'].includes(options.mode)) { options.promoPrice = ''; options.allowCommissionDiscount = false; }
   return options;
  }
  modeUI() { const mode = this.options().mode; this.node('[data-composition]').hidden = ['series', 'single'].includes(mode); this.node('[data-price-wrap]').hidden = !['bundle', 'multi'].includes(mode); this.node('[data-discount-wrap]').hidden = this.story; }
  expire() {
   this.expired = true; this.changed(); this.loadController?.abort(); this.previewController?.abort();
   this.products = []; this.selected.clear(); this.profile = null; this.node('[data-products]').replaceChildren(); this.node('[data-selected]').replaceChildren(); this.node('[data-preview]').replaceChildren();
   this.node('[data-count]').textContent = ''; this.node('[data-verified]').textContent = ''; this.message('La sesión cambió. Cierra esta herramienta e inicia sesión de nuevo.', true); this.buttons();
  }
  close() { this.changed(); this.loadController?.abort(); this.previewController?.abort(); root.removeEventListener('pth:session-changed', this.sessionListener); root.removeEventListener('storage', this.storageListener); this.dialog?.close(); this.dialog?.remove(); this.returnFocus?.focus(); if (storyInstance === this) storyInstance = null; }
  changed() { this.queueEpoch++; if (this.preparing) { this.loadController?.abort(); this.preparing = false; } this.batch.cancel(); this.next = 0; this.node('[data-progress]').hidden = true; this.buttons(); }
  async load(manual = false) {
   if (this.loading || this.expired) return; this.changed(); this.loading = true; this.buttons(); this.message('Comprobando catálogo, precios y disponibilidad…');
   this.loadController = new AbortController();
   try {
    const loaded = await J.catalogue(this.client, this.loadController.signal);
    if (this.expired) return;
    this.products = loaded.products.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')); this.profile = loaded.profile; this.token = loaded.token;
    this.storageKey = 'pth_content_studio_' + this.profile.id;
    this.favorites = new Set(stored(this.storageKey + '_favorites', [])); this.recent = stored(this.storageKey + '_recent', []);
    const legacyOwner = D.clean(this.profile.nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!this.favorites.size) this.favorites = new Set(stored('pth_studio_' + legacyOwner + '_favorites', []));
    if (!this.recent.length) this.recent = stored('pth_studio_' + legacyOwner + '_recent', []);
    this.pruneSelection();
    if (this.productName) { const product = this.products.find(p => p.nombre === this.productName); if (product) this.selected.add(byId(product)); this.productName = ''; }
    this.categories(); this.verified(loaded.verifiedAt); this.render(); this.message(manual ? 'Catálogo actualizado. Revisa los precios antes de preparar.' : 'Selecciona equipos y revisa el diseño.');
   } catch (error) { if (!this.expired && error.name !== 'AbortError') { if ([401, 403].includes(error.status)) this.expire(); else { this.render(); this.message(error.message + ' Conservamos tu selección; vuelve a comprobar antes de preparar.', true); } } }
   finally { this.loading = false; this.buttons(); }
  }
  verified(at) { this.node('[data-verified]').textContent = 'Precios comprobados: ' + new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + '. Se vuelven a consultar antes de cada tanda.'; }
  categories() {
   const select = this.node('[data-category]'), previous = this.initialCategory || select.value; this.initialCategory = null;
   select.replaceChildren(); const all = el('option', 'Todas las categorías'); all.value = 'TODOS'; select.append(all);
   for (const category of [...new Set(this.products.map(p => D.clean(p.categoria)).filter(Boolean))].sort()) { const option = el('option', category); option.value = category; select.append(option); }
   select.value = [...select.options].find(option => option.value.toUpperCase() === String(previous).toUpperCase())?.value || 'TODOS';
  }
  pruneSelection() { const allowed = new Set(this.products.map(byId)); for (const id of this.selected) if (!allowed.has(id)) this.selected.delete(id); }
  filtered() {
   const term = this.node('[data-search]').value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), category = this.node('[data-category]').value, collection = this.node('[data-collection]').value;
   const score = p => Math.min(p._studioPrivateCommission || 0, 30) + (this.favorites.has(byId(p)) ? 10 : 0) + (p.precio < 100 ? 8 : 0) + (this.recent.includes(byId(p)) ? 2 : 5);
   const recommended = collection === 'recommended' ? new Set([...this.products].sort((a, b) => score(b) - score(a)).slice(0, 5).map(byId)) : null;
   const commissions = collection === 'commission' ? this.products.map(p => p._studioPrivateCommission || 0).sort((a, b) => b - a) : [];
   const threshold = commissions[Math.floor(commissions.length * .25)] || 0;
   const filtered = this.products.filter(p => { const id = byId(p), haystack = (p.nombre + ' ' + p.categoria).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return (!term || haystack.includes(term)) && (category === 'TODOS' || D.clean(p.categoria) === category) && (collection !== 'favorites' || this.favorites.has(id)) && (collection !== 'recent' || this.recent.includes(id)) && (collection !== 'recommended' || recommended.has(id)) && (collection !== 'budget' || p.precio < 100) && (collection !== 'delivery' || /24|hoy|r[aá]pid/i.test(D.clean(p.mensajeria))) && (collection !== 'commission' || p._studioPrivateCommission >= threshold) && (!this.node('[data-only]').checked || this.selected.has(id)); });
   if (collection === 'commission') filtered.sort((a, b) => b._studioPrivateCommission - a._studioPrivateCommission);
   if (collection === 'recent') filtered.sort((a, b) => this.recent.indexOf(byId(a)) - this.recent.indexOf(byId(b)));
   return filtered;
  }
  select(products) {
   if (!products.length || this.expired) return;
   if (this.options().mode === 'single' && products.length === 1) this.selected.clear();
   for (const product of products) this.selected.add(byId(product));
   if (({ single: 1, bundle: 4, compare: 3, multi: 6 }[this.options().mode] || Infinity) < this.selected.size) { this.node('[data-mode]').value = 'series'; this.modeUI(); this.message('Selección conservada. Usamos Serie para crear una imagen por equipo.'); }
   this.changed(); this.render();
  }
  toggle(product) { const id = byId(product); if (this.selected.has(id)) this.selected.delete(id); else { this.select([product]); return; } this.changed(); this.render(); }
  render() { this.renderProducts(); this.renderSelected(); this.preview(); this.buttons(); }
  renderProducts() {
   const products = this.filtered(), container = this.node('[data-products]'); container.replaceChildren();
   this.node('[data-count]').textContent = products.length + ' resultados · ' + this.selected.size + ' seleccionados en todo el catálogo';
   this.node('[data-more]').hidden = products.length <= this.limit;
   for (const product of products.slice(0, this.limit)) {
    const row = el('div', null, 'pth-studio-product'); row.dataset.picked = String(this.selected.has(byId(product)));
    const button = el('button', null, 'pth-studio-product-choice'); button.type = 'button'; button.setAttribute('aria-pressed', String(this.selected.has(byId(product))));
    const mark = el('span', this.selected.has(byId(product)) ? '✓' : '+', 'pth-studio-mark');
    const img = el('img'); img.loading = 'lazy'; img.alt = ''; img.width = img.height = 56; try { img.src = D.imageURL(product.thumbnail); } catch (_) {} img.addEventListener('error', () => img.hidden = true);
    const content = el('span', null, 'pth-studio-product-text'); content.append(el('strong', product.nombre), el('span', D.money(product.precio) + ' USD'));
    button.append(mark, img, content); button.addEventListener('click', () => this.toggle(product));
    const favorite = el('button', this.favorites.has(byId(product)) ? '★' : '☆', 'pth-studio-favorite'); favorite.type = 'button'; favorite.setAttribute('aria-label', 'Favorito: ' + product.nombre); favorite.setAttribute('aria-pressed', String(this.favorites.has(byId(product))));
    favorite.addEventListener('click', () => { const id = byId(product); if (this.favorites.has(id)) this.favorites.delete(id); else this.favorites.add(id); save(this.storageKey + '_favorites', [...this.favorites]); this.renderProducts(); });
    row.append(button, favorite); container.append(row);
   }
   if (!products.length) container.append(el('p', 'No hay equipos con estos filtros.', 'pth-studio-hint'));
  }
  selectedProducts() { return this.products.filter(p => this.selected.has(byId(p))); }
  renderSelected() {
   const container = this.node('[data-selected]'); container.replaceChildren();
   for (const product of this.selectedProducts()) { const row = el('div', null, 'pth-studio-selected-row'); const label = el('div'); label.append(el('strong', product.nombre), el('span', D.money(product.precio) + ' USD'));
    if (!this.story) label.append(el('small', 'Tu ganancia privada: ' + D.money(product._studioPrivateCommission) + ' USD'));
    const remove = el('button', 'Quitar'); remove.type = 'button'; remove.setAttribute('aria-label', 'Quitar ' + product.nombre); remove.addEventListener('click', () => this.toggle(product)); row.append(label, remove); container.append(row); }
   if (!this.selected.size) container.append(el('p', 'Aún no has seleccionado equipos.', 'pth-studio-hint'));
  }
  async preview() {
   this.previewController?.abort(); this.previewController = new AbortController(); const signal = this.previewController.signal, epoch = ++this.previewEpoch;
   const holder = this.node('[data-preview]'), products = this.selectedProducts(), options = this.options(); holder.replaceChildren();
   const caption = this.node('[data-preview-caption]');
   if (!products.length || this.expired) { caption.textContent = 'Selecciona un equipo para ver tu diseño.'; return; }
   const series = ['series', 'single'].includes(options.mode); caption.textContent = series ? 'Vista del primer equipo. Cada seleccionado tendrá su propia imagen.' : 'Los equipos seleccionados se reúnen en una imagen.';
   try {
    J.validate(products, options); const canvas = el('canvas'); canvas.setAttribute('aria-label', 'Vista previa: ' + products[0].nombre); holder.append(canvas);
    if (series) await D.single(canvas, J.publicProduct(products[0]), options, signal); else await D.composition(canvas, products.map(J.publicProduct), options, signal);
    if (epoch !== this.previewEpoch || this.expired) canvas.width = canvas.height = 1;
   } catch (error) { if (epoch === this.previewEpoch && error.name !== 'AbortError') { holder.replaceChildren(el('p', error.message, 'pth-studio-error')); } }
  }
  buttons() {
   const preparing = this.batch.busy || this.preparing || this.sharing, ready = this.batch.valid(), disabled = this.expired || this.loading;
   this.node('[data-prepare]').disabled = !!(disabled || preparing || !this.selected.size); this.node('[data-refresh]').disabled = !!(disabled || preparing);
   this.node('[data-share]').hidden = !ready || !this.batch.canShare(); this.node('[data-download]').hidden = !ready; this.node('[data-copy]').hidden = !ready;
   this.node('[data-next]').hidden = !ready || this.batch.ready.next >= this.batch.ready.total || !this.completed;
   this.node('[data-cancel]').hidden = !preparing || !!this.sharing;
   for (const attr of ['share', 'download', 'copy', 'next']) this.node('[data-' + attr + ']').disabled = !!(disabled || preparing || this.downloading);
  }
  async prepare(start) {
   if (this.preparing || this.batch.busy || this.sharing || this.loading || this.expired) return;
   const epoch = ++this.queueEpoch, controller = this.loadController = new AbortController();
   this.batch.cancel(); this.completed = false; this.preparing = true; this.buttons(); this.message('Comprobando precios y disponibilidad antes de generar…');
   try {
    const before = this.selectedProducts(), ids = new Set(before.map(byId)), options = this.options(); J.validate(before, options);
    const fresh = await J.catalogue(this.client, controller.signal);
    if (epoch !== this.queueEpoch || this.expired) return;
    const current = fresh.products.filter(p => ids.has(byId(p))), changed = before.length !== current.length || before.some(p => J.signature(p) !== J.signature(current.find(candidate => byId(candidate) === byId(p)) || {}) || (options.allowCommissionDiscount && p._studioPrivateCommission !== current.find(candidate => byId(candidate) === byId(p))?._studioPrivateCommission));
    this.products = fresh.products.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')); this.profile = fresh.profile; this.token = fresh.token; this.pruneSelection(); this.categories(); this.verified(fresh.verifiedAt); this.render();
    if (changed || options.gestorPhone !== this.profile.telefono) { this.next = 0; throw Error('Cambió el precio, la disponibilidad, los datos del equipo o tu contacto. Revisa la selección actualizada y vuelve a preparar.'); }
    // Snapshot immutable for this batch, independently of filters/list ordering.
    const ordered = before.map(p => current.find(candidate => byId(candidate) === byId(p)));
    const result = await this.batch.prepare({ products: ordered, options, token: fresh.token, start, progress: (done, total, label) => { if (epoch !== this.queueEpoch) return; const progress = this.node('[data-progress]'); progress.hidden = false; progress.max = Math.max(1, total); progress.value = done; this.message(label + ' · ' + done + '/' + total); } });
    if (epoch !== this.queueEpoch || this.expired) { this.batch.cancel(); return; }
    this.next = result.next;
    this.message(result.files.length + ' imagen(es) preparadas · equipos ' + (start + 1) + '–' + result.next + ' de ' + result.total + (this.batch.canShare() ? '. Toca Compartir y elige el destino.' : '. Descarga la tanda para adjuntarla en WhatsApp.'));
   } catch (error) { if (epoch === this.queueEpoch && !this.expired) this.message(error.name === 'AbortError' ? 'Preparación cancelada.' : error.message, error.name !== 'AbortError'); }
   finally { if (epoch === this.queueEpoch) { this.preparing = false; this.buttons(); } }
  }
  share() {
   if (this.sharing || this.downloading || !this.batch.valid()) { this.message('Vuelve a preparar esta tanda antes de compartir.', true); return; }
   const ready = this.batch.ready, epoch = this.queueEpoch;
   this.sharing = true;
   // Call directly during this click, before any asynchronous work or clipboard.
   const operation = this.batch.share(); this.buttons();
   operation.then(() => { if (epoch !== this.queueEpoch || this.expired) return; this.completed = true; this.remember(ready.products); this.onUsage('compartir', ready.files.length); this.message('Imágenes entregadas al menú de compartir. Comprueba el envío en la aplicación que elegiste.'); }).catch(error => { if (epoch === this.queueEpoch) this.message(error.name === 'AbortError' ? 'Compartido cancelado. La tanda sigue preparada para volver a intentarlo.' : error.message, error.name !== 'AbortError'); }).finally(() => { this.sharing = false; this.buttons(); });
  }
  async download() {
   if (this.downloading || this.sharing || !this.batch.valid()) { this.message('Vuelve a preparar la tanda antes de descargar.', true); return; }
   this.downloading = true; const ready = this.batch.ready, epoch = this.queueEpoch; this.buttons();
   try {
    let blob, filename;
    if (ready.files.length === 1) { blob = ready.files[0]; filename = blob.name; }
    else { await root.PTHAssets.load('zip'); if (epoch !== this.queueEpoch || !this.batch.valid()) return; const zip = new root.JSZip(); for (const file of ready.files) zip.file(file.name, file); zip.file('Texto_para_compartir.txt', ready.text); blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }); filename = 'paratuhogar_tanda_' + (ready.start + 1) + '_' + ready.next + '.zip'; }
    if (epoch !== this.queueEpoch || !this.batch.valid()) return;
    const url = URL.createObjectURL(blob), link = el('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    this.completed = true; this.remember(ready.products); this.onUsage('descargar', ready.files.length); this.message('Descarga iniciada. Si descargaste un ZIP, extrae las imágenes antes de adjuntarlas en WhatsApp.');
   } catch (error) { if (epoch === this.queueEpoch) this.message('No se pudo descargar. ' + error.message + ' Puedes reintentar con la tanda preparada.', true); }
   finally { this.downloading = false; this.buttons(); }
  }
  async copy() {
   if (!this.batch.valid()) { this.message('Vuelve a preparar la tanda para copiar su texto.', true); return; }
   const text = this.batch.ready.text, epoch = this.queueEpoch;
   try { await root.navigator.clipboard.writeText(text); if (epoch === this.queueEpoch && !this.expired) this.message('Texto copiado. Pégalo junto a las imágenes en WhatsApp.'); }
   catch (_) { if (epoch !== this.queueEpoch || this.expired) return; const textarea = el('textarea'); textarea.value = text; textarea.setAttribute('aria-label', 'Texto para compartir: selecciónalo y cópialo'); this.node('[data-preview]').append(textarea); textarea.select(); this.message('No se pudo copiar automáticamente. Selecciona y copia el texto que aparece bajo la vista previa.'); }
  }
  remember(products) { for (const product of products) { const id = byId(product); this.recent = [id, ...this.recent.filter(item => item !== id)].slice(0, 50); } save(this.storageKey + '_recent', this.recent); }
 }
 function openStory(client, options) {
  storyInstance?.close(); const previous = document.activeElement, dialog = el('dialog', null, 'pth-studio-dialog'), host = el('div'); dialog.append(host); document.body.append(dialog); dialog.showModal();
  storyInstance = new Studio(host, client, { ...options, story: true }); storyInstance.dialog = dialog; storyInstance.returnFocus = previous;
  dialog.addEventListener('cancel', event => { event.preventDefault(); storyInstance?.close(); });
  host.querySelector('[data-close]').focus(); return storyInstance;
 }
 root.PTHContentStudio = { Studio, openStory, closeStory: () => storyInstance?.close() };
})(window);
