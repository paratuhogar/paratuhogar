// Controlled PDF API stub: tests UI/wiring/errors/downloads, not real jsPDF layout.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const pdfStub=`window.pdfText=[];window.pdfBuilds=0;window.jspdf={jsPDF:function(){pdfBuilds++;let pages=1;return new Proxy({internal:{getNumberOfPages:()=>pages,getCurrentPageInfo:()=>({pageNumber:pages})},addPage(){pages++;},text(value){pdfText.push(value);},getTextWidth:value=>String(value).length*2,splitTextToSize:value=>String(value).split('\\n'),output:()=>new Blob(['%PDF-1.3\\nPDF_API_TEST_STUB'],{type:'application/pdf'})},{get:(target,key)=>key in target?target[key]:()=>{}});}};`;
const products=Array.from({length:86},(_,i)=>({id:'p'+i,nombre:'Equipo '+i,precio:100+i,categoria:'HOGAR',thumbnail:'fixture.svg',descripcion:'Descripción',garantia:'1 año',mensajeria:'Consultar entrega'}));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage(),errors=[],alerts=[],requests=[];let failPdf=true,failImages=false;
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.dismiss();});
 await page.addInitScript(payload=>localStorage.setItem('pth_catalog_data',JSON.stringify(payload)),{timestamp:Date.now(),agent:'Asesor prueba',phone:'5350000000',categoryName:'TODOS',products});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.href);
  if(url.href.includes('jspdf.umd')){if(failPdf){failPdf=false;return route.abort();}return route.fulfill({contentType:'application/javascript',body:pdfStub});}
  if(url.href.includes('autotable'))return route.fulfill({contentType:'application/javascript',body:''});
  if(url.href.includes('qrcode'))return route.fulfill({contentType:'application/javascript',body:'window.QRCode=function(stage){const canvas=document.createElement("canvas");canvas.width=canvas.height=10;stage.append(canvas);};QRCode.CorrectLevel={M:0};'});
  if(url.hostname==='pdf.test'){
   const file=path.join(root,url.pathname.slice(1));if(!fs.existsSync(file))return route.abort();
   const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf'}[path.extname(file)];return route.fulfill({contentType:type||'application/octet-stream',body:fs.readFileSync(file)});
  }
  if(url.hostname==='raw.githubusercontent.com'){if(failImages)return route.abort();return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="30" height="50"><rect width="30" height="50" fill="blue"/></svg>',headers:{'Access-Control-Allow-Origin':'*'}});}
  return route.abort();
 });
 await page.goto('https://pdf.test/catalog-maker.html');
 assert.equal(await page.locator('#product-selector-list input').count(),86,'list renders even when PDF CDNs are unavailable');
 assert.equal(requests.some(url=>/jspdf|qrcode|tailwindcss\.com/.test(url)),false,'list does not wait for PDF libraries or CSS runtime');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PDF UI fits mobile');
 await page.locator('#btn-generate').click();await page.waitForFunction(()=>!generationInProgress);
 assert.match(alerts[0],/No se pudo cargar/);assert.equal(await page.locator('#btn-generate').isEnabled(),true);
 await page.locator('input[name="style"][value="basic"]').check();
 await page.locator('#btn-generate').click();await page.waitForFunction(()=>!document.querySelector('#pdf-ready').hidden);
 assert.equal(await page.evaluate(()=>pdfBuilds),1);assert.match(await page.locator('#pdf-result').textContent(),/86 productos/);
 assert.equal(requests.some(url=>url.includes('raw.githubusercontent')),false,'basic PDF needs no photos');
 const downloadPromise=page.waitForEvent('download');await page.locator('#pdf-download').click();const download=await downloadPromise;const file=await download.path();assert.match(fs.readFileSync(file,'utf8'),/^%PDF/);assert.match(download.suggestedFilename(),/^Catalogo_TODOS_Asesor_prueba\.pdf$/);
 assert.ok((await page.locator('#pdf-open').getAttribute('href')).startsWith('blob:'),'persistent open fallback is available');
 // Select a small PRO catalogue and simulate unavailable photographs.
 await page.locator('#clear-selection').click();assert.equal(await page.locator('#pdf-ready').isVisible(),false,'changing selection invalidates the prepared PDF');await page.locator('#product-selector-list input').nth(0).check();await page.locator('#product-selector-list input').nth(1).check();
 failImages=true;await page.locator('input[name="style"][value="pro"]').check();
 await page.evaluate(()=>Promise.all([startGeneration(),startGeneration()]));await page.waitForFunction(()=>!document.querySelector('#pdf-ready').hidden);
 assert.equal(await page.evaluate(()=>pdfBuilds),2,'duplicate preparation does not create two documents');
 assert.match(await page.locator('#pdf-result').textContent(),/2 fotos no cargaron/);
 assert.equal((await page.evaluate(()=>pdfText.flat())).filter(value=>value==='IMAGEN NO DISPONIBLE').length,2);
 // A photograph that never completes must also settle, and canvas failures are caught.
 assert.equal(await page.evaluate(()=>{const NativeImage=Image;window.Image=class{set src(v){} set crossOrigin(v){}};const original=setTimeout;window.setTimeout=(fn,ms)=>original(fn,ms===10000?10:ms);return loadImage('https://hanging.test/photo').finally(()=>{window.Image=NativeImage;window.setTimeout=original;});}),null);
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>{payload.products[0].__catalogKey='x&quot;);window.untrustedExecuted=true;//';selectedProductKeys=new Set([payload.products[0].__catalogKey]);renderProductSelector();});
 await page.locator('#product-selector-list input').nth(0).uncheck();
 assert.equal(await page.evaluate(()=>window.untrustedExecuted),undefined,'product identifiers are data, never inline executable handlers');
 console.log('PASS PDF UI: 86 products without eager CDNs, mobile, failed library/retry, no-photo basic, duplicate prepare, photo failures/timeouts, explicit download/open fallback (PDF API stub; no real layout verification).');
 await context.close();
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
