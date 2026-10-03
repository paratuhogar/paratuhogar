// Actual introduction markup/scripts and storefront navigation; local synthetic sessions only.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const nav = html.match(/<nav id="admin-nav"[\s\S]*?<\/nav>/)[0];
const guide = html.match(/<aside id="pth-guide-download"[\s\S]*?<\/aside>/)[0];
const welcome = html.match(/<dialog id="pth-welcome"[\s\S]*?<\/dialog>/)[0];
const scripts = ['gestor-guide', 'work-welcome'].map(n => fs.readFileSync(path.join(root, `js/${n}.js`), 'utf8')).join('\n');
const css = ['work-navigation', 'gestor-guide', 'work-welcome'].map(n => fs.readFileSync(path.join(root, `css/${n}.css`), 'utf8')).join('\n');
const storefront = fs.readFileSync(path.join(root, 'js/storefront.js'), 'utf8');
const navigation = storefront.slice(storefront.indexOf('function showSection(section) {'), storefront.indexOf('    // GESTORES', storefront.indexOf('function showSection(section) {')));
const pdf = fs.readFileSync(path.join(root, 'guias/guia-gestores.pdf'));
const manifest = fs.readFileSync(path.join(root, 'guias/gestores.json'));
(async () => {
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 let server;
 try {
  const requests = [];
  server = http.createServer((req, res) => {
   const url = new URL(req.url, 'http://127.0.0.1'); requests.push(url.pathname);
   if (url.pathname === '/guias/gestores.json') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(manifest); }
   if (url.pathname === '/guias/guia-gestores.pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length }); return res.end(req.method === 'HEAD' ? '' : pdf); }
   if (url.pathname === '/assets/fonts/Manrope.ttf') { res.writeHead(200, { 'Content-Type': 'font/ttf' }); return res.end(fs.readFileSync(path.join(root, 'assets/fonts/Manrope.ttf'))); }
   const role = ['visitor', 'gestor', 'child', 'admin', 'mensajero'].includes(url.searchParams.get('role')) ? url.searchParams.get('role') : 'gestor';
   const profile = role === 'visitor' ? null : { id: url.searchParams.get('id') === 'B' ? 'B' : 'A', rol: role === 'child' ? 'gestor' : role, estado: 'activo', ...(role === 'child' ? { parent_id: 'principal' } : {}) };
   res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
   res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Manrope;src:url(/assets/fonts/Manrope.ttf);font-weight:200 800}*{box-sizing:border-box}body{margin:0;background:#f5f8fc}.hidden{display:none}${css}</style></head><body><main>${nav}<section id="sec-catalogo"><input id="search-bar" aria-label="Buscar productos"></section><section id="sec-dashboard" class="hidden" style="padding:16px">${guide}<h1 id="gestor-home-title">Centro de trabajo de ejemplo</h1></section></main><div id="fixture-blocker" class="fixed inset-0 hidden" style="position:fixed;inset:0">Otra tarea abierta</div><dialog id="fixture-dialog"><button>Cerrar otra tarea</button></dialog>${welcome}<script>window.currentUserData=${JSON.stringify(profile)};window.token=${profile ? '"synthetic"' : 'null'};window.adminView=${role === 'admin'};window.gestorName='Referencia ficticia';window.PTHSecureData={token:()=>window.token};window.PTHWorkView={isAdminView:()=>window.adminView};window.offlineStorefront={usingCopy:()=>false};let myOrdersData=[{}];function renderGestorHomeFromCache(){}function loadProDashboard(){}${navigation}document.getElementById('admin-nav').classList.toggle('hidden',!currentUserData||adminView);</script><script>${scripts}</script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const pageFor = async (role = 'gestor', setup) => {
   const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
   if (setup) await context.addInitScript(setup);
   await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
   const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
   await page.goto(`${url}/?role=${role}`); return { page, context, errors };
  };
  const { page, context, errors } = await pageFor();
  await page.waitForSelector('#pth-welcome[open]');
  assert.equal(await page.locator('#pth-welcome-step').textContent(), '1 de 3');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pth-welcome-title');
  assert.equal(await page.locator('#pth-welcome-skip').isVisible(), true);
  assert.equal(await page.locator('#pth-guide-download').isVisible(), false);
  assert.equal(await page.locator('#sec-catalogo #pth-guide-download').count(), 0);
  for (const width of [320, 390, 1280]) for (const dark of [false, true]) {
   await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
   await page.evaluate(d => document.documentElement.classList.toggle('dark', d), dark);
   assert.equal(await page.locator('#pth-welcome').evaluate(n => n.scrollWidth > n.clientWidth), false, 'welcome fits narrow screen');
   for (const id of ['skip', 'action', 'next']) assert.ok((await page.locator(`#pth-welcome-${id}`).boundingBox()).height >= 44);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => document.documentElement.classList.remove('dark'));
  const capture = async name => {
   if (!process.env.PTH_WELCOME_CAPTURE) return;
   fs.mkdirSync(process.env.PTH_WELCOME_CAPTURE, { recursive: true });
   await page.evaluate(() => {
    if (!document.getElementById('fixture-capture-label')) {
     const label = document.createElement('p'); label.id='fixture-capture-label'; label.textContent='DEMOSTRACIÓN LOCAL · DATOS FICTICIOS';
     Object.assign(label.style,{fontSize:'10px',color:'#526176',margin:'12px 0 0'});document.getElementById('pth-welcome').append(label);
    }
    return document.fonts.ready;
   });
   await page.screenshot({ path: path.join(process.env.PTH_WELCOME_CAPTURE, name + '.png') });
  };
  await capture('bienvenida-1');
  await page.click('#pth-welcome-next'); assert.equal(await page.locator('#pth-welcome-step').textContent(), '2 de 3');
  await page.click('#pth-welcome-back'); assert.equal(await page.locator('#pth-welcome-step').textContent(), '1 de 3');
  await page.click('#pth-welcome-next');
  await capture('bienvenida-2');
  await page.click('#pth-welcome-next'); assert.equal(await page.locator('#pth-welcome-step').textContent(), '3 de 3');
  assert.doesNotMatch(await page.locator('#pth-welcome').textContent(), /eterno|rango|semana|sincronización|campo de batalla/i);
  await capture('bienvenida-3');
  await page.click('#pth-welcome-action');
  await page.waitForSelector('#pth-guide-download:visible'); assert.equal(await page.locator('#pth-welcome[open]').count(), 0);
  assert.equal(await page.locator('#sec-dashboard #pth-guide-download').count(), 1);
  await page.click('#pth-welcome-reopen'); await page.waitForSelector('#pth-welcome[open]');
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('#pth-welcome'))), true, 'native dialog retains keyboard focus');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#pth-welcome[open]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pth-welcome-reopen');
  await page.click('#pth-welcome-reopen'); await page.click('#pth-welcome-skip');
  await page.click('#pth-welcome-reopen'); await page.click('#pth-welcome-next'); await page.click('#pth-welcome-next');
  assert.equal(await page.locator('#pth-welcome-next').textContent(), 'Terminar');
  await page.click('#pth-welcome-next'); assert.equal(await page.locator('#pth-welcome[open]').count(), 0);
  await page.reload(); await page.waitForTimeout(500); assert.equal(await page.locator('#pth-welcome[open]').count(), 0, 'does not repeat after reload');
  await page.evaluate(() => { showSection('dashboard'); PTHWelcome.open(); });
  await page.click('#pth-welcome-action'); assert.equal(await page.locator('#sec-dashboard').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'search-bar');
  await page.evaluate(() => { currentUserData = { id: 'B', rol: 'gestor', parent_id: 'A' }; dispatchEvent(new Event('pth:session-changed')); });
  await page.waitForSelector('#pth-welcome[open]'); assert.equal(await page.evaluate(() => localStorage.getItem('pth_welcome_v2:B')), 'seen');
  await page.evaluate(() => { currentUserData = null; token = null; document.getElementById('admin-nav').classList.add('hidden'); dispatchEvent(new Event('pth:session-changed')); });
  assert.equal(await page.locator('#pth-welcome[open]').count(), 0); await page.waitForTimeout(400);
  assert.equal(await page.locator('#pth-welcome[open]').count(), 0, 'logout prevents late opening');
  assert.deepEqual(errors, []); await context.close();
  for (const role of ['visitor', 'admin', 'mensajero']) {
   const tested = await pageFor(role); await tested.page.waitForTimeout(500);
   assert.equal(await tested.page.locator('#pth-welcome[open]').count(), 0, `${role} must not receive sales onboarding`);
   assert.equal(await tested.page.evaluate(() => PTHWelcome.open()), false);
   if (role === 'admin') {
    await tested.page.evaluate(() => { adminView=false; document.getElementById('admin-nav').classList.remove('hidden'); PTHWelcome.sync(); });
    await tested.page.waitForSelector('#pth-welcome[open]'); await tested.page.click('#pth-welcome-skip');
    await tested.page.evaluate(() => showSection('dashboard')); await tested.page.waitForSelector('#pth-guide-download:visible');
   }
   assert.deepEqual(tested.errors, []); await tested.context.close();
  }
  const child = await pageFor('child'); await child.page.waitForSelector('#pth-welcome[open]'); await child.page.click('#pth-welcome-skip'); await child.context.close();
  const legacy = await pageFor('gestor', () => localStorage.setItem('sl_tutorial_completed_v1', 'true'));
  await legacy.page.waitForTimeout(500); assert.equal(await legacy.page.locator('#pth-welcome[open]').count(), 0, 'old dismissal migrates');
  assert.equal(await legacy.page.evaluate(() => localStorage.getItem('pth_welcome_v2:A')), 'seen'); await legacy.context.close();
  const blocked = await pageFor('gestor', () => localStorage.setItem('pth_welcome_v2:A', 'seen'));
  await blocked.page.evaluate(() => { localStorage.removeItem('pth_welcome_v2:A'); document.getElementById('fixture-dialog').showModal(); PTHWelcome.sync(); });
  assert.equal(await blocked.page.locator('#pth-welcome[open]').count(), 0, 'does not stack another dialog');
  await blocked.page.evaluate(() => document.getElementById('fixture-dialog').close());
  await blocked.page.waitForSelector('#pth-welcome[open]'); await blocked.page.click('#pth-welcome-skip');
  await blocked.page.evaluate(() => { PTHWelcome.open(); document.getElementById('fixture-blocker').classList.remove('hidden'); });
  await blocked.page.waitForFunction(() => !document.getElementById('pth-welcome').open);
  assert.deepEqual(blocked.errors, []); await blocked.context.close();
  const failedStorage = await pageFor('gestor', () => { Storage.prototype.getItem = () => { throw Error('disabled'); }; Storage.prototype.setItem = () => { throw Error('disabled'); }; });
  await failedStorage.page.waitForSelector('#pth-welcome[open]'); await failedStorage.page.click('#pth-welcome-skip');
  await failedStorage.page.evaluate(() => { PTHWelcome.sync(); dispatchEvent(new Event('pageshow')); }); await failedStorage.page.waitForTimeout(400);
  assert.equal(await failedStorage.page.locator('#pth-welcome[open]').count(), 0); assert.deepEqual(failedStorage.errors, []); await failedStorage.context.close();
  assert.equal(requests.some(p => /functions|permission|crm|notification/.test(p)), false, 'introduction performs no app writes or permission requests');
  console.log('PASS practical three-step welcome, Dashboard guide, mobile/dark/focus, skip/Escape/reopen, actions, per-account dismissal, legacy migration, child/visitor/admin/messenger, modal queue, logout and storage errors');
 } finally { await browser.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } }
})().catch(error => { console.error(error); process.exitCode = 1; });
