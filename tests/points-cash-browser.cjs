// Isolated real DOM/browser; synthetic localhost cash ledger. Never contacts production.
'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const owner={id:'11111111-1111-4111-8111-111111111111',nombre:'Laura Pérez',rol:'gestor',estado:'activo',parent_id:null};
const admin={...owner,id:'22222222-2222-4222-8222-222222222222',nombre:'Administración',rol:'admin'};
const other={...owner,id:'33333333-3333-4333-8333-333333333333',nombre:'Otra cuenta'};
const rowId='44444444-4444-4444-8444-444444444444';
const now='2026-11-22T12:00:00Z';
const states=new Map(); let browser,server,origin,serial=0;
function row(overrides={}) {return {id:rowId,beneficiaryId:owner.id,beneficiaryName:owner.nombre,usd:10,points:30,state:'requested',revision:1,createdAt:now,updatedAt:now,claimedBy:null,claimedByName:null,paymentMethod:null,paymentReference:null,paidAt:null,reason:null,...overrides};}
function snapshot(state,actor) {
  const own=state.rows.filter(r=>r.beneficiaryId===actor.id);
  const reserved=own.filter(r=>['requested','approved','in_payment'].includes(r.state)).reduce((a,r)=>a+r.points,0);
  const redeemed=own.filter(r=>r.state==='paid').reduce((a,r)=>a+r.points,0);
  const earned=state.earnedById?.[actor.id]??31;
  return {beneficiary:{id:actor.id,name:actor.nombre},enabled:state.enabled,rate:3,earnedConfirmed:earned,available:Math.max(0,earned-reserved-redeemed),reserved,redeemedPoints:redeemed,paidUsd:redeemed/3,deficit:Math.max(0,reserved+redeemed-earned)};
}
async function respond(req,res,url) {
  let raw=''; for await (const part of req) raw+=part;
  const body=JSON.parse(raw),state=states.get(url.searchParams.get('case'));
  const actor=JSON.parse(req.headers['x-test-profile']);
  const cash=url.pathname==='/cash'; state.calls.push({cash,...body});
  if(state.failConcurrentRead&&['summary','list'].includes(body.operation)) {
    if(state.reading) {state.readOverlaps=(state.readOverlaps||0)+1;res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{code:'POINTS_CASH_BUSY',status:409,message:'La billetera se está actualizando.'}}));return;}
    state.reading=true;await new Promise(resolve=>setTimeout(resolve,30));state.reading=false;
  }
  let data;
  if (!cash) {
    if(body.operation==='summary') data={beneficiary:{id:actor.id,name:actor.nombre},enabled:true,balance:31,pending:8,reversed:2,movements:[],nextOffset:null,...(state.absent?{}:{cash:snapshot(state,actor)})};
    else if(body.operation==='settings') data={enabled:true};
    else data={rows:[],nextOffset:null};
  } else if(body.operation==='summary') {
    if(body.beneficiaryId&&state.failTargetSummary) {res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{code:'POINTS_CASH_INVALID',status:400,message:'Cuenta no disponible.'}}));return;}
    const target=body.beneficiaryId?[owner,admin,other].find(p=>p.id===body.beneficiaryId):actor;
    data=snapshot(state,target);
    if(body.beneficiaryId&&state.wrongTargetSummary)data.beneficiary={id:other.id,name:other.nombre};
  }
  else if(body.operation==='list') {
    let rows=state.rows.filter(r=>state.leakRows||actor.rol==='admin'&&!actor.parent_id||r.beneficiaryId===actor.id);
    if(body.state) rows=rows.filter(r=>r.state===body.state);
    if(body.search) rows=rows.filter(r=>(r.beneficiaryName+' '+r.id).includes(body.search));
    const totals={requestedUsd:0,approvedUsd:0,inPaymentUsd:0,paidUsd:0};
    for(const r of rows) {const key={requested:'requestedUsd',approved:'approvedUsd',in_payment:'inPaymentUsd',paid:'paidUsd'}[r.state];if(key)totals[key]+=r.usd;}
    const offset=body.offset||0;
    data={rows:rows.slice(offset,offset+1),nextOffset:offset+1<rows.length?offset+1:null,totals};
  } else if(body.operation==='detail') {
    const selected=state.rows.find(r=>r.id===body.requestId);
    data={request:selected,events:(body.offset?[{id:'event-older',operation:'request',state:'requested',revision:1,actorId:owner.id,actorName:owner.nombre,reason:'Anterior',reference:null,createdAt:now}]:[{id:'event-current',operation:state.systemEvent?'backing_reversed':'request',state:selected.state,revision:selected.revision,actorId:state.systemEvent?null:owner.id,actorName:state.systemEvent?null:'<img src=x onerror=alert(1)>',reason:state.systemEvent?'Saldo corregido':'Motivo <script>alert(1)</script>',reference:null,createdAt:now}]),nextOffset:body.offset?null:1};
  } else {
    if(state.denied) {res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{code:'POINTS_CASH_FORBIDDEN',message:'No autorizado.',status:403}}));return;}
    let result=state.operations.get(body.idempotencyKey);
    if(!result) {
      let selected=state.rows.find(r=>r.id===body.requestId);
      if(body.operation==='request') {selected=row();state.rows.push(selected);}
      else {
        selected.state={approve:'approved',reject:'rejected',cancel:'cancelled',start_payment:'in_payment',record_payment:'paid',release_payment:'approved',refund:'refunded'}[body.operation]; selected.revision++;
        if(body.operation==='start_payment') {selected.claimedBy=actor.id;selected.claimedByName=actor.nombre;}
        if(body.operation==='release_payment') {selected.claimedBy=null;selected.claimedByName=null;}
        if(body.operation==='record_payment') {selected.paymentMethod=body.method;selected.paymentReference=body.reference;selected.paidAt=now;}
        if(body.reason)selected.reason=body.reason;
      }
      result={request:{...selected}};state.operations.set(body.idempotencyKey,result);
    }
    if(state.delay) await new Promise(resolve=>{state.release=resolve;});
    if(state.failOnce) {state.failOnce=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({data:null,error:{code:state.failCode||'SERVICE_UNAVAILABLE',status:503,message:'No confirmado.'}}));return;}
    data=state.incomplete?{request:{id:rowId}}:result;
  }
  if(cash&&body.operation==='summary'&&state.holdSummary) {state.holdSummary=false;await new Promise(resolve=>{state.summaryRelease=resolve;});}
  if(cash&&body.operation==='summary'&&body.beneficiaryId&&state.holdTargetSummary) {state.holdTargetSummary=false;await new Promise(resolve=>{state.targetSummaryRelease=resolve;});}
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data,error:null}));
}
before(async()=>{
  server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,origin||'http://127.0.0.1');
    if(['/wallet','/cash'].includes(url.pathname))return respond(req,res,url);
    if(['/js/points-wallet.js','/js/points-cash.js','/css/points-wallet.css','/css/points-cash.css'].includes(url.pathname)) {
      const file=path.join(root,url.pathname);res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});res.end(fs.existsSync(file)?fs.readFileSync(file):'');return;
    }
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cobros de prueba</title><style>body{font-family:Arial,sans-serif;margin:0;padding:12px}nav{display:flex;gap:8px;flex-wrap:wrap}h1,h2,h3,h4{font:inherit}</style><link rel="stylesheet" href="/css/points-wallet.css"><link rel="stylesheet" href="/css/points-cash.css"><nav><button id="btn-dash-resumen">Inicio</button></nav><nav id="admin-master-nav"></nav><script defer src="/js/points-cash.js"></script><script defer src="/js/points-wallet.js"></script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(t,profile=owner,width=390,options={}) {
  const id=String(++serial),state={calls:[],rows:[],enabled:true,operations:new Map(),...options};states.set(id,state);
  const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage();page.setDefaultTimeout(4000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{assert.ok(route.request().url().startsWith(origin+'/'),'local network only');return route.continue();});
  await page.addInitScript(({profile,id})=>{
    if(!localStorage.getItem('pth_session')) {
      localStorage.setItem('pth_session',JSON.stringify({isAdmin:true,data:profile}));localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));
    }
    const send=(url,body)=>fetch(url+'?case='+id,{method:'POST',headers:{'X-Test-Profile':JSON.stringify(JSON.parse(localStorage.getItem('pth_session')).data)},body:JSON.stringify(body)}).then(r=>r.json()).catch(()=>({data:null,error:{code:'NETWORK_ERROR',message:'Sin respuesta.'}}));
    window.PTHSecureData={pointsWallet:body=>send('/wallet',body),pointsCash:body=>send('/cash',body)};
  },{profile,id});
  await page.goto(origin+'/');
  t.after(async()=>{state.release?.();state.summaryRelease?.();state.targetSummaryRelease?.();await context.close();states.delete(id);assert.deepEqual(errors,[]);});
  return {page,state,context};
}
async function openOwn(page) {await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();}
async function openCashAdmin(page) {await page.click('#pth-points-admin-open');await page.getByRole('button',{name:'Solicitudes de cobro',exact:true}).click();await page.locator('.pth-cash-list').waitFor();}
async function selectRow(page) {await page.getByRole('button',{name:'Ver solicitud',exact:true}).first().click();await page.locator('.pth-cash-detail').waitFor();}
async function requestTen(page) {
  await page.getByRole('button',{name:'Solicitar cobro',exact:true}).click();await page.getByLabel('Importe a cobrar (USD)',{exact:true}).fill('10');await page.getByRole('button',{name:'Revisar cobro',exact:true}).click();
}
async function reviewAction(page,action) {await page.getByRole('button',{name:action,exact:true}).click();}
function writes(state,operation) {return state.calls.filter(c=>c.cash&&c.operation===operation);}
async function waitForState(predicate) {const deadline=Date.now()+4000;while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(predicate(),'synthetic server reached the expected checkpoint');}

