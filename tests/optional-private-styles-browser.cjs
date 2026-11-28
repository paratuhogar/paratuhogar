// Real widget and asset-loader code; only the private transport boundary is synthetic.
'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const owner={id:'11111111-1111-4111-a111-111111111111',nombre:'Laura Pérez',nombre_publico:'Laura',rol:'gestor',estado:'activo',activo:true,parent_id:null};
const stylePaths=['/css/points-wallet.css','/css/points-cash.css','/css/personal-qr.css'];
let browser,server,origin;
before(async()=>{
 server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/js/')||url.pathname.startsWith('/css/')){
   res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'text/css'});
   res.end(fs.readFileSync(path.join(root,url.pathname)));return;
  }
  const hidden=url.searchParams.has('hidden'),standalone=url.searchParams.has('standalone');
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Optional private styles</title>
   ${standalone?stylePaths.map(href=>`<link rel="stylesheet" href="${href}">`).join(''):'<script defer src="/js/internal-assets.js"></script>'}
   <script defer src="/js/points-cash.js"></script><script defer src="/js/points-wallet.js"></script><script defer src="/js/personal-qr.js"></script>
   </head><body><main id="private-panel"${hidden?' hidden':''}><nav><button id="btn-dash-resumen">Inicio</button></nav><div><button data-personal-link>Mi enlace</button></div><nav id="admin-master-nav"></nav></main><button id="outside">Fuera</button></body></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(t,{anonymous=false,hidden=false,standalone=false,hold=false,fail=''}={}){
 const page=await browser.newPage({viewport:{width:390,height:850}}),errors=[],requests=[],held=[];
 const state={hold,fail,calls:[],refreshes:0};page.setDefaultTimeout(5000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());assert.equal(url.origin,origin,'fixture never contacts production');
  if(stylePaths.includes(url.pathname)){
   requests.push(url.pathname);
   if(state.hold)await new Promise(resolve=>held.push(resolve));
   if(state.fail===url.pathname){state.fail='';await route.abort();return;}
  }
  await route.continue();
 });
 await page.addInitScript(({owner,anonymous})=>{
  window.privateCalls=[];window.refreshes=0;
  if(!anonymous){
   localStorage.setItem('pth_session',JSON.stringify({data:owner}));localStorage.setItem('pth_secure_token','a'.repeat(64));
   localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));window.currentUserData=owner;
  }
  window.PTHSecureData={token:()=>localStorage.getItem('pth_secure_token'),refresh:async()=>{window.refreshes++;return owner;},pointsWallet:async body=>{
   window.privateCalls.push(body);return {data:{beneficiary:{id:owner.id,name:owner.nombre},enabled:true,balance:18,pending:0,reversed:0,movements:[],nextOffset:null}};
  }};
 },{owner,anonymous});
 t.after(async()=>{held.splice(0).forEach(resolve=>resolve());await page.close();assert.deepEqual(errors,[],'no unhandled browser exceptions or promise rejections');});
 await page.goto(origin+'/?'+new URLSearchParams({...hidden&&{hidden:'1'},...standalone&&{standalone:'1'}}),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.PTHPointsWallet&&window.PTHPersonalQR);
 return {page,state,requests,release:()=>{state.hold=false;held.splice(0).forEach(resolve=>resolve());}};
}
async function logout(page){await page.evaluate(()=>{localStorage.removeItem('pth_session');localStorage.removeItem('pth_secure_token');dispatchEvent(new Event('pth:session-changed'));});}
async function expectRequests(page,requests,count){await page.waitForFunction(count=>document.querySelectorAll('link[rel="stylesheet"]').length>=count,count);assert.equal(requests.length,count);}

