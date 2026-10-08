// Actual normal checkout form; local HTTP and synthetic DB only.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');let f=await fixture();
 const trace=[];let origin,dropSubmitResponse=false,dropSubmitIntent=null;
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
   if(b.action==='checkout'&&b.operation==='submit'&&dropSubmitResponse){if(dropSubmitIntent===null)dropSubmitIntent=b.intentId;if(b.intentId===dropSubmitIntent){res.destroy();return;}}
   const bytes=zlib.gzipSync(Buffer.from(JSON.stringify(result)));res.writeHead(200,{'Content-Type':'application/json','Content-Encoding':'gzip','Cache-Control':'no-store'});res.end(bytes);return;
  }
  if(/^\/img_productos\//.test(url.pathname)){res.writeHead(200,{'Content-Type':'image/png'});res.end(png);return;}
  let rel=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(rel==='js/storefront.min.js')rel='js/storefront.js';
  if(!/^(?:[\w-]+\.html|service-worker\.js|manifest\.webmanifest|log\.jpeg|(?:js|css|icons)\/[\w.-]+\.(?:js|mjs|css|svg|png))$/.test(rel)||!fs.existsSync(path.join(root,rel))){res.writeHead(404);res.end();return;}
  let bytes=fs.readFileSync(path.join(root,rel));
  if(rel==='index.html'&&!bytes.toString().includes('js/checkout-form-shared.js'))bytes=Buffer.from(bytes.toString().replace('<script src="js/storefront.min.js', '<script src="js/checkout-form-shared.js" defer></script><script src="js/offline-checkout-copy.js" defer></script><script src="js/storefront.min.js'));
  if(rel==='js/secure-data.js'||rel==='js/public-catalog-api.js')bytes=Buffer.from(bytes.toString().replace('https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data',origin+'/mock-secure-data'));
  const type=/\.html$/.test(rel)?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.png')?'image/png':rel.endsWith('.svg')?'image/svg+xml':'image/jpeg';
  if(/html|javascript|css/.test(type)){bytes=zlib.gzipSync(bytes);res.setHeader('Content-Encoding','gzip');}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(bytes);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({...(process.env.PTH_CHROMIUM_PATH?{executablePath:process.env.PTH_CHROMIUM_PATH}:process.platform==='linux'?{executablePath:'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox']}).catch(async error=>{await new Promise(resolve=>server.close(resolve));throw error;});
 try{
  const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'fixture-v1'}:table==='tarifas_mensajeria'?[{municipio:'Centro Habana',localidad:'Centro',precio_pequeno:6,precio_grande:10}]:[];return Promise.resolve({data:single?Array.isArray(data)?data[0]||null:data:data,error:null,count:0}).then(ok,no)}};for(const n of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[n]=()=>q;for(const n of ['single','maybeSingle'])q[n]=()=>{single=true;return q};return q;},rpc(name,p){return Promise.resolve({data:name==='reservar_consecutivo_pedido'?p.p_proveedor+String(++window.fixtureSequence):[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};window.fixtureSequence=0;`;
  async function context(){
    const c=await browser.newContext({viewport:{width:Number(process.env.PTH_PENDING_WIDTH)||390,height:844},colorScheme:process.env.PTH_PENDING_DARK?'dark':'light'}),errors=[];
    c.on('page',p=>p.on('pageerror',e=>errors.push(e.stack||e.message)));
    await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.includes('/js/vendor/supabase-'))return route.fulfill({contentType:'application/javascript',body:sdk});if(url.origin===origin)return route.continue();if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:sdk});if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;width:1em;overflow:hidden}'});if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});return route.fulfill({contentType:'application/json',body:'{"data":[],"error":null}'});});
    await c.addInitScript(profile=>{if(window.top!==window||!/^http:\/\/(127\.0\.0\.1|localhost)/.test(location.href))return;if(!localStorage.getItem('fixture-initialized')){localStorage.setItem('fixture-initialized','true');sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_data_saving_v1','on');localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},f.rows.gestores[0]);
    return {c,errors};
  }
  async function main(c,defaultDashboard=false){const p=await c.newPage();await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);await p.evaluate(dashboard=>{document.getElementById('feedback-announcement')?.remove();if(!dashboard)showSection('catalogo');window.checkoutAlerts=[];window.alert=message=>checkoutAlerts.push(message);window.confirm=()=>true;obtenerDuenoReal=async()=> 'Shared Seller';},defaultDashboard);if(defaultDashboard)await p.locator('#sec-dashboard').waitFor({state:'visible'});
    // Losing connectivity before startup preparation finishes intentionally
    // cannot queue; these scenarios require a genuinely persisted local copy.
    await p.waitForFunction(()=>Boolean(PTHSecureData.offlineProfile()&&window.PTHOfflineCheckoutCopy));
    assert.ok(await p.evaluate(async()=>PTHOfflineCheckoutCopy.create(indexedDB).read('actor-a',{profile:PTHSecureData.offlineProfile()})),'copy is actually persisted before simulated outage');
    return p;}
  async function list(p,account='actor-a'){return p.evaluate(async account=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list(account),account);}
  async function waitForRows(p,predicate,label){const deadline=Date.now()+45000;while(Date.now()<deadline){const rows=await list(p);if(predicate(rows))return rows;await p.waitForTimeout(100);}throw Error(label+': '+JSON.stringify(await list(p)));}
  async function fill(p,{product='Equipo A',name='Synthetic Customer',pickup=true}={}){await p.evaluate(({product,name,pickup})=>{addProductFromCard(product);toggleCartModal(true);document.getElementById('check-recogida').checked=pickup;toggleRecogidaEnAlmacen();if(!pickup){document.getElementById('check-municipio').value='Centro Habana';actualizarLocalidades();document.getElementById('check-localidad').value='Centro';document.getElementById('check-dir').value='Synthetic address';}document.getElementById('check-nombre').value=name;document.getElementById('check-tel').value='synthetic-phone';document.getElementById('check-notas').value='<img src=x onerror=alert(1)> untreated customer text';recalcularTotalFinal();},{product,name,pickup});}
  async function submitOffline(p){await p.locator('#final-submit-btn').click();try{await p.waitForFunction(()=>document.getElementById('cart-modal').classList.contains('hidden'));}catch(error){console.error(await p.evaluate(()=>({message:document.getElementById('pth-pending-message').textContent,form:PTHCheckoutForm.readForm(document),valid:document.getElementById('checkout-form').checkValidity(),cart,handler:document.getElementById('checkout-form').onsubmit.toString().slice(0,300)})));throw error;}}

  // A blocked async popup and form/PDF cleanup cannot hide the receipt action.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await fill(p);
    await p.evaluate(()=>{window.open=()=>null;generarComprobanteVenta=()=>{};generarComprobanteB2B=()=>{};});
    await p.locator('#final-submit-btn').click();await p.locator('#pth-checkout-confirmations').waitFor({state:'visible'});
    assert.equal(f.writes,1);await p.waitForTimeout(4200);assert.equal(await p.locator('#pth-checkout-confirmations').isVisible(),true);
    assert.equal(await p.locator('#pth-checkout-confirmations').getByRole('button',{name:'Enviar pedido por WhatsApp'}).count(),1);
    await fill(p,{product:'Equipo B',name:'Next customer'});assert.equal(await p.evaluate(()=>cart.length),1);assert.equal(await p.locator('#cart-count').innerText(),'1');
    await p.evaluate(()=>toggleCartModal(false));
    await p.reload();await p.waitForFunction(()=>PTHSecureData.accountId()==='actor-a');await p.evaluate(()=>PTHCheckoutConfirmation.restore());
    const send=p.locator('#pth-checkout-confirmations').getByRole('button');await send.click();await p.waitForFunction(()=>document.getElementById('pth-checkout-confirmations').textContent.includes('Vale listo'));
    assert.equal(f.writes,1);assert.deepEqual(errors,[]);await c.close();
  }
  // Another device can submit while a local pending order waits. On recovery,
  // the queue must stop for explicit review rather than create a second sale.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);
    await p.waitForFunction(()=>document.getElementById('pth-device-readiness-summary')?.textContent.includes('Datos guardados'));
    await c.setOffline(true);await fill(p,{name:'Same customer'});
    await p.evaluate(()=>{document.getElementById('check-tel').value='51112233';document.getElementById('check-ci').value='90010112345';});await submitOffline(p);
    const body={...f.body,intentId:'d'.repeat(64),table:'pedidos',delivery:{pickup:true,municipio:'Almacén',localidad:'Centro de Entrega'},inputs:[{...f.body.inputs[0],cliente:'Same customer',telefono:'+5351112233',ci:'90010112345',municipio:'Almacén',direccion:'Recogida presencial en almacén',orden_dia:'A-REMOTE'}]};
    const quote=await f.request({...body,operation:'quote'});assert.equal(quote.error,null);assert.equal((await f.request({...body,operation:'submit',attempt:quote.data.attempt,quote:quote.data.quote})).data.complete,true);
    await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());const rows=await waitForRows(p,r=>r[0]?.state==='blocked','duplicate waits for review');assert.equal(rows[0].code,'POSSIBLE_DUPLICATE');assert.equal(f.writes,1);
    assert.match(await p.locator('#pth-pending-order-panel').innerText(),/A-REMOTE/);
    await p.locator('#pth-pending-order-panel').getByRole('button',{name:'Revisar pendiente'}).click();await p.locator('#final-submit-btn').click();
    await waitForRows(p,r=>r[0]?.state==='confirmed','explicit distinct purchase');assert.equal(f.writes,2);assert.deepEqual(errors,[]);await c.close();
  }

  // The same confirmation queues multiple customers offline, then recovers
  // a lost response without replacing an unrelated live form or draft.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c,true);await c.setOffline(true);
    await fill(p,{name:'First Synthetic'});await submitOffline(p);
    await fill(p,{product:'Equipo B',name:'Second Synthetic'});await submitOffline(p);
    let rows=await list(p);assert.equal(rows.length,2);assert.notEqual(rows[0].intentId,rows[1].intentId);assert.equal(f.writes,0);assert.equal(await p.evaluate(()=>cart.length),0);
    assert.match(await p.locator('#pth-pending-order-panel').innerText(),/Pedidos guardados en este teléfono/);assert.match(await p.locator('#pth-pending-order-panel').innerText(),/todavía sin confirmar en la web/);assert.equal(await p.locator('#pth-pending-order-panel img').count(),0);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await fill(p,{product:'Equipo B',name:'Live Unrelated Customer'});
    await p.evaluate(()=>{cart[0].qty=3;renderCart();document.getElementById('check-dir').value='Untouched local address';document.getElementById('check-vuelto').value='50';toggleCartModal(false);});
    const before=await p.evaluate(()=>({cart:cart.map(p=>({...p})),revision:newCartRevision,draft:lowConnectivity.readDraft('actor-a'),form:PTHCheckoutForm.readForm(document)}));
    dropSubmitResponse=true;await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());
    rows=await waitForRows(p,r=>r.some(x=>x.state==='uncertain')&&r.some(x=>x.state==='confirmed'),'receipt loss plus independent second order');assert.equal(f.writes,2);dropSubmitResponse=false;
    await p.evaluate(()=>PTHPendingCheckoutUI.tick());await waitForRows(p,r=>r.every(x=>x.state==='confirmed'),'both receipts confirmed');assert.equal(f.writes,2);
    const after=await p.evaluate(()=>({cart:cart.map(p=>({...p})),revision:newCartRevision,draft:lowConnectivity.readDraft('actor-a'),form:PTHCheckoutForm.readForm(document)}));assert.deepEqual(after,before);assert.equal(c.pages().length,1);assert.match(await p.locator('#pth-pending-order-panel').innerText(),/Referencia: /);assert.equal((await list(p)).some(r=>r.form||r.lines),false);assert.deepEqual(errors,[]);await c.close();
  }
  // A fresh delivery quote blocks only the affected order. Explicit review
  // displays and accepts the real cost before that order can be submitted.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c,true);await c.setOffline(true);
    await fill(p,{product:'Equipo B',name:'Delivery Synthetic',pickup:false});await submitOffline(p);
    await fill(p,{name:'Pickup Synthetic'});await submitOffline(p);f.rows.tarifas_mensajeria[0].precio_pequeno=10;
    await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());let rows=await waitForRows(p,r=>r.some(x=>x.state==='blocked')&&r.some(x=>x.state==='confirmed'),'changed shipping blocks one row');assert.equal(f.writes,1);
    const blocked=rows.find(r=>r.state==='blocked');assert.equal(blocked.estimate.shipping,6);assert.equal(blocked.reviewEstimate.shipping,10);assert.equal(blocked.outcome,null);
    await p.locator('[data-pending-id="'+blocked.id+'"]').getByRole('button',{name:'Revisar pendiente'}).click();assert.equal(await p.locator('#resumen-envio').innerText(),'$10');assert.equal(f.writes,1);
    await p.locator('#final-submit-btn').click();await waitForRows(p,r=>r.every(x=>x.state==='confirmed'),'explicit revised shipping');assert.equal(f.writes,2);assert.equal(f.rows.pedidos.find(r=>r.cliente==='Delivery Synthetic').costo_mensajeria,10);assert.deepEqual(errors,[]);await c.close();
  }
  // An order being edited remains usable; no background queue can replace it.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await c.setOffline(true);await fill(p);await submitOffline(p);await fill(p,{product:'Equipo B',name:'Editing Synthetic'});await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());await p.waitForTimeout(200);assert.equal(f.writes,0);assert.equal(await p.locator('#check-nombre').inputValue(),'Editing Synthetic');
    await p.evaluate(()=>toggleCartModal(false));await p.evaluate(()=>PTHPendingCheckoutUI.tick());await waitForRows(p,r=>r[0]?.state==='confirmed','send after active editing ends');assert.equal(await p.locator('#check-nombre').inputValue(),'Editing Synthetic');assert.equal(await p.evaluate(()=>cart[0].id),'pB');assert.deepEqual(errors,[]);await c.close();
  }
  // Real storage failure cannot claim success, clear inputs or create an order.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await c.setOffline(true);await fill(p);await p.evaluate(()=>{window.fixturePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value){throw new DOMException('synthetic quota','QuotaExceededError');};});await p.locator('#final-submit-btn').click();await p.waitForFunction(()=>document.getElementById('pth-pending-message').textContent.includes('No se pudo guardar'));assert.equal(await p.locator('#check-nombre').inputValue(),'Synthetic Customer');assert.equal(await p.evaluate(()=>cart.length),1);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Expiry without a valid offline context removes all customer fields.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await c.setOffline(true);await fill(p);await submitOffline(p);await p.evaluate(()=>{localStorage.removeItem('pth_offline_context_v1');PTHSecureData.clearSession('expired');});await waitForRows(p,r=>r.every(x=>!x.form&&!x.lines),'expired session purges customers');assert.equal(await p.locator('#pth-pending-order-panel').isVisible(),false);assert.match(await p.locator('#pth-pending-message').innerText(),/Tu sesión venció/);await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // A valid offline context retains the pending intention but cannot send
  // after session expiry; the existing verified reauthentication is required.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await c.setOffline(true);await fill(p);await submitOffline(p);
    await p.evaluate(()=>PTHSecureData.clearSession('expired'));await p.evaluate(()=>PTHPendingCheckoutUI.drainPrivatePurges());
    const rows=await list(p);assert.equal(rows.length,1);assert.equal(rows[0].form.nombre,'Synthetic Customer');
    await c.setOffline(false);await p.evaluate(()=>PTHPendingCheckoutUI.tick());assert.equal(f.writes,0);assert.equal(await p.evaluate(()=>PTHSecureData.token()),null);assert.deepEqual(errors,[]);await c.close();
  }
  // A receipt arriving after an account switch cannot overwrite B's inputs,
  // cart or draft, and cannot leave B's modal inert or display A's details.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await c.setOffline(true);await fill(p);await submitOffline(p);
    await p.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)),row=(await q.list('actor-a'))[0];await q.patch('actor-a',row.id,{outcome:{attempt:'synthetic-capability'},state:'uncertain'});const checkout=PTHSecureData.checkout;PTHSecureData.checkout=body=>body.operation==='receipt'?new Promise(resolve=>{window.releaseLateReceipt=()=>resolve({data:{complete:true,confirmed:[{reference:'Old-A1',proveedor:'A'}]},error:null});}):checkout(body);});
    await c.setOffline(false);await p.waitForFunction(()=>typeof releaseLateReceipt==='function');
    f.rows.gestores.push({...f.rows.gestores[0],id:'account-b',nombre:'Other Account'});
    await p.evaluate(async()=>{await PTHSecureData.login('account-b','synthetic-only');cart=[{id:'pB',nombre:'Other cart',qty:2,precio_venta:200}];newCartOwner='account-b';newCartRevision='c'.repeat(64);lowConnectivity.saveDraft('account-b',cart);document.getElementById('check-nombre').value='Other Account Customer';releaseLateReceipt();});
    await waitForRows(p,r=>r[0]?.state==='uncertain'&&r[0].code==='SESSION_CHANGED'&&!r[0].lease,'late receipt scope fence');assert.equal(await p.locator('#check-nombre').inputValue(),'Other Account Customer');assert.equal(await p.evaluate(()=>cart[0].qty),2);assert.ok(await p.evaluate(()=>lowConnectivity.readDraft('account-b')));assert.equal(await p.locator('#cart-modal').evaluate(node=>node.inert),false);assert.equal(await p.locator('#pth-pending-order-panel').isVisible(),false);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  // Cached account mode also queues when the browser still claims it is online.
  {
    f=await fixture();const {c,errors}=await context(),p=await main(c);await fill(p);await c.route('**/mock-secure-data',route=>route.abort('internetdisconnected'));await p.evaluate(()=>window.PTHOfflineStorefront={usingCopy:()=>true});await p.evaluate(()=>PTHPendingCheckoutUI.render());await submitOffline(p);await waitForRows(p,r=>r[0]?.state==='queued','apparent online with inaccessible server');assert.equal(await p.evaluate(()=>navigator.onLine),true);assert.equal(f.writes,0);await c.unroute('**/mock-secure-data');await p.evaluate(()=>{window.PTHOfflineStorefront=null;});await p.evaluate(()=>PTHPendingCheckoutUI.tick());await waitForRows(p,r=>r[0]?.state==='confirmed','real connectivity recovery');assert.equal(f.writes,1);assert.deepEqual(errors,[]);await c.close();
  }
  // A queued write delayed before its IDB transaction cannot resurrect private
  // data after expiry cleanup has completed and its marker was acknowledged.
  {
    f=await fixture();const {c,errors}=await context();await c.addInitScript(()=>{let current;Object.defineProperty(window,'PTHPendingCheckout',{configurable:true,get:()=>current,set(api){current=api;const indexed=api.indexedStore;api.indexedStore=idb=>{const store=indexed(idb);return {update(owner,mutate){if(window.holdOnePendingMutation&&window.PTHPendingCheckoutUI?.localForm()&&!window.PTHPendingCheckoutUI?.active()){window.holdOnePendingMutation=false;return new Promise(resolve=>{window.releasePendingMutation=()=>resolve(store.update(owner,mutate));});}return store.update(owner,mutate);}};};}});});
    const p=await main(c);await c.setOffline(true);await fill(p);await p.evaluate(()=>window.holdOnePendingMutation=true);await p.locator('#final-submit-btn').click();await p.waitForFunction(()=>typeof releasePendingMutation==='function');
    await p.evaluate(async()=>{localStorage.removeItem('pth_offline_context_v1');PTHSecureData.clearSession('expired');await PTHPendingCheckoutUI.drainPrivatePurges();});assert.deepEqual(await p.evaluate(()=>PTHSecureData.pendingPrivatePurgeOwners()),[]);assert.deepEqual(await list(p),[]);
    await p.evaluate(()=>releasePendingMutation());await p.waitForFunction(()=>!document.getElementById('pth-queue-order').disabled);assert.deepEqual(await list(p),[]);assert.equal(f.writes,0);assert.equal(await p.evaluate(()=>PTHSecureData.token()),null);assert.deepEqual(errors,[]);await c.close();
  }
  // Startup notices a session that expired before bridge listeners existed.
  {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await c.setOffline(true);await fill(p);await submitOffline(p);await p.evaluate(()=>{localStorage.removeItem('pth_offline_context_v1');localStorage.setItem('pth_secure_token_expires_at',String(Date.now()-1000));});await p.close();await c.setOffline(false);p=await c.newPage();await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>Boolean(window.PTHPendingCheckoutUI));await waitForRows(p,r=>r.every(x=>!x.form&&!x.lines),'startup expiry purges customers');assert.equal(await p.evaluate(()=>localStorage.getItem('pth_secure_token')),null);assert.equal(f.writes,0);assert.deepEqual(errors,[]);await c.close();
  }
  console.log('PASS multiple normal offline confirmations, independent receipts, one lost response, live cart/form preservation, delivery cost review, active editing, storage refusal, expiry privacy, mobile layout, apparent online outages, startup expiry cleanup, no external tabs');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
