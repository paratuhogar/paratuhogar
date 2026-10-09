// Real Chrome, shipped login DOM/client/handler/IndexedDB; all traffic is synthetic.
const {chromium}=require(process.env.PTH_PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/storefront.js'),'utf8');
const notice=source.slice(source.indexOf('function openLoginModal('),source.indexOf('// Ejecutar inmediatamente',source.indexOf('function openLoginModal(')));
const save=source.slice(source.indexOf('window.saveMyPrice = async function('),source.indexOf('// Función para actualizar la etiqueta',source.indexOf('window.saveMyPrice = async function(')));
(async()=>{
 const {sessionFixture}=await import('./fixtures/session-infrastructure.mjs');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM_PATH||'/usr/bin/chromium'});
 try{for(const child of [false,true]){
  const f=await sessionFixture({child});f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+86400000).toISOString();
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin==='http://127.0.0.1:8080'){
    const rel=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!/^(index\.html|js\/[\w.-]+\.js|css\/[\w.-]+\.css|log\.jpeg)$/.test(rel)||!fs.existsSync(path.join(root,rel)))return route.abort();
    let body=fs.readFileSync(path.join(root,rel),'utf8');
    if(rel==='index.html')body=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</head>','<script src="/js/secure-data.js"></script><script src="/js/pending-checkout.js"></script></head>');
    return route.fulfill({contentType:rel.endsWith('.html')?'text/html':rel.endsWith('.css')?'text/css':'application/javascript',body});
   }
   if(url.pathname==='/functions/v1/secure-data'){
    const response=await f.fetch('',{method:'POST',headers:request.headers(),body:request.postData()});
    return route.fulfill({status:response.status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:await response.text()});
   }
   return route.abort();
  });
  await page.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({content:notice});await page.addScriptTag({content:save});
  await page.evaluate(async({token,expiry})=>{
   localStorage.setItem('pth_secure_token',token);localStorage.setItem('pth_secure_token_expires_at',String(Date.parse(expiry)));
   await PTHSecureData.restore();
   window.queue=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));
   await queue.save('owner',{lines:[{id:'product',qty:1,price:100}],form:{nombre:'Synthetic Customer',tel:'50000000',pickup:true,moneda:'USD (Efectivo)'}},{intentId:'b'.repeat(64),savedAt:Date.now()});
  },{token:f.token,expiry:f.rows.pth_secure_sessions[0].expires_at});
  assert.ok(await page.evaluate(()=>PTHSecureData.expiresAt()>Date.now()+29*86400000));
  assert.equal(f.state.writes,1);
  f.rows.pth_secure_sessions[0].expires_at='2000-01-01';
  await page.evaluate(async()=>{
   const db=PTHSecureData.install({from(){throw Error('Direct fallback forbidden');},rpc(){throw Error('Direct RPC fallback forbidden');}});
   const result=await db.from('productos').select();if(result.error?.status!==401)throw Error('Expected expired session');
  });
  assert.equal(await page.locator('#login-overlay').isVisible(),true);
  assert.match(await page.locator('#pth-session-login-notice').innerText(),/Tu sesión venció/);
  assert.equal(await page.evaluate(()=>PTHSecureData.token()),null);
  assert.equal(await page.evaluate(()=>PTHSecureData.preserveOfflineOrders('owner')),true);
  assert.equal(await page.evaluate(async()=>(await queue.list('owner')).length),1);
  assert.equal(await page.evaluate(async()=>(await queue.list('another-owner')).length),0);
  await page.evaluate(async()=>{
   window.gestorName='Fixture';window.resolveSalesHierarchy=async()=>({});
   const button=document.createElement('button');button.textContent='Guardar';
   await saveMyPrice('product',100,10,{currentTarget:button,type:'click'});
   if(button.disabled)throw Error('Save control remains disabled');
  });
  assert.equal(f.state.trace.some(t=>t.table==='precios_personalizados'&&t.op==='update'),false);
  const before=Date.now();await page.evaluate(()=>PTHSecureData.login('Fixture','fixture-only'));
  assert.ok(await page.evaluate(before=>PTHSecureData.expiresAt()>=before+30*86400000,before));
  assert.equal(await page.evaluate(async()=>(await queue.list('owner')).length),1);
  assert.equal(f.rows.pedidos.length,0);assert.deepEqual(errors,[]);
  if(!child)await page.screenshot({path:'/private/tmp/paratuhogar-session-expiry-mobile.png'});
  console.log(`${child?'subgestor':'gestor'}: 30-day renewal, expiry notice, blocked unauthenticated save, original pending order retained, fresh login`);
  await context.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