for(const width of [320,390,1280])test(`31 earned points reserve 30 for 10 USD once, responsive at ${width}px`,async t=>{
  const {page,state}=await fixture(t,owner,width);await openOwn(page);await requestTen(page);
  assert.match(await page.locator('.pth-cash-confirm').innerText(),/10 USD[\s\S]*30 puntos/);
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).dblclick();await page.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();
  assert.equal(writes(state,'request').length,1);assert.equal(writes(state,'request')[0].usd,10);assert.match(writes(state,'request')[0].idempotencyKey,/^[a-f0-9]{64}$/);assert.equal(writes(state,'request')[0].points,undefined);
  await page.waitForFunction(()=>document.querySelector('#pth-points-badge')?.textContent==='1');
  assert.equal(await page.locator('[data-cash-metric="reserved"] strong').innerText(),'30');
  assert.equal(await page.locator('#pth-points-balance').innerText(),'1');
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'31','milestones remain earned-based');
  assert.match(await page.locator('.pth-cash').innerText(),/Administración realiza el pago y lo registra aquí/);
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.PTH_POINTS_SCREENSHOTS) {await page.locator('.pth-cash').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PTH_POINTS_SCREENSHOTS,`cash-own-${width}.png`),fullPage:true});}
  state.rows[0].state='rejected';state.rows[0].reason='Revisión del cobro';state.rows[0].revision++;
  await page.getByRole('button',{name:'Actualizar cobros',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#pth-points-badge')?.textContent==='31');
  assert.equal(await page.locator('.pth-points-celebration').count(),0,'released reserves do not celebrate earned points');
});

