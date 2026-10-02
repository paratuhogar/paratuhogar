// Actual SW, anonymous public reader and checkout; local HTTP and synthetic DB only.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');const f=await fixture();
 const trace=[];let origin;
 const products=Array.from({length:430},(_,i)=>({id:'public-'+i,nombre:'Equipo público '+i,precio:100+i,categoria:i%2?'COCINA':'HOGAR',disponible:'SI',garantia:'1 año',thumbnail:'sample.jpg'}));
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,origin);trace.push({path:url.pathname,method:req.method});
  if(url.pathname==='/mock-secure-data'){
   let body='';for await(const data of req)body+=data;const b=JSON.parse(body);
   trace[trace.length-1].action=b.action;trace[trace.length-1].operation=b.operation;trace[trace.length-1].authorization=Boolean(req.headers.authorization);trace[trace.length-1].cookie=Boolean(req.headers.cookie);
   let result;
   if(req.headers['x-public-fixture']==='yes')result={data:products,error:null};
   else result=await f.request(b,req.headers.authorization?.replace(/^Bearer /,'')||null);
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
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:sdk});if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;width:1em;overflow:hidden}'});if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});return route.fulfill({contentType:'application/json',body:'{"data":[],"error":null}'});});
  await context.addInitScript(profile=>{sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_data_saving_v1','on');localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));},f.rows.gestores[0]);
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);
  await page.evaluate(()=>{showSection('catalogo');window.checkoutAlerts=[];window.alert=message=>checkoutAlerts.push(message);window.confirm=()=>true;obtenerDuenoReal=async()=> 'Shared Seller';});
  await page.evaluate(()=>{addProductFromCard('Equipo A');addProductFromCard('Equipo B');document.getElementById('check-recogida').checked=true;document.getElementById('check-nombre').value='Synthetic Customer';document.getElementById('check-tel').value='synthetic-phone';});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pth_new_cart_v1:actor-a')).lines.length),2);
  f.drop=true;
  await page.evaluate(()=>Promise.all([document.getElementById('checkout-form').onsubmit({preventDefault(){}}),document.getElementById('checkout-form').onsubmit({preventDefault(){}})]));
  assert.equal(f.writes,1);assert.equal(f.rows.pedidos.length,3);assert.ok(await page.evaluate(()=>checkoutAlerts.some(m=>m.includes('confirmación del servidor'))));assert.equal(context.pages().length,1);
  const atOffline=trace.filter(r=>r.action==='checkout').length;await context.setOffline(true);await page.evaluate(()=>document.getElementById('checkout-form').onsubmit({preventDefault(){}}));assert.equal(f.writes,1);assert.equal(await page.evaluate(()=>cart.length),2);
  await context.setOffline(false);await page.waitForTimeout(300);assert.equal(trace.filter(r=>r.action==='checkout').length,atOffline,'returning online never submits or checks automatically');
  f.drop=false;await page.evaluate(()=>document.getElementById('checkout-form').onsubmit({preventDefault(){}}));assert.equal(f.writes,1);assert.equal(await page.evaluate(()=>cart.length),0);assert.ok(await page.evaluate(()=>checkoutAlerts.some(m=>m.includes('El servidor confirmó'))));
  assert.equal(trace.filter(r=>r.operation==='receipt').at(-1).authorization,false,'receipt remains usable without an auth session');
  assert.deepEqual(f.rows.pedidos[0],f.historical);assert.equal(errors.length,0,errors.join(' | '));
  await page.evaluate(()=>{document.getElementById('feedback-announcement')?.remove();showSection('catalogo');});await page.screenshot({path:'/tmp/pth-lowdata-mobile.png',fullPage:false});
  await context.close();
  // Public reader measurements use real local HTTP and CDP throttle, not fulfilled routes.
  const metrics=[];
  for(const kbps of [50,100]){
   const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage(),cdp=await c.newCDPSession(p);
   await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await c.addCookies([{name:'synthetic_auth_cookie',value:'must-not-send',url:origin}]);
   await c.setExtraHTTPHeaders({'x-public-fixture':'yes'});
   await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:900,downloadThroughput:kbps*1000/8,uploadThroughput:kbps*1000/8});
   const start=Date.now();await p.goto(origin+'/offline-catalog.html',{waitUntil:'domcontentloaded',timeout:60000});await p.locator('#offline-refresh').click();await p.waitForFunction(()=>document.getElementById('offline-count').textContent.includes('430'),{},{timeout:60000});
   const elapsed=Date.now()-start;assert.equal(await p.locator('#offline-products article').count(),100);
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('pth_offline_public_catalog_v1')).products.length),430);
   const api=trace.filter(r=>r.path==='/mock-secure-data').at(-1);assert.equal(api.cookie,false);assert.equal(api.authorization,false);
   await p.locator('#offline-search').fill('público 12');assert.ok(await p.locator('#offline-products article').count()>0);
   await p.evaluate(async()=>{const registration=await navigator.serviceWorker.register('/service-worker.js?v=20261002-lowdata2',{scope:'/'});await navigator.serviceWorker.ready;if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});});
   await p.waitForFunction(()=>navigator.serviceWorker.controller,{},{timeout:60000});
   const stored=await p.evaluate(async()=>{const cache=await caches.open('pth-public-static-2026-10-02-lowdata2');return (await cache.keys()).map(r=>new URL(r.url).pathname);});assert.equal(stored.some(url=>/img_productos|secure-data|storefront/.test(url)),false);
   await c.setOffline(true);const offlineStart=Date.now();await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelectorAll('#offline-products article').length===100);assert.ok(await p.locator('#catalog-date').innerText());await p.locator('#offline-category').selectOption('COCINA');assert.equal(await p.locator('#offline-products article').count(),100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   metrics.push({kbps,latencyMs:900,firstPublicCopyMs:elapsed,offlineRepeatMs:Date.now()-offlineStart,products:430});await c.close();
  }
  fs.writeFileSync('/tmp/pth-lowdata-network-metrics.json',JSON.stringify(metrics,null,2));console.log('PASS actual mobile form: double tap, lost response, offline/manual retry, anonymous receipt, one atomic batch, historical row unchanged');console.log(JSON.stringify(metrics));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
