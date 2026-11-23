// Actual UI -> actual cash/wallet gateway modules -> native PostgreSQL -> UI.
// The sole fake boundary is localhost transport identity; no production traffic
// or actual transfer/payment is possible in this synthetic integration fixture.
'use strict';
const {before,after,test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {startPointsPostgres}=require('./helpers/points-postgres.cjs');

const root=path.resolve(__dirname,'..');
const seller={id:'11111111-1111-4111-8111-111111111111',nombre:'Gestora sintética',rol:'gestor',estado:'activo',activo:true,parent_id:null};
const admin={...seller,id:'22222222-2222-4222-8222-222222222222',nombre:'Administración sintética',rol:'admin'};
const actors=new Map([seller,admin].map(actor=>[actor.id,actor]));
const assets=new Set(['/js/points-wallet.js','/js/points-cash.js','/css/points-wallet.css','/css/points-cash.css']);
const rpcSql={pth_points_wallet:'select public.pth_points_wallet($1,$2,$3) result',pth_points_cash:'select public.pth_points_cash($1,$2,$3) result'};
const httpCalls=[],rpcCalls=[],gatewayFailures=[];
let db,browser,server,origin,pointsWallet,pointsCash,adapter;

before(async()=>{
 ({pointsWallet}=await import(pathToFileURL(path.join(root,'supabase/functions/secure-data/points-wallet.mjs')).href));
 ({pointsCash}=await import(pathToFileURL(path.join(root,'supabase/functions/secure-data/points-cash.mjs')).href));
 db=await startPointsPostgres({cashPayouts:true});
 adapter={rpc:async(name,args)=>{
  assert.ok(Object.hasOwn(rpcSql,name),'only the two actual service RPCs are in scope');
  rpcCalls.push({name,args:structuredClone(args)});
  try{return {data:(await db.service(rpcSql[name],[args.p_actor_id,args.p_operation,args.p_body])).rows[0].result,error:null};}
  catch(error){return {data:null,error:{code:error.code,message:error.message}};}
 }};
 for(const actor of actors.values())await db.query('insert into gestores(id,nombre,rol,parent_id) values($1,$2,$3,$4)',[actor.id,actor.nombre,actor.rol,actor.parent_id]);
 await db.query("update pth_points.config set enabled=true,started_at=clock_timestamp()-interval '1 second'; update pth_points.cash_config set enabled=true");
 const granted=await pointsWallet(adapter,{operation:'grant',beneficiaryId:seller.id,points:31,reason:'Reconocimiento exclusivamente sintético',idempotencyKey:randomBytes(32).toString('hex')},admin);
 assert.equal(granted.data.movement.points,31);
 server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,origin||'http://127.0.0.1');
  if(url.pathname==='/wallet'||url.pathname==='/cash'){
   try{
    assert.equal(req.method,'POST');
    const actor=actors.get(req.headers['x-test-actor']);
    assert.ok(actor,'fixture transport must identify a preseeded actor');
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw),cash=url.pathname==='/cash';
    httpCalls.push({actorId:actor.id,cash,body:structuredClone(body)});
    const result=await(cash?pointsCash(adapter,body,actor):pointsWallet(adapter,body,actor,true));
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));
   }catch(error){
    gatewayFailures.push({status:error.status||500,message:error.message,code:error.publicCode});
    res.writeHead(error.status||500,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({data:null,error:{message:error.message,code:error.publicCode||'FIXTURE_FAILURE',status:error.status||500}}));
   }
   return;
  }
  if(assets.has(url.pathname)){
   res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});
   res.end(fs.readFileSync(path.join(root,url.pathname)));return;
  }
  if(!['/seller','/admin','/favicon.ico'].includes(url.pathname)){res.writeHead(404);res.end();return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  res.end('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cobro sintético nativo</title><style>body{font-family:Arial,sans-serif;margin:0;padding:12px}nav{display:flex;gap:8px;flex-wrap:wrap}h1,h2,h3,h4{font:inherit}</style><link rel="stylesheet" href="/css/points-wallet.css"><link rel="stylesheet" href="/css/points-cash.css"><script defer src="/js/points-cash.js"></script><script defer src="/js/points-wallet.js"></script></head><body><nav><button id="btn-dash-resumen">Inicio</button></nav><nav id="admin-master-nav"></nav></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
});

after(async()=>{
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await db?.stop();
});

