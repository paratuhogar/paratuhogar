const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { chromium } = require('playwright');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const nav = html.match(/<nav id="admin-nav"[\s\S]*?<\/nav>/)[0];
const card = html.match(/<aside id="pth-guide-download"[\s\S]*?<\/aside>/)[0];
const css = ['work-navigation', 'gestor-guide'].map(name => fs.readFileSync(path.join(root, 'css', name + '.css'), 'utf8')).join('\n');
const js = fs.readFileSync(path.join(root, 'js/gestor-guide.js'), 'utf8');
const pdf = process.env.PTH_GUIDE_TEST_PDF ? fs.readFileSync(process.env.PTH_GUIDE_TEST_PDF) : Buffer.from('%PDF-1.7\nlocal test fixture\n%%EOF\n');
const release = { published: true, status: 'final', path: '/guias/guia-gestores.pdf', updatedAt: '2026-10-03', revision: '2026-10-03.1', bytes: pdf.length, sha256: crypto.createHash('sha256').update(pdf).digest('hex') };
(async () => {
 let server;
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 try {
  let metadata = { published: false, status: 'pending' }, heads = 0, reads = 0, status = 200, contentType = 'application/pdf', length = pdf.length, hold = null, delayed = false;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  server=http.createServer(async(req,res)=>{
   const u=new URL(req.url,'http://127.0.0.1');
   if(u.pathname==='/'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    return res.end('<!doctype html><html lang="es"><head><style>@font-face{font-family:Manrope;src:url(/assets/fonts/Manrope.ttf);font-weight:200 800}body{margin:0}.hidden{display:none}*{box-sizing:border-box}'+css+'</style></head><body><main>'+nav+'<div id="sec-catalogo">Catálogo de prueba</div><section id="sec-dashboard" hidden>'+card+'Dashboard de prueba</section></main><script>window.currentUserData=null;window.token=null;window.adminView=false;window.PTHSecureData={token:()=>window.token};window.PTHWorkView={isAdminView:()=>window.adminView};</script><script>'+js+'</script></body></html>');
   }
   if(u.pathname==='/assets/fonts/Manrope.ttf'){res.writeHead(200,{'Content-Type':'font/ttf'});return res.end(fs.readFileSync(path.join(root,'assets/fonts/Manrope.ttf')));}
   if(u.pathname==='/guias/gestores.json'){reads++;if(delayed)await new Promise(r=>{hold=r;});res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(metadata));}
   if(u.pathname==='/guias/guia-gestores.pdf'){if(req.method==='HEAD')heads++;res.writeHead(status,{'Content-Type':contentType,'Content-Length':length});return res.end(req.method==='HEAD'?'':pdf);}
   res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const session = async (role='gestor',dashboard=true) => page.evaluate(({role,dashboard}) => {
   window.currentUserData=role==='visitor'?null:{id:role,parent_id:role==='child'?'principal':null};window.token=role==='visitor'?null:'fixture-token';window.adminView=role==='admin';
   document.getElementById('admin-nav').classList.toggle('hidden',role==='visitor'||role==='admin');
   document.getElementById('sec-dashboard').hidden=!dashboard||role==='visitor'||role==='admin';
   dispatchEvent(new Event('pth:session-changed'));
  },{role,dashboard});
  const hidden = async () => { await page.waitForFunction(()=>document.getElementById('pth-guide-download').hidden); assert.equal(await page.locator('#pth-guide-link').getAttribute('href'),null); };
  await page.goto('http://127.0.0.1:'+server.address().port+'/'); await hidden(); assert.equal(reads,0,'visitor must not fetch guide metadata');
  await session(); await page.waitForTimeout(70); await hidden(); assert.equal(heads,0,'pending guide must not request a nonexistent PDF');
  metadata=release; await page.evaluate(()=>PTHGuide.sync(true)); await page.waitForFunction(()=>!document.getElementById('pth-guide-download').hidden);
  assert.equal(await page.locator('#sec-dashboard #pth-guide-download').count(),1,'guide belongs to Dashboard');
  await session('gestor',false); await hidden();
  const catalogueReads=reads; await page.evaluate(()=>PTHGuide.sync(true)); assert.equal(reads,catalogueReads,'catalogue does not fetch guide metadata');
  await session(); await page.waitForFunction(()=>!document.getElementById('pth-guide-download').hidden);
  assert.equal(await page.locator('#pth-guide-download').count(),1);
  assert.equal(await page.locator('#pth-guide-link').getAttribute('href'),'/guias/guia-gestores.pdf?v=2026-10-03.1');
  assert.match(await page.locator('#pth-guide-meta').textContent(),/Revisión 1/);
  for(const width of [320,390,1280])for(const dark of [false,true]) {
   await page.setViewportSize({width,height:844});await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
   const frame=await page.locator('#pth-guide-download').evaluate(node=>{const a=node.querySelector('a'),r=a.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,linkHeight:r.height,cardWidth:node.getBoundingClientRect().width,viewport:innerWidth};});
   assert.equal(frame.overflow,false);assert.ok(frame.linkHeight>=44);assert.ok(frame.cardWidth<=frame.viewport);
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  await page.locator('#pth-guide-link').focus();assert.notEqual(await page.locator('#pth-guide-link').evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#pth-guide-link').click()]);
  const downloaded=await download.path();assert.equal(crypto.createHash('sha256').update(fs.readFileSync(downloaded)).digest('hex'),release.sha256,'download bytes match metadata');
  if(process.env.PTH_GUIDE_CAPTURE){await page.evaluate(()=>{const e=document.createElement('div');e.textContent='DEMOSTRACIÓN LOCAL · DATOS FICTICIOS';Object.assign(e.style,{background:'#0b2550',color:'white',font:'bold 10px sans-serif',textAlign:'center',padding:'6px'});document.body.prepend(e);});await page.evaluate(()=>document.fonts.ready);const bottom=await page.locator('#pth-guide-download').evaluate(n=>n.getBoundingClientRect().bottom);await page.screenshot({path:process.env.PTH_GUIDE_CAPTURE,clip:{x:0,y:0,width:390,height:Math.ceil(bottom+8)}});}
  await session('child');await page.waitForFunction(()=>!document.getElementById('pth-guide-download').hidden);
  await session('admin');await hidden();await session('visitor');await hidden();
  metadata={...release,bytes:5000001};await session();await page.waitForTimeout(70);await hidden();
  metadata={...release,status:'draft'};await page.evaluate(()=>PTHGuide.sync(true));await hidden();
  metadata={...release,path:'https://example.invalid/private.pdf'};await page.evaluate(()=>PTHGuide.sync(true));await hidden();
  metadata=release;status=404;await page.evaluate(()=>PTHGuide.sync(true));await hidden();
  status=200;contentType='text/html';await page.evaluate(()=>PTHGuide.sync(true));await hidden();
  contentType='application/pdf';length=pdf.length+1;await page.evaluate(()=>PTHGuide.sync(true));await hidden();
  length=pdf.length;delayed=true;void page.evaluate(()=>PTHGuide.sync(true));await page.waitForTimeout(70);await session('visitor');hold();await page.waitForTimeout(70);await hidden();delayed=false;
  await session();await page.waitForFunction(()=>!document.getElementById('pth-guide-download').hidden);
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));await hidden();await page.evaluate(()=>dispatchEvent(new Event('pageshow')));await page.waitForFunction(()=>!document.getElementById('pth-guide-download').hidden);
  await page.addStyleTag({content:'#pth-guide-download{font-size:26px}#pth-guide-download h2{font-size:32px}#pth-guide-download .pth-guide-meta{font-size:24px}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'enlarged text fits mobile');
  assert.deepEqual(errors,[]);
  console.log('PASS Dashboard-only guide, no catalogue requests, roles, pending/final gates, stable download bytes, 320/390/1280, dark/light, focus, oversized text, errors, late response and back navigation');
  await page.close();
 } finally { await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));} }
})().catch(error=>{console.error(error);process.exitCode=1;});
