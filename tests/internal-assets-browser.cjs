const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage(),requests=[];let failXlsx=true;
 await page.route('**/*',async route=>{
  const url=route.request().url();requests.push(url);
  if(url.includes('sheetjs')&&failXlsx){failXlsx=false;return route.abort();}
  let body='';
  if(url.includes('jspdf.umd'))body='window.testPdfCore=true;';
  if(url.includes('autotable'))body='if(!window.testPdfCore)throw Error("PDF plugin loaded before core");window.testPdfPlugin=true;';
  if(url.includes('studio-designs.js'))body='window.testStudioDesigns=true;';
  if(url.includes('studio-jobs.js'))body='if(!window.testStudioDesigns)throw Error("Studio jobs loaded before designs");window.testStudioJobs=true;';
  if(url.includes('content-studio.js'))body='if(!window.testStudioJobs)throw Error("Studio UI loaded before jobs");window.testStudioUI=true;';
  await route.fulfill({contentType:url.includes('.css')?'text/css':'application/javascript',body});
 });
 await page.setContent('<html><head><base href="https://assets.test/"></head><body><script>window.alerts=[];window.alert=m=>alerts.push(m)</script></body></html>');
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/internal-assets.js'),'utf8')});
 assert.equal(requests.length,0);
 await page.evaluate(()=>Promise.all([PTHAssets.load('zip'),PTHAssets.load('zip')]));assert.equal(requests.filter(u=>u.includes('jszip')).length,1);
 assert.equal(await page.evaluate(()=>PTHAssets.ensure('xlsx')),false);assert.equal(await page.evaluate(()=>alerts.length),1);
 assert.equal(await page.evaluate(()=>PTHAssets.ensure('xlsx')),true);assert.equal(requests.filter(u=>u.includes('sheetjs')).length,2);
 await page.evaluate(()=>PTHAssets.load('pdf'));assert.equal(await page.evaluate(()=>testPdfPlugin),true);
 await page.evaluate(()=>PTHAssets.load('studio'));assert.equal(await page.evaluate(()=>testStudioUI),true);
 console.log('PASS lazy assets: zero eager requests, concurrent deduplication, failure/retry, ordered PDF and Studio dependencies');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