test('fractional/oversized USD never creates a request and disabled/absent configuration has no CTA',async t=>{
  const {page,state}=await fixture(t);await openOwn(page);await page.getByRole('button',{name:'Solicitar cobro',exact:true}).click();
  for(const value of ['1.5','11']) {await page.getByLabel('Importe a cobrar (USD)',{exact:true}).fill(value);await page.getByRole('button',{name:'Revisar cobro',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).count(),0);}
  assert.equal(writes(state,'request').length,0);
  state.enabled=false;await page.getByRole('button',{name:'Cerrar puntos'}).click();await openOwn(page);assert.equal(await page.getByRole('button',{name:'Solicitar cobro',exact:true}).count(),0);
  state.absent=true;await page.getByRole('button',{name:'Cerrar puntos'}).click();await openOwn(page);assert.equal(await page.locator('.pth-cash').count(),0);assert.doesNotMatch(await page.locator('#pth-points-dialog').innerText(),/USD/);
});

test('lost response survives close and reload and checks with the same frozen payload/key',async t=>{
  const {page,state}=await fixture(t,owner,390,{failOnce:true});await openOwn(page);await requestTen(page);
  await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();await page.getByText(/No se pudo confirmar el resultado/).waitFor();
  assert.equal(writes(state,'request').length,1);assert.equal(state.rows.length,1);
  await page.getByRole('button',{name:'Cerrar puntos'}).click();await page.reload();await openOwn(page);
  assert.equal(await page.getByRole('button',{name:'Solicitar cobro',exact:true}).count(),0,'uncertain operation blocks a blind new request');
  assert.equal(writes(state,'request').length,1,'reopening never automatically writes');
  await page.getByRole('button',{name:'Comprobar resultado',exact:true}).click();await page.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();
  assert.equal(writes(state,'request').length,2);assert.deepEqual(writes(state,'request')[0],writes(state,'request')[1]);assert.equal(state.rows.length,1);
});

