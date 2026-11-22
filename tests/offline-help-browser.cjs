// Shipped HTML, scripts, styles and service worker; synthetic localhost data only.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startFixture}=require('./fixtures/offline-normal-http.cjs');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});});
after(async()=>{await browser?.close();});

async function open(t,width=390,dark=false){
 const fixture=await startFixture();
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'allow'});
 const errors=[];
 t.after(async()=>{await context.close();await fixture.close();assert.deepEqual(errors,[]);assert.equal(fixture.f.writes,0,'presentation never writes orders');assert.equal(fixture.requests.some(r=>r.action==='checkout'||r.action==='logout'),false);});
 await context.addInitScript(({actor,token,until,dark})=>{
  if(location.hostname!=='127.0.0.1')return;
  sessionStorage.setItem('pth_intro_vista','true');sessionStorage.setItem('pth_entry_logged','true');
  for(const[k,v]of Object.entries({pth_last_seen_level:'0',info_precios_v1:'true',sl_tutorial_completed_v1:'true',pth_subgestor_onboarding_v1:'true'}))localStorage.setItem(k,v);
  if(!localStorage.getItem('fixture_initialized')){
   localStorage.setItem('fixture_initialized','1');localStorage.setItem('pth_secure_token',token);
   localStorage.setItem('pth_secure_token_expires_at',String(until));
   localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:{...actor,password:'__session__'}}));
  }
  document.addEventListener('DOMContentLoaded',()=>document.documentElement.classList.toggle('dark',dark),{once:true});
 },{actor:fixture.actors.a,token:fixture.tokens.a,until:fixture.until,dark});
 await context.route('**/*',r=>new URL(r.request().url()).origin===fixture.origin?r.continue():r.abort());
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.goto(fixture.origin+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('pth-device-readiness-summary')?.textContent.startsWith('Listo')&&!document.getElementById('pth-device-retry')?.disabled,{},{timeout:50000});
 await page.evaluate(()=>showSection('dashboard'));
 return {page,context,fixture};
}

for(const width of [390,1280])for(const dark of [false,true])test(`offline explanations stay optional at ${width}px ${dark?'dark':'light'}`,async t=>{
 const {page,context}=await open(t,width,dark);
 assert.equal(await page.locator('#pth-offline-help').count(),1,'one native help disclosure must own the optional copy');
 const help=page.locator('#pth-offline-help'),summary=help.locator('summary');
 assert.equal(await help.evaluate(e=>e.open),false);
 assert.equal(await summary.innerText(),'Ayuda y detalles');
 assert.equal(await page.locator('#pth-data-saving-description').isVisible(),false);
 assert.equal(await page.locator('#pth-saved-catalog-description').isVisible(),false);
 assert.equal(await page.locator('#pth-saved-catalog-warning').isVisible(),false);
 assert.equal(await page.locator('#pth-device-copy-result').isVisible(),false,'success details are not a second visible paragraph');
 assert.ok((await page.locator('#pth-device-readiness-summary').innerText()).length<80,'ready state fits one short sentence');
 for(const selector of ['#pth-device-retry','#pth-data-saving-toggle','#pth-saved-catalog-date time'])assert.equal(await page.locator(selector).isVisible(),true,selector+' stays visible');
 await summary.focus();await page.keyboard.press('Enter');
 assert.equal(await help.evaluate(e=>e.open),true);
 for(const selector of ['#pth-data-saving-description','#pth-saved-catalog-description','#pth-saved-catalog-warning','#pth-device-copy-result'])assert.equal(await page.locator(selector).isVisible(),true,selector+' can be read on demand');
 assert.match(await help.innerText(),/teléfono personal/);
 const old=await page.locator('#pth-data-saving-toggle').getAttribute('aria-pressed');
 await page.locator('#pth-data-saving-toggle').click();
 assert.notEqual(await page.locator('#pth-data-saving-toggle').getAttribute('aria-pressed'),old);
 assert.equal(await help.evaluate(e=>e.open),true,'control rerenders do not close the help being read');
 assert.equal(await page.locator('#pth-data-saving-description').count(),1,'rerenders do not duplicate explanations');
 await summary.focus();await page.keyboard.press('Space');assert.equal(await help.evaluate(e=>e.open),false);
 assert.equal(await page.locator('#pth-data-saving-description').isVisible(),false);
 const area=page.locator('#pth-offline-work');
 assert.equal(await area.evaluate(e=>e.scrollWidth<=e.clientWidth),true,'no horizontal overflow');
 assert.ok((await summary.boundingBox()).height>=44,'touch target remains usable');
 if(process.env.PTH_OFFLINE_HELP_EVIDENCE){fs.mkdirSync(process.env.PTH_OFFLINE_HELP_EVIDENCE,{recursive:true});await page.screenshot({path:path.join(process.env.PTH_OFFLINE_HELP_EVIDENCE,`closed-${width}-${dark?'dark':'light'}.png`),fullPage:true});}
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PTHOfflineStorefront?.usingCopy());
 await page.evaluate(()=>showSection('dashboard'));
 assert.equal(await page.locator('#pth-offline-help').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#pth-device-retry').isVisible(),true);
 await page.locator('#pth-offline-help summary').click();
 assert.equal(await page.locator('#pth-saved-catalog-warning').isVisible(),true,'help works with no network');
});

test('failed preparation and retained pending orders are never hidden inside help',async t=>{
 const {page,fixture}=await open(t);
 fixture.f.rows.pedidos.find(r=>r.id==='own-a').cliente='C'.repeat(201);
 await page.locator('#pth-device-retry').click();
 await page.waitForFunction(()=>document.getElementById('pth-device-copy-result')?.textContent.includes('No se actualizó')&&!document.getElementById('pth-device-retry').disabled);
 assert.equal(await page.locator('#pth-offline-help').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#pth-device-copy-result').isVisible(),true,'failure remains actionable with help closed');
 assert.equal(await page.locator('#pth-device-copy-result').evaluate(e=>!!e.closest('#pth-offline-help')),false);
 assert.match(await page.locator('#pth-device-copy-result').innerText(),/límites del guardado local/);
 fixture.f.rows.pedidos.find(r=>r.id==='own-a').cliente=fixture.markers.a;
 await page.locator('#pth-device-retry').click();
 await page.waitForFunction(()=>document.getElementById('pth-device-copy-result')?.textContent.startsWith('Copia guardada')&&!document.getElementById('pth-device-retry').disabled);
 assert.equal(await page.locator('#pth-device-copy-result').isVisible(),false,'recovered success returns to optional details');
 await page.evaluate(async()=>{const q=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));const row=await q.save('actor-a',{lines:[{id:'pA',qty:1,price:100}],form:{nombre:'Cliente de prueba pendiente',tel:'5350000000',pickup:true,moneda:'USD (Efectivo)'},estimate:{shipping:0}});await q.patch('actor-a',row.id,{state:'paused'});await PTHPendingCheckoutUI.render();showSection('catalogo');});
 const pending=page.locator('#pth-pending-order-panel');
 assert.equal(await pending.locator('summary').isVisible(),true);
 assert.equal(await pending.evaluate(e=>!!e.closest('#pth-offline-help')),false);
 await pending.locator('summary').click();
 assert.equal(await page.getByText('Cliente de prueba pendiente',{exact:true}).isVisible(),true);
});
