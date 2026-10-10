// Synthetic isolated form using real shared CRM and normal-storefront CRM functions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PTH_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(root+'/js/storefront.js','utf8');
const crm=source.slice(source.indexOf('let crmClients = [];'),source.indexOf('// 3. SISTEMA DE AUTO-GUARDADO'));
const clients=[{cliente:'María Pérez',telefono:'50000001',ci:'synthetic-1',direccion:'Calle A'},{cliente:'María Pérez',telefono:'50000002',ci:'synthetic-2',direccion:'Calle B'},{cliente:'Ana',telefono:'50000003',ci:'synthetic-3',direccion:'Calle C'}];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PTH_CHROMIUM?{executablePath:process.env.PTH_CHROMIUM}:{})});
 try {for(const width of [390,1280])for(const offline of [false,true])for(const entry of ['normal','shared']){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390}),page=await context.newPage();page.on('pageerror',e=>console.error('PAGE ERROR',e.message));await context.route('**/*',r=>r.abort());
 await page.setContent('<form><label for="crm-search">Buscar clienta</label><input id="crm-search" list="crm-datalist"><datalist id="crm-datalist"></datalist>'+['nombre','ci','tel','dir','municipio','localidad'].map(n=>'<input id="check-'+n+'">').join('')+'<input id="check-recogida" type="checkbox"></form>');
 await page.addScriptTag({path:root+'/js/checkout-form-shared.js'});
 await page.evaluate(()=>{window.confirmations=0;window.confirmAnswer=false;window.confirm=()=>{confirmations++;return confirmAnswer;};window.changes=0;});
 if(entry==='normal')await page.addScriptTag({content:'let offlineStorefront={current:()=>null};'+crm+';crmClients='+JSON.stringify(clients)+';renderCheckoutClientChoices();window.updateChoices=rows=>{crmClients=rows;renderCheckoutClientChoices();};'});
 else await page.evaluate(clients=>{window.binding=PTHCheckoutForm.bind(document,{clients,onChange:()=>changes++});window.updateChoices=rows=>binding.clients.update(rows);},clients);
 await context.setOffline(offline);
 // Name/accent matching exposes explicit choices, never guesses a homonym.
 await page.locator('#crm-search').fill('maria');assert.equal(await page.locator('#check-tel').inputValue(),'');assert.equal(await page.locator('#pth-crm-choices button').count(),2);
 if(width===390)await page.getByRole('button',{name:/50000002/}).tap();else await page.getByRole('button',{name:/50000002/}).click();assert.equal(await page.locator('#check-tel').inputValue(),'50000002');assert.equal(await page.locator('#check-ci').inputValue(),'synthetic-2');
 // Cancel and then explicitly approve replacing manually edited fields.
 await page.locator('#check-dir').fill('Edición manual');await page.locator('#crm-search').fill('Ana');await page.getByRole('button',{name:/50000003/}).click();assert.equal(await page.locator('#check-dir').inputValue(),'Edición manual');assert.equal(await page.locator('#check-tel').inputValue(),'50000002');
 await page.evaluate(()=>confirmAnswer=true);await page.getByRole('button',{name:/50000003/}).click();assert.equal(await page.locator('#check-tel').inputValue(),'50000003');assert.equal(await page.locator('#check-dir').inputValue(),'Calle C');
 // Clearing a filled field is an edit too and must not be silently undone.
 await page.locator('#check-ci').fill('');await page.evaluate(()=>confirmAnswer=false);await page.locator('#crm-search').fill('María');await page.getByRole('button',{name:/50000001/}).click();assert.equal(await page.locator('#check-ci').inputValue(),'');assert.equal(await page.locator('#check-tel').inputValue(),'50000003');await page.evaluate(()=>confirmAnswer=true);
 // Keyboard activation; exact saved datalist value also uses guarded selection.
 await page.locator('#crm-search').fill('María');await page.getByRole('button',{name:/50000001/}).focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#check-tel').inputValue(),'50000001');
 await page.locator('#crm-search').fill('María Pérez | 50000002');assert.equal(await page.locator('#check-tel').inputValue(),'50000002');
 // Detached choices from an older search cannot apply a different client.
 await page.locator('#crm-search').fill('Ana');await page.evaluate(()=>window.oldSearchButton=document.querySelector('#pth-crm-choices button'));await page.locator('#crm-search').fill('María');await page.evaluate(()=>oldSearchButton.click());assert.equal(await page.locator('#check-tel').inputValue(),'50000002');
 // Late options do not modify edited fields; detached/stale buttons cannot select.
 await page.locator('#crm-search').fill('Ana');await page.evaluate(()=>window.staleButton=document.querySelector('#pth-crm-choices button'));await page.evaluate(()=>updateChoices([]));await page.evaluate(()=>staleButton.click());assert.equal(await page.locator('#check-tel').inputValue(),'50000002');
 await page.locator('#crm-search').fill('María Pérez | 50000001');await page.evaluate(clients=>updateChoices(clients),clients);assert.equal(await page.locator('#check-tel').inputValue(),'50000002');
 await page.locator('#check-dir').fill('Manual late edit');await page.evaluate(()=>{confirmAnswer=false;confirmations=0;});await page.locator('#crm-search').fill('Ana | 50000003');await page.locator('#crm-search').dispatchEvent('change');assert.equal(await page.evaluate(()=>confirmations),1);assert.equal(await page.locator('#check-dir').inputValue(),'Manual late edit');await page.evaluate(()=>confirmAnswer=true);
 // Two different records with identical name+phone must be explicitly distinguished.
 await page.evaluate(clients=>updateChoices([clients[0],{...clients[0],direccion:'Otra dirección',ci:'other-ci'}]),clients);await page.locator('#crm-search').fill('María Pérez | 50000001');await page.locator('#crm-search').dispatchEvent('change');assert.equal(await page.locator('#check-tel').inputValue(),'50000002');assert.equal(await page.locator('#pth-crm-choices button').count(),2);
 await page.getByRole('button',{name:/Otra dirección/}).click();assert.equal(await page.locator('#check-ci').inputValue(),'other-ci');
 assert.equal(await page.locator('#pth-crm-choices [type="submit"]').count(),0);
 if(entry==='normal')await page.evaluate(()=>window.dispatchEvent(new Event('pth:session-changed')));else await page.evaluate(()=>binding.destroy());assert.equal(await page.locator('#pth-crm-choices button').count(),0);assert.equal(await page.locator('#crm-datalist option').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('PASS CRM',entry,width,offline?'offline':'online','homonyms, accents, guarded edits, keyboard, exact choice, late/stale options');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