test('admin approval reserves, exclusive payment records full cash with explicit evidence, refund confirms returned money',async t=>{
  const {page,state}=await fixture(t,admin,1280,{rows:[row()]});await openCashAdmin(page);await selectRow(page);
  await reviewAction(page,'Aprobar');await reviewAction(page,'Revisar aprobación');await reviewAction(page,'Confirmar aprobación');await page.getByText('Solicitud aprobada. El dinero todavía no se ha pagado.',{exact:true}).waitFor();
  assert.equal(state.rows[0].state,'approved');assert.equal(writes(state,'record_payment').length,0);
  await reviewAction(page,'Iniciar pago');await reviewAction(page,'Revisar inicio de pago');await reviewAction(page,'Confirmar inicio de pago');await page.getByText('Pago asignado. Comprueba el desembolso antes de registrarlo.',{exact:true}).waitFor();
  assert.equal(state.rows[0].claimedBy,admin.id);
  await reviewAction(page,'Registrar pago');
  await page.getByLabel('Importe pagado (USD)',{exact:true}).fill('9');await page.getByLabel('Referencia o constancia',{exact:true}).fill('REC-2026');await page.getByLabel('Confirmo que el dinero ya se entregó completo',{exact:true}).check();await reviewAction(page,'Revisar pago');
  assert.equal(await page.getByRole('button',{name:'Confirmar pago registrado',exact:true}).count(),0,'partial payment is rejected');
  await page.getByLabel('Importe pagado (USD)',{exact:true}).fill('10');await page.getByLabel('Medio de pago',{exact:true}).selectOption('efectivo');await reviewAction(page,'Revisar pago');await reviewAction(page,'Confirmar pago registrado');await page.getByText('Pago registrado. La web no transfirió dinero.',{exact:true}).waitFor();
  const paid=writes(state,'record_payment')[0];assert.equal(paid.usd,10);assert.equal(paid.method,'efectivo');assert.equal(paid.reference,'REC-2026');assert.equal(paid.confirmPaid,true);
  assert.equal(await page.getByRole('button',{name:'Rechazar',exact:true}).count(),0);
  await reviewAction(page,'Registrar devolución');await page.getByLabel('Importe devuelto (USD)',{exact:true}).fill('10');await page.getByLabel('Motivo',{exact:true}).fill('Devolución comprobada');await page.getByLabel('Referencia o constancia',{exact:true}).fill('DEV-1');await reviewAction(page,'Revisar devolución');
  assert.equal(await page.getByRole('button',{name:'Confirmar devolución registrada',exact:true}).count(),0);
  await page.getByLabel('Confirmo que el dinero se devolvió completo',{exact:true}).check();await reviewAction(page,'Revisar devolución');await reviewAction(page,'Confirmar devolución registrada');await page.getByText('Devolución registrada y puntos reintegrados.',{exact:true}).waitFor();assert.equal(writes(state,'refund')[0].confirmReturned,true);
});

test('payment claims belonging to another admin cannot be paid and explicit nonpayment releases safely',async t=>{
  const {page,state}=await fixture(t,admin,390,{rows:[row({state:'in_payment',revision:3,claimedBy:other.id,claimedByName:other.nombre})]});await openCashAdmin(page);await selectRow(page);
  assert.equal(await page.getByRole('button',{name:'Registrar pago',exact:true}).count(),0);
  assert.match(await page.locator('.pth-cash-detail').innerText(),/Otra cuenta/);
  await reviewAction(page,'Resolver sin pago');await page.getByLabel('Motivo',{exact:true}).fill('Desembolso comprobado como no realizado');await page.getByLabel('Referencia o constancia',{exact:true}).fill('INC-1');await reviewAction(page,'Revisar liberación');
  assert.equal(await page.getByRole('button',{name:'Confirmar liberación',exact:true}).count(),0);
  await page.getByLabel('Confirmo que no se entregó dinero',{exact:true}).check();await reviewAction(page,'Revisar liberación');await reviewAction(page,'Confirmar liberación');await page.getByText('Asignación liberada tras comprobar que no hubo pago.',{exact:true}).waitFor();assert.equal(writes(state,'release_payment')[0].confirmNotPaid,true);
});

