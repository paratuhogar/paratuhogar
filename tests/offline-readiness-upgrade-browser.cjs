// Shipped previous release -> candidate on the same browser/device storage.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {startFixture}=require('./fixtures/offline-normal-http.cjs');
const baseline='58ba35380503c1f0ff8056ef6452422081be6709';
const evidence=process.env.PTH_OFFLINE_EVIDENCE||path.resolve(__dirname,'../../evidence/offline-readiness-upgrade');
const files=['index.html','offline.html','offline-catalog.html','offline-order.html','service-worker.js','js/pwa.js','js/pending-checkout-storefront.js'];
async function state(page){return page.evaluate(async()=>{
 const registration=await navigator.serviceWorker.ready;
 const shell=await new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=event=>{channel.port1.close();resolve(event.data);};navigator.serviceWorker.controller.postMessage({type:'PTH_CHECK_OFFLINE_SHELL'},[channel.port2]);});
 const profile=PTHSecureData.offlineProfile(),copy=await PTHOfflineCheckoutCopy.create(indexedDB).read(profile.id,{profile});
 const queue=await PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).list(profile.id);
 return {summary:document.getElementById('pth-device-readiness-summary')?.textContent,result:document.getElementById('pth-device-copy-result')?.textContent,shell,waiting:Boolean(registration.waiting),copy:{owner:copy.owner,products:copy.products.length,clients:copy.clients.length,tariffs:copy.tariffs.length},queue:queue.map(row=>({id:row.id,state:row.state,lines:row.lines,form:row.form}))};
});}
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});const fixture=await startFixture();
 for(const file of files)fixture.publicAsset('/'+file,execFileSync('git',['show',baseline+':'+file],{cwd:path.resolve(__dirname,'..')}));
 const browser=await chromium.launch({executablePath:process.env.PTH_CHROME_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
 const report={syntheticOnly:true,pageErrors:[],cases:[]};
 try{
  await context.addInitScript(({actor,token,until})=>{
   if(location.hostname!=='127.0.0.1')return;sessionStorage.setItem('pth_intro_vista','true');sessionStorage.setItem('pth_entry_logged','true');
   for(const [k,v]of Object.entries({pth_last_seen_level:'0',info_precios_v1:'true',sl_tutorial_completed_v1:'true',pth_subgestor_onboarding_v1:'true'}))localStorage.setItem(k,v);
   if(!localStorage.getItem('fixture_initialized')){localStorage.setItem('fixture_initialized','1');localStorage.setItem('pth_secure_token',token);localStorage.setItem('pth_secure_token_expires_at',String(until));localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:{...actor,password:'__session__'}}));}
  },{actor:fixture.actors.a,token:fixture.tokens.a,until:fixture.until});
  await context.route('**/*',route=>new URL(route.request().url()).origin===fixture.origin?route.continue():route.abort());
  let page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.goto(fixture.origin+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('pth-device-copy-result')?.textContent.includes('incompleta')&&!document.getElementById('pth-device-retry')?.disabled,{},{timeout:50000});
  await page.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));const row=await q.save('actor-a',{lines:[{id:'pA',qty:1,price:100}],form:{nombre:'DEMO retained on worker upgrade',tel:'5350000000',pickup:true,moneda:'USD (Efectivo)'},estimate:{shipping:0}});await q.patch('actor-a',row.id,{state:'paused',code:'SYNTHETIC_KEEP'});});
  const before=await state(page);assert.equal(before.shell.ready,true);assert.match(before.summary,/no está listo.*Conéctate/);assert.equal(before.shell.version,'pth-public-static-2026-10-06-all-pending1');
  await page.screenshot({path:path.join(evidence,'before-complete-worker-rejected.png')});report.cases.push({name:'published release reproduces photographed not-ready state with fully cached shell',...before});
  for(const file of files)fixture.publicAsset('/'+file,null);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('pth-device-readiness-summary')?.textContent.startsWith('Listo para trabajar')&&!document.getElementById('pth-device-retry')?.disabled,{},{timeout:60000});
  const upgraded=await state(page);assert.equal(upgraded.shell.ready,true);assert.equal(upgraded.shell.version,'pth-public-static-2026-10-06-ready1');assert.equal(upgraded.waiting,false);assert.deepEqual(upgraded.queue,before.queue);assert.deepEqual(upgraded.copy,before.copy);
  assert.equal(await page.locator('#pth-connection-status').isVisible(),false,'completed worker update must retire its update invitation');
  // Repeated readiness/copy checks must stay ready rather than flip back.
  await page.locator('#pth-device-retry').click();await page.waitForFunction(()=>!document.getElementById('pth-device-retry').disabled,{},{timeout:50000});
  const retried=await state(page);assert.match(retried.summary,/Listo para trabajar/);assert.deepEqual(retried.queue,before.queue);await page.screenshot({path:path.join(evidence,'after-ready-same-device.png')});report.cases.push({name:'same device updates controller, remains ready on explicit retry, preserves copy and pending',...retried});
  await page.close();await context.setOffline(true);page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.message));
  await page.goto(fixture.origin+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PTHOfflineStorefront?.usingCopy()&&document.getElementById('pth-device-readiness-summary')?.textContent.startsWith('Listo para trabajar'),{},{timeout:40000});
  const reopened=await state(page);assert.equal(reopened.shell.ready,true);assert.deepEqual(reopened.queue,before.queue);assert.deepEqual(reopened.copy,before.copy);assert.equal(await page.locator('#productos-container article h3').count(),2);await page.screenshot({path:path.join(evidence,'cold-reopened-offline.png')});report.cases.push({name:'closed page then cold reopened same root offline; catalogue and pending preserved',...reopened});
  assert.equal(fixture.f.writes,0);assert.equal(fixture.requests.some(r=>r.action==='checkout'||r.action==='logout'),false);assert.deepEqual(report.pageErrors,[]);report.writes=0;report.checkoutOrLogoutRequests=0;
  fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));console.log('PASS '+report.cases.length+' real Chrome same-device release/cold-reopen cases; zero order writes');
 }finally{await context.close();await browser.close();await fixture.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
