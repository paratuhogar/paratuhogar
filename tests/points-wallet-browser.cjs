// Real browser / real wallet UI, synthetic localhost-only gateway. No production network.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const owner = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Laura Pérez', rol: 'gestor', estado: 'activo', parent_id: null };
const admin = { ...owner, id: '22222222-2222-4222-8222-222222222222', nombre: 'Administración', rol: 'admin' };
const child = { ...owner, id: '33333333-3333-4333-8333-333333333333', nombre: 'Ana Subgestora', parent_id: owner.id };
const account = { id: child.id, name: child.nombre, active:true };
const product = '44444444-4444-4444-8444-444444444444';
const movement = '55555555-5555-4555-8555-555555555555';
const capture = '66666666-6666-4666-8666-666666666666';
let browser, server, origin, gateway, serial = 0;
const scenarios = new Map();

function summary(beneficiaryId, offset = 0) {
  return {
    beneficiary: { id: beneficiaryId || owner.id, name: beneficiaryId === child.id ? child.nombre : owner.nombre },
    enabled: true, startedAt: '2026-11-22T10:00:00Z', balance: 18, pending: 8, reversed: 2,
    movements: offset ? [{ id: 'older', points: -2, kind: 'reversal', reason: 'Corrección del reconocimiento', createdAt: '2026-11-22T10:00:00Z', orderReference: null, reversalOf: movement }]
      : [{ id: movement, points: 18, kind: 'manual_credit', reason: 'Reto de noviembre <img src=x onerror=alert(1)>', createdAt: '2026-11-22T12:00:00Z', orderReference: 'PTH-0123', reversalOf: null }],
    nextOffset: offset ? null : 1
  };
}