test('anonymous visitors do not fetch any private styles or private balances',async t=>{
 const {page,requests}=await fixture(t,{anonymous:true});await page.waitForTimeout(100);
 assert.deepEqual(requests,[]);assert.deepEqual(await page.evaluate(()=>privateCalls),[]);
 assert.equal(await page.evaluate(()=>PTHPointsWallet.open()),false);
 await page.evaluate(()=>PTHPersonalQR.openOwn());assert.deepEqual(requests,[]);
});
test('visible authenticated entries load each shared stylesheet exactly once',async t=>{
 const {page,requests}=await fixture(t);await expectRequests(page,requests,3);
 await page.locator('#pth-points-open').waitFor({state:'visible'});
 await page.evaluate(()=>Promise.all([PTHAssets.load('pointsStyles'),PTHAssets.load('pointsStyles'),PTHAssets.load('personalQRStyles')]));
 assert.deepEqual(requests.slice().sort(),stylePaths.slice().sort());
 await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 assert.equal(await page.locator('#pth-points-dialog').evaluate(e=>e.open&&getComputedStyle(e).position==='fixed'),true);
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'pth-points-open');
});
test('hidden authenticated entries stay deferred until their panel becomes visible',async t=>{
 const {page,requests}=await fixture(t,{hidden:true});await page.waitForTimeout(100);assert.deepEqual(requests,[]);
 await page.evaluate(()=>document.querySelector('#private-panel').hidden=false);await expectRequests(page,requests,3);
 await page.locator('#pth-points-open').waitFor({state:'visible'});await page.locator('#pth-personal-qr-open').waitFor({state:'visible'});
});
test('wallet never opens unstyled, deduplicates concurrent opens and ignores a late logout',async t=>{
 const {page,requests,release}=await fixture(t,{hidden:true,hold:true});
 assert.deepEqual(await page.evaluate(()=>[PTHPointsWallet.open(),PTHPointsWallet.open()]),[true,true]);
 await expectRequests(page,requests,2);
 assert.equal(await page.locator('#pth-points-dialog[open]').count(),0);
 assert.equal(await page.getByRole('status').filter({hasText:'Cargando estilos de puntos'}).isVisible(),true);
 await logout(page);release();await page.waitForTimeout(100);
 assert.equal(await page.locator('#pth-points-dialog[open]').count(),0);assert.deepEqual(await page.evaluate(()=>privateCalls),[]);
 assert.equal(await page.locator('#pth-points-style-status').count(),0);
});
test('wallet style failure leaves a recoverable retry and reuses successful shared CSS',async t=>{
 const {page,requests}=await fixture(t,{hidden:true,fail:'/css/points-cash.css'});
 await page.focus('#outside');
 await page.evaluate(()=>PTHPointsWallet.open());
 await page.getByRole('button',{name:'Reintentar estilos de puntos',exact:true}).waitFor();
 assert.equal(await page.locator('#pth-points-dialog[open]').count(),0);
 await page.getByRole('button',{name:'Reintentar estilos de puntos',exact:true}).click();await page.locator('#pth-points-balance').waitFor();
 assert.equal(requests.filter(url=>url==='/css/points-wallet.css').length,1);assert.equal(requests.filter(url=>url==='/css/points-cash.css').length,2);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='outside');assert.equal(await page.evaluate(()=>document.activeElement.id),'outside','style retry preserves the original wallet opener');
});
test('QR waits for its style and a late logout cannot reopen or verify an account',async t=>{
 const {page,requests,release}=await fixture(t,{hidden:true,hold:true});
 await page.evaluate(()=>{void PTHPersonalQR.openOwn();});await expectRequests(page,requests,1);
 assert.equal(await page.locator('#pth-personal-qr-dialog[open]').count(),0);
 await logout(page);release();await page.waitForTimeout(100);
 assert.equal(await page.locator('#pth-personal-qr-dialog[open]').count(),0);assert.equal(await page.evaluate(()=>refreshes),0);
});
test('QR style failures are retryable without opening an unstyled dialog',async t=>{
 const {page,requests}=await fixture(t,{hidden:true,fail:'/css/personal-qr.css'});
 await page.focus('#outside');
 await page.evaluate(()=>{void PTHPersonalQR.openOwn();});
 await page.getByRole('button',{name:'Reintentar estilos de QR',exact:true}).waitFor();
 assert.equal(await page.locator('#pth-personal-qr-dialog[open]').count(),0);
 await page.getByRole('button',{name:'Reintentar estilos de QR',exact:true}).click();await page.locator('#pth-personal-qr-dialog[open]').waitFor();
 assert.equal(requests.filter(url=>url==='/css/personal-qr.css').length,2);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='outside');assert.equal(await page.evaluate(()=>document.activeElement.id),'outside','style retry preserves the original QR opener');
});
test('standalone fixtures reuse existing styles without PTHAssets or duplicate downloads',async t=>{
 const {page,requests}=await fixture(t,{standalone:true});
 await page.locator('#pth-points-open').waitFor({state:'visible'});await page.click('#pth-points-open');await page.locator('#pth-points-balance').waitFor();
 await page.keyboard.press('Escape');await page.click('#pth-personal-qr-open');await page.locator('#pth-personal-qr-dialog[open]').waitFor();
 assert.deepEqual(requests.slice().sort(),stylePaths.slice().sort());
});
