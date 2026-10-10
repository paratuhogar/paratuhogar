// Actual service worker + shipped local SDK, local gateway and synthetic orders.
// NODE_PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules node tests/offline-normal-worker-browser.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {startFixture}=require('./fixtures/offline-normal-http.cjs');

async function makeContext(browser,fixture,width=390,account='a') {
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'allow'});
  await context.addInitScript(({actor,token,until})=>{
    if(location.hostname!=='127.0.0.1')return; // about:blank has opaque storage.
    window.fixtureSessionEvents=[];window.addEventListener('pth:session-changed',event=>window.fixtureSessionEvents.push({reason:event.reason,expired:PTHSecureData.expiredCheckoutOwner?.(),bridge:Boolean(window.PTHPendingCheckoutUI)}));
    sessionStorage.setItem('pth_intro_vista','true');sessionStorage.setItem('pth_entry_logged','true');
    for(const [key,value] of Object.entries({pth_last_seen_level:'0',info_precios_v1:'true',sl_tutorial_completed_v1:'true',pth_subgestor_onboarding_v1:'true'}))localStorage.setItem(key,value);
    if(!localStorage.getItem('fixture_initialized')) {
      localStorage.setItem('fixture_initialized','1');
      localStorage.setItem('pth_secure_token',token);localStorage.setItem('pth_secure_token_expires_at',String(until));
      localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:{...actor,password:'__session__'}}));
    }
  },{actor:fixture.actors[account],token:fixture.tokens[account],until:fixture.until});
  const external=[];
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===fixture.origin)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  context.on('page',page=>page.on('dialog',dialog=>dialog.dismiss()));
  return {context,external};
}
async function ready(page,fixture,url='/') {
  await page.goto(fixture.origin+url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2&&window.PTHPendingCheckoutUI);
}
async function workerReady(page) {
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
}
// Chromium's new-target network override may leave navigator.onLine=true when
// a target is created after context.setOffline. Set both actual browser states;
// this is device emulation, not an app/SDK/worker replacement.
const deviceSessions=new WeakMap();
async function deviceOffline(context,page,offline) {
  await context.setOffline(offline);
  let cdp=deviceSessions.get(page);
  if(!cdp){cdp=await context.newCDPSession(page);deviceSessions.set(page,cdp);await cdp.send('Network.enable');}
  await cdp.send('Network.overrideNetworkState',{offline,latency:0,downloadThroughput:offline?0:-1,uploadThroughput:offline?0:-1,connectionType:offline?'none':'wifi'});
}
async function openCart(page,name='Equipo A') {
  await page.evaluate(name=>{closeDetail();showSection('catalogo');addProductFromCard(name);},name);
  await page.waitForFunction(()=>!document.getElementById('cart-modal').classList.contains('hidden'));
  // addItemToCart schedules CRM focus; wait for that UI transition before typing.
  await page.waitForFunction(()=>document.activeElement===document.getElementById('crm-search'));
}
async function saveCopy(page) {
  await page.locator('#pth-save-offline-copy').click();
  await page.waitForFunction(()=>!document.getElementById('pth-save-offline-copy').disabled&&/Copia guardada|No se pudo guardar|Renueva tu sesión/.test(document.getElementById('pth-pending-message')?.textContent||''));
  assert.match(await page.locator('#pth-pending-message').innerText(),/Copia guardada/,'actual save-copy button must save private account-scoped data');
  const copies=await privateCopies(page);
  assert.ok(copies.every(copy=>copy.products.every(product=>!Object.hasOwn(product,'comision')&&!Object.hasOwn(product,'password'))));
  await page.evaluate(()=>toggleCartModal(false));
}
async function rows(page,owner='actor-a') {return page.evaluate(owner=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list(owner),owner);}
async function fillOrder(page,name) {
  await page.waitForFunction(()=>!PTHPendingCheckoutUI.localForm());
  await openCart(page);
  await page.waitForFunction(()=>!document.getElementById('final-submit-btn').disabled);
  await page.locator('#check-nombre').fill(name);
  await page.locator('#check-ci').fill('11111111111');await page.locator('#check-tel').fill('5351111111');
  await page.locator('#check-municipio').selectOption('Centro Habana');await page.locator('#check-localidad').selectOption('Centro');
  await page.locator('#check-dir').fill('SYNTHETIC_PENDING_ADDRESS_19');
  await page.locator('#check-notas').fill('Texto de prueba, no instrucciones de ejecución');
  assert.match(await page.locator('#resumen-envio').innerText(),/6/);
  assert.match(await page.locator('#total-convertido').innerText(),/106/);
  await page.locator('#final-submit-btn').click();
  try { await page.waitForFunction(()=>document.getElementById('cart-modal').classList.contains('hidden')&&!PTHPendingCheckoutUI.localForm()); }
  catch(error){console.error('Synthetic pending-form diagnostic:',await page.evaluate(()=>({message:document.getElementById('pth-pending-message')?.textContent,valid:document.getElementById('checkout-form').checkValidity(),form:PTHCheckoutForm.readForm(document),cart:cart.map(p=>({id:p.id,qty:p.qty})),online:navigator.onLine,usingCopy:PTHOfflineStorefront.usingCopy()})));console.error('Synthetic queued states:',(await rows(page)).map(r=>({state:r.state,code:r.code})));throw error;}
}
async function auditCache(page,fixture) {
  const cached=await page.evaluate(async()=>{
    const result=[];for(const name of await caches.keys())for(const req of await (await caches.open(name)).keys()) {
      const response=await (await caches.open(name)).match(req);
      result.push({name,url:req.url,authorization:req.headers.get('authorization'),body:await response.text()});
    }return result;
  });
  assert.ok(cached.some(row=>new URL(row.url).pathname==='/index.html'));
  for(const row of cached.filter(row=>new URL(row.url).pathname==='/index.html'))assert.equal(row.body,fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),'cached app shell must be the exact checked-in generic template');
  for(const row of cached) {
    const path=new URL(row.url).pathname;
    assert.equal(new URL(row.url).origin,fixture.origin);
    assert.ok(/^(?:\/index\.html|\/offline(?:-catalog|-order)?\.html|\/js\/[\w./-]+\.(?:js|mjs)|\/css\/[\w.-]+\.css|\/log\.jpeg|\/icons\/[\w-]+\.(?:svg|png)|\/manifest\.webmanifest|\/synthetic-sentinel)$/.test(path),path+' must be public static');
    assert.equal(row.authorization,null);
    for(const marker of [...Object.values(fixture.markers),'SYNTHETIC_PENDING_ADDRESS_19',fixture.tokens.a,fixture.tokens.b])assert.equal(row.body.includes(marker),false,'CacheStorage leaked '+marker);
    assert.equal(/(?:^|\/)(?:functions|rest|feedback|screenshots?|quotes?|crm)(?:\/|\.html|$)/i.test(path),false);
  }
  return cached.length;
}
async function eventually(read,predicate,label) {
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){const value=await read();if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error('Timed out: '+label);
}
async function privateCopies(page) {
  return page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pth_offline_checkout_copy_v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject)=>{const request=db.transaction('copies').objectStore('copies').getAll();request.onsuccess=()=>{db.close();resolve(request.result);};request.onerror=()=>reject(request.error);});
  });
}
async function upgradeAndCompatibility(browser,fixture) {
  fixture.setOldWorker(true);
  const {context}=await makeContext(browser,fixture,320);
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(fixture.origin+'/__warm-old');await workerReady(page);
  assert.ok((await page.evaluate(()=>caches.keys())).includes('pth-public-static-2026-10-02-pending1'));
  await page.evaluate(async()=>{
    await (await caches.open('pth-public-images-v1')).put('/synthetic-sentinel',new Response('public image sentinel'));
    await (await caches.open('unrelated-public-synthetic')).put('/synthetic-sentinel',new Response('unrelated public sentinel'));
  });
  fixture.setOldWorker(false);
  await ready(page,fixture);
  // Assert the waiting state again outside browser polling (async predicates
  // are not a reliable wait for completion across Playwright versions).
  await eventually(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),Boolean,'new real worker waiting');
  await page.locator('#pth-connection-status [data-pth-status-action]').filter({hasText:'Actualizar ahora'}).click();
  await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('20261006-ready1'));
  await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);
  const names=await page.evaluate(()=>caches.keys());
  assert.equal(names.includes('pth-public-static-2026-10-02-pending1'),false);assert.ok(names.includes('pth-public-static-2026-10-10-crm1'));
  assert.ok(names.includes('pth-public-images-v1'));assert.ok(names.includes('unrelated-public-synthetic'));
  await openCart(page);
  const size=await page.locator('#checkout-form').boundingBox();assert.ok(size&&size.width<=320);
  await saveCopy(page);
  await page.goto(fixture.origin+'/offline-catalog.html',{waitUntil:'domcontentloaded'});
  await page.locator('#offline-refresh').click();await page.waitForFunction(()=>document.querySelectorAll('#offline-products article').length===2);
  const before=fixture.requests.length;
  await deviceOffline(context,page,true);await page.reload({waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);
  assert.equal(await page.locator('#offline-products article').count(),2);assert.match(await page.locator('#catalog-date').innerText(),/Guardado el/);
  await page.goto(fixture.origin+'/offline-order.html',{waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);
  assert.ok(await page.locator('#checkout-form').count());
  await page.goto(fixture.origin+'/feedback.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#checkout-form').count(),0);assert.equal((await page.locator('body').innerText()).includes(fixture.markers.a),false);
  await ready(page,fixture,'/?search=Equipo%20A');await deviceOffline(context,page,true);
  await page.waitForFunction(()=>!document.getElementById('detail-modal').classList.contains('hidden'));
  assert.equal(await page.locator('#detail-name').innerText(),'Equipo A');
  assert.equal(fixture.requests.slice(before).some(req=>req.path.startsWith('/producto/js/')),false);
  await auditCache(page,fixture);assert.deepEqual(errors,[]);
  console.log('PASS old actual worker upgrade with UI action, old cache removed/image+unrelated preserved; explicit public reader/order reader compatible; private route generic fallback; 320px normal query-detail/form');
  await context.close();
}
async function accountPrivacy(browser,fixture) {
  const baseline=fixture.f.writes;
  const {context}=await makeContext(browser,fixture,320);
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page,fixture);await workerReady(page);await openCart(page);await saveCopy(page);
  const utility=await context.newPage();await utility.goto(fixture.origin+'/__storage');
  await deviceOffline(context,page,true);await page.reload({waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);await page.waitForFunction(()=>PTHOfflineStorefront.usingCopy());
  await fillOrder(page,'SYNTHETIC_A_QUEUED_PRIVATE');
  await openCart(page);assert.ok((await page.locator('#crm-datalist option').evaluateAll(nodes=>nodes.map(n=>n.value))).some(value=>value.startsWith(fixture.markers.a)));
  // Real browser storage events come from a separate same-origin tab.
  await utility.evaluate(({actor,token,until})=>{
    localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:{...actor,password:'__session__'}}));
    localStorage.setItem('pth_secure_token',token);localStorage.setItem('pth_secure_token_expires_at',String(until));
  },{actor:fixture.actors.b,token:fixture.tokens.b,until:fixture.until});
  await page.waitForFunction(()=>!PTHOfflineStorefront.usingCopy()&&document.querySelectorAll('#crm-datalist option').length===0&&document.getElementById('cart-modal').classList.contains('hidden'));
  await eventually(()=>privateCopies(page),value=>!value.some(copy=>copy.owner==='actor-a'),'A private device copy purged after account change');
  assert.equal((await page.locator('body').innerText()).includes('SYNTHETIC_A_QUEUED_PRIVATE'),false);
  assert.equal(fixture.f.writes,baseline);
  await deviceOffline(context,page,false);await ready(page,fixture);await openCart(page);
  await page.waitForFunction(()=>document.querySelectorAll('#crm-datalist option').length===1);
  assert.deepEqual(await page.locator('#crm-datalist option').evaluateAll(nodes=>nodes.map(n=>n.value)),[fixture.markers.b+' | 5352222222']);
  assert.equal((await rows(page,'actor-b')).length,0);
  // Quota refusal preserves the existing valid copy and editable draft.
  await saveCopy(page);await openCart(page);
  const beforeQuotaCopy=(await privateCopies(page)).find(copy=>copy.owner==='actor-b');assert.ok(beforeQuotaCopy);
  await page.locator('#check-nombre').fill('SYNTHETIC_QUOTA_DRAFT');
  await page.evaluate(()=>{window.fixturePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='copies')throw new DOMException('Synthetic quota','QuotaExceededError');return window.fixturePut.apply(this,args);};});
  await page.locator('#pth-save-offline-copy').click();
  await page.waitForFunction(()=>document.getElementById('pth-device-copy-result')?.textContent.startsWith('No se actualizó la copia de datos.'));
  assert.equal(await page.locator('#check-nombre').inputValue(),'SYNTHETIC_QUOTA_DRAFT');
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.fixturePut;delete window.fixturePut;});
  assert.deepEqual((await privateCopies(page)).find(copy=>copy.owner==='actor-b'),beforeQuotaCopy);
  await saveCopy(page);await deviceOffline(context,page,true);await page.reload({waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);await page.waitForFunction(()=>PTHOfflineStorefront.usingCopy());
  await fillOrder(page,'SYNTHETIC_B_LOGOUT_PRIVATE');
  await page.evaluate(()=>PTHSecureData.clearSession());
  const retainedB=await rows(page,'actor-b');assert.equal(retainedB.length,1);assert.equal(retainedB[0].form.nombre,'SYNTHETIC_B_LOGOUT_PRIVATE');
  assert.equal(await page.evaluate(()=>PTHSecureData.token()),null);await page.waitForFunction(()=>document.getElementById('pth-pending-order-panel').hidden&&document.querySelectorAll('#crm-datalist option').length===0);assert.equal((await page.locator('body').innerText()).includes('SYNTHETIC_B_LOGOUT_PRIVATE'),false);
  await eventually(()=>privateCopies(page),value=>!value.some(copy=>copy.owner==='actor-b'),'logout purges own copy');
  assert.equal(await page.locator('#crm-datalist option').count(),0);assert.equal(await page.locator('#cart-modal').isVisible(),false);
  assert.equal(fixture.f.writes,baseline);await auditCache(page,fixture);assert.deepEqual(errors,[]);
  console.log('PASS real shared-origin account change clears A UI/copy, B sees only own CRM/queue; copy quota keeps editable draft; logout retains isolated B queue and erases customer copy; 320px offline normal form');
  await context.close();
}
async function expiredReopening(browser,fixture,interrupted=false,logout=false,prepared=true) {
  const baseline=fixture.f.writes;
  const {context}=await makeContext(browser,fixture,390);
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await ready(page,fixture);await workerReady(page);await openCart(page);await saveCopy(page);
  const utility=await context.newPage();await utility.goto(fixture.origin+'/__storage');
  await deviceOffline(context,page,true);await page.reload({waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);await page.waitForFunction(()=>PTHOfflineStorefront.usingCopy());
  await fillOrder(page,'SYNTHETIC_EXPIRED_CUSTOMER');assert.equal((await rows(page)).length,1);
  if(!prepared)await page.evaluate(()=>localStorage.removeItem('pth_offline_context_v1'));
  if(interrupted) {
    if(logout) {
      // A transient failed transaction followed by navigation must retain the
      // durable cleanup marker. The new document has a healthy real IndexedDB.
      await page.evaluate(()=>{
        const original=IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction=function(stores,mode,...args){if(mode==='readwrite')throw new DOMException('Synthetic interrupted cleanup','AbortError');return original.call(this,stores,mode,...args);};
        PTHSecureData.clearSession();
      });
      assert.equal(await page.evaluate(()=>localStorage.getItem('pth_pending_private_purge_v1:actor-a')),'2','failed cleanup must retain a durable owner-only marker');
    } else await page.evaluate(()=>localStorage.setItem('pth_secure_token_expires_at',String(Date.now()-1)));
    await page.reload({waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);
  } else {
    await page.close();
    await utility.evaluate(()=>localStorage.setItem('pth_secure_token_expires_at',String(Date.now()-1)));
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await deviceOffline(context,page,true);
    await page.goto(fixture.origin+'/',{waitUntil:'domcontentloaded'});await deviceOffline(context,page,true);
  }
  await page.waitForFunction(()=>Boolean(window.PTHPendingCheckoutUI));
  console.log('Expired reopening diagnostics:',await page.evaluate(()=>({token:PTHSecureData.token()?true:false,expired:PTHSecureData.expiredCheckoutOwner(),events:window.fixtureSessionEvents})),(await rows(page)).map(row=>({state:row.state,form:Boolean(row.form),attempt:Boolean(row.outcome?.attempt)})));
  const retained=await rows(page);assert.equal(retained.length,1);assert.equal(retained[0].form.nombre,'SYNTHETIC_EXPIRED_CUSTOMER');assert.notEqual(retained[0].state,'confirmed');
  if(logout||!prepared)await eventually(()=>privateCopies(page),value=>!value.some(copy=>copy.owner==='actor-a'),'no prepared context leaves a saved own CRM copy');
  else assert.ok((await privateCopies(page)).some(copy=>copy.owner==='actor-a'),'prepared seven-day copy survives the shorter live-session expiry');
  await eventually(()=>page.evaluate(()=>PTHSecureData.pendingPrivatePurgeOwners?.()||[]),owners=>!owners.includes('actor-a'),'successful queue and CRM purges retire cleanup marker');
  assert.equal(await page.evaluate(()=>PTHSecureData.token()),null);assert.equal(await page.locator('#cart-modal').isVisible(),false);
  if(logout||!prepared){assert.ok(!await page.evaluate(()=>PTHOfflineStorefront.current()?.owner));assert.equal(await page.locator('#crm-datalist option').count(),0);assert.equal((await page.locator('body').innerText()).includes('SYNTHETIC_EXPIRED_CUSTOMER'),false);}
  else assert.equal(await page.evaluate(()=>PTHSecureData.offlineProfile()?.id),'actor-a');
  assert.equal(await page.locator('#pth-session-login-notice').isVisible(),false,'offline reopening does not force an unavailable login');
  assert.equal(fixture.f.writes,baseline);await auditCache(page,fixture);assert.deepEqual(errors,[]);
  console.log('PASS '+(logout?'logout cleanup aborted then reload':interrupted?'interrupted active expiry cleanup/reload':'session expired while app closed')+' on actual cached normal reopening: token absent, queued order retained under its owner, prepared copy '+(logout||!prepared?'cleared':'bounded and retained')+'; no forced login offline, no order sent');
  await context.close();
}

(async()=>{
  const fixture=await startFixture();
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    if(process.env.PTH_GATE_CASE==='expiry'){await expiredReopening(browser,fixture);return;}
    if(process.env.PTH_GATE_CASE==='interrupt'){await expiredReopening(browser,fixture,true);return;}
    if(process.env.PTH_GATE_CASE==='logout'){await expiredReopening(browser,fixture,true,true);return;}
    const {context}=await makeContext(browser,fixture,390);
    let page=await context.newPage();const errors=[],downloads=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d.suggestedFilename()));});page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
    await ready(page,fixture,'/?ref=synthetic-link');console.log('Online storefront ready');await workerReady(page);console.log('Actual worker controls storefront');
    await openCart(page);await saveCopy(page);console.log('Actual save-copy button succeeded');
    assert.equal(fixture.f.writes,0);
    await page.close();page=await context.newPage();await deviceOffline(context,page,true);
    await ready(page,fixture,'/?ref=synthetic-link');
    await deviceOffline(context,page,true);
    await page.waitForFunction(()=>PTHOfflineStorefront.usingCopy());console.log('Same root URL reopened offline');
    assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).search,'?ref=synthetic-link');
    console.log('Offline device state:',await page.evaluate(()=>({online:navigator.onLine,pwa:[...document.scripts].find(s=>s.src.includes('/js/pwa.js'))?.src,connection:document.getElementById('pth-connection-status')?.textContent})));
    assert.equal(await page.evaluate(()=>navigator.onLine),false);
    assert.match(await page.locator('#pth-connection-status').innerText(),/Continúa en esta página/);
    await page.evaluate(()=>filterByCategory('ENERGIA'));
    assert.deepEqual(await page.locator('#productos-container article h3').allTextContents(),['Equipo B']);
    await page.evaluate(()=>filterByCategory('TODOS'));await page.locator('#search-bar').fill('Equipo A');await page.evaluate(()=>filterProducts());
    await page.locator('#productos-container a').filter({hasText:'Ver información completa'}).click();
    const deep=new URL(page.url()).pathname;
    assert.match(deep,/^\/producto\//);assert.match(await page.locator('#detail-desc').innerText(),/Descripción equipo A/);
    await page.close();page=await context.newPage();await deviceOffline(context,page,true);await ready(page,fixture,deep);await deviceOffline(context,page,true);
    await page.waitForFunction(()=>document.getElementById('detail-name').textContent==='Equipo A'&&!document.getElementById('detail-modal').classList.contains('hidden'));
    assert.equal(await page.evaluate(()=>document.baseURI),fixture.origin+'/');
    await openCart(page);
    assert.deepEqual(await page.locator('#crm-datalist option').allTextContents(),[fixture.markers.address]);
    await page.locator('#crm-search').fill(fixture.markers.a+' | 5351111111');await page.locator('#crm-search').dispatchEvent('change');
    assert.equal(await page.locator('#check-nombre').inputValue(),fixture.markers.a);assert.equal(await page.locator('#check-dir').inputValue(),fixture.markers.address);
    await page.evaluate(()=>{cart=[];renderCart();toggleCartModal(false);});
    await fillOrder(page,'SYNTHETIC_ORDER_ONE');await fillOrder(page,'SYNTHETIC_ORDER_TWO');console.log('Two normal offline forms saved');
    let pending=await rows(page);assert.equal(pending.length,2);assert.equal(new Set(pending.map(row=>row.id)).size,2);assert.equal(fixture.f.writes,0);
    await page.close();page=await context.newPage();await deviceOffline(context,page,true);await ready(page,fixture,'/index.html?ref=synthetic-link');await deviceOffline(context,page,true);await page.waitForFunction(()=>PTHOfflineStorefront.usingCopy());
    assert.equal((await rows(page)).length,2);assert.match(await page.locator('#pth-pending-order-panel').innerText(),/2 pedidos pendientes/);
    await deviceOffline(context,page,false);console.log('Restored transport while normal storefront remains open');
    await page.waitForFunction(()=>{const sections=[...document.querySelectorAll('#pth-pending-order-panel section')];return sections.length===2&&sections.every(section=>section.querySelector('[role=status]')?.textContent==='La tienda confirmó que recibió este pedido.');},{},{timeout:45000});
    assert.equal(fixture.f.writes,2);assert.deepEqual(fixture.f.rows.pedidos[0],fixture.f.historical);
    pending=await rows(page);assert.ok(pending.every(row=>!row.form&&!row.lines&&row.receipts?.length===1));
    assert.equal(context.pages().length,1,'automatic pending flush must not open WhatsApp or extra tabs');assert.deepEqual(downloads,[],'automatic pending flush must not download PDFs');
    const count=await auditCache(page,fixture);assert.deepEqual(errors,[]);
    console.log('PASS real worker root/query/index/deep reopening; categories/detail/own CRM/tariff; 2 normal offline orders auto-flush exactly once; '+count+' public static cache entries, no private data');
    await context.close();
    await upgradeAndCompatibility(browser,fixture);
    await accountPrivacy(browser,fixture);
    await expiredReopening(browser,fixture);
    await expiredReopening(browser,fixture,false,false,false);
    await expiredReopening(browser,fixture,true);
    await expiredReopening(browser,fixture,true,true);
  } catch(error) {console.error('Requests at failure:',fixture.requests.slice(-12));console.error('Optional REST:',fixture.unexpected);throw error;}
  finally {await browser.close();await fixture.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