before(async () => {
  ({pointsWallet:gateway}=await import(path.join(root,'supabase/functions/secure-data/points-wallet.mjs')));
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, origin || 'http://127.0.0.1');
    if (url.pathname === '/api') {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw), state = scenarios.get(url.searchParams.get('case'));
      const actor = JSON.parse(req.headers['x-test-profile']);
      state.calls.push(body);
      if (state.delay && body.operation === 'summary') await new Promise(resolve => {state.releases.push(resolve);state.release=()=>state.releases.splice(0).forEach(done=>done());});
      const write = ['grant', 'reverse', 'save_rule'].includes(body.operation);
      // Destroying TCP here lets Chromium transparently retransmit POST itself.
      // A gateway 503 isolates the UI's uncertain-outcome/no-replay contract.
      if (write && state.failOnce) { state.failOnce = false; res.writeHead(503, {'Content-Type':'application/json'}); res.end(JSON.stringify({data:null,error:{message:'Resultado no confirmado.',code:'SERVICE_UNAVAILABLE'}})); return; }
      if (write && state.sessionChanged) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({data:null,error:{message:'La sesión cambió.',code:'SESSION_CHANGED'}})); return; }
      if (state.failRead && !write) { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({data:null,error:{message:'No se pudo consultar. Reintenta.',code:'SERVICE_UNAVAILABLE'}})); return; }
      let data;
      switch (body.operation) {
        case 'summary': data = {...summary(body.beneficiaryId || actor.id, body.offset),balance:state.balances[body.beneficiaryId||actor.id]??18,enabled:state.enabled}; break;
        case 'accounts': data = { rows: body.offset ? [{id:owner.id,name:owner.nombre,active:true}] : [{...account,active:!state.inactive}], nextOffset: body.offset ? null : 1 }; break;
        case 'rules': data = { rows: [{productId:product,name:'Lavadora compacta',size:state.missingClassification?null:'pequeno',pointsPerUnit:state.missingClassification?null:body.offset ? 0 : 1,customPoints:body.offset ? 0 : null}], nextOffset:body.offset ? null : 1 }; break;
        case 'issues': data = { rows: body.offset ? [] : [{id:capture,beneficiaryId:state.missingBeneficiary?null:child.id,name:state.missingBeneficiary?'Cuenta sin identificar':child.nombre,orderReference:'PTH-0999',reason:'missing_classification'}], nextOffset:body.offset ? null : 1 }; break;
        case 'settings': data = { enabled:state.enabled,startedAt:state.enabled?'2026-11-22T10:00:00Z':null }; break;
        case 'save_rule': data = {rule:{productId:body.productId,name:'Lavadora compacta',size:'pequeno',pointsPerUnit:body.pointsPerUnit ?? 1,customPoints:body.pointsPerUnit}}; break;
        default: data = {movement:{id:movement,points:body.operation==='reverse'?-18:body.points,kind:body.operation==='reverse'?'reversal':'manual_credit',reason:body.reason,createdAt:'2026-11-22T12:00:00Z',orderReference:body.captureId?'PTH-0999':null,reversalOf:body.movementId||null}};
      }
      try {
        const validated=await gateway({rpc:async()=>body.operation==='grant'&&!state.enabled?{data:null,error:{code:'P0001'}}:{data,error:null}},body,actor);
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(validated));
      } catch(error) {
        res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{message:error.message,code:error.publicCode||'POINTS_INVALID'}}));
      }
      return;
    }
    if (url.pathname === '/js/points-wallet.js' || url.pathname === '/css/points-wallet.css') {
      const file = path.join(root,url.pathname);
      res.writeHead(200, {'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});
      res.end(fs.existsSync(file)?fs.readFileSync(file):''); return;
    }
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;margin:0;padding:16px;background:#f8fafc}nav{display:flex;gap:8px;flex-wrap:wrap}button{font:inherit}h1,h2,h3,h4{font-size:inherit;font-weight:inherit}</style><link rel="stylesheet" href="/css/points-wallet.css"><title>Puntos · prueba local</title><nav><button id="btn-dash-resumen">Inicio</button></nav><section id="sec-admin-master"><h1>Administración</h1><div id="admin-listings">Listados existentes</div></section><script src="/js/points-wallet.js" defer></script></html>');
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.PTH_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function fixture(t, profile = owner, width = 390) {
  const id = String(++serial), state = {profile,calls:[],releases:[],balances:{},failOnce:false,delay:false,failRead:false,enabled:true}; scenarios.set(id,state);
  const page = await browser.newPage({viewport:{width,height:850}});
  page.setDefaultTimeout(5000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { if (!route.request().url().startsWith(origin + '/')) throw Error('Nonlocal browser network blocked'); return route.continue(); });
  await page.addInitScript(({profile,id}) => {
    localStorage.setItem('pth_secure_token','a'.repeat(64));
    localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));
    localStorage.setItem('pth_session',JSON.stringify({isAdmin:true,data:profile}));
    window.PTHSecureData = {pointsWallet:body=>fetch('/api?case='+id,{method:'POST',headers:{'X-Test-Profile':JSON.stringify(JSON.parse(localStorage.getItem('pth_session')).data)},body:JSON.stringify(body)}).then(res=>res.json()).catch(()=>({data:null,error:{message:'La conexión se interrumpió.',code:'NETWORK_ERROR'}}))};
  },{profile,id});
  await page.goto(origin+'/');
  t.after(async () => { state.release?.(); await page.close(); scenarios.delete(id); assert.deepEqual(errors,[],'no uncaught browser exceptions'); });
  assert.equal(await page.locator('#pth-points-open').count(),1,'authenticated seller gets a wallet entry');
  return {page,state};
}
async function openAdmin(page) {
  await page.click('#pth-points-admin-open');
  await page.getByRole('button',{name:child.nombre,exact:true}).click();
  await page.locator('#pth-points-balance').waitFor();
}
async function grant(page, points = '7', reason = 'Reconocimiento por vídeo') {
  await page.getByLabel('Puntos a otorgar',{exact:true}).fill(points);
  await page.getByLabel('Motivo del reconocimiento',{exact:true}).fill(reason);
  await page.getByRole('button',{name:'Revisar reconocimiento',exact:true}).click();
}
async function switchSession(page, profile, token = 'b'.repeat(64), event = 'pth:session-changed') {
  await page.evaluate(({profile,token,event}) => {
    if (profile) localStorage.setItem('pth_session',JSON.stringify({isAdmin:true,data:profile})); else localStorage.removeItem('pth_session');
    if (token) localStorage.setItem('pth_secure_token',token); else localStorage.removeItem('pth_secure_token');
    dispatchEvent(event==='storage'?new StorageEvent('storage',{key:'pth_session'}):new Event(event));
  },{profile,token,event});
}

