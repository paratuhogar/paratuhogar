// Actual SW, anonymous public reader and checkout; local HTTP and synthetic DB only.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=process.env.PTH_FIXTURE_ROOT||path.resolve(__dirname,'..');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx1sAAAAASUVORK5CYII=','base64');
(async()=>{
 const {fixture}=await import('./fixtures/new-checkout.mjs');let f=await fixture();
 const trace=[];let origin,dropSubmitResponse=false;
 const products=Array.from({length:430},(_,i)=>({id:'public-'+i,nombre:'Equipo público '+i,precio:100+i,categoria:i%2?'COCINA':'HOGAR',disponible:'SI',garantia:'1 año',thumbnail:'sample.jpg'}));
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,origin);trace.push({path:url.pathname,method:req.method});
  if(url.pathname==='/mock-secure-data'){
   let body='';for await(const data of req)body+=data;const b=JSON.parse(body);
   trace[trace.length-1].action=b.action;trace[trace.length-1].operation=b.operation;trace[trace.length-1].authorization=Boolean(req.headers.authorization);trace[trace.length-1].cookie=Boolean(req.headers.cookie);
   let result;
   if(b.action==='announcement')result={data:{acknowledged:true},error:null};
   else if(req.headers['x-public-fixture']==='yes')result={data:products,error:null};
   else result=await f.request(b,req.headers.authorization?.replace(/^Bearer /,'')||null);
   if(b.action==='checkout'&&b.operation==='submit'&&dropSubmitResponse){res.destroy();return;}
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
 const browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const sdk=`window.supabase={createClient(){return {from(table){let single=false;const q={then(ok,no){let data=table==='control_sistema'?{valor:'fixture-v1'}:table==='tarifas_mensajeria'?[{municipio:'Centro Habana',localidad:'Centro',precio_pequeno:6,precio_grande:10}]:[];return Promise.resolve({data:single?Array.isArray(data)?data[0]||null:data:data,error:null,count:0}).then(ok,no)}};for(const n of ['select','eq','neq','gt','gte','lt','lte','order','limit','range','in','is','not','or','insert','update','delete','upsert'])q[n]=()=>q;for(const n of ['single','maybeSingle'])q[n]=()=>{single=true;return q};return q;},rpc(name,p){return Promise.resolve({data:name==='reservar_consecutivo_pedido'?p.p_proveedor+String(++window.fixtureSequence):[],error:null})},channel(){const q={on:()=>q,subscribe:()=>q};return q;},removeChannel(){}}}};window.fixtureSequence=0;`;
  async function context(){
    const c=await browser.newContext({viewport:{width:Number(process.env.PTH_PENDING_WIDTH)||390,height:844},colorScheme:process.env.PTH_PENDING_DARK?'dark':'light'}),errors=[];
    c.on('page',p=>p.on('pageerror',e=>{errors.push(e.stack||e.message);console.error('PAGE',e.stack||e.message);}));
    await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/js/vendor/supabase-2.57.4.js')return route.fulfill({contentType:'application/javascript',body:sdk});if(url.origin===origin)return route.continue();if(url.href.includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:sdk});if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:'.material-symbols-outlined{display:inline-block;width:1em;overflow:hidden}'});if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/png',body:png});return route.fulfill({contentType:'application/json',body:'{"data":[],"error":null}'});});
    await c.addInitScript(profile=>{if(window.top!==window||!/^http:\/\/(127\.0\.0\.1|localhost)/.test(location.href))return;if(!localStorage.getItem('fixture-initialized')){localStorage.setItem('fixture-initialized','true');sessionStorage.setItem('pth_intro_vista','true');localStorage.setItem('pth_last_seen_level','0');localStorage.setItem('info_precios_v1','true');localStorage.setItem('sl_tutorial_completed_v1','true');localStorage.setItem('pth_data_saving_v1','on');localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:profile.nombre,isAdmin:false,data:profile}));}},f.rows.gestores[0]);
    return {c,errors};
  }
  async function main(c,defaultDashboard=false){const p=await c.newPage();await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);await p.evaluate(dashboard=>{document.getElementById('feedback-announcement')?.remove();if(!dashboard)showSection('catalogo');window.checkoutAlerts=[];window.alert=message=>checkoutAlerts.push(message);window.confirm=()=>true;obtenerDuenoReal=async()=> 'Shared Seller';},defaultDashboard);if(defaultDashboard)await p.locator('#sec-dashboard').waitFor({state:'visible'});return p;}
  async function row(p,account='actor-a'){return p.evaluate(async account=>PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB)).read(account),account);}
  async function waitState(p,state){const deadline=Date.now()+45000;while(Date.now()<deadline){const current=await row(p);if(current?.state===state)return;await p.waitForTimeout(200);}const current=await row(p);throw Error('Expected '+state+', got '+current?.state+' code='+current?.code+' message='+current?.message);}
  async function fillCart(p){await p.evaluate(()=>{addProductFromCard('Equipo A');addProductFromCard('Equipo B');toggleCartModal(true);document.getElementById('check-recogida').checked=true;toggleRecogidaEnAlmacen();document.getElementById('check-nombre').value='Synthetic Customer';document.getElementById('check-tel').value='synthetic-phone';document.getElementById('check-ci').value='00123456789';document.getElementById('check-notas').value='<script>untrusted submitted text</script>';});}


  for(const width of [390,1280]) {
    f=await fixture();const {c,errors}=await context();let p=await main(c);await p.setViewportSize({width,height:844});await fillCart(p);
    const baseline=process.env.PTH_REPRO_BASELINE==='1';
    await p.evaluate(baseline=>{
      if(!baseline){const wait=PTHCheckoutSubmitGuard.waitForCheckout;PTHCheckoutSubmitGuard.waitForCheckout=value=>wait(value,150);}
      const original=supabaseClient.from.bind(supabaseClient);window.originalFrom=original;
      supabaseClient.from=table=>{if(table!=='blacklist')return original(table);const q={then:resolve=>{window.releaseRisk=()=>resolve({data:[],error:null});}};for(const key of ['select','in','limit'])q[key]=()=>q;return q;};
      window.submitDone=false;document.getElementById('checkout-form').onsubmit({preventDefault(){}}).then(()=>window.submitDone=true);
    },baseline);
    await p.waitForFunction(()=>typeof releaseRisk==='function');
    if(baseline){await p.waitForTimeout(400);assert.equal(await p.evaluate(()=>submitDone),false);assert.equal(await p.locator('#final-submit-btn').innerText(),'PROCESANDO...');assert.equal(f.writes,0);console.log('REPRO baseline: unresolved risk read leaves PROCESANDO and active lock',width);await c.close();continue;}
    await p.waitForFunction(()=>submitDone);assert.equal(await p.locator('#final-submit-btn').isDisabled(),false);assert.equal(f.writes,0);
    await p.evaluate(()=>{supabaseClient.from=originalFrom;releaseRisk();});
    await p.waitForTimeout(100);assert.equal(f.writes,0,'late read cannot resume timed-out checkout');
    // Server accepts but response never reaches the caller. Recovery uses saved attempt.
    await p.evaluate(()=>{const original=PTHSecureData.checkout.bind(PTHSecureData);window.checkoutOriginal=original;PTHSecureData.checkout=async value=>{const result=await original(value);if(value.operation==='submit'){window.lateSubmit=()=>result;return new Promise(resolve=>{window.resolveSubmit=()=>resolve(result);});}return result;};});
    await p.evaluate(()=>document.getElementById('checkout-form').onsubmit({preventDefault(){}}));
    assert.equal(f.writes,1);assert.ok(await p.evaluate(()=>readNewCheckoutOutcome()?.attempt));assert.equal(await p.locator('#final-submit-btn').isDisabled(),false);
    assert.equal(await p.locator('#pth-checkout-confirmations').count(),0);
    await p.evaluate(()=>{PTHSecureData.checkout=checkoutOriginal;});
    await p.evaluate(()=>document.getElementById('checkout-form').onsubmit({preventDefault(){}}));assert.equal(f.writes,1);assert.equal(await p.evaluate(()=>cart.length),0);
    await p.evaluate(()=>resolveSubmit());await p.waitForTimeout(100);assert.equal(f.writes,1);
    await p.evaluate(()=>{for(const reference of ['A-340','A-343'])PTHCheckoutConfirmation.show({owner:'actor-a',table:'pedidos',phone:'5356071095',receipts:[{reference}]});PTHCheckoutConfirmation.show({owner:'actor-a',table:'pedidos',phone:'5356071095',receipts:[{reference:'A-344'},{reference:'B-50'}]});});
    assert.equal(await p.locator('#pth-checkout-confirmations section').count(),1);assert.match(await p.locator('#pth-checkout-confirmations').innerText(),/A-344.*B-50/);
    await p.locator('#pth-checkout-confirmations').getByRole('button',{name:'Cerrar',exact:true}).click();assert.equal(await p.locator('#pth-checkout-confirmations').count(),0);
    await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof productosRaw!=='undefined'&&productosRaw.length===2);await p.evaluate(()=>PTHCheckoutConfirmation.restore());assert.equal(await p.locator('#pth-checkout-confirmations').count(),0);await p.screenshot({path:'/tmp/pth-checkout-'+width+'.png',fullPage:true});assert.deepEqual(errors,[]);await c.close();console.log('PASS recovery + latest receipts',width);
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
