// Actual generated pages + actual storefront action functions in a local component fixture.
// Every external request is blocked; no production, orders or credentials are used.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),id='12345678-1234-4234-8234-123456789abc';
const src=fs.readFileSync(path.join(root,'js/storefront.js'),'utf8');
const actionStart=src.indexOf('let productLinkActionConsumed = false;'),addStart=src.indexOf('   function addItemToCart(');
const actionSource=src.slice(actionStart,src.indexOf('function consultSelectedProduct()',actionStart));
const addSource=src.slice(addStart,src.indexOf('// --- AÑADE ESTA FUNCIÓN',addStart));
const home=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><script src="/js/affiliate-links.js"></script>
<p>LOCAL COMPONENT FIXTURE · NO REAL ORDER</p><span id="cart-count"></span><h1 id="detail-name"></h1><button id="detail-client-consult">Consultar</button><section id="fixture-cart" hidden>Confirma tu pedido antes de enviarlo</section><input id="crm-search">
<script>
let cart=JSON.parse(localStorage.getItem('fixture-cart')||'[]'),selectedProduct,calls=[];
const params=new URLSearchParams(location.search), name=params.get('search')||'Equipo';
const product={nombre:name,precio:100,disponible:'SI',categoria:'ENERGIA',mensajeria:'3'};
const incoming=PTHAffiliate.incoming();if(incoming)PTHAffiliate.remember(incoming);
function isProductCurrentlyAvailable(p){return p.disponible==='SI'}
function openDetail(){selectedProduct=product;document.getElementById('detail-name').textContent=name;calls.push('detail');history.replaceState(null,'','/')}
function closeDetail(){calls.push('close')}
function toggleCartModal(){calls.push('cart');document.getElementById('fixture-cart').hidden=false;localStorage.setItem('fixture-cart',JSON.stringify(cart))}
function captureGhostLead(){calls.push('FORBIDDEN-write')}
window.PTHAnalytics={event(){calls.push('FORBIDDEN-event')}};
${actionSource}
${addSource}
openSharedProduct(product,params);
window.fixtureReady=true;
</script>`;
(async()=>{
 const requests=[],server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');requests.push({path:url.pathname,method:req.method});
  if(url.pathname==='/'||url.pathname==='/index.html'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(home);}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  let body=fs.readFileSync(file);
  // Redirect only production CTA endpoint plumbing to this local component fixture.
  if(file.endsWith('.html'))body=Buffer.from(String(body).split('https://paratuhogar.org/?search=').join(origin+'/?search='));
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'});res.end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
   const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   await page.goto(origin+'/categoria/energia/?ref='+id+'&contact=5350000000',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.PTHSeoAffiliate);await page.evaluate(()=>PTHSeoAffiliate.ready);
   assert.equal(await page.evaluate(()=>PTHAffiliate.read().id),id);assert.equal(await page.evaluate(()=>PTHAffiliate.read().expiresAt),null);
   assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://paratuhogar.org/categoria/energia/');
   const productLink=await page.locator('.card a').first().getAttribute('href');assert.equal(new URL(productLink).searchParams.get('ref'),id);
   await page.locator('.card a').first().click();await page.waitForFunction(()=>window.PTHSeoAffiliate);await page.evaluate(()=>PTHSeoAffiliate.ready);
   assert.ok(await page.locator('h1').innerText());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const consult=await page.locator('[data-action=consultar]').getAttribute('href'),order=await page.locator('[data-action=pedir]').getAttribute('href');
   await page.locator('[data-action=consultar]').click();await page.waitForFunction(()=>window.fixtureReady);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'detail-client-consult');assert.deepEqual(await page.evaluate(()=>calls),['detail']);
   assert.equal(await page.evaluate(()=>cart.length),0);assert.equal(context.pages().length,1,'consultation cannot auto-open WhatsApp');
   await page.goto(order,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixtureReady);
   assert.equal(await page.evaluate(()=>cart[0].qty),1);assert.equal(await page.locator('#fixture-cart').isVisible(),true);assert.deepEqual(await page.evaluate(()=>calls),['detail','close','cart']);
   await page.goto(order,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixtureReady);assert.equal(await page.evaluate(()=>cart[0].qty),1,'repeated link does not increment quantity');
   await page.goto(origin+'/categoria/cocina/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PTHSeoAffiliate);await page.evaluate(()=>PTHSeoAffiliate.ready);
   assert.equal(await page.evaluate(()=>PTHAffiliate.read().id),id,'ordinary category navigation retains referral');
   await page.evaluate(()=>PTHAffiliate.clear());await page.locator('.card a').first().click();await page.waitForFunction(()=>window.PTHSeoAffiliate);
   assert.equal(await page.evaluate(()=>PTHAffiliate.read()),null,'explicit removal stays removed');
   assert.equal(errors.length,0,errors.join(' | '));await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.addInitScript(()=>{localStorage.setItem('pth_referrer_smart',JSON.stringify({nombre:'Old synthetic',expiresAt:1}));localStorage.setItem('pth_referrer',JSON.stringify({nombre:'Older synthetic'}));});
  await page.goto(origin+'/categoria/energia/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PTHSeoAffiliate);
  assert.equal(await page.evaluate(()=>PTHAffiliate.read()),null);assert.equal(new URL(await page.locator('.card a').first().getAttribute('href')).search,'');
  await page.goto(origin+'/?search=Equipo&accion=execute-code',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixtureReady);assert.equal(await page.evaluate(()=>cart.length),0);await context.close();
  assert.ok(requests.every(r=>r.method==='GET'&&!/functions\/v1|rest\/v1/.test(r.path)));
  console.log('PASS generated category/product navigation at390/1280, UUID/contact, canonical, direct visits, removal/expiration, consultation focus, local order preparation, repeated link, invalid action; no API writes/external traffic.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