for (const width of [320,390,1280]) test(`own wallet is responsive and paginates ledger at ${width}px`,async t => {
  const {page,state} = await fixture(t,owner,width);
  await page.click('#pth-points-open');
  await page.locator('#pth-points-balance').waitFor();
  assert.equal(await page.locator('#pth-points-balance').innerText(),'18');
  assert.equal(await page.locator('#pth-points-title').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=24&&Number(getComputedStyle(e).fontWeight)>=700),true,'dialog headings stay readable under storefront style reset');
  assert.match(await page.locator('#pth-points-dialog').innerText(),/8[\s\S]*Pendientes/);
  assert.match(await page.locator('#pth-points-dialog').innerText(),/2[\s\S]*Revertidos/);
  assert.equal(await page.locator('#pth-points-dialog img').count(),0,'server strings remain inert text');
  assert.doesNotMatch(await page.locator('#pth-points-dialog').innerText(),/\$|USD|canjear/i);
  assert.equal(await page.locator('#pth-points-admin-open').count(),0,'legacy isAdmin is not authority');
  assert.equal(state.calls[0].beneficiaryId,undefined,'own view never sends another beneficiary');
  await page.getByRole('button',{name:'Ver más movimientos',exact:true}).click();
  await page.getByText('Corrección del reconocimiento',{exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='summary').at(-1).offset,1);
  assert.equal(await page.evaluate(()=>document.querySelector('#pth-points-dialog').scrollWidth<=document.querySelector('#pth-points-dialog').clientWidth),true,'no horizontal overflow');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.keyboard.press('Tab');
  await page.getByRole('button',{name:'Cerrar puntos',exact:true}).focus();
  assert.notEqual(await page.getByRole('button',{name:'Cerrar puntos',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle),'none');
  if (process.env.PTH_POINTS_SCREENSHOTS) {fs.mkdirSync(process.env.PTH_POINTS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PTH_POINTS_SCREENSHOTS,`points-own-${width}.png`),fullPage:true});}
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'pth-points-open','focus returns to opener');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/points|wallet/i.test(k))),[],'no private wallet storage');
});

test('principal and logistics cannot open child administration, even with legacy isAdmin',async t => {
  const {page} = await fixture(t,owner);
  assert.equal(await page.evaluate(()=>window.PTHPointsWallet.openAdmin()),false);
  await switchSession(page,{...owner,rol:'logistica'});
  assert.equal(await page.locator('#pth-points-admin-open').count(),0);
  await switchSession(page,{...child,rol:'admin'});
  assert.equal(await page.locator('#pth-points-admin-open').count(),0,'parent-linked role cannot become admin');
});

test('account search is server paginated and grant confirmation names account, amount and reason',async t => {
  const {page,state} = await fixture(t,admin,1280);
  assert.equal(await page.locator('#pth-points-admin-open').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('#admin-listings'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'admin entry precedes long existing lists');
  await page.click('#pth-points-admin-open');
  await page.getByLabel('Buscar cuenta',{exact:true}).fill('Ana');
  await page.getByRole('button',{name:'Buscar cuentas',exact:true}).click();
  await page.getByRole('button',{name:child.nombre,exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='accounts').at(-1).search,'Ana');
  await page.getByRole('button',{name:'Ver más cuentas',exact:true}).click();
  await page.getByRole('button',{name:owner.nombre,exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='accounts').at(-1).offset,1);
  await page.getByRole('button',{name:child.nombre,exact:true}).click();
  await page.locator('#pth-points-balance').waitFor();
  await grant(page);
  const review = await page.locator('.pth-points-confirm').innerText();
  assert.match(review,/Ana Subgestora/); assert.match(review,/7/); assert.match(review,/Reconocimiento por vídeo/);
  await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).dblclick();
  await page.getByText('Reconocimiento registrado.',{exact:true}).waitFor();
  const writes = state.calls.filter(c=>c.operation==='grant');
  assert.equal(writes.length,1,'double click is a single request');
  assert.equal(writes[0].beneficiaryId,child.id); assert.equal(writes[0].points,7); assert.match(writes[0].idempotencyKey,/^[a-f0-9]{64}$/);
  assert.equal(writes[0].captureId,undefined);
  if (process.env.PTH_POINTS_SCREENSHOTS) await page.screenshot({path:path.join(process.env.PTH_POINTS_SCREENSHOTS,'points-admin-1280.png'),fullPage:true});
});

