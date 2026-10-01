// All sessions, permissions and push services are synthetic. No production calls.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const scenario of ['config-timeout','browser-timeout','permission-timeout','registration-timeout','subscription-timeout','save-timeout','cleanup-timeout','pilot-timeout','disable-timeout']){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*',route=>new URL(route.request().url()).pathname==='/js/admin-push.mjs'
   ?route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'js/admin-push.mjs'))})
   :route.fulfill({contentType:'text/html',body:'<main id="settings"></main>'}));
  await page.goto('http://127.0.0.1:8080/');
  await page.evaluate(async scenario=>{
   const {mountAdminPush}=await import('/js/admin-push.mjs');
   window.calls={permission:0,registration:0,subscribe:0,save:0,unsubscribe:0,pilot:0,retry:0};
   const never=()=>new Promise(()=>{});
   const sub={endpoint:'https://push.test/synthetic',toJSON:()=>({endpoint:'https://push.test/synthetic',keys:{auth:'fixture',p256dh:'fixture'}}),unsubscribe:async()=>{calls.unsubscribe++;if(['cleanup-timeout','disable-timeout'].includes(scenario))return never();return true;}};
   const raw=String.fromCharCode(4)+String.fromCharCode(...new Uint8Array(64)),publicKey=btoa(raw).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
   const config={enabled:true,allowedTopics:['orders'],publicKey};window.readyConfig=config;
   const env={isSecureContext:true,navigator:{userAgent:'Desktop',serviceWorker:{}},PushManager:{},Notification:{permission:'default',requestPermission:async()=>{calls.permission++;return scenario==='permission-timeout'?new Promise(resolve=>window.resolvePermission=resolve):'granted';}},matchMedia:()=>({matches:false})};
   await mountAdminPush(document.querySelector('#settings'),{
    scope:()=> 'fixed-session',retry:()=>calls.retry++,
    config:async()=>scenario==='config-timeout'?new Promise(resolve=>window.resolveConfig=resolve):config,
    existing:async()=>scenario==='browser-timeout'?never():null,
    registration:async()=>{calls.registration++;if(scenario==='registration-timeout')return never();return {pushManager:{getSubscription:async()=>null,subscribe:async()=>{calls.subscribe++;return scenario==='subscription-timeout'?new Promise(resolve=>window.resolveSubscription=()=>resolve(sub)):sub;}}};},
    save:async()=>{calls.save++;if(scenario==='save-timeout')return never();if(scenario==='cleanup-timeout')throw Error('offline');},
    remove:async()=>scenario==='disable-timeout'?never():undefined,
    pilot:async()=>{calls.pilot++;return scenario==='pilot-timeout'?never():undefined;},
   },env,{config:100,existing:100,permission:100,registration:100,subscription:100,save:100,cleanup:100,pilot:100,remove:100});
  },scenario);
  const activate=page.getByRole('button',{name:'Activar notificaciones',exact:true});
  if(['config-timeout','browser-timeout'].includes(scenario)){
   assert.equal(await activate.isVisible(),false);assert.equal(await page.evaluate(()=>calls.permission),0);
   await page.getByRole('button',{name:'Volver a comprobar'}).click();assert.equal(await page.evaluate(()=>calls.retry),1);
   if(scenario==='config-timeout'){await page.evaluate(()=>resolveConfig(readyConfig));assert.equal(await activate.isVisible(),false,'late config does not enable after failure');}
  }else{
   await page.locator('input[type=checkbox]').check();await activate.click();
   if(['pilot-timeout','disable-timeout'].includes(scenario)){
    await page.getByRole('status').filter({hasText:'Notificaciones activadas'}).waitFor();
    await page.getByRole('button',{name:scenario==='pilot-timeout'?'Enviar aviso de prueba':'Desactivar en este dispositivo'}).click();
    await page.getByRole('status').filter({hasText:scenario==='pilot-timeout'?'no respondió a la prueba':'No se pudo confirmar toda'}).waitFor();
   }else{
    const text={'permission-timeout':'permiso del navegador sigue pendiente','registration-timeout':'no terminó de preparar','subscription-timeout':'no terminó de registrar','save-timeout':'No se confirmó el registro','cleanup-timeout':'No se completó la activación'}[scenario];
    await page.getByRole('status').filter({hasText:text}).waitFor();
   }
   assert.equal(await activate.isDisabled(),false,'busy state always clears');
   assert.equal(await activate.getAttribute('aria-busy'),'false');assert.equal(await activate.evaluate(e=>getComputedStyle(e).cursor),'pointer');
   if(scenario==='permission-timeout'){await page.evaluate(()=>resolvePermission('granted'));assert.equal(await page.evaluate(()=>calls.registration),0,'late permission cannot auto activate');}
   if(scenario==='subscription-timeout'){
    await page.evaluate(()=>resolveSubscription());await page.waitForFunction(()=>calls.unsubscribe===1);
    assert.equal(await page.evaluate(()=>calls.save),0,'late device is removed without server enrollment');
   }
   if(['save-timeout','cleanup-timeout'].includes(scenario))assert.equal(await page.evaluate(()=>calls.unsubscribe),1);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`PASS bounded push UI ${scenario}: actionable status, safe late completion, retryable controls`);await page.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
