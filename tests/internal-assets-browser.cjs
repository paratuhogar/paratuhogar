const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage(),requests=[];let failXlsx=true;
 await page.route('**/*',async route=>{
  const url=route.request().url();requests.push(url);
  if(new URL(url).pathname.startsWith('/producto/'))return route.fulfill({status:404,body:''});
  if(url.includes('sheetjs')&&failXlsx){failXlsx=false;return route.abort();}
  let body='';
  if(url.includes('jspdf.umd'))body='window.testPdfCore=true;';
  if(url.includes('autotable'))body='if(!window.testPdfCore)throw Error("PDF plugin loaded before core");window.testPdfPlugin=true;';
  if(url.includes('studio-designs.js'))body='window.testStudioDesigns=true;';
  if(url.includes('studio-jobs.js'))body='if(!window.testStudioDesigns)throw Error("Studio jobs loaded before designs");window.testStudioJobs=true;';
  if(url.includes('studio-collection.js'))body='if(!window.testStudioJobs)throw Error("Collection loaded before jobs");window.testStudioCollection=true;';
  if(url.includes('content-studio.js'))body='if(!window.testStudioCollection)throw Error("Studio UI loaded before collection");window.testStudioUI=true;';
  if(url.includes('quick-story.js'))body='if(!window.testStudioJobs)throw Error("Quick Story loaded before jobs");window.testQuickStory=true;';
  await route.fulfill({contentType:url.includes('.css')?'text/css':'application/javascript',body});
 });
 await page.setContent('<html><head><base href="https://assets.test/producto/bateria/"></head><body><script>window.alerts=[];window.alert=m=>alerts.push(m)</script></body></html>');
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/internal-assets.js'),'utf8')});
 assert.equal(requests.length,0);
 await page.evaluate(()=>Promise.all([PTHAssets.load('zip'),PTHAssets.load('zip')]));assert.equal(requests.filter(u=>u.includes('jszip')).length,1);
 assert.equal(await page.evaluate(()=>PTHAssets.ensure('xlsx')),false);assert.equal(await page.evaluate(()=>alerts.length),1);
 assert.equal(await page.evaluate(()=>PTHAssets.ensure('xlsx')),true);assert.equal(requests.filter(u=>u.includes('sheetjs')).length,2);
 await page.evaluate(()=>PTHAssets.load('pdf'));assert.equal(await page.evaluate(()=>testPdfPlugin),true);
 await page.evaluate(()=>PTHAssets.load('story'));assert.equal(await page.evaluate(()=>testQuickStory),true);
 assert.equal(requests.some(u=>u.includes('content-studio.js')),false,'quick Story does not fetch the full editor');
 await page.evaluate(()=>PTHAssets.load('studio'));assert.equal(await page.evaluate(()=>testStudioUI),true);
 assert.equal(requests.filter(u=>u.includes('studio-jobs.js')).length,1,'Story and Studio share only renderer/jobs dependencies');
 await page.evaluate(()=>Promise.all([PTHAssets.load('traffic'),PTHAssets.load('session')]));
 assert.equal(requests.some(u=>new URL(u).pathname.startsWith('/producto/')),false,'local tools must resolve from the site root on product routes');
 console.log('PASS lazy assets: zero eager requests, concurrent deduplication, failure/retry, ordered PDF and Studio dependencies, nested product route');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
