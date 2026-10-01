const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'js/image-variants.js'),'utf8'),ctx);
const [name,row]=Object.entries(ctx.window.PTH_IMAGE_VARIANTS).find(([,r])=>r.width360===360&&r.width720===720);
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const [width,dpr,mode,expected] of [[390,2,'grid',360],[1280,2,'grid',720],[390,2,'list',720]]){
 const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:dpr});let failVariant=false,failOriginal=false,originalRequests=0;
 await page.route('**/*',async route=>{const u=new URL(route.request().url());
 if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="card" style="width:260px;height:260px"></div>'});
 if(u.pathname==='/original/'+name){originalRequests++;return route.fulfill({status:failOriginal?404:200,contentType:'image/webp',body:fs.readFileSync(path.join(root,row.webp720))});}
 const file=path.join(root,u.pathname);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({status:failVariant&&u.pathname.includes('/optimized/')?404:200,body:fs.readFileSync(file),contentType:u.pathname.endsWith('.mjs')?'application/javascript':u.pathname.endsWith('.avif')?'image/avif':u.pathname.endsWith('.webp')?'image/webp':'image/svg+xml'});
 });
 await page.goto('http://127.0.0.1:8080/');await page.addScriptTag({path:path.join(root,'js/image-variants.js')});await page.addScriptTag({path:path.join(root,'js/product-images.js')});
 const render=()=>page.evaluate(({name,mode})=>{document.querySelector('#card').innerHTML=PTHProductImages.render('/original/'+name,'Product " <safe>','test-class',mode);},{name,mode});
 await render();await page.waitForFunction(()=>document.querySelector('#card img').naturalWidth>0);
 assert.match(await page.locator('#card img').evaluate(i=>i.currentSrc),new RegExp('-'+expected+'\\.avif$'));assert.equal(originalRequests,0);
 assert.equal(await page.locator('#card img').getAttribute('alt'),'Product " <safe>');
 failVariant=true;await render();await page.locator('#card img').evaluate(i=>PTHProductImages.fallback(i));
 await page.waitForFunction(()=>document.querySelector('#card img').currentSrc.includes('/original/'));
 assert.equal(await page.locator('#card source').count(),0);
 failOriginal=true;await page.locator('#card img').evaluate(i=>PTHProductImages.fallback(i));
 await page.waitForFunction(()=>document.querySelector('#card img').currentSrc.endsWith('/icons/product-placeholder.svg'));
 assert.equal(await page.locator('#card img').getAttribute('onerror'),null);
 const diagnostic=await page.evaluate(async()=>{const d=await import('/js/performance-diagnostics.mjs');const result=d.snapshot();d.stop();return result;});
 assert.equal(diagnostic.localOnly,true);assert.doesNotMatch(JSON.stringify(diagnostic),/127\.0\.0\.1|original\/|Bearer|token=/);
 console.log(`PASS ${width}px DPR${dpr} ${mode}: ${expected}px candidate, escaping, original/placeholder fallback, local diagnostics`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
