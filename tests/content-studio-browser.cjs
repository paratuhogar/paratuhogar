// Real Chromium, local fixtures only: no production queries or WhatsApp messages.
const { chromium } = require('playwright'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), out = process.env.PTH_STUDIO_TEST_OUTPUT || '/tmp/pth-studio-tested';
const profile = { id: 'gestor-a', nombre: 'Gestor prueba', telefono: '', rol: 'gestor', estado: 'activo' };
const products = Array.from({ length: 1003 }, (_, i) => ({ id: 'p' + String(i).padStart(4, '0'), nombre: i === 0 ? 'Refrigerador Royal Side by Side 20 pies' : (i < 603 ? 'Modelo Royal ' : 'Otro equipo ') + i, precio: i === 0 ? 890 : 100 + i, comision: 37, costo_proveedor: 'PRIVATE_SENTINEL', disponible: 'SI', precio_flexible: 'SI', categoria: i < 603 ? 'Refrigeración' : 'Cocina', thumbnail: 'test.svg', descripcion: 'Tecnología Inverter. Capacidad: 20 pies cúbicos. Dimensiones: 900 × 697 × 1865 mm', garantia: '1 mes', mensajeria: 'Mensajería por costo adicional' }));
products[1].nombre += ' Ñandú';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400"><rect width="900" height="1400" fill="white"/><rect x="235" y="110" width="430" height="1170" rx="14" fill="#adb5bd"/><path d="M450 110v1170" stroke="#4c5662" stroke-width="7"/><path d="M410 420v280M490 420v280" stroke="#263442" stroke-width="14"/></svg>';
const sdk = `window.supabase={createClient(){return {from(){return {then:ok=>Promise.resolve({data:[],error:null}).then(ok)}} ,rpc(){}}}};`;
(async () => {
 fs.mkdirSync(out, { recursive: true }); const { validateQuery } = await import('../supabase/functions/secure-data/handler.mjs');
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 try {
  let version = 0, hold = false, imageFailure = false, subgestor = false;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }), page = await context.newPage(), errors = [], queries = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('pth_secure_token', 'tenant-a'); localStorage.setItem('pth_session', JSON.stringify({ name: 'Gestor prueba', data: { id: 'gestor-a', nombre: 'Gestor prueba', rol: 'gestor' } })); });
  await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if (url.pathname === '/functions/v1/secure-data') {
    const body = route.request().postDataJSON(), actor = subgestor ? { ...profile, id: 'sub-a', parent_id: 'gestor-a', parent_nombre: profile.nombre } : profile;
    assert.ok(['session', 'query'].includes(body.action), 'must not mutate any remote data');
    if (hold && body.action === 'query') { await new Promise(resolve => setTimeout(resolve, 400)); }
    if (body.action === 'session') return route.fulfill({ json: { data: { profile: actor }, error: null } });
    validateQuery(body, actor); queries.push(body);
    let data = body.table === 'productos' ? products.map(p => ({ ...p, precio: p.precio + version, comision: subgestor ? 15 : p.comision })) : body.table === 'precios_personalizados' && subgestor ? [{ producto_id: 'p0000', nuevo_precio: 990, comision_subgestor: 15, visible_subgestor: false }, { producto_id: 'p0001', nuevo_precio: 150, comision_subgestor: 15, visible_subgestor: true }] : [];
    if (body.range) data = data.slice(body.range[0], body.range[1] + 1);
    return route.fulfill({ json: { data, error: null } });
   }
   if (url.hostname.includes('jsdelivr') && url.pathname.includes('supabase')) return route.fulfill({ contentType: 'application/javascript', body: sdk });
   if (url.hostname.includes('cdnjs') && url.pathname.includes('jszip')) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(require.resolve('jszip/dist/jszip.min.js')) });
   if (url.hostname === 'raw.githubusercontent.com') return imageFailure ? route.abort() : route.fulfill({ contentType: 'image/svg+xml', body: svg, headers: { 'Access-Control-Allow-Origin': '*' } });
   if (url.origin === 'https://studio.test') {
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf' };
    return route.fulfill({ contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
   }
   return route.abort();
  });
  await page.goto('https://studio.test/studio.html');
  await page.waitForFunction(() => PTHStudioPage.products.length === 1003 && !PTHStudioPage.loading);
  assert.equal(await page.locator('[data-products] .pth-studio-product').count(), 40);
  await page.locator('[data-search]').fill('Royal'); await page.locator('[data-select-results]').click();
  assert.equal(await page.evaluate(() => PTHStudioPage.selected.size), 603, 'select matching results beyond loaded first 40');
  assert.equal(await page.locator('[data-selected] .pth-studio-selected-row').count(), 603, 'review list distinct from product selection markers');
  await page.locator('[data-search]').fill('Otro'); assert.equal(await page.evaluate(() => PTHStudioPage.selected.size), 603, 'search must preserve selection');
  await page.locator('[data-select-all]').click(); assert.equal(await page.evaluate(() => PTHStudioPage.selected.size), 1003);
  await page.locator('[data-only]').check(); assert.match(await page.locator('[data-count]').textContent(), /1003 seleccionados/);
  await page.locator('[data-search]').fill('');
  await page.locator('[data-clear]').click(); await page.locator('[data-only]').uncheck();
  for (let i = 0; i < 23; i++) await page.locator('[data-products] .pth-studio-product-choice').nth(i).click();
  assert.equal(await page.locator('[data-next]').count(), 0, 'Magic Studio never asks to prepare another batch');
  await page.evaluate(() => { window.shareCalls = []; window.capabilityCalls = []; navigator.canShare = data => { capabilityCalls.push(Object.keys(data)); return data.files.length <= 10; }; navigator.share = data => { shareCalls.push({ count: data.files.length, activation: navigator.userActivation.isActive, keys: Object.keys(data) }); return Promise.resolve(); }; });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.files.length), 10);
  assert.ok(await page.evaluate(() => PTHStudioPage.batch.ready.bytes <= PTHStudioJobs.MAX_BYTES));
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.total), 23, 'one click prepares the entire selection');
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.shareNext), 10);
  assert.doesNotMatch(await page.evaluate(() => PTHStudioPage.batch.ready.text), /PRIVATE_SENTINEL|comisi[oó]n|5356071095|Entrega 24/i);
  await page.locator('[data-share]').click(); await page.waitForFunction(() => PTHStudioPage.completed);
  assert.deepEqual(await page.evaluate(() => shareCalls[0]), { count: 10, activation: true, keys: ['files'] });
  await page.waitForFunction(() => PTHStudioPage.batch.ready?.shareStart === 10 && PTHStudioPage.batch.valid());
  assert.match(await page.locator('[data-share]').textContent(), /11–20 de 23/, 'next share group is preloaded, no preparation click');
  const downloadPromise = page.waitForEvent('download'); await page.locator('[data-download]').click(); const download = await downloadPromise; await download.saveAs(path.join(out, 'batch.zip'));
  const zip = await require('jszip').loadAsync(fs.readFileSync(path.join(out, 'batch.zip')), { checkCRC32: true });
  assert.equal(Object.keys(zip.files).filter(file => file.endsWith('.jpg')).length, 23); assert.ok(zip.file('Texto_para_compartir.txt'));
  assert.doesNotMatch(await zip.file('Texto_para_compartir.txt').async('string'), /PRIVATE_SENTINEL|comisi[oó]n/);
  await page.locator('[data-share]').click(); await page.waitForFunction(() => PTHStudioPage.batch.ready?.shareStart === 20 && PTHStudioPage.batch.valid());
  await page.locator('[data-share]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid() && !PTHStudioPage.batch.ready.files.length);
  assert.equal(await page.locator('[data-share]').isVisible(), false);
  // A compatible device can share >10 small images together, without an arbitrary count restriction.
  await page.evaluate(() => { navigator.canShare = data => data.files.length > 0; });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.files.length), 23);
  // Preserve valid JPEG output, adding harmless trailing bytes to exercise a real >12-MiB archive.
  await page.evaluate(() => {
   window.originalBlob = HTMLCanvasElement.prototype.toBlob;
   HTMLCanvasElement.prototype.toBlob = function(callback, ...args) { originalBlob.call(this, blob => callback(new Blob([blob, new Uint8Array(768 * 1024)], { type: 'image/jpeg' })), ...args); };
   window.originalRender = PTHStudioDesigns.single; window.renderCounts = {}; window.failProduct = PTHStudioPage.selectedProducts()[5].id;
   PTHStudioDesigns.single = async function(canvas, product, ...args) { if (!canvas.closest('[data-preview]')) renderCounts[product.id] = (renderCounts[product.id] || 0) + 1; if (product.id === failProduct) throw Error('Interrupción de fotografía de prueba'); return originalRender.call(this, canvas, product, ...args); };
  });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null, 'an incomplete selection cannot be exported');
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.job.entries.length), 5);
  assert.equal(await page.locator('[data-prepare]').textContent(), 'Continuar preparación');
  const firstSelectedId = await page.evaluate(() => PTHStudioPage.selectedProducts()[0].id);
  const firstRenderCount = await page.evaluate(id => renderCounts[id], firstSelectedId);
  await page.evaluate(() => { failProduct = ''; });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  assert.equal(await page.evaluate(id => renderCounts[id], firstSelectedId), firstRenderCount, 'retry retains completed images');
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.total), 23);
  assert.ok(await page.evaluate(() => PTHStudioPage.batch.ready.bytes > PTHStudioJobs.MAX_BYTES));
  assert.ok(await page.evaluate(() => PTHStudioPage.batch.ready.files.reduce((n, f) => n + f.size, 0) <= PTHStudioJobs.MAX_BYTES), 'only a bounded share group is loaded');
  const largeDownloadPromise = page.waitForEvent('download'); await page.locator('[data-download]').click(); const largeDownload = await largeDownloadPromise; await largeDownload.saveAs(path.join(out, 'complete-over-12mb.zip'));
  const largeZip = await require('jszip').loadAsync(fs.readFileSync(path.join(out, 'complete-over-12mb.zip')), { checkCRC32: true });
  assert.equal(Object.keys(largeZip.files).filter(name => name.endsWith('.jpg')).length, 23);
  assert.ok(Object.keys(largeZip.files).some(name => name.includes('Ñandú')), 'UTF-8 ZIP filenames round trip');
  assert.ok(fs.statSync(path.join(out, 'complete-over-12mb.zip')).size > 12 * 1024 * 1024);
  // Invalidating settings while a write is waiting cannot resurrect temporary artifacts.
  await page.evaluate(() => {
   HTMLCanvasElement.prototype.toBlob = originalBlob; PTHStudioDesigns.single = originalRender;
   window.originalPut = PTHStudioPage.batch.cache.put.bind(PTHStudioPage.batch.cache);
   PTHStudioPage.batch.cache.put = async (...args) => { window.writeHeld = true; await new Promise(resolve => window.releaseWrite = resolve); return originalPut(...args); };
  });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => window.writeHeld);
  await page.locator('[data-cancel]').click(); await page.evaluate(() => releaseWrite()); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.job), null);
  await page.evaluate(() => { PTHStudioPage.batch.cache.put = originalPut; });
  // Failed storage blocks completion, then an explicit retry can recover without leaving the editor.
  await page.evaluate(() => { PTHStudioPage.batch.cache.put = () => Promise.reject(new DOMException('Storage fixture full', 'QuotaExceededError')); });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); assert.match(await page.locator('[data-status]').textContent(), /espacio temporal/);
  await page.evaluate(() => { PTHStudioPage.batch.cache.put = originalPut; });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  // Missing temporary data restarts cleanly instead of looping on a broken saved prefix.
  await page.locator('[data-controls-details] summary').click(); await page.locator('[data-theme]').selectOption('technical'); await page.locator('[data-controls-details] summary').click();
  await page.evaluate(() => { window.originalGet = PTHStudioPage.batch.cache.get.bind(PTHStudioPage.batch.cache); PTHStudioPage.batch.cache.get = () => Promise.resolve(undefined); });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); assert.equal(await page.evaluate(() => PTHStudioPage.batch.job), null);
  await page.evaluate(() => { PTHStudioPage.batch.cache.get = originalGet; });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  await page.locator('[data-controls-details] summary').click(); await page.locator('[data-theme]').selectOption('premium');
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null, 'changing design invalidates the complete archive');
  await page.locator('[data-controls-details] summary').click();
  await page.evaluate(() => { navigator.canShare = data => data.files.length <= 10; });
  // Cancel/retry: selection remains intact, stale response cannot complete a job.
  hold = true; await page.locator('[data-prepare]').click(); await page.locator('[data-cancel]').click();
  assert.equal(await page.evaluate(() => PTHStudioPage.preparing), false); await page.waitForTimeout(500); assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); hold = false;
  // Price changes force review instead of exporting cached values.
  version = 1; await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing);
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); assert.match(await page.locator('[data-status]').textContent(), /Cambi[oó]/);
  assert.equal(await page.evaluate(() => PTHStudioPage.products.find(p => p.id === 'p0000').precio), 891);
  await page.locator('[data-clear]').click(); await page.locator('[data-only]').uncheck();
  await page.evaluate(() => { PTHStudioPage.selected.add('p0000'); PTHStudioPage.render(); });
  await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid());
  // Native cancellation preserves files, duplicate clicks cannot open two sheets.
  await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('cancel', 'AbortError')); });
  await page.locator('[data-share]').click(); await page.waitForFunction(() => !PTHStudioPage.sharing); assert.equal(await page.evaluate(() => PTHStudioPage.batch.valid()), true);
  await page.evaluate(() => { window.pendingShares = 0; navigator.share = () => { pendingShares++; return new Promise(resolve => window.releaseShare = resolve); }; PTHStudioPage.share(); PTHStudioPage.share(); });
  assert.equal(await page.evaluate(() => pendingShares), 1); await page.evaluate(() => releaseShare()); await page.waitForFunction(() => !PTHStudioPage.sharing);
  await page.locator('[data-controls-details] summary').click();
  // Eight deterministic templates; no horizontal scrolling at phone sizes.
  for (const format of ['story', 'square']) for (const theme of ['essential', 'premium', 'technical', 'editorial']) {
   await page.locator('[data-format]').selectOption(format); await page.locator('[data-theme]').selectOption(theme);
   await page.waitForFunction(format => { const c = document.querySelector('[data-preview] canvas'); return c?.width === 1080 && c?.height === (format === 'story' ? 1920 : 1080); }, format);
   const data = await page.locator('[data-preview] canvas').evaluate(c => c.toDataURL('image/png').split(',')[1]); fs.writeFileSync(path.join(out, theme + '-' + format + '.png'), Buffer.from(data, 'base64'));
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  for (const width of [320, 390, 820, 1366]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Studio layout fits ' + width); }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'studio-mobile.png'), fullPage: true });
  // Multi/compare/bundle are still supported; approved price-discount guard remains.
  await page.evaluate(() => { PTHStudioPage.selected.add('p0001'); PTHStudioPage.render(); });
  for (const mode of ['compare', 'bundle', 'multi']) { await page.locator('[data-mode]').selectOption(mode); await page.locator('[data-prepare]').click(); await page.waitForFunction(() => PTHStudioPage.batch.valid()); assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready.files.length), 1); }
  await page.locator('[data-mode]').selectOption('bundle'); await page.locator('[data-promo]').fill('960'); await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing); assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null);
  // Image errors must fail generation rather than download incomplete artwork.
  await page.locator('[data-promo]').fill(''); await page.locator('[data-mode]').selectOption('series'); imageFailure = true; await page.locator('[data-prepare]').click(); await page.waitForFunction(() => !PTHStudioPage.preparing); assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); imageFailure = false;
  // Dialog shares the exact same implementation; focus returns and session clears previews.
  await page.evaluate(() => { const button = document.createElement('button'); button.id = 'story-opener'; button.textContent = 'Stories'; document.body.append(button); button.focus(); PTHContentStudio.openStory(PTHStudioPage.client, { productName: 'Refrigerador Royal Side by Side 20 pies' }); });
  await page.waitForFunction(() => document.querySelector('dialog [data-count]')?.textContent.includes('1 seleccionados'));
  assert.equal(await page.locator('dialog').evaluate(d => d.open), true); await page.locator('dialog [data-controls-details] summary').click(); await page.locator('dialog [data-mode]').selectOption('series');
  await page.locator('dialog [data-select-results]').click(); assert.match(await page.locator('dialog [data-count]').textContent(), /1003 seleccionados/);
  await page.locator('dialog [data-close]').click(); assert.equal(await page.locator('dialog').count(), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'story-opener');
  await page.evaluate(() => { localStorage.setItem('pth_secure_token', 'tenant-b'); dispatchEvent(new Event('pth:session-changed')); });
  assert.equal(await page.evaluate(() => PTHStudioPage.batch.ready), null); assert.equal(await page.locator('[data-preview] canvas').count(), 0); assert.equal(await page.locator('[data-products] .pth-studio-product').count(), 0);
  // New subgestor session: hidden product absent, assigned private share only.
  subgestor = true; await page.goto('https://studio.test/studio.html'); await page.waitForFunction(() => PTHStudioPage.products.length === 1002 && !PTHStudioPage.loading);
  assert.equal(await page.evaluate(() => PTHStudioPage.products.some(p => p.id === 'p0000')), false);
  assert.deepEqual(await page.evaluate(() => { const p = PTHStudioPage.products.find(p => p.id === 'p0001'); return { price: p.precio, commission: p._studioPrivateCommission, cost: 'costo_proveedor' in p }; }), { price: 150, commission: 15, cost: false });
  assert.deepEqual(errors, []);
  await page.evaluate(async () => { await PTHStudioPage.batch.cleanup; });
  assert.equal(await page.evaluate(async () => {
   const db = await PTHStudioPage.batch.cache.open(); return await new Promise(resolve => { const r = db.transaction('files').objectStore('files').count(); r.onsuccess = () => resolve(r.result); });
  }), 0, 'session change deletes all generated artifacts from the previous preparation');
  assert.ok(queries.some(q => q.table === 'productos' && q.range[0] === 1000), 'complete paginated catalogue');
  console.log('PASS Stories/Studio: 1003 catalogue products, 23-image one-click complete CRC-verified ZIP including >12 MiB, all-at-once compatible sharing or automatic bounded groups, error resume, quota recovery, interrupted-write fencing, activation, cancel/duplicate/retry, fresh prices, 8 templates, modes, mobile, dialog focus, tenant cleanup; no remote writes/messages.');
  await context.close();
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