async function actorPage(t,profile,width){
 const context=await browser.newContext({viewport:{width,height:900}});
 const page=await context.newPage(),errors=[],external=[];
 page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{
  if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort('blockedbyclient');}
  return route.continue();
 });
 await page.addInitScript(profile=>{
  localStorage.setItem('pth_session',JSON.stringify({isAdmin:profile.rol==='admin',data:profile}));
  localStorage.setItem('pth_secure_token',(profile.rol==='admin'?'b':'a').repeat(64));
  localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));
  const send=async(url,body)=>{
   try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Test-Actor':profile.id},body:JSON.stringify(body)});
    const result=await response.json();if(result.error)result.error.status=response.status;return result;
   }catch{return {data:null,error:{code:'NETWORK_ERROR',message:'Sin respuesta de la prueba local.'}};}
  };
  window.PTHSecureData={pointsWallet:body=>send('/wallet',body),pointsCash:body=>send('/cash',body)};
 },profile);
 t.after(async()=>{await context.close();assert.deepEqual(external,[],'no external network may be requested');assert.deepEqual(errors,[],'actual UI must have no uncaught browser errors');});
 await page.goto(origin+(profile.rol==='admin'?'/admin':'/seller'));
 return page;
}

const click=(page,name)=>page.getByRole('button',{name,exact:true}).click();
const cashSummary=async()=>(await pointsCash(adapter,{operation:'summary'},seller)).data;
async function expectMetric(page,name,value){
 await page.waitForFunction(({name,value})=>document.querySelector(`[data-cash-metric="${name}"] strong`)?.textContent===value,{name,value:String(value)});
 assert.equal(await page.locator(`[data-cash-metric="${name}"] strong`).innerText(),String(value));
}
async function earnedLedger(){
 return(await db.query('select count(*)::int movements,coalesce(sum(points),0)::int points from pth_points.movements where beneficiary_id=$1',[seller.id])).rows[0];
}

