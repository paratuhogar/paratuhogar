// Local public reader only: synthetic products, no API credentials or real orders.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'), http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const products=[
  {id:'panel',nombre:'Panel solar  bifacial 595 W',categoria:'ENERGIA ',precio:219.99,disponible:'SI'},
  {id:'battery',nombre:'Batería portátil',categoria:' ENERGÍA',precio:850,disponible:'SI'},
  {id:'cooler',nombre:'Refrigerador',categoria:'MUNDOFRIO',precio:510,disponible:'SI'},
  {id:'freezer',nombre:'Congelador',categoria:'MUNDOFRIO ',precio:290,disponible:'NO'},
  {id:'bike',nombre:'Bicicleta eléctrica',categoria:'TRANSPORTE',precio:499,disponible:'SI'},
  {id:'scooter',nombre:'Moto eléctrica',categoria:' TRANSPORTE\t',precio:990,disponible:'SI'}
];

(async()=>{
  const allowed=new Set(['offline-catalog.html','offline.html','offline-order.html','service-worker.js','old-service-worker.js','js/admin-push-worker.js','css/offline-catalog.css','css/offline-order.css','js/low-connectivity.js','js/public-catalog-api.js','js/image-variants.js','js/product-images.js','js/offline-catalog.js','js/secure-data.js','js/pending-checkout.js','js/pending-checkout-page.js']);
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const filename=pathname==='/'?'offline-catalog.html':pathname.slice(1);
    if(!allowed.has(filename)&&!/^(?:index\.html|js\/(?:[\w.-]+\.(?:js|mjs)|vendor\/supabase-2\.57\.4\.js)|css\/[\w.-]+\.css|icons\/[\w.-]+\.(?:svg|png)|log\.jpeg)$/.test(filename)){response.writeHead(404);response.end();return;}
    const body=filename==='old-service-worker.js'
      ? "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));"
      : filename==='js/public-catalog-api.js'
      ? `window.fixtureRefreshes=0;window.PTHPublicCatalog={fetch:async()=>{window.fixtureRefreshes++;return ${JSON.stringify(products)}}};`
      : fs.readFileSync(path.join(root,filename));
    response.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':filename.endsWith('.css')?'text/css':'application/javascript'});
    response.end(body);
  });
  let browser;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    for(const width of [320,390,1280]){
      const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:width===390?'allow':'block'}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
      await context.addInitScript(rows=>{if(!localStorage.getItem('pth_offline_public_catalog_v1'))localStorage.setItem('pth_offline_public_catalog_v1',JSON.stringify({version:1,savedAt:Date.now(),products:rows}));},products);
      await page.goto(origin+'/offline-catalog.html',{waitUntil:'load'});
      const snapshot=await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1'));
      assert.deepEqual(await page.locator('#offline-category option').evaluateAll(options=>options.map(option=>[option.value,option.textContent])),[['','Todas'],['ENERGIA','ENERGIA'],['MUNDOFRIO','MUNDOFRIO'],['TRANSPORTE','TRANSPORTE']]);
      await context.setOffline(true);
      for(const query of ['panel solar bifacial',' PANEL  solar\tbifacial ','bifacial panel solar']){
        await page.locator('#offline-search').fill(query);
        assert.deepEqual(await page.locator('#offline-products h2').allTextContents(),['Panel solar  bifacial 595 W']);
        assert.equal(await page.locator('#offline-products strong').innerText(),'$219.99 USD');
      }
      await page.locator('#offline-search').fill(' BATERIA portatil ');
      assert.deepEqual(await page.locator('#offline-products h2').allTextContents(),['Batería portátil']);
      await page.locator('#offline-search').fill(' \t');
      for(const category of ['ENERGIA','MUNDOFRIO','TRANSPORTE']){
        await page.locator('#offline-category').selectOption(category);
        assert.equal(await page.locator('#offline-products article').count(),2);
      }
      assert.equal(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),snapshot);
      await page.locator('#offline-category').selectOption('ENERGIA');
      await page.locator('#offline-search').fill('solar bifacial');
      await context.setOffline(false);await page.locator('#offline-refresh').click();
      await page.waitForFunction(()=>window.fixtureRefreshes===1&&document.getElementById('offline-refresh').disabled===false);
      assert.equal(await page.locator('#offline-category').inputValue(),'ENERGIA');
      assert.deepEqual(await page.locator('#offline-products h2').allTextContents(),['Panel solar  bifacial 595 W']);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);
      if(width===390){
        const upgradedSnapshot=await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1'));
        await page.evaluate(async()=>{
          await navigator.serviceWorker.register('/old-service-worker.js',{scope:'/'});
          await navigator.serviceWorker.ready;
        });
        await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/old-service-worker.js'));
        await page.evaluate(async()=>{
          for(const cacheName of ['pth-public-static-2026-10-02-lowdata1','pth-public-static-2026-10-02-fasttools1','pth-public-static-2026-10-02-quickstory1','pth-public-static-2026-10-02-review1','pth-public-images-v1','unrelated-cache']){
            const cache=await caches.open(cacheName);await cache.put('/synthetic-sentinel',new Response('keep outside old static cache'));
          }
          localStorage.setItem('pth_new_cart_v1:synthetic','synthetic draft sentinel');
          const registration=await navigator.serviceWorker.register('/service-worker.js?v=20261003-pending2',{scope:'/',updateViaCache:'none'});
          window.fixtureRegistration=registration;
        });
        await page.waitForFunction(()=>window.fixtureRegistration.waiting?.state==='installed');
        await page.evaluate(()=>fixtureRegistration.waiting.postMessage({type:'SKIP_WAITING'}));
        await page.waitForFunction(()=>fixtureRegistration.active?.state==='activated'&&navigator.serviceWorker.controller?.scriptURL.endsWith('service-worker.js?v=20261003-pending2'));
        const cacheNames=await page.evaluate(()=>caches.keys());
        assert.equal(cacheNames.includes('pth-public-static-2026-10-02-lowdata1'),false);
        assert.equal(cacheNames.includes('pth-public-static-2026-10-02-fasttools1'),false);
        assert.equal(cacheNames.includes('pth-public-static-2026-10-02-quickstory1'),false);
        assert.equal(cacheNames.includes('pth-public-static-2026-10-02-review1'),false);
        for(const name of ['pth-public-static-2026-10-03-pending2','pth-public-images-v1','unrelated-cache'])assert.equal(cacheNames.includes(name),true);
        assert.equal(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),upgradedSnapshot);
        assert.equal(await page.evaluate(()=>localStorage.getItem('pth_new_cart_v1:synthetic')),'synthetic draft sentinel');
        await context.setOffline(true);await page.goto(origin+'/offline-catalog.html',{waitUntil:'load'});
        await page.locator('#offline-search').fill('panel solar bifacial');
        assert.deepEqual(await page.locator('#offline-products h2').allTextContents(),['Panel solar  bifacial 595 W']);
        assert.equal(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),upgradedSnapshot);
        // The saved catalogue link and query-bearing direct URL work offline too.
        await page.goto(origin+'/offline-catalog.html?catalog_q=panel',{waitUntil:'load'});
        await page.locator('#offline-search').fill('panel solar bifacial');
        assert.deepEqual(await page.locator('#offline-products h2').allTextContents(),['Panel solar  bifacial 595 W']);
        await page.goto(origin+'/offline.html',{waitUntil:'load'});
        await page.locator('a[href="/offline-catalog.html"]').click();
        assert.equal(await page.locator('#offline-search').count(),1);
        assert.equal(await page.evaluate(()=>localStorage.getItem('pth_offline_public_catalog_v1')),upgradedSnapshot);
        assert.deepEqual(errors,[]);
        await page.screenshot({path:'/tmp/pth-offline-filters-mobile.png',fullPage:true});
        console.log('PASS actual worker upgrade: new reader cached, previous static cache removed, image/unrelated caches and cart/public data retained, corrected search in compatible offline reader');
      }
      await context.close();
      console.log(`PASS saved public reader ${width}px: multiword/whitespace/accent search, category deduplication, offline filters, unchanged stored data, selected filter retained after refresh`);
    }
  }finally{
    if(browser)await browser.close();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
