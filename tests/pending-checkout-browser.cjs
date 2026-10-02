// Actual SW, anonymous public reader and checkout; local HTTP and synthetic DB only.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');let f=await fixture();
 const trace=[];let origin,dropSubmitResponse=false;
 const products=Array.from({length:430},(_,i)=>({id:'public-'+i,nombre:'Equipo público '+i,precio:100+i,categoria:i%2?'COCINA':'HOGAR',disponible:'SI',garantia:'1 año',thumbnail:'sample.jpg'}));
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,origin);trace.push({path:url.pathname,method:req.method});
  if(url.pathname==='/mock-secure-data'){
   let body='';for await(const data of req)body+=data;const b=JSON.parse(body);
   trace[trace.length-1].action=b.action;trace[trace.length-1].operation=b.operation;trace[trace.length-1].authorization=Boolean(req.headers.authorization);trace[trace.length-1].cookie=Boolean(req.headers.cookie);
   let result;
   if(b.action==='announcement')result={data:{acknowledged:true},error:null};
   else if(req.headers['x-public-fixture']==='yes')result={data:products,error:null};
   else result=await f.request(b,req.headers.authorization?.replace(/^Bearer /,'')||null);
   if(b.action==='checkout'&&b.operation==='submit'&&dropSubmitResponse){res.destroy();return;}
   const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(result)));res.writeHead(200,{'Content-Type':'application/json','Content-Encoding':'gzip','Cache-Control':'no-store'});res.end(bytes);return;
  }
  if(/^\/img_productos\//.test(url.pathname)){res.writeHead(200,{'Content-Type':'image/png'});res.end(png);return;}
  const rel=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!/^(?:[\w-]+\.html|service-worker\.js|manifest\.webmanifest|log\.jpeg|(?:js|css|icons)\/[\w.-]+\.(?:js|mjs|css|svg|png))$/.test(rel)||!fs.existsSync(path.join(root,rel))){res.writeHead(404);res.end();return;}
  let bytes=fs.readFileSync(path.join(root,rel));
  if(rel==='js/secure-data.js'||rel==='js/public-catalog-api.js')bytes=Buffer.from(bytes.toString().replace('https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data',origin+'/mock-secure-data'));
  const type=/\.html$/.test(rel)?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.png')?'image/png':rel.endsWith('.svg')?'image/svg+xml':'image/jpeg';
  if(/html|javascript|css/.test(type)){bytes=zlib.gzipSync(bytes);res.setHeader('Content-Encoding','gzip');}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(bytes);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'fixture-v1'}:table==='tarifas_mensajeria'?[{municipio:'Centro Habana',localidad:'Centro',precio_pequeno:6,precio_grande:10}]:[];return Promise.resolve({data:single?Array.isArray(data)?data[0]||null:data:data,error:null,count:0}).then(ok,no)}};for(const n of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[n]=()=>q;for(const n of ['single','maybeSingle'])q[n]=()=>{single=true;return q};return q;},rpc(name,p){return Promise.resolve({data:name==='reservar_consecutivo_pedido'?p.p_proveedor+String(++window.fixtureSequence):[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};window.fixtureSequence=0;`;
  async function context(){
    const c=await browser.newContext({viewport:{width:Number(process.env.PTH_PENDING_WIDTH)||390,height:844},colorScheme:process.env.PTH_PENDING_DARK?'dark':'light'}),errors=[];
    c.on('page',p=>p.on('pageerror',e=>errors.push(e.stack||e.message)));
    await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:sdk});if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;width:1em;overflow:hidden}'});if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});return route.fulfill({contentType:'application/json',body:'{"data":[],"error":null}'});});
    await c.addInitScript(profile=>{if(window.top!==window||!/^http:\/\/(127\.0\.0\.1|localhost)/.test(location.href))return;if(!localStorage.getItem('fixture-initialized')){localStorage.setItem('fixture-initialized','true');sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_data_saving_v1','on');localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},f.rows.gestores[0]);
    return {c,errors};
  }
  async function main(c,defaultDashboard=false){const p=await c.newPage();await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);await p.evaluate(dashboard=>{document.getElementById('feedback-announcement')?.remove();if(!dashboard)showSection('catalogo');window.checkoutAlerts=[];window.alert=message=>checkoutAlerts.push(message);window.confirm=()=>true;obtenerDuenoReal=async()=> 'Shared Seller';},defaultDashboard);if(defaultDashboard)await p.locator('#sec-dashboard').waitFor({state:'visible'});return p;}
  async function row(p,account='actor-a'){return p.evaluate(async account=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).read(account),account);}
  async function waitState(p,state){const deadline=Date.now()+45000;while(Date.now()<deadline){const current=await row(p);if(current?.state===state)return;await p.waitForTimeout(200);}const current=await row(p);throw Error('Expected '+state+', got '+current?.state+' code='+current?.code+' message='+current?.message);}
  async function fillCart(p){await p.evaluate(()=>{addProductFromCard('Equipo A');addProductFromCard('Equipo B');toggleCartModal(true);document.getElementById('check-recogida').checked=true;toggleRecogidaEnAlmacen();document.getElementById('check-nombre').value='Synthetic Customer';document.getElementById('check-tel').value='synthetic-phone';document.getElementById('check-notas').value='<script>untrusted submitted text</script>';});}

  // Open app, explicit save during loss of connectivity, reopen the actual cached shell.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await fillCart(p);
    await p.waitForFunction(()=>navigator.serviceWorker.controller);
    await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    let saved=await row(p);const revision=saved.id;assert.equal(saved.form.nombre,'Synthetic Customer');assert.equal(f.writes,0);assert.equal(await p.evaluate(()=>localStorage.getItem('autosave_check-nombre')),null);
    await p.close();p=await c.newPage();await p.goto(origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await p.locator('#pending-summary').waitFor({state:'visible'});assert.ok((await p.locator('#pending-summary-text').innerText()).includes('Synthetic Customer'));assert.equal((await row(p)).id,revision);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const cached=await p.evaluate(async()=>{const cache=await caches.open('pth-public-static-2026-10-02-pending1');return (await cache.keys()).map(r=>new URL(r.url).pathname);});assert.ok(cached.includes('/offline-order.html'));assert.equal(cached.some(path=>path==='/'||path.includes('mock-secure-data')||path.includes('functions/v1')),false);
    // Response loss after acceptance: same pending and receipt on the next open main page.
    f.drop=true;dropSubmitResponse=true;await c.setOffline(false);await p.waitForURL(origin+'/?pending_order=1',{timeout:45000});await waitState(p,'uncertain');assert.equal(f.writes,1);assert.equal((await row(p)).id,revision);assert.equal(c.pages().length,1,'no WhatsApp or download tab');
    f.drop=false;dropSubmitResponse=false;await p.reload({waitUntil:'domcontentloaded'});await waitState(p,'confirmed');assert.equal(f.writes,1);saved=await row(p);assert.equal(saved.form,undefined);assert.equal(saved.lines,undefined);assert.doesNotMatch(JSON.stringify(saved),/Synthetic Customer|synthetic-phone|untrusted/);assert.equal(c.pages().length,1);
    assert.deepEqual(f.rows.pedidos[0],f.historical);assert.deepEqual(errors,[]);await c.close();
  }
  // Prepare a new pending while reopened entirely offline; keyboard and cancellation.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await p.waitForFunction(()=>navigator.serviceWorker.controller);
    await p.evaluate(()=>{const store=PTHLowConnectivity.create(localStorage);store.savePublic(productosRaw.map(p=>({...p,comision:undefined})));});
    await c.setOffline(true);await p.close();p=await c.newPage();await p.goto(origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await p.locator('#pending-form').waitFor({state:'visible'});
    await p.locator('#pending-search').fill('Equipo A');await p.getByLabel('Cantidad de Equipo A').fill('2');await p.locator('#pending-nombre').fill('Offline Synthetic');await p.locator('#pending-tel').fill('5350000000');await p.locator('#pending-pickup').check();await p.locator('#pending-notas').fill('<img src=x onerror=alert(1)>');
    await p.locator('#pending-save').focus();await p.keyboard.press('Enter');await waitState(p,'queued');assert.equal(f.writes,0);assert.equal((await row(p)).lines[0].qty,2);assert.equal(await p.locator('#pending-summary-text img').count(),0);
    await p.getByRole('button',{name:'Cancelar pendiente',exact:true}).click();assert.equal(await row(p),null);await c.setOffline(false);await p.waitForTimeout(600);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Two real browser tabs race the same explicit saved revision, one atomic write.
  {
    f=await fixture();const {c,errors}=await context();const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    await c.setOffline(false);const other=await main(c);await waitState(p,'confirmed');await waitState(other,'confirmed');assert.equal(f.writes,1);assert.equal(c.pages().length,2);assert.deepEqual(errors,[]);await c.close();
  }
  // A different local account cannot view or send another account's pending.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await fillCart(p);await p.waitForFunction(()=>navigator.serviceWorker.controller);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    await p.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));});
    const other=await c.newPage();await other.goto(origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await other.locator('#pending-form').waitFor({state:'visible'});assert.equal(await other.locator('#pending-summary').isVisible(),false);assert.equal(await row(other,'account-b'),null);await c.setOffline(false);await p.waitForTimeout(800);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Storage refusal gives a usable error and cannot manufacture saved status.
  {
    f=await fixture();const {c}=await context();await c.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('synthetic storage denial')}}));const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await p.waitForFunction(()=>document.getElementById('pth-pending-message').textContent.includes('No se pudo guardar'));assert.match(await p.locator('#pth-pending-message').innerText(),/No se pudo guardar/);assert.equal(f.writes,0);await c.close();
  }
  // A delayed local read and a delayed receipt cannot repaint account A after switching to B.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await fillCart(p);await p.waitForFunction(()=>navigator.serviceWorker.controller);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    await c.addInitScript(()=>{
      if(!location.pathname.endsWith('/offline-order.html'))return;
      let value;Object.defineProperty(window,'PTHPendingCheckout',{configurable:true,get:()=>value,set(api){value=api;const indexed=api.indexedStore;api.indexedStore=idb=>{const store=indexed(idb);return {async update(owner,mutate){const result=await store.update(owner,mutate);if(new URLSearchParams(location.search).has('delay_read')&&!window.fixtureReleased)await new Promise(resolve=>{(window.fixtureReadReleases||=[]).push(resolve);window.releasePendingRead=()=>{window.fixtureReleased=true;for(const release of fixtureReadReleases)release();};window.fixturePendingReadHeld=true;});return result;}};};}});
    });
    const delayed=await c.newPage();await delayed.goto(origin+'/offline-order.html?delay_read=1',{waitUntil:'domcontentloaded'});await delayed.waitForFunction(()=>fixturePendingReadHeld===true);
    await delayed.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));window.dispatchEvent(new Event('pth:session-changed'));releasePendingRead();});await delayed.waitForTimeout(400);
    assert.equal(await delayed.locator('#pending-summary').isVisible(),false);assert.equal(await delayed.locator('#pending-summary-text').innerText(),'');assert.doesNotMatch(await delayed.locator('body').innerText(),/Synthetic Customer|synthetic-phone/);assert.equal(f.writes,0);
    // Restore the original local identity only for this synthetic receipt race.
    await delayed.evaluate(profile=>{localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,data:profile}));localStorage.setItem('pth_secure_token','a'.repeat(64));},f.rows.gestores[0]);await delayed.close();
    p=await c.newPage();await p.goto(origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await p.locator('#pending-summary').waitFor({state:'visible'});
    await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),row=await q.read('actor-a');await q.patch('actor-a',row.id,{outcome:{attempt:'synthetic-capability'},state:'uncertain'});PTHSecureData.checkout=async()=>new Promise(resolve=>{window.releaseReceipt=()=>resolve({data:{complete:true,confirmed:[{reference:'A1',proveedor:'A'}]},error:null});});});
    await p.bringToFront();await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.getByRole('button',{name:'Comprobar recepción',exact:true}).click();await p.waitForFunction(()=>typeof releaseReceipt==='function');
    await p.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));window.dispatchEvent(new Event('pth:session-changed'));releaseReceipt();});await p.waitForTimeout(300);assert.equal(await p.locator('#pending-summary-text').innerText(),'');assert.doesNotMatch(await p.locator('body').innerText(),/Synthetic Customer|synthetic-phone|A1/);assert.deepEqual(errors,[]);await c.close();
  }
  // Explicit logout removes all pending customer fields and never sends them as a visitor.
  {
    f=await fixture();const {c,errors}=await context();const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');await p.evaluate(()=>PTHSecureData.clearSession());
    const deadline=Date.now()+5000;while(await row(p)&&Date.now()<deadline)await p.waitForTimeout(100);assert.equal(await row(p),null);await c.setOffline(false);await p.waitForTimeout(300);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Real IndexedDB quota failure keeps the editable data and never claims persistence.
  {
    f=await fixture();const {c,errors}=await context();await c.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value){if(this.name==='orders')throw new DOMException('synthetic quota exceeded','QuotaExceededError');return put.call(this,value);};});const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await p.waitForFunction(()=>document.getElementById('pth-pending-message').textContent.includes('No se pudo guardar'));assert.match(await p.locator('#pth-pending-message').innerText(),/No se pudo guardar/);assert.equal(await row(p),null);assert.equal(await p.locator('#check-nombre').inputValue(),'Synthetic Customer');assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Current server inventory/prices still stop pending delivery for explicit review.
  for(const condition of ['price','stock']){
    f=await fixture();const {c,errors}=await context();const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    if(condition==='price')f.rows.productos[0].precio=150;else f.rows.productos[0].disponible='NO';await c.setOffline(false);await waitState(p,'blocked');assert.equal(f.writes,0);assert.ok((await row(p)).form);assert.deepEqual(errors,[]);await c.close();
  }
  // Review opens without sending; a pre-quote edit stays out of legacy unscoped autosave.
  {
    f=await fixture();const {c,errors}=await context();const p=await main(c,true);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    f.rows.productos[0].precio=150;await c.setOffline(false);await waitState(p,'blocked');assert.equal((await row(p)).outcome,null);assert.equal(await p.locator('#sec-dashboard').isVisible(),true);assert.equal(await p.locator('#pth-pending-order-panel').isVisible(),true);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.locator('#pth-pending-order-panel').getByRole('button',{name:'Revisar pendiente',exact:true}).click();assert.equal(f.writes,0);
    await p.locator('#check-nombre').fill('Edited Synthetic Customer');assert.equal(await p.evaluate(()=>localStorage.getItem('autosave_check-nombre')),null);
    await p.locator('#final-submit-btn').click();await waitState(p,'confirmed');assert.equal(f.writes,1);assert.equal(f.rows.pedidos[1].cliente,'Edited Synthetic Customer');assert.deepEqual(errors,[]);await c.close();
  }
  // A signed pickup can be reviewed and retried despite canonicalized display address.
  {
    f=await fixture();const {c,errors}=await context();const p=await main(c,true);await fillCart(p);await p.evaluate(()=>document.getElementById('check-dir').value='Original unused pickup address');await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    await p.evaluate(()=>{const checkout=PTHSecureData.checkout;window.blockSyntheticSubmit=true;PTHSecureData.checkout=async body=>body.operation==='submit'&&blockSyntheticSubmit?{data:null,error:{code:'CONDITIONS_CHANGED',message:'Synthetic changed conditions'}}:checkout(body);});await c.setOffline(false);await waitState(p,'blocked');const saved=await row(p);assert.ok(saved.outcome?.attempt);assert.equal(saved.form.dir,'Original unused pickup address');assert.equal(f.writes,0);assert.equal(await p.locator('#sec-dashboard').isVisible(),true);assert.equal(await p.locator('#pth-pending-order-panel').isVisible(),true);
    await p.locator('#pth-pending-order-panel').getByRole('button',{name:'Revisar pendiente',exact:true}).click();assert.equal(f.writes,0);assert.equal(await p.locator('#check-nombre').evaluate(el=>el.readOnly),true);assert.equal(await p.locator('#check-dir').inputValue(),'Recogida en Almacén');
    await p.evaluate(()=>window.blockSyntheticSubmit=false);await p.locator('#final-submit-btn').click();await waitState(p,'confirmed');assert.equal(f.writes,1);assert.deepEqual(errors,[]);await c.close();
  }
  // Saving A cannot erase B's identical autosave fields when the account changes during IDB.
  {
    f=await fixture();const {c,errors}=await context();await c.addInitScript(()=>{let value;Object.defineProperty(window,'PTHPendingCheckout',{configurable:true,get:()=>value,set(api){value=api;const create=api.create;api.create=(...args)=>{const q=create(...args),save=q.save.bind(q);q.save=async(...inputs)=>{const saved=await save(...inputs);if(window.holdPendingSave)await new Promise(resolve=>{window.releasePendingSave=resolve;});return saved;};return q;};}});});
    const p=await main(c);await fillCart(p);await c.setOffline(true);await p.evaluate(()=>window.holdPendingSave=true);await p.locator('#pth-queue-order').click();await p.waitForFunction(()=>typeof releasePendingSave==='function');
    await p.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));window.dispatchEvent(new Event('pth:session-changed'));document.getElementById('check-nombre').value='Synthetic Customer';localStorage.setItem('autosave_check-nombre','Synthetic Customer');releasePendingSave();});await p.waitForFunction(()=>!document.getElementById('pth-queue-order').disabled);
    assert.equal(await p.locator('#check-nombre').inputValue(),'Synthetic Customer');assert.equal(await p.evaluate(()=>localStorage.getItem('autosave_check-nombre')),'Synthetic Customer');assert.equal((await row(p)).form.nombre,'Synthetic Customer');assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // A receipt arriving after an account switch cannot clear the new account's cart or form.
  {
    f=await fixture();const {c,errors}=await context();const p=await main(c);await fillCart(p);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');
    await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),saved=await q.read('actor-a');await q.patch('actor-a',saved.id,{outcome:{attempt:'synthetic-capability'},state:'uncertain'});const checkout=PTHSecureData.checkout;PTHSecureData.checkout=async body=>body.operation==='receipt'?new Promise(resolve=>{window.releaseMainReceipt=()=>resolve({data:{complete:true,confirmed:[{reference:'Old-A1',proveedor:'A'}]},error:null});}):checkout(body);});
    await c.setOffline(false);await p.waitForFunction(()=>typeof releaseMainReceipt==='function');
    await p.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));window.dispatchEvent(new Event('pth:session-changed'));cart=[{id:'pB',nombre:'Other cart',qty:2,precio_venta:200}];newCartOwner='account-b';newCartRevision='c'.repeat(64);lowConnectivity.saveDraft('account-b',cart);document.getElementById('check-nombre').value='Account B Customer';releaseMainReceipt();});await waitState(p,'blocked');
    assert.equal(await p.locator('#check-nombre').inputValue(),'Account B Customer');assert.equal(await p.evaluate(()=>cart[0]?.qty),2);assert.ok(await p.evaluate(()=>lowConnectivity.readDraft('account-b')));assert.equal(await p.evaluate(()=>lowConnectivity.wasSent('account-b','c'.repeat(64))),false);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // An old receipt cannot confirm a newer local revision, and private details disappear on account switch.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await fillCart(p);await p.waitForFunction(()=>navigator.serviceWorker.controller);await c.setOffline(true);await p.locator('#pth-queue-order').click();await waitState(p,'queued');await p.close();p=await c.newPage();await p.goto(origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await p.locator('#pending-summary').waitFor({state:'visible'});
    await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),saved=await q.read('actor-a');await q.patch('actor-a',saved.id,{state:'blocked',message:'Synthetic private customer detail',outcome:{attempt:'synthetic-capability'}});PTHSecureData.checkout=async()=>new Promise(resolve=>{window.releaseOldRevisionReceipt=()=>resolve({data:{complete:true,confirmed:[{reference:'Old-A1',proveedor:'A'}]},error:null});});});await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(()=>document.getElementById('pending-detail').textContent==='Synthetic private customer detail');
    await p.getByRole('button',{name:'Comprobar recepción',exact:true}).click();await p.waitForFunction(()=>typeof releaseOldRevisionReceipt==='function');const replacement=await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),old=await q.read('actor-a');await q.confirmed('actor-a',old.id,[{reference:'Old-A1'}]);return q.save('actor-a',{lines:[{id:'pA',qty:2,price:100}],form:{...old.form,nombre:'Replacement Synthetic'}});});await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForFunction(()=>document.getElementById('pending-summary-text').textContent.includes('Replacement Synthetic'));await p.evaluate(()=>releaseOldRevisionReceipt());await p.waitForFunction(()=>document.getElementById('pending-status').textContent.includes('No se pudo completar'));
    const current=await row(p);assert.equal(current.id,replacement.id);assert.equal(current.state,'queued');assert.equal(current.form.nombre,'Replacement Synthetic');assert.equal(f.writes,0);
    await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),current=await q.read('actor-a');await q.patch('actor-a',current.id,{state:'blocked',message:'Synthetic private customer detail'});window.dispatchEvent(new Event('focus'));});await p.waitForFunction(()=>document.getElementById('pending-detail').textContent==='Synthetic private customer detail');
    await p.evaluate(()=>{localStorage.setItem('pth_session',JSON.stringify({name:'Other',data:{id:'account-b',nombre:'Other',rol:'gestor'}}));localStorage.setItem('pth_secure_token','b'.repeat(64));window.dispatchEvent(new Event('pth:session-changed'));});await p.waitForFunction(()=>document.getElementById('pending-detail').textContent==='');assert.doesNotMatch(await p.locator('body').innerText(),/Replacement Synthetic|Synthetic private customer detail/);assert.deepEqual(errors,[]);await c.close();
  }
  console.log('PASS actual generated storefront, explicit pending, cached offline form, reopen, socket loss after acceptance, receipt recovery, one atomic write, cancellation, keyboard, concurrent tabs, account changes during save/read/receipt, old-revision fence, private detail cleanup, editable review, signed pickup retry, IDB quota, no WhatsApp/PDF, historical row preserved');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
