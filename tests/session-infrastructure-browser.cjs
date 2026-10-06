// Real browser + real client/handler, with synthetic DB and intercepted traffic only.
const {chromium}=require(process.env.PTH_PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {sessionFixture}=await import('./fixtures/session-infrastructure.mjs');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM_PATH||'/usr/bin/chromium'});
 try{
  for(const stage of ['session','profile','parent','courier']){
   const f=await sessionFixture({child:stage==='parent',courier:stage==='courier'});
   const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin==='http://127.0.0.1:8080'){
     if(url.pathname==='/secure-data.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'js/secure-data.js'),'utf8')});
     return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic session QA</title><script src="/secure-data.js"></script>'});
    }
    if(url.pathname==='/functions/v1/secure-data'){
     if(f.state.network)return route.abort();
     const response=await f.fetch('',{method:'POST',headers:request.headers(),body:request.postData()});
     return route.fulfill({status:response.status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'},body:await response.text()});
    }
    return route.abort();
   });
   await page.goto('http://127.0.0.1:8080/'+(stage==='courier'?'mensajeros.html':''));
   await page.evaluate(async({token,expiresAt,courier})=>{
    const key=courier?'pth_secure_messenger_token':'pth_secure_token';localStorage.setItem(key,token);localStorage.setItem(key+'_expires_at',String(Date.parse(expiresAt)));await PTHSecureData.restore();
   },{token:f.token,expiresAt:f.expiresAt,courier:stage==='courier'});
   f.state.failure={stage,mode:'returned'};
   const failed=await page.evaluate(async()=>{try{await PTHSecureData.refresh();return {unexpected:true};}catch(e){return {status:e.status,code:e.code,retained:Boolean(PTHSecureData.token())};}});
   assert.deepEqual(failed,{status:503,code:'SERVICE_UNAVAILABLE',retained:true});assert.equal(f.state.writes,0);
   await page.reload();
   const cold=await page.evaluate(async()=>{
    const client=PTHSecureData.install({from(){throw Error('Direct fallback forbidden');},rpc(){throw Error('Direct RPC fallback forbidden');}});
    const results=await Promise.all([client.from('pedidos').insert({cliente:'Fixture'}),client.from('pedidos').insert({cliente:'Fixture'})]);
    return results.map(result=>({status:result.error.status,code:result.error.code}));
   });
   assert.deepEqual(cold,[{status:503,code:'SERVICE_UNAVAILABLE'},{status:503,code:'SERVICE_UNAVAILABLE'}]);assert.equal(f.state.writes,0);assert.equal(f.rows.pedidos.length,0);assert.equal(f.state.requests.some(body=>body.action==='query'),false);
   f.state.failure=null;
   const recovered=await page.evaluate(async()=>({id:(await PTHSecureData.restore()).id,retained:Boolean(PTHSecureData.token())}));
   assert.deepEqual(recovered,{id:stage==='courier'?'courier':'owner',retained:true});
   assert.equal(f.state.requests.some(body=>body.action==='login'||body.action==='login_messenger'),false);
   if(stage!=='courier'){
    const result=await page.evaluate(()=>PTHSecureData.publicName('Saved once'));assert.equal(result.error,null);assert.equal(f.state.writes,1);
    const forbidden=await page.evaluate(async()=>{const db=PTHSecureData.install({from(){throw Error('Direct fallback forbidden');},rpc(){throw Error('Direct fallback forbidden');}});const result=await db.from('gestores').update({rol:'admin'});return {status:result.error.status,retained:Boolean(PTHSecureData.token())};});
    assert.deepEqual(forbidden,{status:403,retained:true});assert.equal(f.state.writes,1);
   }
   f.rows.pth_secure_sessions=[];
   const invalid=await page.evaluate(async()=>{try{await PTHSecureData.refresh();return {unexpected:true};}catch(e){return {status:e.status,retained:Boolean(PTHSecureData.token())};}});
   assert.deepEqual(invalid,{status:401,retained:false});assert.equal(f.rows.pedidos.length,0);assert.equal(f.rows.gestores[0].rol,'gestor');assert.deepEqual(errors,[]);
   console.log(`${stage}: 503 retained session, cold/concurrent writes blocked, recovery without login, genuine 401/403 preserved`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
