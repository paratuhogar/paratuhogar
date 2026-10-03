// Real announcement + session adapter, synthetic gateway and accounts only.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const adapter=fs.readFileSync(path.join(root,'js/secure-data.js'),'utf8');
const script=fs.readFileSync(path.join(root,'js/feedback-announcement.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/feedback-announcement.css'),'utf8');
const output=process.env.PTH_ANNOUNCEMENT_SCREENSHOTS;
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 if(output)fs.mkdirSync(output,{recursive:true});
 for(const width of [360,390,1280]){
  const acknowledged=new Set();let writes=0,fail=false,lost=false,delay=0;
  const makePage=async()=>{
   const context=await browser.newContext({viewport:{width,height:800}});
   await context.addInitScript(()=>{if(!localStorage.getItem('pth_secure_token'))localStorage.setItem('pth_secure_token','a'.repeat(64));});
   await context.route('https://ljqwaovevfatkiigirhf.supabase.co/**',async route=>{
    const body=route.request().postDataJSON(),actor=route.request().headers().authorization?.slice(7,8);let data;
    if(body.action==='session')data={profile:{id:actor,nombre:actor,rol:'gestor',...(actor==='b'?{parent_id:'a'}:{})}};
    if(body.action==='announcement'){
     if(body.operation==='acknowledge'){
      writes++;if(fail)return route.abort();acknowledged.add(actor);
      if(lost){lost=false;return route.abort();}
     }
     data={acknowledged:acknowledged.has(actor)};
     if(delay)await new Promise(r=>setTimeout(r,delay));
    }
    await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'},body:JSON.stringify({data,error:null})});
   });
   await context.route('http://127.0.0.1:8080/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().endsWith('/feedback.html')?'<h1>Feedback test destination</h1>':`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font-family:system-ui;background:#f4f7fb}.hidden{display:none}${css}</style></head><body><button id="panel">Panel de trabajo</button><div id="modal-intro-precios" class="hidden">Existing intro</div><script>${adapter}</script><script>${script}</script><script>PTHSecureData.restore().then(()=>PTHFeedbackAnnouncement.show())</script></body></html>`}));
   const page=await context.newPage();await page.goto('http://127.0.0.1:8080/');return {page,context};
  };
  const {page,context}=await makePage();
  await page.waitForSelector('#feedback-announcement:visible');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'feedback-announcement-title');
  for(const selector of ['open','acknowledge'])assert.ok((await page.locator(`[data-announcement-action=${selector}]`).boundingBox()).height>=44);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(output)await page.screenshot({path:path.join(output,`announcement-${width}.png`)});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.announcementAction),'open');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.announcementAction),'acknowledge');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.announcementAction),'open');
  await page.keyboard.press('Escape');assert.equal(writes,0);assert.equal(await page.locator('dialog').isVisible(),false);
  await page.reload();await page.waitForSelector('dialog:visible');
  fail=true;await page.click('[data-announcement-action=acknowledge]');await page.waitForSelector('[data-announcement-action=later]:visible');assert.equal(acknowledged.size,0);
  await page.click('[data-announcement-action=later]');assert.equal(await page.locator('dialog').isVisible(),false);
  fail=false;await page.reload();await page.waitForSelector('dialog:visible');lost=true;
  await page.click('[data-announcement-action=acknowledge]');await page.waitForSelector('[data-announcement-action=later]:visible');
  assert.equal(acknowledged.size,1);const beforeRetry=writes;await page.evaluate(()=>{const b=document.querySelector('[data-announcement-action=acknowledge]');b.click();b.click();});await page.waitForSelector('dialog',{state:'hidden'});assert.equal(writes,beforeRetry+1);
  await page.reload();await page.waitForFunction(()=>PTHFeedbackAnnouncement&&PTHSecureData.token());await page.waitForTimeout(100);assert.equal(await page.locator('dialog[open]').count(),0);
  const fresh=await makePage();await fresh.page.waitForTimeout(100);assert.equal(await fresh.page.locator('dialog[open]').count(),0);await fresh.context.close();
  // Different account in the same browser (subgestor) has its own acknowledgement.
  await page.evaluate(()=>{PTHSecureData.clearSession();localStorage.setItem('pth_secure_token','b'.repeat(64));});
  await page.reload();await page.waitForSelector('dialog:visible');
  await page.click('[data-announcement-action=open]');await page.waitForURL('**/feedback.html');assert.equal(acknowledged.has('b'),true);
  await page.goBack();await page.waitForTimeout(100);assert.equal(await page.locator('dialog[open]').count(),0);
  // Existing onboarding is not overlaid; session clearing closes a stale dialog.
  await page.evaluate(()=>{PTHSecureData.clearSession();localStorage.setItem('pth_secure_token','c'.repeat(64));document.getElementById('modal-intro-precios').classList.remove('hidden');return PTHSecureData.restore().then(()=>PTHFeedbackAnnouncement.show());});
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.evaluate(()=>document.getElementById('modal-intro-precios').classList.add('hidden'));await page.waitForSelector('dialog:visible');
  await page.evaluate(()=>PTHSecureData.clearSession());assert.equal(await page.locator('dialog').isVisible(),false);
  // The practical welcome is a native dialog; wait for its open attribute to clear.
  await page.evaluate(()=>{localStorage.setItem('pth_secure_token','e'.repeat(64));const welcome=document.createElement('dialog');welcome.id='pth-welcome';welcome.textContent='Synthetic practical welcome';document.body.append(welcome);welcome.showModal();return PTHSecureData.restore().then(()=>PTHFeedbackAnnouncement.show());});
  assert.equal(await page.locator('#feedback-announcement[open]').count(),0);
  assert.equal(await page.locator('#pth-welcome[open]').count(),1);
  await page.evaluate(()=>document.getElementById('pth-welcome').close());await page.waitForSelector('#feedback-announcement[open]');
  await page.evaluate(()=>{PTHSecureData.clearSession();document.getElementById('pth-welcome').remove();});
  // Delayed old-account status must not reopen after logout.
  delay=150;await page.evaluate(()=>{localStorage.setItem('pth_secure_token','d'.repeat(64));return PTHSecureData.restore();});
  await page.evaluate(()=>{void PTHFeedbackAnnouncement.show();setTimeout(()=>PTHSecureData.clearSession(),30);});await page.waitForTimeout(250);assert.equal(await page.locator('dialog[open]').count(),0);
  await context.close();console.log(`PASS ${width}px: mobile, focus trap, Escape, failure, lost reply/retry, new device, distinct subgestor, back, modal queue, logout and stale response`);
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