test('admin filters/search/pages globally and renders hostile audit text as plain text',async t=>{
  const {page,state}=await fixture(t,admin,320,{rows:[row(),row({id:'55555555-5555-4555-8555-555555555555',beneficiaryId:other.id,beneficiaryName:other.nombre,state:'approved'})]});await openCashAdmin(page);
  await page.getByRole('button',{name:'Ver más solicitudes',exact:true}).click();await page.getByText(other.nombre,{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Ver solicitud',exact:true}).count(),2);
  await page.getByLabel('Estado del cobro',{exact:true}).selectOption('approved');await page.getByLabel('Buscar solicitudes',{exact:true}).fill(other.nombre);await reviewAction(page,'Buscar cobros');
  await page.getByText(other.nombre,{exact:true}).first().waitFor();const call=state.calls.filter(c=>c.cash&&c.operation==='list').at(-1);assert.equal(call.state,'approved');assert.equal(call.search,other.nombre);assert.equal(call.beneficiaryId,undefined);
  await selectRow(page);assert.equal(await page.locator('.pth-cash-detail img,.pth-cash-detail script').count(),0);assert.match(await page.locator('.pth-cash-audit').innerText(),/<script>/);
  await reviewAction(page,'Ver más eventos');await page.getByText('Anterior',{exact:true}).waitFor();assert.equal(state.calls.filter(c=>c.cash&&c.operation==='detail').at(-1).offset,1);
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.keyboard.press('Tab');await page.getByRole('button',{name:'Cerrar puntos'}).focus();assert.notEqual(await page.getByRole('button',{name:'Cerrar puntos'}).evaluate(e=>getComputedStyle(e).outlineStyle),'none');
});

test('offline writes are disabled and cross-account late mutation cannot leak or confirm private data',async t=>{
  const {page,state,context}=await fixture(t);await openOwn(page);await requestTen(page);await context.setOffline(true);await page.getByText(/Sin conexión/).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).isDisabled(),true);assert.equal(writes(state,'request').length,0);
  await context.setOffline(false);await page.getByText(/Conexión recuperada/).first().waitFor();state.delay=true;await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).click();
  await waitForState(()=>state.release);
  await page.evaluate(profile=>{localStorage.setItem('pth_session',JSON.stringify({data:profile}));localStorage.setItem('pth_secure_token','b'.repeat(64));dispatchEvent(new Event('pth:session-changed'));},other);
  state.delay=false;state.release();await page.waitForTimeout(80);
  assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open),false);
  assert.equal(await page.locator('.pth-cash').count(),0);assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('pth_cash')).length),0);
});

test('incomplete mutation responses never confirm payment and subaccounts cannot gain admin tools',async t=>{
  const {page,state}=await fixture(t,admin,390,{rows:[row({state:'in_payment',revision:3,claimedBy:admin.id,claimedByName:admin.nombre})],incomplete:true});await openCashAdmin(page);await selectRow(page);await reviewAction(page,'Registrar pago');
  await page.getByLabel('Importe pagado (USD)',{exact:true}).fill('10');await page.getByLabel('Referencia o constancia',{exact:true}).fill('REC-1');await page.getByLabel('Confirmo que el dinero ya se entregó completo',{exact:true}).check();await reviewAction(page,'Revisar pago');await reviewAction(page,'Confirmar pago registrado');await page.getByText(/No se pudo confirmar el resultado/).waitFor();
  assert.equal(await page.getByText('Pago registrado. La web no transfirió dinero.',{exact:true}).count(),0);
  assert.equal(writes(state,'record_payment').length,1);
  state.incomplete=false;await page.getByRole('button',{name:'Cerrar puntos'}).click();await page.reload();await openCashAdmin(page);
  assert.equal(writes(state,'record_payment').length,1,'reopening never repeats an uncertain payment automatically');
  await reviewAction(page,'Comprobar resultado');await page.getByText('Pago registrado. La web no transfirió dinero.',{exact:true}).waitFor();
  assert.deepEqual(writes(state,'record_payment')[0],writes(state,'record_payment')[1]);
  await page.evaluate(profile=>{localStorage.setItem('pth_session',JSON.stringify({isAdmin:true,data:profile}));dispatchEvent(new Event('pth:session-changed'));},{...other,rol:'admin',parent_id:owner.id});
  assert.equal(await page.locator('#pth-points-admin-open').count(),0);
});