test('positive amount and a nonblank reason are required before grant',async t => {
  const {page,state} = await fixture(t,admin);
  await openAdmin(page);
  await grant(page,'0','   ');
  assert.equal(await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).count(),0);
  assert.equal(state.calls.filter(c=>c.operation==='grant').length,0);
});

test('uncertain grant preserves values and idempotency key without automatic write retries',async t => {
  const {page,state} = await fixture(t,admin); state.failOnce = true;
  await openAdmin(page); await grant(page);
  await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).click();
  await page.getByText(/No se pudo confirmar/).waitFor();
  assert.equal(await page.getByLabel('Puntos a otorgar',{exact:true}).inputValue(),'7');
  assert.equal(await page.getByLabel('Motivo del reconocimiento',{exact:true}).inputValue(),'Reconocimiento por vídeo');
  assert.equal(state.calls.filter(c=>c.operation==='grant').length,1);
  await page.getByRole('button',{name:'Reintentar reconocimiento',exact:true}).click();
  await page.getByText('Reconocimiento registrado.',{exact:true}).waitFor();
  const writes=state.calls.filter(c=>c.operation==='grant');
  assert.equal(writes.length,2); assert.equal(writes[0].idempotencyKey,writes[1].idempotencyKey);
});

test('admin reverses a specific recognition with a required reason',async t => {
  const {page,state} = await fixture(t,admin);
  await openAdmin(page);
  await page.getByRole('button',{name:'Revertir reconocimiento',exact:true}).click();
  await page.getByLabel('Motivo del reverso',{exact:true}).fill('Reconocimiento duplicado');
  await page.getByRole('button',{name:'Revisar reverso',exact:true}).click();
  assert.match(await page.locator('.pth-points-confirm').innerText(),/Ana Subgestora[\s\S]*18[\s\S]*Reconocimiento duplicado/);
  await page.getByRole('button',{name:'Confirmar reverso',exact:true}).click();
  await page.getByText('Reverso registrado.',{exact:true}).waitFor();
  assert.equal(state.calls.find(c=>c.operation==='reverse').movementId,movement);
});

test('product rules distinguish explicit zero from default null and paginate',async t => {
  const {page,state} = await fixture(t,admin,320);
  await page.click('#pth-points-admin-open');
  await page.getByRole('button',{name:'Reglas por producto',exact:true}).click();
  await page.getByRole('button',{name:'Editar Lavadora compacta',exact:true}).click();
  await page.getByLabel('Tipo de regla',{exact:true}).selectOption('custom');
  await page.getByLabel('Puntos por unidad',{exact:true}).fill('0');
  await page.getByLabel('Motivo del cambio',{exact:true}).fill('Excluir este producto');
  if (process.env.PTH_POINTS_SCREENSHOTS) await page.screenshot({path:path.join(process.env.PTH_POINTS_SCREENSHOTS,'points-rules-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Revisar regla',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar regla',exact:true}).click();
  await page.getByText('Regla guardada.',{exact:true}).waitFor();
  assert.equal(state.calls.find(c=>c.operation==='save_rule').pointsPerUnit,0);
  await page.getByRole('button',{name:'Editar Lavadora compacta',exact:true}).click();
  await page.getByLabel('Tipo de regla',{exact:true}).selectOption('default');
  await page.getByLabel('Motivo del cambio',{exact:true}).fill('Restaurar la regla por tamaño');
  await page.getByRole('button',{name:'Revisar regla',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar regla',exact:true}).click();
  await page.getByText('Regla guardada.',{exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='save_rule').at(-1).pointsPerUnit,null);
  await page.getByRole('button',{name:'Ver más productos',exact:true}).click();
  await page.getByText('Excluido · 0 puntos',{exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='rules').at(-1).offset,1);
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
});

test('issue resolution links the sale capture and beneficiary to the manual recognition',async t => {
  const {page,state} = await fixture(t,admin);
  await page.click('#pth-points-admin-open');
  await page.getByRole('button',{name:'Ventas por revisar',exact:true}).click();
  await page.getByText('PTH-0999',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Resolver con puntos',exact:true}).click();
  await grant(page,'8','Clasificación revisada por administración');
  await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).click();
  await page.getByText('Reconocimiento registrado.',{exact:true}).waitFor();
  const write=state.calls.find(c=>c.operation==='grant');
  assert.equal(write.captureId,capture); assert.equal(write.beneficiaryId,child.id);
});

test('offline labels old totals and blocks new writes without replaying on reconnect',async t => {
  const {page,state} = await fixture(t,admin);
  await openAdmin(page); await grant(page);
  await page.context().setOffline(true);
  await page.getByText(/Sin conexión/).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).isDisabled(),true);
  await page.context().setOffline(false);
  await page.getByText(/Conexión recuperada/).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='grant').length,0,'online event does not replay writes');
  assert.match(await page.locator('#pth-points-dialog').innerText(),/no se han actualizado|Última consulta/i);
});

test('owner, token, role changes and logout erase private views and reject late responses',async t => {
  const {page,state} = await fixture(t,admin);
  state.delay=true;
  await page.click('#pth-points-open');
  await page.waitForFunction(()=>document.querySelector('#pth-points-dialog').textContent.includes('Cargando'));
  await switchSession(page,child);
  state.delay=false; state.release();
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open),false);
  assert.doesNotMatch(await page.locator('#pth-points-dialog').innerText(),/Laura Pérez|18/);
  await page.click('#pth-points-open'); await page.locator('#pth-points-balance').waitFor();
  await switchSession(page,child,'c'.repeat(64),'storage');
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open),false,'token-only switch clears private view');
  await page.click('#pth-points-open'); await page.locator('#pth-points-balance').waitFor();
  await switchSession(page,{...child,rol:'logistica'},'c'.repeat(64));
  assert.equal(await page.locator('#pth-points-balance').count(),0,'role changes clear amounts');
  await switchSession(page,null,null);
  assert.equal(await page.locator('#pth-points-open').count(),0);
  assert.equal(await page.locator('#pth-points-admin-open').count(),0);
});

