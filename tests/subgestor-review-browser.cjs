// Loopback-only synthetic UI. No accounts, real customer data or production API.
const {chromium}=require(process.env.PTH_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><div id="admin-subgestor-review"></div><script>
window.currentUserData={id:'synthetic-admin',rol:'admin'};window.reviewCalls=[];
window.syntheticRow={id:'00000000-0000-4000-8000-000000000010',orden_dia:'CA-1587',cliente:'<img src=x onerror=evil()>',subgestor_nombre:'Child Fixture',parent_gestor_nombre:'Parent Fixture',producto:'Cocina de prueba',total:53,telefono:'50000000',ci:'00123456789',municipio:'Habana',direccion:'Calle uno [NOTA: llamar] [VUELTO: 100]',review_version:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
window.PTHSecureData={token:()=> 'fixture-only',reviewSubgestor:async b=>{reviewCalls.push(b);if(b.operation==='list')return {data:{rows:reviewCalls.some(c=>c.operation==='approve')?[]:[syntheticRow],hasMore:false}};if(b.operation==='edit'){Object.assign(syntheticRow,b.changes);syntheticRow.review_version='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';return{data:{id:syntheticRow.id}};}return{data:{id:syntheticRow.id}};}};
</script><link rel="stylesheet" href="/css/subgestor-review.css"><script src="/js/subgestor-review.js"></script><script>PTHSubgestorReview.open();</script>`;
(async()=>{
 const server=http.createServer((req,res)=>{if(req.url==='/fixture'){res.setHeader('content-type','text/html');return res.end(fixture);}if(!['/js/subgestor-review.js','/css/subgestor-review.css'].includes(req.url)){res.writeHead(404);return res.end();}res.setHeader('content-type',req.url.endsWith('.js')?'application/javascript':'text/css');res.end(fs.readFileSync(path.join(root,req.url)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin+'/fixture');
  await page.getByText('#CA-1587',{exact:true}).waitFor();assert.equal(await page.locator('article img').count(),0);
  await page.getByRole('button',{name:'Editar entrega'}).click();await page.getByRole('dialog').waitFor();
  await page.getByLabel('Vuelto de ($)',{exact:true}).fill('50');await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const edit=await page.evaluate(()=>reviewCalls.find(c=>c.operation==='edit'));assert.equal(edit.changes.direccion,'Calle uno [NOTA: llamar] [VUELTO: 50]');assert.equal(edit.expected,'a'.repeat(32));
  const search=page.getByRole('textbox',{name:'Buscar pedidos de subgestores'});await search.fill('CA-1587');await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await page.waitForFunction(()=>reviewCalls.some(c=>c.operation==='list'&&c.search==='CA-1587'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Aprobar',exact:true}).click();assert.equal(await page.evaluate(()=>reviewCalls.some(c=>c.operation==='approve')),false);
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Aprobar',exact:true}).click();try{await page.getByText('Pedido aprobado. Ya está disponible en logística.',{exact:true}).waitFor({timeout:5000});}catch(e){console.log(await page.locator('body').innerText(),await page.evaluate(()=>reviewCalls),errors);throw e;}
  assert.equal(await page.evaluate(()=>reviewCalls.filter(c=>c.operation==='approve').length),1);
  assert.deepEqual(errors,[]);console.log('PASS synthetic admin review, safe text, edit/vuelto, reference search, confirm and approval at '+viewport.width+'px');await page.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