test('available balance below 3 keeps the request CTA disabled after connection updates',async t=>{
  const {page,context}=await fixture(t,owner,390,{rows:[row()]});await openOwn(page);await page.getByRole('button',{name:'Solicitar cobro',exact:true}).waitFor();
  await context.setOffline(true);await page.getByText(/Sin conexión/).first().waitFor();await context.setOffline(false);await page.getByText(/Conexión recuperada/).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Solicitar cobro',exact:true}).isDisabled(),true,'connection events cannot turn insufficient points into a usable request');
});

test('review freezes amount until explicitly editing and labels badge as available',async t=>{
  const {page}=await fixture(t);await openOwn(page);await requestTen(page);
  assert.equal(await page.getByLabel('Importe a cobrar (USD)',{exact:true}).isDisabled(),true);
  assert.match(await page.locator('#pth-points-open').getAttribute('aria-label'),/disponibles/);
  await reviewAction(page,'Volver a editar');assert.equal(await page.getByLabel('Importe a cobrar (USD)',{exact:true}).isDisabled(),false);
});

test('reload with another identity erases old pending private data even when cash is unavailable',async t=>{
  const {page,state}=await fixture(t,owner,390,{failOnce:true});await openOwn(page);await requestTen(page);await reviewAction(page,'Confirmar solicitud');await page.getByText(/No se pudo confirmar el resultado/).waitFor();
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('pth_cash')).length),1);
  state.absent=true;
  await page.evaluate(profile=>{localStorage.setItem('pth_session',JSON.stringify({data:profile}));localStorage.setItem('pth_secure_token','b'.repeat(64));},other);
  await page.reload();await openOwn(page);
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('pth_cash')).length),0);
});

test('owner cancellation and admin rejection require reasons and release reserves, with no payment',async t=>{
  const {page,state}=await fixture(t,owner,390,{rows:[row()]});await openOwn(page);await selectRow(page);await reviewAction(page,'Cancelar solicitud');await reviewAction(page,'Revisar cancelación');
  assert.equal(await page.getByRole('button',{name:'Confirmar cancelación',exact:true}).count(),0);
  await page.getByLabel('Motivo',{exact:true}).fill('Ya no necesito cobrar ahora');await reviewAction(page,'Revisar cancelación');await reviewAction(page,'Confirmar cancelación');await page.getByText('Solicitud cancelada y reserva liberada.',{exact:true}).waitFor();assert.equal(writes(state,'cancel')[0].revision,1);
  await page.waitForFunction(()=>document.querySelector('#pth-points-badge').textContent==='31');
  const second=await fixture(t,admin,390,{rows:[row()]});await openCashAdmin(second.page);await selectRow(second.page);await reviewAction(second.page,'Rechazar');await second.page.getByLabel('Motivo',{exact:true}).fill('Solicitud duplicada');await reviewAction(second.page,'Revisar rechazo');await reviewAction(second.page,'Confirmar rechazo');await second.page.getByText('Solicitud rechazada y reserva liberada.',{exact:true}).waitFor();assert.equal(writes(second.state,'reject')[0].reason,'Solicitud duplicada');assert.equal(writes(second.state,'record_payment').length,0);
});

test('foreign ordinary rows are rejected before rendering and missing cash never invokes cash transport',async t=>{
  const {page}=await fixture(t,owner,390,{rows:[row({beneficiaryId:other.id,beneficiaryName:other.nombre})],leakRows:true});await openOwn(page);await page.getByText(/La respuesta no se pudo confirmar/).waitFor();assert.equal(await page.getByText(other.nombre,{exact:true}).count(),0);
  const absent=await fixture(t,admin,390,{absent:true});await absent.page.click('#pth-points-admin-open');await absent.page.getByText('Programa activo para ventas nuevas.',{exact:true}).waitFor();assert.equal(await absent.page.getByRole('button',{name:'Solicitudes de cobro',exact:true}).count(),0);assert.equal(absent.state.calls.filter(c=>c.cash).length,0);
});

