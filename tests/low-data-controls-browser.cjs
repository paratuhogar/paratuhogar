// Actual app UI with synthetic data and intercepted local resources only.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const products=Array.from({length:30},(_,i)=>({id:'p'+i,nombre:'Nevera prueba '+String(i).padStart(2,'0'),precio:1000+i,comision:50,categoria:i<15?'NEVERAS':'ENERGIA',disponible:'SI',precio_flexible:'NO',thumbnail:'test.png',created_at:'2026-09-25',garantia:'1 año'}));
const parent={id:'11111111-1111-4111-8111-111111111111',nombre:'Gestor Prueba',rol:'gestor',estado:'activo',telefono:'5350000000',password:'__session__'};
const child={...parent,id:'22222222-2222-4222-8222-222222222222',nombre:'Sub Prueba',parent_id:parent.id,parent_nombre:parent.nombre};
const admin={...parent,id:'44444444-4444-4444-8444-444444444444',rol:'admin'};
const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'v1'}:[];if(single&&Array.isArray(data))data=null;return Promise.resolve({data,error:null,count:0}).then(ok,no)}};for(const name of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[name]=()=>q;for(const name of ['single','maybeSingle'])q[name]=()=>{single=true;return q};return q;},rpc(){return Promise.resolve({data:[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};`;

(async()=>{const {validateQuery}=await import('../supabase/functions/secure-data/handler.mjs');const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const role of ['visitor','gestor'])for(const width of [320,390,1280])for(const dark of [false,true]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();
 const requests=[],errors=[],secureRequests=[],profile=parent;let heroFinished=false,productsAfterHero,failSalesTools=false;
 page.on('pageerror',e=>errors.push(e.stack));
 await context.addInitScript(({role,profile})=>{sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_subgestor_onboarding_v1','true');if(localStorage.getItem('pth_data_saving_v1')===null)localStorage.setItem('pth_data_saving_v1','on');if(role!=='visitor'){localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},{role,profile});
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
 if(!/^(index\.html|catalog-maker\.html|feedback\.html|offline-catalog\.html|offline\.html|log\.jpeg|js\/[\w.-]+\.(?:js|mjs)|css\/[\w.-]+\.css|assets\/fonts\/Manrope\.ttf|icons\/[\w.-]+\.(?:svg|png))$/.test(rel))return route.fulfill({status:404,body:''});
 if(rel==='js/sales-tools.min.js'&&failSalesTools){failSalesTools=false;return route.abort();}
 const file=path.join(root,rel);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:fs.readFileSync(file),contentType:rel.endsWith('.html')?'text/html; charset=utf-8':/\.(js|mjs)$/.test(rel)?'application/javascript; charset=utf-8':rel.endsWith('.css')?'text/css':rel.endsWith('.ttf')?'font/ttf':'image/jpeg'});
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
 await page.waitForFunction(role=>typeof productosRaw!=='undefined'&&productosRaw.length===30&&productsLoadInProgress===false&&(role==='visitor'||window.currentUserData?.id),role);
 await page.waitForFunction(()=>lowConnectivity.readPublic()!==null&&publicCatalogueRefresh===null);
 await page.evaluate(dark=>{showSection('catalogo');document.documentElement.classList.toggle('dark',dark);document.getElementById('feedback-announcement')?.remove();},dark);
 const panel=page.locator('#pth-low-data-panel');await panel.scrollIntoViewIfNeeded();
 const toggle=page.getByRole('button',{name:'Ahorro de datos',exact:true}),copyLink=page.getByRole('link',{name:'Abrir catálogo guardado',exact:true});
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.match(await toggle.innerText(),/Desactivar ahorro/);
 assert.equal(await panel.locator('[role=status]').first().innerText(),'Activado');
 assert.equal(await page.locator('#productos-container img').count(),0);
 assert.equal(await page.locator('#productos-container .pth-photo-button').count(),24);
 await page.locator('#productos-container .pth-photo-button').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#productos-container img').length===1,{},{timeout:2000});
 assert.equal(await page.locator('#productos-container img').count(),1,'touching a photo loads only that photo');
 assert.equal(new URL(page.url()).pathname,'/','photo action must not follow the enclosing product link');
 assert.equal(await page.locator('#productos-container .pth-photo-button').count(),23);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>renderProducts());
 assert.equal(await page.locator('#productos-container img').count(),0);
 assert.match(await panel.locator('#pth-data-saving-description').innerText(),/solo se cargan al tocarlas/);
 assert.ok(await panel.locator('time').getAttribute('datetime'));
 const copyBefore=await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1'));
 await toggle.focus();await page.keyboard.press('Space');
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.match(await toggle.innerText(),/Activar ahorro/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pth_data_saving_v1')),'off');
 assert.equal(await page.locator('#productos-container img').count(),24,'disabling saving restores actual image loading');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'pth-data-saving-toggle');
 assert.equal(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),copyBefore,'toggling does not rewrite a dated public snapshot');
 await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>PTHDataSaving.enabled()),true);assert.equal(await page.locator('#productos-container img').count(),0);
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'pth-saved-catalog-link');
 const focusStyle=await copyLink.evaluate(el=>({style:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));
 assert.equal(focusStyle.style,'solid');assert.ok(parseFloat(focusStyle.width)>=3);
 for(const action of [toggle,copyLink]){const box=await action.boundingBox();assert.ok(box.height>=44);assert.ok(box.x>=0&&box.x+box.width<=width);}
 const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'panel fits the viewport');
 // Contrast for normal-size card copy and action text in both themes.
 for(const selector of ['.pth-data-saving-action','.pth-saved-catalog-action','.pth-data-saving-state']){
  const colors=await panel.locator(selector).evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
  const luminance=color=>{const values=color.match(/\d+(?:\.\d+)?/g).slice(0,3).map(v=>{const c=Number(v)/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;};
  const a=luminance(colors.fg),b=luminance(colors.bg);assert.ok((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)>=4.5,selector+' readable text contrast');
 }
 if(width===390&&role==='gestor')await panel.screenshot({path:'/tmp/pth-low-data-control-'+(dark?'dark':'mobile')+'.png'});
 if(width===1280&&role==='gestor'&&!dark)await panel.screenshot({path:'/tmp/pth-low-data-control-desktop.png'});
 // A stale date stays visible; no refresh, live-price promise, or order is triggered.
 const staleAt=await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('pth_offline_public_catalog_v1'));value.savedAt=Date.now()-3*60*60*1000;localStorage.setItem('pth_offline_public_catalog_v1',JSON.stringify(value));renderLowConnectivityPanel();return value.savedAt;});
 assert.match(await page.locator('#pth-saved-catalog-date').innerText(),/Pendiente de actualizar/);
 assert.equal(Date.parse(await panel.locator('time').getAttribute('datetime')),staleAt);
 assert.match(await panel.locator('#pth-saved-catalog-warning').innerText(),/Confírmalos con conexión/);
 assert.match(await panel.locator('#pth-saved-catalog-description').innerText(),/Consulta productos y precios de la última copia guardada aunque no tengas internet/);
 assert.match(await panel.locator('#pth-saved-catalog-warning').innerText(),/solo podrás abrir las fotos guardadas/);
 await page.evaluate(()=>{localStorage.removeItem('pth_offline_public_catalog_v1');renderLowConnectivityPanel();});
 assert.equal(await panel.locator('time').count(),0);assert.match(await page.locator('#pth-saved-catalog-date').innerText(),/Todavía no hay/);
 assert.match(await page.locator('#pth-saved-catalog-description').innerText(),/Actualizar copia pública/);
 // Storage refusal does not disable the in-tab choice or invent a saved copy.
 await page.evaluate(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='pth_offline_public_catalog_v1')throw Error('private mode');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='pth_data_saving_v1')throw Error('quota');return set.call(this,key,value);};window.restoreSyntheticStorage=()=>{Storage.prototype.getItem=get;Storage.prototype.setItem=set;};renderLowConnectivityPanel();});
 await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.equal(await panel.locator('time').count(),0);
 await page.evaluate(()=>restoreSyntheticStorage());
 await copyLink.click();await page.waitForURL('**/offline-catalog.html');
 assert.equal(await page.locator('#offline-refresh').innerText(),'Actualizar copia pública');
 await page.locator('#offline-refresh').click();await page.waitForFunction(()=>document.getElementById('offline-count').textContent.includes('30'));
 assert.ok(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),'link offers the real manual public-copy flow');
 assert.equal(secureRequests.some(b=>b.action==='checkout'||b.action==='rpc'&&b.name?.includes('solicitar_cobro')||b.op&&b.op!=='select'&&['pedidos','pedidos_subgestores','precios_personalizados'].includes(b.table)),false);
 assert.deepEqual(errors,[]);console.log(`PASS connection controls ${role} ${width}px ${dark?'dark':'light'}: actual image toggle, keyboard/focus, touch targets, contrast, copy/date/stale/missing/storage-refusal states, public-reader navigation and manual save, no business writes`);
 await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
