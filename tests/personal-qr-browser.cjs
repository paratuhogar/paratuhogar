// Real dialogs, encoder, canvas and PNG decoder. All gateway responses are synthetic.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const owner = { id:'11111111-1111-4111-a111-111111111111', nombre:'Laura Pérez', nombre_publico:'Laura Hogar', estado:'activo', activo:true, rol:'gestor', parent_id:null };
const child = { ...owner, id:'22222222-2222-4222-a222-222222222222', nombre:'Ana Subgestora', nombre_publico:'Ana', parent_id:owner.id, parent_nombre:owner.nombre, parent_telefono:'55555555' };
const admin = { ...owner, id:'33333333-3333-4333-a333-333333333333', nombre:'Administración', nombre_publico:'Equipo', rol:'admin' };
const inactive = { ...owner, id:'44444444-4444-4444-a444-444444444444', nombre:'Cuenta inactiva', nombre_publico:'Inactiva', estado:'inactivo', activo:false };
let browser, server, origin;

before(async () => {
  server = http.createServer((req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (pathname.startsWith('/js/') || pathname.startsWith('/css/')) {
      const file=path.join(root,pathname);
      res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript':'text/css'});
      res.end(fs.existsSync(file)?fs.readFileSync(file):''); return;
    }
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR · prueba local</title>
      <style>body{font-family:Arial,sans-serif;margin:0;padding:16px}button,input{font:inherit}</style>
      <link rel="stylesheet" href="/css/personal-qr.css">
      <div id="sec-dashboard"><button id="existing-link" onclick="void 0" data-personal-link>Mi enlace</button></div>
      <nav id="admin-master-nav"></nav>
      <script src="/js/secure-data.js"></script><script src="/js/affiliate-links.js"></script>
      <script src="/js/vendor/supabase-2.57.4.js"></script><script src="/js/short-links.js"></script>
      <script>const supabaseClient=PTHSecureData.install(supabase.createClient('https://ljqwaovevfatkiigirhf.supabase.co','sb_publishable_fixture'));PTHShortLinks.configure(supabaseClient);</script>
      <script src="/js/personal-qr.js" defer></script></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.PTH_BROWSER_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});

async function fixture(t,profile=owner,{width=390,share=false}={}) {
  const context=await browser.newContext({viewport:{width,height:850},acceptDownloads:true});
  const page=await context.newPage(); page.setDefaultTimeout(6000);
  const errors=[],state={profile:{...profile},calls:[],vendorRequests:0,failVendor:false,delay:null,releases:[],rows:[owner,child,admin,inactive],failShort:false,shortRows:[{slug:'qrown01',original_url:'https://paratuhogar.org/?ref='+owner.id,gestor:owner.nombre},{slug:'qrchild',original_url:'https://paratuhogar.org/?ref='+child.id,gestor:child.nombre}]};
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',async route=>{
    const request=route.request(),url=request.url();
    if(url.startsWith('https://ljqwaovevfatkiigirhf.supabase.co/rest/v1/short_links')){
      if(state.failShort){await route.abort();return;}
      const params=new URL(url).searchParams;
      if(request.method()==='POST'){state.shortRows.push(request.postDataJSON()[0]);await route.fulfill({status:201,body:''});return;}
      let rows=state.shortRows.filter(row=>['slug','gestor','original_url'].every(key=>!params.has(key)||params.get(key)==='eq.'+row[key]));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});return;
    }
    if(url==='https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data'){
      const body=request.postDataJSON();state.calls.push(body);
      const actor={...state.profile}; let data;
      if(body.action==='session')data={profile:actor,expiresAt:new Date(Date.now()+3600000).toISOString()};
      else {
        assert.equal(body.action,'query','QR never sends writes or RPCs'); assert.equal(body.op,'select'); assert.equal(body.table,'gestores');
        assert.equal(body.columns,'id,nombre,nombre_publico,estado,activo,parent_id');
        let rows=state.rows.map(row=>({...row}));
        for(const filter of body.filters){
          if(filter.method==='eq')rows=rows.filter(row=>row[filter.column]===filter.value);
          else if(filter.method==='or'){
            const value=filter.value.match(/ilike\.\*([^*]*)\*/)?.[1]||'';
            rows=rows.filter(row=>(row.nombre+' '+row.nombre_publico).toLowerCase().includes(value.toLowerCase()));
          } else throw Error('Unexpected QR filter '+filter.method);
        }
        rows=rows.slice(...(body.range?[body.range[0],body.range[1]+1]:[0,body.limit||1000]));
        data=body.single?rows[0]||null:rows;
      }
      if(state.delay?.(body))await new Promise(resolve=>state.releases.push(resolve));
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify({data,error:null})});return;
    }
    assert.ok(url.startsWith(origin+'/'),'unexpected external request: '+url);
    if(url.includes('/vendor/qrcode-generator-')){state.vendorRequests++;if(state.failVendor){await route.abort();return;}}
    await route.continue();
  });
  await page.addInitScript(({profile,share})=>{
    localStorage.setItem('pth_secure_token','a'.repeat(64));
    localStorage.setItem('pth_secure_token_expires_at',String(Date.now()+3600000));
    localStorage.setItem('pth_session',JSON.stringify({data:profile}));
    window.currentUserData={...profile};
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedLink=value;}}});
    if(share){Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError');}});}
  },{profile,share});
  await page.goto(origin+'/');
  t.after(async()=>{state.releases.splice(0).forEach(resolve=>resolve());await context.close();assert.deepEqual(errors,[],'no uncaught browser errors');});
  return {page,state,context};
}
async function openOwn(page) {
  assert.equal(await page.getByRole('button',{name:'Mi QR',exact:true}).count(),1,'seller gets Mi QR beside Mi enlace');
  await page.getByRole('button',{name:'Mi QR',exact:true}).click();
  await page.getByRole('button',{name:'Descargar PNG',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
}
async function downloadedPNG(page) {
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Descargar PNG',exact:true}).click();
  const result=await download;
  const png=require('pngjs').PNG.sync.read(fs.readFileSync(await result.path()));
  const decoded=require('jsqr')(new Uint8ClampedArray(png.data),png.width,png.height,{inversionAttempts:'dontInvert'});
  assert.ok(decoded,'actual downloaded PNG is scannable');
  assert.equal(png.width,1024);assert.equal(png.height,1024);
  assert.ok(/^paratuhogar-qr-[0-9a-f-]+\.png$/.test(result.suggestedFilename()));
  return {png,decoded};
}
function quietZone(png,decoded) {
  const size=decoded.version*4+17,unit=Math.abs(decoded.location.topRightFinderPattern.x-decoded.location.topLeftFinderPattern.x)/(size-7);
  let first=png.width;
  for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
    const i=(y*png.width+x)*4;
    assert.equal(png.data[i+3],255,'PNG background is opaque');
    if(png.data[i]<100){first=Math.min(first,x,y,png.width-1-x,png.height-1-y);}
  }
  assert.ok(first>=Math.floor(unit*4),'quiet zone is at least four modules');
}

test('own QR loads encoder only after opening and downloads a verified private-data-free short URL',async t=>{
  const {page,state}=await fixture(t);assert.equal(state.vendorRequests,0);
  await openOwn(page);const {png,decoded}=await downloadedPNG(page);
  if(process.env.PTH_QR_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.PTH_QR_ARTIFACT_DIR,'personal-qr-mobile.png'),fullPage:true});
  assert.equal(decoded.data,'https://paratuhogar.org/?s=qrown01');
  assert.equal(await page.locator('#pth-personal-qr-name').textContent(),'Laura Hogar');quietZone(png,decoded);
  await page.getByRole('button',{name:'Copiar enlace',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.copiedLink),'https://paratuhogar.org/?s=qrown01');
  assert.equal(state.vendorRequests,1);assert.ok(state.calls.some(body=>body.action==='session'));
});
test('shortener failure exposes only retry, never a long QR or copyable fallback',async t=>{
  const {page,state}=await fixture(t);state.failShort=true;
  await page.getByRole('button',{name:'Mi QR',exact:true}).click();
  await page.getByRole('button',{name:'Reintentar enlace',exact:true}).waitFor();
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);
  assert.equal(await page.locator('#pth-personal-qr-download').count(),0);
  assert.match(await page.locator('#pth-personal-qr-status').textContent(),/enlace corto/);
  state.failShort=false;await page.getByRole('button',{name:'Reintentar enlace',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrown01');
});
test('subgestor QR uses the child UUID, never parent contact or attribution',async t=>{
  const {page}=await fixture(t,child);await openOwn(page);const {decoded}=await downloadedPNG(page);
  assert.equal(decoded.data,'https://paratuhogar.org/?s=qrchild');
  assert.equal(await page.locator('#pth-personal-qr-name').textContent(),'Ana');
  const scan=await page.context().newPage();await scan.goto(origin+'/?s=qrchild');
  await scan.evaluate(async()=>{const resolved=await PTHShortLinks.resolve('qrchild');PTHAffiliate.acceptShortLink(PTHAffiliate.incoming(new URL(resolved.url).search));});
  assert.equal(await scan.evaluate(()=>PTHAffiliate.checkoutReference()),child.id);
});
test('admin selects a verified child account and inactive accounts cannot generate',async t=>{
  const {page,state}=await fixture(t,admin,{width:1280});
  await page.getByRole('button',{name:'QR de gestores',exact:true}).click();
  await page.getByRole('button',{name:'Ana',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrchild');
  if(process.env.PTH_QR_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.PTH_QR_ARTIFACT_DIR,'personal-qr-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Elegir otra cuenta',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Inactiva',exact:true}).isDisabled(),true);
  assert.match(await page.locator('#pth-personal-qr-content').textContent(),/inactiva/i);
  assert.ok(state.calls.some(body=>body.filters?.some(f=>f.column==='id'&&f.value===child.id)),'selection revalidates its target');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'pth-personal-qr-admin-open','admin QR returns to its original entry after selection');
});
test('untrusted openAccount cannot select another account or override a verified public name',async t=>{
  const {page,state}=await fixture(t,owner);
  await page.evaluate(profile=>PTHPersonalQR.openAccount({...profile,nombre_publico:'Forged'}),child);
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);
  assert.equal(state.vendorRequests,0);assert.equal(await page.getByRole('button',{name:'QR de gestores',exact:true}).count(),0);
  await page.keyboard.press('Escape');
  await page.evaluate(profile=>PTHPersonalQR.openAccount({...profile,nombre_publico:'Forged'}),owner);
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal(await page.locator('#pth-personal-qr-name').textContent(),'Laura Hogar');
});
test('only principal admin roles see the selector and inactive own accounts have no QR',async t=>{
  for(const profile of [{...admin,rol:'logistica'},{...admin,parent_id:owner.id},inactive]){
    const {page}=await fixture(t,profile);
    assert.equal(await page.getByRole('button',{name:'QR de gestores',exact:true}).count(),0);
    if(profile===inactive)assert.equal(await page.getByRole('button',{name:'Mi QR',exact:true}).count(),0);
  }
});
test('dialog traps focus, fits mobile, Escape clears data and restores its opener',async t=>{
  const {page}=await fixture(t);await openOwn(page);
  assert.equal(await page.locator('dialog[open]').count(),1);
  const bounds=await page.locator('dialog[open]').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true,await page.evaluate(()=>JSON.stringify({active:document.activeElement.tagName,id:document.activeElement.id})));}
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
  assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Mi QR');
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);
});
test('logout during verification closes and erases the dialog and ignores its late response',async t=>{
  const {page,state}=await fixture(t);state.delay=body=>body.action==='session';
  await page.getByRole('button',{name:'Mi QR',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('dialog[open]'));
  await page.evaluate(()=>{currentUserData=null;PTHSecureData.clearSession();});
  state.releases.splice(0).forEach(resolve=>resolve());
  await page.waitForTimeout(100);
  assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#pth-personal-qr-link').count(),0);assert.equal(state.vendorRequests,0);
});
test('same-tab account and admin permission changes erase an open QR',async t=>{
  const {page}=await fixture(t,admin);await openOwn(page);
  await page.evaluate(profile=>{currentUserData=profile;localStorage.setItem('pth_session',JSON.stringify({data:profile}));window.dispatchEvent(new Event('pth:session-changed'));},child);
  assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('#pth-personal-qr-link').count(),0);
  assert.equal(await page.getByRole('button',{name:'QR de gestores',exact:true}).count(),0);
});
test('late admin searches cannot replace newer results or a selected account',async t=>{
  const {page,state}=await fixture(t,admin);await page.getByRole('button',{name:'QR de gestores',exact:true}).click();
  await page.getByRole('button',{name:'Ana',exact:true}).waitFor();
  state.delay=body=>body.filters?.some(f=>f.method==='or'&&f.value.includes('Laura'));
  await page.getByRole('searchbox',{name:'Buscar cuenta'}).fill('Laura');await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByRole('searchbox',{name:'Buscar cuenta'}).fill('Ana');await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.getByRole('button',{name:'Ana',exact:true}).click();
  state.releases.splice(0).forEach(resolve=>resolve());
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal(await page.locator('#pth-personal-qr-name').textContent(),'Ana');
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrchild');
});
test('failed lazy library keeps the link readable and retries locally',async t=>{
  const {page,state}=await fixture(t);state.failVendor=true;
  await page.getByRole('button',{name:'Mi QR',exact:true}).click();
  await page.getByRole('button',{name:'Reintentar QR',exact:true}).waitFor();
  assert.equal(await page.locator('#pth-personal-qr-link').textContent(),'https://paratuhogar.org/?s=qrown01');
  assert.equal(await page.getByRole('button',{name:'Descargar PNG',exact:true}).isDisabled(),true);
  state.failVendor=false;await page.getByRole('button',{name:'Reintentar QR',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrown01');
});
test('cancelled native share reports no completion and keeps manual download',async t=>{
  const {page}=await fixture(t,owner,{share:true});await openOwn(page);
  await page.getByRole('button',{name:'Compartir PNG',exact:true}).click();
  assert.doesNotMatch(await page.locator('#pth-personal-qr-status').textContent(),/compartido|enviado|descargado/i);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrown01');
});

test('an account deactivated after listing is verified again and cannot generate',async t=>{
  const {page,state}=await fixture(t,admin);await page.getByRole('button',{name:'QR de gestores',exact:true}).click();
  await page.getByRole('button',{name:'Ana',exact:true}).waitFor();
  state.rows=state.rows.map(row=>row.id===child.id?{...row,estado:'inactivo',activo:false}:row);
  await page.getByRole('button',{name:'Ana',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#pth-personal-qr-status')?.textContent.includes('inactiva'));
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);assert.equal(state.vendorRequests,0);
});
test('verified server demotion defeats a forged local administrator and clears prior permission',async t=>{
  const {page,state}=await fixture(t,admin);state.profile={...admin,rol:'gestor'};
  await page.getByRole('button',{name:'QR de gestores',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(await page.getByRole('button',{name:'QR de gestores',exact:true}).count(),0);
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);assert.equal(state.vendorRequests,0);
});
test('late target response cannot replace another account QR',async t=>{
  const {page,state}=await fixture(t,admin);await page.getByRole('button',{name:'QR de gestores',exact:true}).click();
  await page.getByRole('button',{name:'Ana',exact:true}).waitFor();
  state.delay=body=>body.filters?.some(filter=>filter.column==='id'&&filter.value===child.id);
  await page.getByRole('button',{name:'Ana',exact:true}).click();
  await page.evaluate(profile=>void PTHPersonalQR.openAccount(profile),owner);
  await page.waitForFunction(()=>document.querySelector('#pth-personal-qr-name')?.textContent==='Laura Hogar');
  state.releases.splice(0).forEach(resolve=>resolve());
  await page.waitForFunction(()=>!document.querySelector('#pth-personal-qr-download')?.disabled);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrown01');
});
test('cross-tab token removal and silent current account change erase open QR data',async t=>{
  const {page,context}=await fixture(t);await openOwn(page);
  const other=await context.newPage();await other.goto(origin+'/');
  await other.evaluate(()=>localStorage.removeItem('pth_secure_token'));
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(await page.locator('#pth-personal-qr-link').count(),0);
  const second=await fixture(t);await openOwn(second.page);
  await second.page.evaluate(profile=>{window.currentUserData=profile;},child);
  await second.page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  assert.equal(await second.page.locator('#pth-personal-qr-link').count(),0);
});
test('cancelled download never claims a saved PNG or blocks retry',async t=>{
  const {page}=await fixture(t);await openOwn(page);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PNG',exact:true}).click();
  await (await pending).cancel();
  assert.doesNotMatch(await page.locator('#pth-personal-qr-status').textContent(),/descargado|guardado|completad[ao]/i);
  assert.equal(await page.getByRole('button',{name:'Descargar PNG',exact:true}).isEnabled(),true);
  assert.equal((await downloadedPNG(page)).decoded.data,'https://paratuhogar.org/?s=qrown01');
});
