const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ref='12345678-1234-4234-8234-123456789abc',contact='5350000000';
const routes=['/categoria/energia/','/categoria/mundo-frio/','/categoria/energia/que-revisar-antes-de-elegir/','/categoria/mundo-frio/como-comparar-equipos/','/categoria/mundo-frio/antes-de-confirmar-el-pedido/'];
(async()=>{
 const requests=[],server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');requests.push({method:req.method,path:url.pathname});
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':'application/octet-stream'});res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   for(const route of routes){
    await page.goto(origin+route+'?ref='+ref+'&contact='+contact,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.PTHSeoAffiliate);await page.evaluate(()=>PTHSeoAffiliate.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow ${route}`);
    assert.equal(await page.evaluate(()=>PTHAffiliate.read().id),ref);
    assert.equal(await page.evaluate(()=>PTHAffiliate.read().telefono),contact);
    for(const href of await page.locator('.editorial a,.editorial-links a,.guide-links a,.crumbs a').evaluateAll(links=>links.map(link=>link.href))){
     const url=new URL(href);assert.equal(url.origin,origin);assert.equal(url.searchParams.get('ref'),ref);assert.equal(url.searchParams.get('contact'),contact);
     assert.ok(fs.existsSync(path.join(root,url.pathname,'index.html'))||url.pathname==='/',`broken local link: ${url.pathname}`);
    }
   }
   await page.goto(origin+routes[0],{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.PTHSeoAffiliate);
   await page.locator('.editorial-card a').first().click();await page.waitForFunction(()=>window.PTHSeoAffiliate);
   assert.ok(page.url().includes('que-revisar-antes-de-elegir'));assert.equal(await page.evaluate(()=>PTHAffiliate.read().id),ref);
   await page.locator('.crumbs a').nth(1).click();await page.waitForFunction(()=>window.PTHSeoAffiliate);
   assert.equal(new URL(page.url()).pathname,'/categoria/energia/');
   if(width===390)await page.screenshot({path:'/tmp/paratuhogar-editorial-mobile.png',fullPage:true});
   assert.deepEqual(errors,[]);await context.close();
  }
  assert.ok(requests.every(request=>request.method==='GET'&&!/rest\/v1|functions\/v1/.test(request.path)));
  console.log('PASS five draft pages at320/390/1280px, local links, UUID/contact preserved through nested guide/back navigation; no API writes or external traffic.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