test('gateway-specific 503 remains an uncertain operation and keeps its original key',async t=>{
  const {page,state}=await fixture(t,owner,390,{failOnce:true,failCode:'POINTS_CASH_UNAVAILABLE'});await openOwn(page);await requestTen(page);await reviewAction(page,'Confirmar solicitud');await page.getByText(/No se pudo confirmar el resultado/).waitFor();
  assert.equal(await page.getByRole('button',{name:'Solicitar cobro',exact:true}).count(),0);await reviewAction(page,'Comprobar resultado');await page.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();assert.deepEqual(writes(state,'request')[0],writes(state,'request')[1]);
});

test('disabling new requests blocks an already reviewed but unsent request without losing its amount',async t=>{
  const {page,state}=await fixture(t);await openOwn(page);await requestTen(page);state.enabled=false;await reviewAction(page,'Actualizar cobros');
  await page.getByText('Los nuevos cobros están desactivados. El historial y las obligaciones se conservan.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Importe a cobrar (USD)',{exact:true}).inputValue(),'10');assert.equal(await page.getByRole('button',{name:'Confirmar solicitud',exact:true}).isDisabled(),true);assert.equal(writes(state,'request').length,0);
});

test('a delayed old cash summary cannot replace the latest reservation',async t=>{
  const {page,state}=await fixture(t);await openOwn(page);await page.getByRole('button',{name:'Solicitar cobro',exact:true}).waitFor();state.holdSummary=true;await reviewAction(page,'Actualizar cobros');
  await waitForState(()=>state.summaryRelease);
  await requestTen(page);await reviewAction(page,'Confirmar solicitud');await page.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-cash-metric="reserved"] strong').textContent==='30');state.summaryRelease();
  await page.waitForTimeout(80);assert.equal(await page.locator('[data-cash-metric="reserved"] strong').innerText(),'30');
});

test('recording a normal request never falsely claims that the connection recovered',async t=>{
  const {page}=await fixture(t);await openOwn(page);await requestTen(page);await reviewAction(page,'Confirmar solicitud');await page.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();
  assert.doesNotMatch(await page.locator('.pth-cash').innerText(),/Conexión recuperada/);
});

test('automatic backing reversals show system authorship and their audited revision',async t=>{
  const {page}=await fixture(t,owner,390,{rows:[row({state:'cancelled',revision:2})],systemEvent:true});await openOwn(page);await selectRow(page);
  assert.match(await page.locator('.pth-cash-audit').innerText(),/Ajuste automático de puntos/);assert.match(await page.locator('.pth-cash-audit').innerText(),/Revisión 2/);assert.doesNotMatch(await page.locator('.pth-cash-audit').innerText(),/Administración/);
});

