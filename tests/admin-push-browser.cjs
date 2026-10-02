const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const scenario of ['ready','inactive-existing','angel-ready','angel-existing','disabled','disabled-config','paused-existing','denied','save-failure','session-change']){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/js/admin-push.mjs')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'js/admin-push.mjs'))});return route.fulfill({contentType:'text/html',body:'<main id="settings"></main>'});});
 await page.goto('http://127.0.0.1:8080/');
 await page.evaluate(async scenario=>{
  const {mountAdminPush}=await import('/js/admin-push.mjs');window.calls={permission:0,subscribe:0,save:0,remove:0,unsubscribe:0,pilot:0};window.scope='session-a';
  const subscription={endpoint:'https://push.test/synthetic',toJSON:()=>({endpoint:'https://push.test/synthetic',keys:{auth:'synthetic',p256dh:'synthetic'}}),unsubscribe:async()=>{calls.unsubscribe++;return true;}};
  const env={isSecureContext:true,navigator:{userAgent:'Desktop',serviceWorker:{}},PushManager:{},Notification:{permission:'default',requestPermission:async()=>{calls.permission++;if(scenario==='session-change')window.scope='session-b';return scenario==='denied'?'denied':'granted';}},matchMedia:()=>({matches:false}),addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window)};
  const raw=String.fromCharCode(4)+String.fromCharCode(...new Uint8Array(64));const publicKey=btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  await mountAdminPush(document.querySelector('#settings'),{scope:()=>window.scope,config:async()=>({enabled:!['disabled','disabled-config','paused-existing'].includes(scenario),publicKey,allowedTopics:scenario.startsWith('angel-')?['orders','suggestions','applications']:['orders'],...(scenario==='disabled-config'?{readiness:{deliveryReady:true,switchOn:true,publicKeyValid:true,privateKeyValid:false,dispatchSecretValid:true,subjectValid:true}}:{})}),existing:async()=>['paused-existing','angel-existing','inactive-existing'].includes(scenario)?subscription:null,status:async()=>({active:scenario==='angel-existing',topics:['orders','suggestions']}),registration:async()=>({pushManager:{getSubscription:async()=>['angel-existing','inactive-existing'].includes(scenario)?subscription:null,subscribe:async()=>{calls.subscribe++;return subscription;}}}),save:async data=>{calls.save++;window.savedTopics=data.topics;if(scenario==='save-failure')throw Error('offline');},remove:async()=>{calls.remove++;},pilot:async()=>{calls.pilot++;}},env);
 },scenario);
 assert.equal(await page.evaluate(()=>calls.permission),0,'no prompt on load');
 assert.ok((await page.locator('#settings').textContent()).includes('Al cerrar sesión o caducar tu acceso'));
 if(scenario==='inactive-existing'){
  await page.getByRole('status').filter({hasText:'necesita activar los avisos para tu sesión actual'}).waitFor();
  assert.equal(await page.evaluate(()=>calls.save),0);assert.equal(await page.evaluate(()=>calls.subscribe),0);assert.equal(await page.locator('input[value=orders]').isChecked(),false);
  await page.locator('input[value=orders]').check();await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Notificaciones activadas'}).waitFor();assert.equal(await page.evaluate(()=>calls.save),1);assert.equal(await page.evaluate(()=>calls.subscribe),0);assert.equal(await page.evaluate(()=>calls.pilot),0);assert.deepEqual(await page.evaluate(()=>savedTopics),['orders']);
  console.log('PASS inactive browser subscription: clear session explanation, explicit reactivation, no automatic enrollment/send');await page.close();continue;
 }
 if(scenario==='disabled'){assert.equal(await page.getByRole('button',{name:'Activar notificaciones',exact:true,includeHidden:true}).isDisabled(),true);await page.close();continue;}
 if(scenario==='disabled-config'){
  await page.getByRole('status').filter({hasText:'no reconoce la clave privada'}).waitFor();
  assert.equal(await page.evaluate(()=>calls.permission),0);assert.equal(await page.evaluate(()=>calls.subscribe),0);
  console.log('PASS private readiness diagnostics: exact condition, no keys or browser prompt');await page.close();continue;
 }
 if(scenario==='paused-existing'){
  assert.equal(await page.getByRole('button',{name:'Activar notificaciones',exact:true,includeHidden:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Desactivar en este dispositivo'}).click();await page.getByRole('status').filter({hasText:'desactivadas'}).waitFor();
  assert.equal(await page.evaluate(()=>calls.unsubscribe),1);assert.equal(await page.evaluate(()=>calls.remove),1);assert.equal(await page.evaluate(()=>calls.subscribe),0);
  console.log('PASS paused push: existing device can still opt out');await page.close();continue;
 }
 if(scenario.startsWith('angel-')){
  assert.equal(await page.locator('input[type=checkbox]').count(),3);
  assert.equal(await page.locator('input[value=applications]').isChecked(),false,'new topic never auto-enrolls');
  assert.equal(await page.evaluate(()=>calls.save),0);
  await page.locator('input[value=applications]').check();await page.getByRole('button',{name:'Activar notificaciones',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Notificaciones activadas'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>savedTopics),scenario==='angel-existing'?['orders','suggestions','applications']:['applications']);
  console.log(`PASS ${scenario}: explicit application choice, old topics preserved, no automatic enrollment`);await page.close();continue;
 }
 assert.equal(await page.locator('input[type=checkbox]').count(),1,'ordinary admin has orders only');
 await page.getByRole('button',{name:'Activar notificaciones',exact:true,includeHidden:true}).click();assert.equal(await page.evaluate(()=>calls.permission),0,'must select a topic');
 await page.locator('input').check();await page.getByRole('button',{name:'Activar notificaciones',exact:true,includeHidden:true}).click();
 if(scenario==='ready'){
  await page.getByRole('status').filter({hasText:'Notificaciones activadas'}).waitFor();assert.equal(await page.evaluate(()=>calls.subscribe),1);assert.deepEqual(await page.evaluate(()=>savedTopics),['orders']);
  assert.equal(await page.evaluate(()=>calls.pilot),0,'no automatic pilot');await page.getByRole('button',{name:'Enviar aviso de prueba'}).click();
  await page.getByRole('status').filter({hasText:'Prueba enviada'}).waitFor();assert.equal(await page.evaluate(()=>calls.pilot),1);
  await page.getByRole('button',{name:'Desactivar en este dispositivo'}).click();await page.getByRole('status').filter({hasText:'desactivadas'}).waitFor();assert.equal(await page.evaluate(()=>calls.remove),1);assert.equal(await page.evaluate(()=>calls.unsubscribe),1);
 }else if(scenario==='save-failure'){await page.getByRole('status').filter({hasText:'No se completó'}).waitFor();assert.equal(await page.evaluate(()=>calls.unsubscribe),1);}
 else {assert.equal(await page.evaluate(()=>calls.subscribe),0);assert.equal(await page.evaluate(()=>calls.save),0);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log(`PASS push UI ${scenario}: explicit opt-in, audience choices, no production calls`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