test('read failure offers an explicit retry, and expired local sessions expose no private entry',async t => {
  const {page,state} = await fixture(t,owner); state.failRead=true;
  await page.click('#pth-points-open');
  await page.getByText('No se pudo consultar. Reintenta.',{exact:true}).waitFor();
  assert.equal(await page.locator('#pth-points-balance').count(),0);
  state.failRead=false;
  await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();
  await page.locator('#pth-points-balance').waitFor();
  await page.evaluate(()=>{localStorage.setItem('pth_secure_token_expires_at',String(Date.now()-1));dispatchEvent(new Event('pth:session-changed'));});
  assert.equal(await page.locator('#pth-points-open').count(),0);
  assert.equal(await page.locator('#pth-points-balance').count(),0);
});

test('gateway session change closes and erases an old administrative form without replay',async t=>{
  const {page,state}=await fixture(t,admin);state.sessionChanged=true;
  await openAdmin(page);await grant(page);
  await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#pth-points-dialog').open);
  assert.equal(await page.locator('#pth-points-balance').count(),0);
  assert.equal(await page.getByLabel('Motivo del reconocimiento',{exact:true}).count(),0);
  assert.equal(state.calls.filter(c=>c.operation==='grant').length,1);
});

test('disabled program preserves existing balances without claiming new sales accrue',async t=>{
  const {page,state}=await fixture(t,owner);state.enabled=false;
  await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
  assert.match(await page.locator('#pth-points-dialog').innerText(),/no está activo para ventas nuevas/);
  assert.doesNotMatch(await page.locator('#pth-points-dialog').innerText(),/Las ventas suman puntos/);
  assert.equal(await page.locator('#pth-points-balance').innerText(),'18');
});

test('issue without beneficiary requires selecting an account before reading or granting points',async t=>{
  const {page,state}=await fixture(t,admin);state.missingBeneficiary=true;
  await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
  const before=state.calls.filter(c=>c.operation==='summary').length;
  await page.click('#pth-points-admin-open');await page.getByRole('button',{name:'Ventas por revisar',exact:true}).click();
  await page.getByRole('button',{name:'Resolver con puntos',exact:true}).click();
  await page.getByText('Selecciona el destinatario de esta venta.',{exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='summary').length,before,'missing owner never falls back to admin wallet; own badge is unrelated');
  await page.getByRole('button',{name:child.nombre,exact:true}).click();await page.locator('#pth-points-balance').waitFor();
  await grant(page,'8','Destinatario y clasificación verificados');await page.getByRole('button',{name:'Confirmar reconocimiento',exact:true}).click();
  await page.getByText('Reconocimiento registrado.',{exact:true}).waitFor();
  const write=state.calls.find(c=>c.operation==='grant');assert.equal(write.beneficiaryId,child.id);assert.equal(write.captureId,capture);
});