test('native UI cash lifecycle reserves, approves, records synthetic payment and refunds without changing earnings',async t=>{
 const ownPage=await actorPage(t,seller,390);
 await ownPage.click('#pth-points-open');await ownPage.locator('#pth-points-balance').waitFor();
 await expectMetric(ownPage,'available',31);
 assert.equal(await ownPage.getByRole('progressbar').getAttribute('aria-valuenow'),'31');
 assert.deepEqual(await earnedLedger(),{movements:1,points:31});

 await click(ownPage,'Solicitar cobro');
 await ownPage.getByLabel('Importe a cobrar (USD)',{exact:true}).fill('10');
 await click(ownPage,'Revisar cobro');
 assert.match(await ownPage.locator('.pth-cash-confirm').innerText(),/10 USD[\s\S]*30 puntos/);
 await click(ownPage,'Confirmar solicitud');
 await ownPage.getByText('Solicitud de cobro registrada.',{exact:true}).waitFor();
 await expectMetric(ownPage,'available',1);await expectMetric(ownPage,'reserved',30);
 await ownPage.waitForFunction(()=>document.querySelector('#pth-points-balance')?.textContent==='1'&&document.querySelector('#pth-points-badge')?.textContent==='1');
 const requested=(await db.query('select id,state,usd,points::integer points from pth_points.cash_payouts where beneficiary_id=$1',[seller.id])).rows;
 assert.equal(requested.length,1);assert.deepEqual([requested[0].state,requested[0].usd,requested[0].points],['requested',10,30]);
 const payoutId=requested[0].id;
 assert.deepEqual(await earnedLedger(),{movements:1,points:31});

 const adminPage=await actorPage(t,admin,1280);
 await adminPage.click('#pth-points-admin-open');await click(adminPage,'Solicitudes de cobro');
 await click(adminPage,'Ver solicitud');await adminPage.locator('.pth-cash-detail').waitFor();
 assert.match(await adminPage.locator('.pth-cash-detail').innerText(),/Gestora sintética[\s\S]*10 USD · 30 puntos/);
 for(const name of ['Aprobar','Revisar aprobación','Confirmar aprobación'])await click(adminPage,name);
 await adminPage.getByText('Solicitud aprobada. El dinero todavía no se ha pagado.',{exact:true}).waitFor();
 assert.deepEqual([(await cashSummary()).reserved,(await cashSummary()).paidUsd],[30,0]);
 for(const name of ['Iniciar pago','Revisar inicio de pago','Confirmar inicio de pago'])await click(adminPage,name);
 await adminPage.getByText('Pago asignado. Comprueba el desembolso antes de registrarlo.',{exact:true}).waitFor();
 const claimed=(await db.query('select state,claimed_by from pth_points.cash_payouts where id=$1',[payoutId])).rows[0];
 assert.deepEqual(claimed,{state:'in_payment',claimed_by:admin.id});

 await click(adminPage,'Registrar pago');
 await adminPage.getByLabel('Importe pagado (USD)',{exact:true}).fill('10');
 await adminPage.getByLabel('Medio de pago',{exact:true}).selectOption('efectivo');
 await adminPage.getByLabel('Referencia o constancia',{exact:true}).fill('PAGO-SINTETICO-SIN-DINERO-REAL');
 await adminPage.getByLabel('Confirmo que el dinero ya se entregó completo',{exact:true}).check();
 await click(adminPage,'Revisar pago');await click(adminPage,'Confirmar pago registrado');
 await adminPage.getByText('Pago registrado. La web no transfirió dinero.',{exact:true}).waitFor();
 assert.deepEqual([(await cashSummary()).available,(await cashSummary()).reserved,(await cashSummary()).redeemedPoints,(await cashSummary()).paidUsd],[1,0,30,10]);
 assert.deepEqual((await db.query("select kind,usd,points::integer points,reference from pth_points.cash_entries where payout_id=$1 and kind='payment'",[payoutId])).rows,[{kind:'payment',usd:10,points:30,reference:'PAGO-SINTETICO-SIN-DINERO-REAL'}]);

 await click(ownPage,'Actualizar cobros');
 await ownPage.locator('.pth-cash-row [data-state="paid"]').waitFor();
 assert.equal(await ownPage.locator('.pth-cash-row .pth-cash-amount').innerText(),'10 USD');
 await expectMetric(ownPage,'available',1);await expectMetric(ownPage,'reserved',0);await expectMetric(ownPage,'redeemed',30);
 await click(ownPage,'Ver solicitud');
 await ownPage.getByText(/Pago registrado: efectivo · PAGO-SINTETICO-SIN-DINERO-REAL/).waitFor();
 assert.equal(await ownPage.getByRole('progressbar').getAttribute('aria-valuenow'),'31');
 assert.deepEqual(await earnedLedger(),{movements:1,points:31});

 await click(adminPage,'Registrar devolución');
 await adminPage.getByLabel('Importe devuelto (USD)',{exact:true}).fill('10');
 await adminPage.getByLabel('Motivo',{exact:true}).fill('Corrección sintética con devolución completa');
 await adminPage.getByLabel('Referencia o constancia',{exact:true}).fill('DEVOLUCION-SINTETICA-SIN-DINERO-REAL');
 await adminPage.getByLabel('Confirmo que el dinero se devolvió completo',{exact:true}).check();
 await click(adminPage,'Revisar devolución');await click(adminPage,'Confirmar devolución registrada');
 await adminPage.getByText('Devolución registrada y puntos reintegrados.',{exact:true}).waitFor();
 await click(ownPage,'Actualizar cobros');await ownPage.locator('.pth-cash-row [data-state="refunded"]').waitFor();
 await expectMetric(ownPage,'available',31);await expectMetric(ownPage,'reserved',0);await expectMetric(ownPage,'redeemed',0);
 await ownPage.waitForFunction(()=>document.querySelector('#pth-points-balance')?.textContent==='31'&&document.querySelector('#pth-points-badge')?.textContent==='31');
 assert.equal(await ownPage.locator('.pth-points-celebration').count(),0,'returned cash releases availability, never invents new earnings');
 assert.equal(await ownPage.getByRole('progressbar').getAttribute('aria-valuenow'),'31');
 assert.deepEqual(await earnedLedger(),{movements:1,points:31});
 assert.deepEqual([(await cashSummary()).available,(await cashSummary()).paidUsd],[31,0]);
 assert.deepEqual((await db.query('select kind,usd,points::integer points from pth_points.cash_entries where payout_id=$1 order by points desc',[payoutId])).rows,[{kind:'payment',usd:10,points:30},{kind:'refund',usd:-10,points:-30}]);
 assert.deepEqual((await db.query('select operation from pth_points.cash_events where payout_id=$1 order by revision',[payoutId])).rows.map(row=>row.operation),['request','approve','start_payment','record_payment','refund']);
 assert.deepEqual(httpCalls.filter(call=>call.cash&&!['summary','list','detail'].includes(call.body.operation)).map(call=>[call.actorId,call.body.operation]),[[seller.id,'request'],[admin.id,'approve'],[admin.id,'start_payment'],[admin.id,'record_payment'],[admin.id,'refund']]);
 assert.ok(rpcCalls.some(call=>call.name==='pth_points_wallet'&&call.args.p_actor_id===seller.id&&call.args.p_operation==='summary'));
 assert.ok(rpcCalls.some(call=>call.name==='pth_points_cash'&&call.args.p_actor_id===admin.id&&call.args.p_operation==='record_payment'));
 assert.deepEqual(gatewayFailures,[],'real module/SQL DTOs must agree without swallowed failures');
});
