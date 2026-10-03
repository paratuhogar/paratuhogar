// Actual quick UI, secure client, renderer and JPEGs. All traffic is intercepted.
const { chromium } = require('playwright'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), out = '/tmp/pth-quick-story-tested';
const profile = { id: 'actor-a', nombre: 'Contacto prueba', telefono: '5350000000', rol: 'gestor', estado: 'activo' };
const products = Array.from({ length: 503 }, (_, i) => ({ id: 'p' + i, nombre: 'Nevera prueba ' + i, precio: 100 + i, precio_flexible: 'SI', disponible: 'SI', comision: 20, costo_proveedor: 'PRIVATE_SENTINEL', categoria: 'NEVERAS', thumbnail: 'test-' + i + '.svg', descripcion: '20 pies. Inverter.', garantia: '1 mes', mensajeria: 'Mensajería por costo adicional' }));
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="white"/><rect x="125" y="70" width="350" height="750" rx="12" fill="#adb5bd"/><path d="M300 70v750" stroke="#344256" stroke-width="7"/></svg>';
const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><script src="/sdk.js" defer></script><script src="/js/secure-data.js" defer></script><script src="/js/internal-assets.js" defer></script></head><body><button id="opener">Crear Story</button><script>addEventListener('DOMContentLoaded',()=>{window.client=supabase.createClient('https://ljqwaovevfatkiigirhf.supabase.co','test-publishable');window.launch=async options=>{if(await PTHAssets.ensure('story'))window.story=PTHQuickStory.open(client,options)};document.getElementById('opener').onclick=()=>launch({productId:'p0'});});</script></body></html>`;
const sdk = `window.supabase={createClient(){return {from(){return {then:ok=>Promise.resolve({data:[],error:null}).then(ok)}},rpc(){}}}};`;
(async () => {
 fs.mkdirSync(out, { recursive: true }); const { validateQuery } = await import('../supabase/functions/secure-data/handler.mjs');
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 try {
  for (const width of [320, 390, 1280]) {
   let version = 0, delay = false, imageFailure = false, hidden = false, sub = false, denied = false, offline = false, failLoad = width === 320;
   const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true }), page = await context.newPage();
   const requests = [], queries = [], errors = [], alerts = [];
   page.on('pageerror', error => errors.push(error.message)); page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
   await page.addInitScript(() => { localStorage.setItem('pth_secure_token', 'actor-a-token'); window.createdURLs = []; window.revokedURLs = []; const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL); URL.createObjectURL = blob => { const url = create(blob); createdURLs.push(url); return url; }; URL.revokeObjectURL = url => { revokedURLs.push(url); revoke(url); }; navigator.canShare = data => data.files.length === 1; window.shareCalls = []; navigator.share = data => { shareCalls.push({ count: data.files.length, activation: navigator.userActivation.isActive, keys: Object.keys(data) }); return Promise.resolve(); }; });
   await page.route('**/*', async route => {
    const url = new URL(route.request().url()); requests.push(url.href);
    if (url.pathname === '/functions/v1/secure-data') {
     if (offline) return route.abort('internetdisconnected');
     if (denied) return route.fulfill({ status: 403, json: { data: null, error: { message: 'Sesión vencida', status: 403 } } });
     const body = route.request().postDataJSON(), actor = sub ? { ...profile, id: 'child-a', parent_id: profile.id, parent_nombre: profile.nombre } : profile;
     assert.ok(['session', 'query'].includes(body.action), 'Story must not mutate business data');
     if (delay) await new Promise(resolve => setTimeout(resolve, 350));
     if (body.action === 'session') return route.fulfill({ json: { data: { profile: actor }, error: null } });
     validateQuery(body, actor); queries.push(body);
     let data = body.table === 'productos' ? products.filter(p => !hidden || p.id !== 'p0').map(p => ({ ...p, precio: p.precio + version })) : body.table === 'precios_personalizados' && sub ? [{ producto_id: 'p0', nuevo_precio: 130, comision_subgestor: 5, visible_subgestor: false }, { producto_id: 'p1', nuevo_precio: 150, comision_subgestor: 7, visible_subgestor: true }] : [];
     if (body.range) data = data.slice(body.range[0], body.range[1] + 1);
     return route.fulfill({ json: { data, error: null } });
    }
    if (url.hostname === 'raw.githubusercontent.com') return imageFailure ? route.abort() : route.fulfill({ contentType: 'image/svg+xml', body: svg, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (url.origin === 'https://story.test') {
     if (url.pathname === '/index.html') return route.fulfill({ contentType: 'text/html', body: fixture });
     if (url.pathname === '/sdk.js') return route.fulfill({ contentType: 'application/javascript', body: sdk });
     if (url.pathname === '/js/quick-story.js' && failLoad) { failLoad = false; return route.abort(); }
     const file = path.resolve(root, '.' + url.pathname); if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.abort();
     return route.fulfill({ contentType: file.endsWith('.css') ? 'text/css' : file.endsWith('.ttf') ? 'font/ttf' : 'application/javascript', body: fs.readFileSync(file) });
    }
    return route.abort();
   });
   await page.goto('https://story.test/index.html');
   assert.equal(requests.some(url => url.includes('studio-designs') || url.includes('quick-story')), false, 'tools remain lazy');
   await page.evaluate(() => history.pushState({}, '', '/producto/nevera-prueba/'));
   const failureDialog = width === 320 ? page.waitForEvent('dialog') : null;
   await page.locator('#opener').click();
   if (failureDialog) { await failureDialog; assert.equal(alerts.length, 1); await page.locator('#opener').click(); }
   const ready = () => page.waitForFunction(() => window.story?.batch.valid() && document.querySelector('dialog [data-preview] img')?.naturalHeight === 1920);
   await ready();
   assert.equal(await page.locator('dialog [data-name]').innerText(), 'Nevera prueba 0');
   assert.equal(await page.locator('dialog [data-format],dialog [data-mode],dialog [data-select-all]').count(), 0);
   assert.equal(requests.some(url => url.includes('content-studio.js')), false, 'full editor is absent');
   assert.equal(requests.some(url => /\/producto\/.*\/(?:js|css|assets)\//.test(new URL(url).pathname)), false, 'nested entry uses root assets');
   assert.equal(await page.evaluate(() => story.batch.ready.files.length), 1);
   assert.doesNotMatch(await page.evaluate(() => story.batch.ready.text), /PRIVATE_SENTINEL|gestor|comisi[oó]n|24h/i);
   assert.match(await page.evaluate(() => story.batch.ready.text), /5350000000/);
   const hashes = [];
   for (const theme of ['essential', 'premium', 'technical', 'editorial']) {
    if (theme !== 'essential') { await page.locator('[data-theme="' + theme + '"]').click(); await ready(); }
    hashes.push(await page.evaluate(async () => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await story.batch.ready.files[0].arrayBuffer()))).join(',')));
    assert.equal(await page.locator('[data-theme="' + theme + '"]').getAttribute('aria-pressed'), 'true');
   }
   assert.equal(new Set(hashes).size, 4, 'four rendered designs differ');
   assert.equal(await page.locator('dialog').evaluate(d => d.scrollWidth <= d.clientWidth), true);
   for (const selector of ['[data-share]', '[data-download]', '[data-theme="essential"]']) { const box = await page.locator(selector).boundingBox(); assert.ok(box.height >= 44); }
   await page.screenshot({ path: path.join(out, 'story-' + width + '.png'), fullPage: true });
   // Native gesture and duplicate invocation are verified without sending anything.
   await page.locator('[data-share]').click(); await page.waitForFunction(() => !story.sharing);
   assert.deepEqual(await page.evaluate(() => shareCalls[0]), { count: 1, activation: true, keys: ['files'] });
   await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException("Failed to execute 'share' on 'Navigator': Permission denied", 'NotAllowedError')); });
   await page.locator('[data-share]').click(); await page.waitForFunction(() => !story.sharing);
   assert.equal(await page.evaluate(() => story.batch.valid()), true);
   assert.match(await page.locator('[data-status]').textContent(), /imagen sigue preparada/);
   assert.doesNotMatch(await page.locator('[data-status]').textContent(), /Permission denied|Navigator/);
   await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('cancel', 'AbortError')); });
   await page.locator('[data-share]').click(); await page.waitForFunction(() => !story.sharing); assert.equal(await page.evaluate(() => story.batch.valid()), true);
   await page.evaluate(() => { window.pendingShares = 0; navigator.share = () => { pendingShares++; return new Promise(resolve => window.releaseShare = resolve); }; story.share(); story.share(); });
   assert.equal(await page.evaluate(() => pendingShares), 1); await page.evaluate(() => releaseShare()); await page.waitForFunction(() => !story.sharing);
   await page.evaluate(() => { navigator.canShare = () => false; story.buttons(); });
   assert.equal(await page.locator('[data-share]').isVisible(), false);
   const downloadEvent = page.waitForEvent('download'); await page.locator('[data-download]').click(); const download = await downloadEvent; await download.saveAs(path.join(out, 'story-' + width + '.jpg'));
   assert.ok(fs.statSync(path.join(out, 'story-' + width + '.jpg')).size > 10000);
   // Price changes require an explicit review before another file can be prepared.
   version = 1; await page.locator('[data-theme="essential"]').click(); await page.waitForFunction(() => !story.loading);
   assert.equal(await page.evaluate(() => story.batch.ready), null); assert.match(await page.locator('[data-status]').innerText(), /Cambió/); assert.equal(await page.locator('[data-price]').innerText(), '$101 USD');
   await page.locator('[data-retry]').click(); await ready();
   // Search chooses exactly one other product; changing during preparation cancels the old file.
   await page.locator('[data-picker] summary').click(); await page.locator('[data-search]').fill('Nevera prueba 1'); await page.locator('[data-product-id="p1"]').click(); await ready();
   assert.equal(await page.evaluate(() => story.batch.ready.products[0].id), 'p1');
   delay = true; await page.locator('[data-theme="premium"]').click(); await page.locator('[data-theme="technical"]').click(); delay = false; await ready();
   assert.equal(await page.evaluate(() => story.options().theme), 'technical');
   await page.locator('[data-close]').focus(); await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog').count(), 0); assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
   // Generic access picks a product, while unavailable/unauthorized products are never prepared.
   await page.evaluate(() => launch({})); await page.waitForFunction(() => !story.loading); assert.equal(await page.evaluate(() => story.batch.ready), null);
   await page.locator('[data-search]').fill('Nevera prueba 0'); await page.locator('[data-product-id="p0"]').click(); await ready();
   await page.locator('[data-close]').click(); hidden = true; await page.evaluate(() => launch({ productId: 'p0' })); await page.waitForFunction(() => !story.loading); assert.equal(await page.evaluate(() => story.batch.ready), null); assert.match(await page.locator('[data-status]').innerText(), /no está disponible/); hidden = false;
   await page.locator('[data-close]').click();
   assert.equal(await page.evaluate(() => createdURLs.every(url => revokedURLs.includes(url))), true);
   sub = true; await page.goto('https://story.test/index.html'); await page.evaluate(() => launch({ productId: 'p0' })); await page.waitForFunction(() => !story.loading); assert.equal(await page.locator('[data-product-id="p0"]').count(), 0);
   await page.locator('[data-search]').fill('Nevera prueba 1'); await page.locator('[data-product-id="p1"]').click(); await ready(); assert.equal(await page.locator('[data-price]').innerText(), '$150 USD');
   // Clearing session removes files, previews and account data even while requests are pending.
   delay = true; await page.locator('[data-theme="premium"]').click(); await page.evaluate(() => { localStorage.setItem('pth_secure_token', 'other-account'); dispatchEvent(new Event('pth:session-changed')); });
   await page.waitForFunction(() => story.expired); await page.waitForTimeout(450); assert.equal(await page.evaluate(() => story.batch.ready), null); assert.equal(await page.locator('[data-preview] img').count(), 0); assert.equal(await page.locator('[data-products] button').count(), 0);
   delay = false; await page.locator('[data-close]').click(); sub = false;
   await page.goto('https://story.test/index.html');
   // Image/network failures keep a working retry; no partial image can be shared.
   imageFailure = true; await page.evaluate(() => launch({ productId: 'p3' })); await page.waitForFunction(() => !story.loading); assert.equal(await page.evaluate(() => story.batch.ready), null); assert.match(await page.locator('[data-status]').innerText(), /fotografía/); imageFailure = false; await page.locator('[data-retry]').click(); await ready();
   await page.locator('[data-close]').click(); offline = true; await context.setOffline(true); await page.evaluate(() => launch({ productId: 'p3' })); await page.waitForFunction(() => !story.loading); assert.equal(await page.evaluate(() => story.batch.ready), null); offline = false; await context.setOffline(false); await page.locator('[data-retry]').click(); await ready();
   await page.locator('[data-close]').click(); denied = true; await page.evaluate(() => launch({ productId: 'p3' })); await page.waitForFunction(() => !story.loading); assert.equal(await page.evaluate(() => story.batch.ready), null); denied = false; await page.locator('[data-close]').click();
   assert.deepEqual(errors, []); assert.ok(queries.some(q => q.table === 'productos' && q.range[0] === 500));
   assert.equal(await page.evaluate(() => createdURLs.every(url => revokedURLs.includes(url))), true, 'all image URLs are revoked on close');
   assert.equal(requests.some(url => /jszip|chart\.js|qrcode|jspdf/.test(url)), false);
   console.log('PASS quick Story ' + width + ': lazy nested-route entry, automatic single JPEG, 4 designs, mobile/keyboard, product changes, price review, share gesture/cancel/dedup, download, failures/offline, session/subaccount privacy; no real writes/messages.');
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
