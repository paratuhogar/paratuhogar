// Normal storefront entry point, real local SDK and synthetic account-only data.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const profile={id:'11111111-1111-4111-8111-111111111111',nombre:'Cuenta prueba',rol:'gestor',estado:'activo',password:'__session__'};
const child={...profile,id:'22222222-2222-4222-8222-222222222222',nombre:'Cuenta hija',parent_id:profile.id,parent_nombre:profile.nombre};
const products=[{id:'nevera',nombre:'Nevera prueba',precio:520,comision:25,categoria:'NEVERAS',disponible:'SI',tamaño_envio:'Grande',proveedor:'B',thumbnail:'test.png',garantia:'1 año',descripcion:'Descripción guardada',created_at:new Date().toISOString()},
{id:'panel',nombre:'Panel prueba',precio:200,comision:50,categoria:'ENERGIA',disponible:'SI',tamaño_envio:'Pequeño',proveedor:'B',thumbnail:'test.png',descripcion:'Panel guardado'}];
const tariffs=[{municipio:'Playa',localidad:'Santa Fe',precio_pequeno:6,precio_grande:10}];
const clients=[{cliente:'Cliente propio',ci:'',telefono:'5350000000',direccion:'Dirección propia'}];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const actor of [profile,child]){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let disconnected=false;
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(actor=>{sessionStorage.setItem('pth_intro_vista','true');sessionStorage.setItem('pth_entry_logged','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_subgestor_onboarding_v1','true');if(!localStorage.getItem('pth_session')){localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));localStorage.setItem('pth_session',JSON.stringify({name:actor.nombre,isAdmin:false,data:actor}));}},actor);
 await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.hostname==='127.0.0.1'){
   const rel=url.pathname==='/'||url.pathname.startsWith('/producto/')?'index.html':url.pathname.slice(1);
   if(!/^(index\.html|log\.jpeg|js\/[\w./-]+\.(?:js|mjs)|css\/[\w.-]+\.css|icons\/[\w.-]+\.(?:svg|png))$/.test(rel)||!fs.existsSync(path.join(root,rel)))return route.fulfill({status:404,body:''});
   let body=fs.readFileSync(path.join(root,rel));
   if(rel==='index.html')body=String(body).replace('<head>','<head><base href="/">').replace(/<script src="js\/storefront\.min\.js[^>]*>/,'<link rel="stylesheet" href="/css/offline-storefront.css"><script src="/js/checkout-form-shared.js" defer></script><script src="/js/offline-checkout-copy.js" defer></script><script src="/js/offline-storefront-adapter.js" defer></script><script src="/js/storefront.js" defer>');
   return route.fulfill({body,contentType:rel.endsWith('.html')?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript':rel.endsWith('.css')?'text/css':'image/png'});
 }
 if(disconnected)return route.abort();
 if(url.pathname==='/functions/v1/secure-data'){
   const input=req.postDataJSON();let data=[];
   if(input.action==='session')data={profile:actor,expiresAt:new Date(Date.now()+3600000).toISOString()};
   if(input.action==='announcement')data={acknowledged:true};
   if(input.action==='query'){
     if(input.table==='productos')data=products;
     if(input.table==='gestores')data=[profile,child];
     for(const f of input.filters||[])if(f.method==='eq')data=data.filter(row=>row[f.column]===f.value);
     if(input.single)data=data[0]||null;
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null,count:0})});
 }
 if(url.pathname.startsWith('/rest/v1/')){
   let data=[];if(url.pathname.endsWith('/tarifas_mensajeria'))data=tariffs;if(url.pathname.endsWith('/categorias'))data=[{nombre:'NEVERAS'},{nombre:'ENERGIA'}];
   if(url.pathname.endsWith('/control_sistema'))data={valor:'2026-10-02'};
   return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
 }
 if(req.resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});
 if(req.resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;max-width:1em;overflow:hidden}'});
 return route.fulfill({contentType:'application/json',body:'{"success":false}'});
 });
 await page.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);
 await page.evaluate(async({products,clients,tariffs,actor})=>{const copy=PTHOfflineCheckoutCopy.create(indexedDB);await copy.save(actor.id,{products,clients,tariffs},{consent:true,profile:actor,sessionUntil:PTHSecureData.expiresAt()});},{products,clients,tariffs,actor});
 disconnected=true;await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PTHOfflineStorefront?.usingCopy());assert.equal(await page.evaluate(()=>navigator.onLine),true,'real server failure also uses saved copy');await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PTHOfflineStorefront?.usingCopy()&&typeof productosRaw!=='undefined'&&productosRaw.length===2);
 assert.equal(new URL(page.url()).pathname,'/');assert.match(await page.locator('#pth-offline-storefront-status').innerText(),/Sin conexión.*Datos guardados/);
 assert.equal(await page.evaluate(()=>PTHSecureData.accountId()),actor.id);
 await page.waitForFunction(()=>document.querySelectorAll('#productos-container article').length===2);
 assert.match(await page.locator('#productos-container').innerText(),/Disponible al conectar/);assert.equal(await page.locator('#sec-dashboard').isVisible(),false);
 await page.evaluate(()=>filterByCategory('ENERGIA'));assert.deepEqual(await page.locator('#productos-container article h3').allTextContents(),['Panel prueba']);
 await page.evaluate(()=>filterByCategory('TODOS'));await page.locator('#search-bar').fill('Nevera');await page.evaluate(()=>filterProducts());assert.equal(await page.locator('#productos-container article').count(),1);
 await page.locator('#productos-container a').filter({hasText:'Ver información completa'}).click();
 assert.equal(await page.locator('#detail-name').innerText(),'Nevera prueba');assert.match(await page.locator('#detail-desc').innerText(),/Descripción guardada/);assert.match(await page.locator('#admin-comm-badge').innerText(),/Disponible al conectar/i);
 assert.match(new URL(page.url()).pathname,/^\/producto\//);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('detail-name')?.textContent==='Nevera prueba'&&!document.getElementById('detail-modal').classList.contains('hidden'));
 await page.evaluate(()=>{closeDetail();addProductFromCard('Nevera prueba');});
 await page.waitForFunction(()=>document.querySelectorAll('#crm-datalist option').length===1);
 await page.locator('#crm-search').fill('Cliente propio | 5350000000');await page.locator('#crm-search').dispatchEvent('change');assert.equal(await page.locator('#check-nombre').inputValue(),'Cliente propio');assert.equal(await page.locator('#check-dir').inputValue(),'Dirección propia');
 await page.locator('#check-municipio').selectOption('Playa');await page.locator('#check-localidad').selectOption('Santa Fe');assert.match(await page.locator('#resumen-envio').innerText(),/10/);assert.match(await page.locator('#total-convertido').innerText(),/530/);
 // Unknown delivery remains an incomplete choice, never an invented municipality.
 assert.equal(await page.locator('#check-municipio option').count(),2);assert.equal(await page.evaluate(()=>PTHOfflineStorefront.current().products.some(p=>Object.hasOwn(p,'comision'))),false);
 await page.evaluate(()=>{PTHSecureData.clearSession();});await page.waitForFunction(()=>!window.PTHOfflineStorefront?.usingCopy());assert.equal(await page.locator('#crm-datalist option').count(),0);assert.equal(await page.locator('#productos-container article').count(),0);assert.equal(await page.locator('#cart-modal').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS '+(actor.parent_id?'child':'principal')+': same normal URL offline/reopen/deep detail, categories/search/cart, own CRM, saved delivery $10/total$530, logout clears private display');
 await context.close();
 }
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