test('approved requests offer cancellation but never rejection',async t=>{
  const {page}=await fixture(t,admin,390,{rows:[row({state:'approved',revision:2})]});await openCashAdmin(page);await selectRow(page);
  assert.equal(await page.getByRole('button',{name:'Rechazar',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Cancelar solicitud',exact:true}).count(),1);
});

test('cash and wallet refresh gestures serialize shared-account summary and list reads',async t=>{
  const {page,state}=await fixture(t,owner,390,{rows:[row()]});await openOwn(page);await page.locator('.pth-cash-row [data-state="requested"]').waitFor();await page.locator('[data-cash-metric="reserved"] strong').waitFor();
  state.failConcurrentRead=true;state.rows[0].state='rejected';state.rows[0].revision++;
  await reviewAction(page,'Actualizar cobros');await page.locator('.pth-cash-row [data-state="rejected"]').waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Actualizar cobros')?.disabled===false);
  assert.equal(state.readOverlaps||0,0,'cash summary/list and onChanged wallet summary share the account lock');
  state.rows[0].state='requested';state.rows[0].revision++;
  await reviewAction(page,'Actualizar puntos');await page.locator('.pth-cash-row [data-state="requested"]').waitFor();
  assert.equal(state.readOverlaps||0,0,'wallet refresh finishes before cash refresh starts');
});

test('admin detail warns about the selected beneficiary deficit without blocking real payment evidence',async t=>{
  const {page,state}=await fixture(t,admin,390,{rows:[row({state:'in_payment',revision:3,claimedBy:admin.id,claimedByName:admin.nombre})],earnedById:{[owner.id]:25}});await openCashAdmin(page);await selectRow(page);
  const warning=page.getByText('Esta cuenta tiene un ajuste pendiente de 5 puntos. Comprueba si el dinero ya se pagó antes de continuar. La reserva no se libera automáticamente.',{exact:true});await warning.waitFor();
  assert.equal(await warning.getAttribute('role'),'status');assert.equal(await page.getByRole('button',{name:'Registrar pago',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'Resolver sin pago',exact:true}).isEnabled(),true);
  assert.ok(state.calls.some(c=>c.cash&&c.operation==='summary'&&c.beneficiaryId===owner.id));
});

test('unavailable or mismatched beneficiary summary preserves paid detail, audit and safe resolution actions',async t=>{
  for(const options of [{failTargetSummary:true},{wrongTargetSummary:true}]) {
    const {page}=await fixture(t,admin,390,{rows:[row({state:'paid',revision:4,claimedBy:admin.id,claimedByName:admin.nombre,paymentMethod:'efectivo',paymentReference:'REC-1',paidAt:now})],...options});await openCashAdmin(page);await selectRow(page);
    await page.getByText('No se pudo verificar el respaldo. Comprueba el estado del pago antes de continuar.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Registrar devolución',exact:true}).isEnabled(),true);assert.ok(await page.locator('.pth-cash-audit li').count());assert.match(await page.locator('.pth-cash-detail').innerText(),/REC-1/);
  }
});

test('late beneficiary warning cannot overwrite another selected request or revive a changed account',async t=>{
  const {page,state}=await fixture(t,admin,390,{rows:[row({state:'in_payment',revision:3,claimedBy:admin.id,claimedByName:admin.nombre}),row({id:'55555555-5555-4555-8555-555555555555',beneficiaryId:other.id,beneficiaryName:other.nombre})],earnedById:{[owner.id]:25}});await openCashAdmin(page);state.holdTargetSummary=true;await selectRow(page);await waitForState(()=>state.targetSummaryRelease);
  await reviewAction(page,'Ver más solicitudes');await page.getByText(other.nombre,{exact:true}).waitFor();await page.getByRole('button',{name:'Ver solicitud',exact:true}).last().click();await page.locator('.pth-cash-detail').getByRole('heading',{name:other.nombre,exact:true}).waitFor();state.targetSummaryRelease();await page.waitForTimeout(80);
  assert.equal(await page.getByText(/Esta cuenta tiene un ajuste pendiente/).count(),0);assert.equal(await page.locator('.pth-cash-detail').getByRole('heading',{name:other.nombre,exact:true}).count(),1);
  state.holdTargetSummary=true;state.targetSummaryRelease=null;await page.getByRole('button',{name:'Ver solicitud',exact:true}).first().click();await waitForState(()=>state.targetSummaryRelease);
  await page.evaluate(profile=>{localStorage.setItem('pth_session',JSON.stringify({data:profile}));localStorage.setItem('pth_secure_token','b'.repeat(64));dispatchEvent(new Event('pth:session-changed'));},other);state.targetSummaryRelease();await page.waitForTimeout(80);
  assert.equal(await page.locator('.pth-cash').count(),0);assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open),false);
});

test('explicit admin refresh updates selected backing warning without losing payment form values',async t=>{
  const {page,state}=await fixture(t,admin,390,{rows:[row({state:'in_payment',revision:3,claimedBy:admin.id,claimedByName:admin.nombre})]});await openCashAdmin(page);await selectRow(page);await page.getByText('Comprobando el respaldo de esta cuenta…',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.locator('.pth-cash-backing-warning').isVisible(),false);await reviewAction(page,'Registrar pago');await page.getByLabel('Referencia o constancia',{exact:true}).fill('Constancia conservada');await page.getByLabel('Medio de pago',{exact:true}).selectOption('transferencia');
  state.earnedById={[owner.id]:25};await reviewAction(page,'Actualizar cobros');await page.getByText('Esta cuenta tiene un ajuste pendiente de 5 puntos. Comprueba si el dinero ya se pagó antes de continuar. La reserva no se libera automáticamente.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Referencia o constancia',{exact:true}).inputValue(),'Constancia conservada');assert.equal(await page.getByLabel('Medio de pago',{exact:true}).inputValue(),'transferencia');assert.equal(await page.getByLabel('Importe pagado (USD)',{exact:true}).inputValue(),'10');
  state.earnedById[owner.id]=31;await reviewAction(page,'Actualizar cobros');await page.locator('.pth-cash-backing-warning').waitFor({state:'hidden'});assert.equal(await page.getByLabel('Referencia o constancia',{exact:true}).inputValue(),'Constancia conservada');
});