test('inactive account retains its history but does not offer new recognitions',async t=>{
  const {page,state}=await fixture(t,admin);state.inactive=true;
  await page.click('#pth-points-admin-open');
  await page.getByRole('button',{name:child.nombre+' · Inactiva',exact:true}).click();
  await page.locator('#pth-points-balance').waitFor();
  assert.equal(await page.getByLabel('Puntos a otorgar',{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Revisar reconocimiento',exact:true}).count(),0);
  assert.match(await page.locator('#pth-points-dialog').innerText(),/historial se conserva/i);
});

test('missing product classification is not presented as a zero-point default',async t=>{
  const {page,state}=await fixture(t,admin);state.missingClassification=true;
  await page.click('#pth-points-admin-open');await page.getByRole('button',{name:'Reglas por producto',exact:true}).click();
  await page.getByText('Sin clasificación · requiere revisión',{exact:true}).waitFor();
  assert.doesNotMatch(await page.locator('.pth-points-product').innerText(),/Por tamaño · 0/);
  await page.getByRole('button',{name:'Ventas por revisar',exact:true}).click();
  await page.getByText('Producto sin clasificación',{exact:true}).waitFor();
  assert.doesNotMatch(await page.locator('.pth-points-product').innerText(),/missing_classification/);
});

test('paused admin account hides new grants but retains audited reversals',async t=>{
  const {page,state}=await fixture(t,admin);state.enabled=false;
  await openAdmin(page);
  assert.equal(await page.getByRole('button',{name:'Revisar reconocimiento',exact:true}).isVisible(),false);
  await page.getByRole('button',{name:'Revertir reconocimiento',exact:true}).click();
  await page.getByLabel('Motivo del reverso',{exact:true}).fill('Corrección durante la pausa');
  await page.getByRole('button',{name:'Revisar reverso',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar reverso',exact:true}).click();
  await page.getByText('Reverso registrado.',{exact:true}).waitFor();
  assert.equal(state.calls.filter(c=>c.operation==='grant').length,0);
});

test('entry badge displays only confirmed own points and avoids repeated background reads',async t=>{
 const {page,state}=await fixture(t);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 const calls=state.calls.filter(c=>c.operation==='summary').length;
 for(let i=0;i<8;i++)await page.evaluate(()=>dispatchEvent(new Event('focus')));
 assert.equal(state.calls.filter(c=>c.operation==='summary').length,calls,'recent verified badge does not poll on repeated focus');
 assert.equal(await page.locator('#pth-points-badge').innerText(),'18','8 pending points are not added');
 assert.match(await page.locator('#pth-points-open').getAttribute('aria-label'),/18.*confirmados/);
 assert.equal(await page.locator('#pth-points-badge').evaluate(e=>{const badge=e.getBoundingClientRect(),nav=e.parentElement.parentElement.getBoundingClientRect();return badge.top>=nav.top;}),true,'counter must not be clipped by the real scrolling navigation');
 assert.equal(state.calls.some(c=>c.operation==='grant'||c.operation==='reverse'),false);
});

test('milestones use confirmed balance and celebrate only a new increase',async t=>{
 const {page,state}=await fixture(t);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 assert.deepEqual(await page.locator('.pth-points-milestone[data-reached="true"]').allTextContents(),['5','10']);
 assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'18');
 assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'25');
 assert.equal(await page.locator('.pth-points-celebration').count(),0,'opening an existing balance does not invent a new reward');
 state.balances[owner.id]=25;
 await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();
 await page.getByText('Sumaste 7 puntos confirmados.',{exact:true}).waitFor();
 assert.equal(await page.locator('#pth-points-badge').innerText(),'25');
 assert.deepEqual(await page.locator('.pth-points-milestone[data-reached="true"]').allTextContents(),['5','10','25']);
 await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();await page.locator('#pth-points-balance').waitFor();
 assert.equal(await page.locator('.pth-points-celebration').count(),0,'same balance is not celebrated again');
 assert.match(await page.locator('#pth-points-dialog').innerText(),/hitos visuales|Hitos visuales/);
});

test('zero and completed milestones stay honest, including reduced motion',async t=>{
 const {page,state}=await fixture(t,owner,320);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 state.balances[owner.id]=0;await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 assert.equal(await page.locator('#pth-points-badge').innerText(),'0');
 assert.equal(await page.locator('.pth-points-milestone[data-reached="true"]').count(),0);
 assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
 await page.emulateMedia({reducedMotion:'reduce'});state.balances[owner.id]=100;
 await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();
 await page.getByText('Sumaste 100 puntos confirmados.',{exact:true}).waitFor();
 assert.equal(await page.locator('.pth-points-milestone[data-reached="true"]').count(),5);
 assert.equal(await page.locator('.pth-points-celebration').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
});

test('administrative inspection never replaces the administrator own badge',async t=>{
 const {page,state}=await fixture(t,admin);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 state.balances[admin.id]=4;state.balances[child.id]=37;
 await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 assert.equal(await page.locator('#pth-points-badge').innerText(),'4');
 await page.getByRole('button',{name:'Cerrar puntos',exact:true}).click();await openAdmin(page);
 assert.equal(await page.locator('#pth-points-balance').innerText(),'37');
 assert.equal(await page.locator('#pth-points-badge').innerText(),'4');
});

test('badge hides unverified amounts offline and discards a delayed old-account result',async t=>{
 const {page,state}=await fixture(t);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 await page.context().setOffline(true);
 assert.equal(await page.locator('#pth-points-badge').innerText(),'—','offline badge is not a current balance');
 state.delay=true;await page.context().setOffline(false);
 await page.waitForFunction(()=>document.querySelector('#pth-points-badge').textContent==='…');
 await switchSession(page,child);state.delay=false;state.release?.();
 await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 await switchSession(page,null,null);
 assert.equal(await page.locator('#pth-points-badge').count(),0);
 assert.equal(await page.locator('#pth-points-balance').count(),0);
 assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/points|wallet/i.test(k))),[]);
});

async function holdBackgroundRead(page){
 await page.evaluate(()=>{
  const original=PTHSecureData.pointsWallet;
  window.badgeHeld=false;window.badgeResultReady=false;window.holdBadge=true;
  PTHSecureData.pointsWallet=async body=>{
   const hold=window.holdBadge&&body.operation==='summary';let gate;
   if(hold){window.badgeHeld=true;gate=new Promise(resolve=>window.releaseBadge=resolve);}
   const result=await original(body);
   if(hold){window.badgeResultReady=true;await gate;}
   return result;
  };
  dispatchEvent(new Event('online'));window.holdBadge=false;
 });
 await page.waitForFunction(()=>!window.badgeHeld||window.badgeResultReady);
}

test('a delayed badge read cannot replace a newer wallet balance or repeat its celebration',async t=>{
 const {page,state}=await fixture(t);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 await holdBackgroundRead(page);
 state.balances[owner.id]=25;
 await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();
 await page.getByText('Sumaste 7 puntos confirmados.',{exact:true}).waitFor();
 await page.evaluate(()=>window.releaseBadge?.());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('#pth-points-badge').innerText(),'25');
 assert.equal(await page.locator('#pth-points-balance').innerText(),'25');
 await page.getByRole('button',{name:'Actualizar puntos',exact:true}).click();await page.locator('#pth-points-balance').waitFor();
 assert.equal(await page.locator('.pth-points-celebration').count(),0);
});

test('a previously confirmed in-flight response cannot repaint a current badge after going offline',async t=>{
 const {page}=await fixture(t);
 await page.locator('#pth-points-badge').filter({hasText:'18'}).waitFor();
 await holdBackgroundRead(page);
 assert.equal(await page.evaluate(()=>window.badgeHeld),true,'exercise an actual pending background request');
 await page.context().setOffline(true);await page.evaluate(()=>window.releaseBadge());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('#pth-points-badge').innerText(),'—');
});
