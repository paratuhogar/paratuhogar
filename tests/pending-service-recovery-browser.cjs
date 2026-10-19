// Real shipped page, worker, IndexedDB, session client and queue scheduler.
// All requests are loopback-only; all accounts and orders are synthetic.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {startFixture}=require('./fixtures/offline-normal-http.cjs');
const executablePath=process.env.PTH_CHROMIUM||'/usr/bin/chromium';
(async()=>{
 const fixture=await startFixture();let browser;
 try {
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  let unavailable=false;
  const from=fixture.f.db.from;
  fixture.f.db.from=table=>{
   const query=from(table),then=query.then;
   if(table==='pth_secure_sessions')query.then=function(resolve,reject){
    return unavailable?Promise.resolve({data:null,error:{code:'SYNTHETIC_SERVICE_FAILURE'}}).then(resolve,reject):then.call(this,resolve,reject);
   };
   return query;
  };
  async function context(){
   const c=await browser.newContext({serviceWorkers:'allow',viewport:{width:390,height:844}});
   await c.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());
   await c.addInitScript(({actor,token,until})=>{
    if(location.hostname!=='127.0.0.1'||localStorage.getItem('fixture_initialized'))return;
    localStorage.setItem('fixture_initialized','1');
    sessionStorage.setItem('pth_intro_vista','true');sessionStorage.setItem('pth_entry_logged','true');
    for(const key of ['info_precios_v1','sl_tutorial_completed_v1','pth_subgestor_onboarding_v1'])localStorage.setItem(key,'true');
    localStorage.setItem('pth_secure_token',token);localStorage.setItem('pth_secure_token_expires_at',String(until));
    localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:{...actor,password:'__session__'}}));
   },{actor:fixture.actors.a,token:fixture.tokens.a,until:fixture.until});
   c.on('page',p=>p.on('dialog',d=>d.dismiss()));return c;
  }
  const c=await context();let page=await c.newPage();
  await page.goto(fixture.origin);
  await page.waitForFunction(()=>window.PTHPendingCheckoutUI&&typeof productosRaw!=='undefined'&&productosRaw.length===2);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const original=await page.evaluate(async()=>{
   const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));
   return q.save(PTHSecureData.accountId(),{lines:[{id:'pA',qty:1,price:100}],estimate:{equipment:100,shipping:6,total:106},form:{nombre:'Synthetic recovery',tel:'5351111111',ci:'11111111111',dir:'Synthetic fixture only',municipio:'Centro Habana',localidad:'Centro',moneda:'USD (Efectivo)'}});
  });
  unavailable=true;
  await page.evaluate(()=>PTHPendingCheckoutUI.catalogReady());
  const pending=await page.evaluate(async id=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).read(PTHSecureData.accountId(),id),original.id);
  assert.equal(pending.state,'queued');assert.equal(pending.code,'SERVICE_UNAVAILABLE');
  assert.deepEqual(pending.form,original.form);assert.equal(pending.intentId,original.intentId);assert.equal(fixture.f.writes,0);
  assert.equal(await page.evaluate(()=>Boolean(PTHSecureData.token())),true);
  await page.close();page=await c.newPage();
  // Read persisted queue before opening the application, without allowing send.
  await page.goto(fixture.origin+'/__storage');
  const persisted=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const r=indexedDB.open('pth_pending_checkout_v2',1);r.onerror=reject;r.onsuccess=()=>{const tx=r.result.transaction('queues'),q=tx.objectStore('queues').get('actor-a');q.onsuccess=()=>resolve(q.result.orders[0]);};
  }));
  assert.equal(persisted.id,original.id);assert.equal(persisted.intentId,original.intentId);assert.deepEqual(persisted.form,original.form);
  unavailable=false;
  await page.goto(fixture.origin);
  await page.waitForFunction(()=>window.PTHPendingCheckoutUI&&typeof productosRaw!=='undefined'&&productosRaw.length===2);
  await page.evaluate(()=>PTHPendingCheckoutUI.catalogReady());
  const deadline=Date.now()+20000;
  let confirmed;
  do {
   confirmed=await page.evaluate(async id=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).read('actor-a',id),original.id);
   if(confirmed?.state==='confirmed')break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }while(Date.now()<deadline);
  assert.equal(confirmed?.state,'confirmed');
  assert.equal(fixture.f.writes,1);console.log('PASS pending recovery and persistence');
  await page.reload();await page.waitForFunction(()=>Boolean(window.PTHPendingCheckoutUI));
  await page.evaluate(()=>PTHPendingCheckoutUI.catalogReady());assert.equal(fixture.f.writes,1);
  assert.equal(c.pages().length,1);await c.close();
  // A real handler 401 must still invalidate the browser credential, not retry as a verified user.
  const denied=await context(),p=await denied.newPage();await p.goto(fixture.origin);
  await p.waitForFunction(()=>window.PTHSecureData&&window.PTHPendingCheckoutUI&&PTHSecureData.accountId());
  fixture.f.rows.pth_secure_sessions=[];
  const invalid=await fixture.f.request({action:'session'},fixture.tokens.a);
  assert.equal(fixture.f.lastStatus,401);assert.equal(invalid.error.code,'SESSION_INVALID');
  console.log('Checking genuine 401');
  const rejection=await p.evaluate(async()=>{try{await PTHSecureData.refresh();return null;}catch(e){return {status:e.status,code:e.code,tokenPresent:Boolean(PTHSecureData.token())};}});
  // A concurrent real page request can receive the 401 first and clear it.
  if(rejection){assert.equal(rejection.status,401);assert.equal(rejection.code,'SESSION_INVALID');}
  assert.equal(await p.evaluate(()=>Boolean(PTHSecureData.token())),false);
  await p.evaluate(()=>PTHPendingCheckoutUI.catalogReady());assert.equal(fixture.f.writes,1);
  await denied.close();
  console.log('PASS shipped worker/scheduler: 503 retains pending; IndexedDB survives tab close; recovery writes once; reload does not duplicate; actual handler 401 clears credential and causes no order write.');
 }finally{await browser?.close();await fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
