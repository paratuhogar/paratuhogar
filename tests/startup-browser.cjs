// Full storefront with synthetic data and controlled resources. No production traffic.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const baseline=process.env.PTH_STARTUP_BASELINE;
const baselineHtml=baseline?fs.readFileSync(baseline,'utf8'):null;
const products=Array.from({length:30},(_,i)=>({id:'p'+i,nombre:'Nevera prueba '+String(i).padStart(2,'0'),precio:1000+i,comision:50,categoria:i<15?'NEVERAS':'ENERGIA',disponible:'SI',precio_flexible:'NO',thumbnail:'test.png',created_at:'2026-09-25',garantia:'1 año'}));
const parent={id:'11111111-1111-4111-8111-111111111111',nombre:'Gestor Prueba',rol:'gestor',estado:'activo',telefono:'5350000000',password:'__session__'};
const child={...parent,id:'22222222-2222-4222-8222-222222222222',nombre:'Sub Prueba',parent_id:parent.id,parent_nombre:parent.nombre};
const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'v1'}:[];if(single&&Array.isArray(data))data=null;return Promise.resolve({data,error:null,count:0}).then(ok,no)}};for(const name of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[name]=()=>q;for(const name of ['single','maybeSingle'])q[name]=()=>{single=true;return q};return q;},rpc(){return Promise.resolve({data:[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};`;
(async()=>{const {validateQuery}=await import('../supabase/functions/secure-data/handler.mjs');const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const role of (baseline?['visitor']:['visitor','gestor','subgestor'])){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();const requests=[],errors=[];let navigations=0,heroFinished=false,productsAfterHero;const profile=role==='subgestor'?child:parent;
 page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 await page.addInitScript(({role,profile})=>{sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','1');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_subgestor_onboarding_v1','true');if(role!=='visitor'){localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},{role,profile});
 await page.route('**/*',async route=>{
 const req=route.request(),url=new URL(req.url());requests.push(url.href);
 if(url.pathname==='/functions/v1/secure-data'){
 const b=req.postDataJSON();let data=[];
 if(b.action==='session')data={profile};
 if(b.action==='login')data={token:'a'.repeat(64),profile:parent};
 else if(b.action==='announcement')data={acknowledged:true};
 else if(b.action==='query'){
  try{validateQuery(b,req.headers().authorization?profile:null);}catch(e){return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({data:null,error:{message:e.message}})});}
  if(b.table==='productos'){productsAfterHero=heroFinished;}
  if(b.table==='productos')data=products.map(p=>({...p,comision:!req.headers().authorization?0:role==='subgestor'?15:50}));
  if(b.table==='gestores')data=[parent,child];
  if(b.table==='precios_personalizados')data=role==='subgestor'?products.map(p=>({gestor:parent.nombre,producto_id:p.id,nuevo_precio:p.precio,comision_subgestor:15,visible_subgestor:true})):[];
  for(const f of b.filters||[])if(f.method==='eq')data=data.filter(r=>r[f.column]===f.value);
  if(b.single)data=data[0]||null;
 }
 return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'},body:JSON.stringify({data,error:null,count:0})});
 }
 if(url.hostname==='127.0.0.1'){
 let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(!/^(index\.html|feedback\.html|log\.jpeg|js\/[\w.-]+\.(?:js|mjs)|css\/[\w.-]+\.css|icons\/[\w.-]+\.(?:svg|png))$/.test(rel))return route.fulfill({status:404,body:''});
 const file=path.join(root,rel);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:rel==='index.html'&&baselineHtml?baselineHtml:fs.readFileSync(file),contentType:rel.endsWith('.html')?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript; charset=utf-8':rel.endsWith('.css')?'text/css':'image/jpeg'});
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
 try{await page.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===30,{},{timeout:12000});}catch(e){throw Error(role+': '+errors.join(' | ')+' '+await page.locator('#productos-container').innerText());}
 if(baseline){assert.equal(navigations,2);assert.equal(productsAfterHero,true);console.log('BASELINE controlled fixture: 2 navigations; catalogue waits for delayed hero image');await context.close();continue;}
 assert.equal(productsAfterHero,false,'catalogue must start without waiting for hero');
 assert.equal(navigations,1,'root must not reload');assert.equal(new URL(page.url()).search,'');
 assert.equal(await page.locator('#splash-screen').count(),0);
 assert.equal(requests.some(u=>/cdn.tailwindcss|quilljs|chart\.js|sheetjs|jszip|jspdf/.test(u)),false,'no runtime CSS or heavy tools during startup');
 if(role!=='visitor')await page.evaluate(()=>showSection('catalogo'));
 await page.waitForFunction(()=>document.querySelectorAll('#productos-container article').length===24);
 await page.evaluate(()=>loadMoreCatalogProducts());assert.equal(await page.locator('#productos-container article').count(),30);
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
  await page.evaluate(()=>{document.getElementById('log-user').value='synthetic-test-user';document.getElementById('log-pass').value='synthetic-test-only';return processLogin();});
  await page.waitForFunction(()=>window.currentUserData?.nombre==='Gestor Prueba'&&Number(productosRaw[0]?.comision)===50);
 }
 assert.deepEqual(errors,[],'unexpected runtime errors');
 console.log(`PASS ${role}: one navigation, no heavy startup tools, 24/30 pagination, filters/search/cart, own pricing, feedback link, mobile`);
 await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
