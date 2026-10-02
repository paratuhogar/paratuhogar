// Full storefront with synthetic data and controlled resources. No production traffic.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const baseline=process.env.PTH_STARTUP_BASELINE;
const baselineHtml=baseline?fs.readFileSync(baseline,'utf8'):null;
const products=Array.from({length:30},(_,i)=>({id:'p'+i,nombre:'Nevera prueba '+String(i).padStart(2,'0'),precio:1000+i,comision:50,categoria:i<15?'NEVERAS':'ENERGIA',disponible:'SI',precio_flexible:'NO',thumbnail:'test.png',created_at:'2026-09-25',garantia:'1 año'}));
const parent={id:'11111111-1111-4111-8111-111111111111',nombre:'Gestor Prueba',rol:'gestor',estado:'activo',telefono:'5350000000',password:'__session__'};
const child={...parent,id:'22222222-2222-4222-8222-222222222222',nombre:'Sub Prueba',parent_id:parent.id,parent_nombre:parent.nombre};
const admin={...parent,id:'44444444-4444-4444-8444-444444444444',rol:'admin'};
const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'v1'}:[];if(single&&Array.isArray(data))data=null;return Promise.resolve({data,error:null,count:0}).then(ok,no)}};for(const name of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[name]=()=>q;for(const name of ['single','maybeSingle'])q[name]=()=>{single=true;return q};return q;},rpc(){return Promise.resolve({data:[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};`;
(async()=>{const {validateQuery}=await import('../supabase/functions/secure-data/handler.mjs');const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const role of (baseline?['visitor']:['visitor','gestor','subgestor','admin'])){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const requests=[],errors=[],secureRequests=[];let navigations=0,heroFinished=false,productsAfterHero,failSalesTools=true;const profile=role==='subgestor'?child:role==='admin'?admin:parent;
 page.on('pageerror',e=>errors.push(e.stack));page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 await page.addInitScript(({role,profile})=>{sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_subgestor_onboarding_v1','true');if(role!=='visitor'){localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},{role,profile});
 await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());requests.push(url.href);
 if(url.pathname==='/functions/v1/secure-data'){
 const b=req.postDataJSON();secureRequests.push(b);let data=[];
 if(b.action==='session')data={profile};
 if(b.action==='login')data={token:'a'.repeat(64),profile:parent};
 else if(b.action==='announcement')data={acknowledged:true};
 else if(b.action==='query'){
  try{validateQuery(b,req.headers().authorization?profile:null);}catch(e){return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({data:null,error:{message:e.message}})});}
  if(b.table==='productos'){productsAfterHero=heroFinished;}
  if(b.table==='productos')data=products.map(p=>({...p,comision:!req.headers().authorization?0:role==='subgestor'?15:50}));
  if(b.table==='productos'&&b.columns==='id, descripcion')data=data.map(product=>({...product,descripcion:'Descripción de prueba'}));
  if(b.table==='gestores')data=[parent,child,admin,{...parent,id:'33333333-3333-4333-8333-333333333333'}];
  if(b.table==='precios_personalizados')data=role==='subgestor'?products.map(p=>({gestor:parent.nombre,producto_id:p.id,nuevo_precio:p.precio,comision_subgestor:15,visible_subgestor:true})):[];
  for(const f of b.filters||[])if(f.method==='eq')data=data.filter(r=>r[f.column]===f.value);
  if(b.single){if(data.length>1){return route.fulfill({status:406,contentType:'application/json',body:JSON.stringify({data:null,error:{code:'PGRST116',message:'La consulta no devolvió un único registro.'}})});}data=data[0]||null;}
 }
 return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'},body:JSON.stringify({data,error:null,count:0})});
 }
 if(url.hostname==='127.0.0.1'){
 let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(!/^(index\.html|catalog-maker\.html|feedback\.html|log\.jpeg|js\/[\w.-]+\.(?:js|mjs)|css\/[\w.-]+\.css|assets\/fonts\/Manrope\.ttf|icons\/[\w.-]+\.(?:svg|png))$/.test(rel))return route.fulfill({status:404,body:''});
 if(rel==='js/sales-tools.min.js'&&failSalesTools){failSalesTools=false;return route.abort();}
 const file=path.join(root,rel);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:rel==='index.html'&&baselineHtml?baselineHtml:fs.readFileSync(file),contentType:rel.endsWith('.html')?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript; charset=utf-8':rel.endsWith('.css')?'text/css':rel.endsWith('.ttf')?'font/ttf':'image/jpeg'});
 }
 if(url.hostname==='cdn.tailwindcss.com')return route.fulfill({contentType:'application/javascript',body:'window.tailwind={config:{}};'});
 if(url.hostname==='images.unsplash.com'){await new Promise(r=>setTimeout(r,1000));heroFinished=true;}
 if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:sdk});
 if(req.resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;width:1em;overflow:hidden;white-space:nowrap}'});
 if(req.resourceType()==='image')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64')});
 if(req.resourceType()==='script')return route.fulfill({contentType:'application/javascript',body:''});
 return route.fulfill({contentType:'application/json',body:'{"success":false}'});
 });
 await page.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
 if(role==='admin'){await page.waitForFunction(()=>window.currentUserData?.rol==='admin');await page.evaluate(()=>PTHWorkView.switchView('gestor'));}
 try{await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===30,{},{timeout:12000});}catch(e){throw Error(role+': '+errors.join(' | ')+' '+await page.locator('#productos-container').innerText());}
 if(baseline){assert.equal(navigations,2);assert.equal(productsAfterHero,true);console.log('BASELINE controlled fixture: 2 navigations; catalogue waits for delayed hero image');await context.close();continue;}
 assert.equal(productsAfterHero,false,'catalogue must start without waiting for hero');
 assert.equal(navigations,1,'root must not reload');assert.equal(new URL(page.url()).search,'');
 assert.equal(await page.locator('#splash-screen').count(),0);
 assert.equal(requests.some(u=>u.includes('/sales-tools')),false,'sales code is deferred until an explicit click');
 assert.equal(requests.some(u=>/cdn.tailwindcss|quilljs|chart\.js|sheetjs|jszip|jspdf/.test(u)),false,'no runtime CSS or heavy tools during startup');
 if(role!=='visitor')await page.evaluate(()=>showSection('catalogo'));
 await page.waitForFunction(()=>document.querySelectorAll('#productos-container article').length===24);
 await page.evaluate(()=>loadMoreCatalogProducts());assert.equal(await page.locator('#productos-container article').count(),30);
 // Catalogue pagination keeps active sorting even when source names disagree with prices.
 await page.evaluate(()=>{window.catalogueBeforePaginationTest=productosRaw;productosRaw=Array.from({length:86},(_,i)=>({id:'sort'+i,nombre:'Equipo '+String(85-i).padStart(2,'0'),precio:17+i,comision:15,categoria:i%2?'COCINA':'HOGAR',disponible:'SI',thumbnail:'test.png',garantia:'1 mes'})).sort((a,b)=>a.nombre.localeCompare(b.nombre));activeCategory='TODOS';document.getElementById('search-bar').value='';document.getElementById(isGestorCatalogMode()?'sort-selector':'sort-selector-public').value='precio_asc';renderProducts();});
 const catalogueNames=()=>page.locator('#productos-container article h3').allTextContents();
 const firstSorted=await catalogueNames();assert.equal(firstSorted.length,24);assert.deepEqual(firstSorted.slice(0,4),['Equipo 85','Equipo 84','Equipo 83','Equipo 82']);
 if(role!=='visitor')await page.evaluate(()=>showSection('catalogo'));
 await page.locator('#productos-container button').filter({hasText:'Cargar más productos'}).click();
 const nextSorted=await catalogueNames();assert.equal(nextSorted.length,48);assert.deepEqual(nextSorted.slice(0,24),firstSorted);
 await page.evaluate(()=>{document.getElementById('search-bar').value='no-matching-product';activeCategory='COCINA';document.getElementById('filter-high-comm').checked=true;renderProducts();});
 await page.locator('#productos-container button').filter({hasText:'Ver todos los disponibles'}).click();assert.equal(await page.locator('#productos-container article').count(),24);
 assert.deepEqual(await page.evaluate(()=>({search:document.getElementById('search-bar').value,category:activeCategory,commission:document.getElementById('filter-high-comm').checked,sort:document.getElementById(isGestorCatalogMode()?'sort-selector':'sort-selector-public').value})),{search:'',category:'TODOS',commission:false,sort:'precio_asc'});
 await page.evaluate(()=>{productosRaw=window.catalogueBeforePaginationTest;delete window.catalogueBeforePaginationTest;renderProducts();});
 await page.evaluate(()=>filterByCategory('NEVERAS'));assert.equal(await page.locator('#productos-container article').count(),15);
 await page.evaluate(()=>{filterByCategory('TODOS');document.getElementById('search-bar').value='prueba 01';renderProducts();});assert.equal(await page.locator('#productos-container article').count(),1);
 await page.evaluate(()=>addProductFromCard('Nevera prueba 01'));assert.equal(await page.evaluate(()=>cart.length),1);
 assert.equal(await page.evaluate(()=>Number(productosRaw[0].comision)),role==='visitor'?0:role==='subgestor'?15:50);
 if(role!=='visitor')assert.equal(await page.locator('#work-feedback-link').getAttribute('href'),'feedback.html');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+15),'no overflow beyond existing 15px carousel margin');
 if(role==='visitor'){
  await page.goto('http://127.0.0.1:8080/?ref=Gestor%20Prueba&contact=5350000000',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===30);
  assert.equal(new URL(page.url()).searchParams.get('ref'),'Gestor Prueba');assert.equal(new URL(page.url()).searchParams.has('v'),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pth_referrer_smart')).nombre),'Gestor Prueba');
  // Real mobile checkout entrypoint; every request is intercepted with synthetic data.
  await page.evaluate(async()=>{
   window.checkoutIdentityAlerts=[];window.alert=message=>checkoutIdentityAlerts.push(message);
   cart=[{...productosRaw[1],qty:1}];
   document.getElementById('check-recogida').checked=true;
   document.getElementById('check-nombre').value='Synthetic Customer';document.getElementById('check-tel').value='5350000000';
   await document.getElementById('checkout-form').onsubmit({preventDefault(){}});
   window.firstIdentityToken=sessionStorage.getItem('pth_checkout_submission_token');
   await document.getElementById('checkout-form').onsubmit({preventDefault(){}});
  });
  assert.deepEqual(await page.evaluate(()=>checkoutIdentityAlerts),Array(2).fill('El enlace de atención necesita revisión. Pide al contacto que te lo envió que lo revise antes de confirmar. Tus datos siguen en esta pantalla.'));
  assert.equal(await page.locator('#final-submit-btn').isEnabled(),true);
  assert.equal(await page.evaluate(()=>cart.length),1);assert.equal(await page.locator('#check-nombre').inputValue(),'Synthetic Customer');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pth_checkout_submission_token')===firstIdentityToken),true);
  assert.equal(secureRequests.some(body=>['pedidos','pedidos_subgestores'].includes(body.table)&&body.op==='insert'),false);
  assert.equal(context.pages().length,1,'ambiguous identity never opens WhatsApp');
  await page.evaluate(()=>{document.getElementById('log-user').value='synthetic-test-user';document.getElementById('log-pass').value='synthetic-test-only';return processLogin();});
  await page.waitForFunction(()=>window.currentUserData?.nombre==='Gestor Prueba'&&Number(productosRaw[0]?.comision)===50);
 }
 if(role!=='visitor'){
  await page.evaluate(()=>{toggleCartModal(false);openDetail('Nevera prueba 01');});
  assert.match(new URL(page.url()).pathname,/^\/producto\//,'test Stories after opening the actual product detail');
  const storyAlerts=[];page.on('dialog',async dialog=>{storyAlerts.push(dialog.message());await dialog.dismiss();});
  await page.locator('#btn-story-maker').click();
  await page.waitForFunction(()=>document.querySelector('dialog [data-count]')?.textContent.includes('1 seleccionados'));
  await page.waitForFunction(()=>{const canvas=document.querySelector('dialog [data-preview] canvas');return canvas?.width===1080&&canvas?.height===1920&&document.fonts.check('16px PTHManrope');});
  assert.equal(await page.locator('dialog [data-preview] canvas').getAttribute('aria-label'),'Vista previa: Nevera prueba 01');
  assert.ok(requests.some(u=>new URL(u).pathname==='/assets/fonts/Manrope.ttf'),'real Story font loads successfully');
  assert.equal(requests.some(u=>/\/producto\/.*\/(?:js|css|assets)\//.test(new URL(u).pathname)),false,'tools and fonts must load from the root');
  assert.deepEqual(storyAlerts,[],'product Story opens without an asset-load alert');
  await page.locator('dialog [data-select-results]').click();
  assert.match(await page.locator('dialog [data-count]').textContent(),/30 seleccionados/);
  await page.locator('dialog [data-close]').click();
  assert.equal(await page.locator('dialog').count(),0,'real storefront Stories entrypoint closes cleanly');
  await page.evaluate(()=>closeDetail());
  await page.evaluate(()=>showSection('catalogo'));
  // A failed download unlocks retry; double taps request/open the composer once.
  await page.locator('#btn-copy-bulk').click();
  await page.waitForFunction(()=>document.getElementById('btn-copy-bulk').disabled===false);
  assert.equal(await page.locator('#sales-composer-modal').count(),0);
  assert.ok(storyAlerts.some(message=>message.includes('No se pudo abrir la herramienta')));
  await page.evaluate(()=>Promise.all([copyCategoryOffers(),copyCategoryOffers()]));
  assert.equal(requests.filter(u=>u.includes('/sales-tools.min.js')).length,2,'one failed request and one successful retry');
  assert.equal(await page.locator('#sales-composer-modal').count(),1);
  assert.match(await page.locator('#sales-composer-preview').inputValue(),/Nevera prueba 01/);
  assert.equal(await page.locator('#btn-copy-bulk').isEnabled(),true);
  await page.evaluate(()=>{window.syntheticShares=[];window.open=(url)=>{syntheticShares.push(url);return null;};});
  await page.locator('#sales-composer-modal button').filter({hasText:'WhatsApp'}).click();
  assert.match(await page.evaluate(()=>syntheticShares[0]),/^https:\/\/wa.me\//);
  await page.evaluate(()=>closeSalesComposer());
  await page.locator('#btn-pdf-bulk').click();
  await page.waitForURL('**/catalog-maker.html?v=20261002-catalog1',{waitUntil:'domcontentloaded'});
  assert.equal(context.pages().length,1,'PDF opens without relying on a delayed popup');
  assert.equal(await page.locator('#product-selector-list input').count(),1);
  const exportData=await page.evaluate(()=>JSON.parse(localStorage.getItem('pth_catalog_data')));
  assert.equal(exportData.ownerId,profile.id);assert.equal(exportData.products[0].nombre,'Nevera prueba 01');
  assert.equal(Number(exportData.products[0].precio),1001);
  assert.equal(exportData.products.some(product=>Object.hasOwn(product,'comision')||Object.hasOwn(product,'costo_proveedor')),false);
 }
 assert.deepEqual(errors,[],'unexpected runtime errors');
 console.log(`PASS ${role}: one navigation, no heavy startup tools, 24/30 pagination, filters/search/cart, own pricing, feedback link, mobile${role!=='visitor'?', actual product-detail Story preview and same-tab PDF with selected product':''}`);
 await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
