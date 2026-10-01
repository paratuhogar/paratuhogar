// Real embedded reviewer + real tab/date rendering, with a mocked authenticated gateway.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/storefront.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const tab=source.slice(source.indexOf('function changeAdminTab(tab)'),source.indexOf('// Registro de estadísticas',source.indexOf('function changeAdminTab(tab)')));
const dates=source.slice(source.indexOf('function formatTeamReportDate('),source.indexOf('async function loadAdminReports()'));
const render=source.slice(source.indexOf('function renderAdminReports()'),source.indexOf('let categoriasAdminBD',source.indexOf('function renderAdminReports()')));
const section=html.slice(html.indexOf('<section id="cnt-feedback"'),html.indexOf('<div id="cnt-buzon"'));
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [360,390,1280])for(const role of ['owner','admin','gestor','subgestor']){
 const page=await browser.newPage({viewport:{width,height:850}});let listCalls=0,screenshotCalls=0;
 await page.addInitScript(()=>localStorage.setItem('pth_secure_token','a'.repeat(64)));
 await page.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.pathname==='/functions/v1/secure-data'){
  const b=route.request().postDataJSON();let data;
  if(b.action==='session')data={profile:{id:role,rol:role==='owner'?'admin':role==='subgestor'?'gestor':role,parent_id:role==='subgestor'?'parent':null}};
  if(b.operation==='list'){listCalls++;data={owner:role==='owner',next:null,rows:[{id:'11111111-1111-4111-8111-111111111111',kind:'mejora',title:'<script>bad()</script>',need:'Necesidad de prueba',workflow:'Hoy copio uno a uno',benefit:'Ahorrar tiempo',page:'/index.html',created_at:'2026-10-01T12:30:00Z',status:'nuevo',priority:'normal',response:'',owner_note:'Nota reservada',revision:0}]};}
  if(b.operation==='screenshot'){screenshotCalls++;data={screenshot:null};}
  return route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null}),headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'}});
 }
 if(u.pathname==='/admin-fixture')return route.fulfill({contentType:'text/html',body:`<style>*{box-sizing:border-box}.hidden{display:none}body{margin:8px}button{min-height:44px}</style><button id="tab-feedback" class="btn-tab-admin" onclick="changeAdminTab('feedback')">Problemas y mejoras</button><button id="tab-buzon" class="btn-tab-admin" onclick="changeAdminTab('buzon')">Buzón</button>${section}<div id="cnt-buzon" class="tab-cnt hidden"><div id="list-admin-reportes"></div></div>`});
 const file=path.join(root,u.pathname);if(!file.startsWith(root)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:fs.readFileSync(file),contentType:u.pathname.endsWith('.html')?'text/html':u.pathname.endsWith('.css')?'text/css':'application/javascript'});
 });
 await page.goto('http://127.0.0.1:8080/admin-fixture');await page.addScriptTag({content:tab+dates+render});
 assert.equal(listCalls,0);await page.click('#tab-feedback');const frame=page.frameLocator('iframe');
 await frame.locator('#message').filter({hasText:role==='owner'?'Sección privada.':'Tu cuenta no tiene acceso'}).waitFor();
 assert.equal(await frame.locator('#feedback-form').isVisible(),false);
 if(role==='owner'){
  assert.equal(await frame.locator('#reports article').count(),1);assert.equal(await frame.locator('#reports script').count(),0);
  await frame.locator('#reports summary').click();assert.equal(await frame.locator('#reports select').first().inputValue(),'nuevo');
  assert.match(await frame.locator('#reports article').innerText(),/0?8:30/);assert.equal(screenshotCalls,0);
 }else{assert.equal(await frame.locator('#private').isVisible(),false);assert.equal(await frame.locator('#reports article').count(),0);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(role==='owner'){
  await page.evaluate(()=>localStorage.removeItem('pth_secure_token'));
  await frame.locator('#message').filter({hasText:'La sesión cambió'}).waitFor();assert.equal(await frame.locator('#reports article').count(),0);
 }
 await page.click('#tab-buzon');assert.equal(await page.locator('iframe').count(),0);
 await page.evaluate(()=>{window.reportesAdminRaw=[{categoria:'Solicitud',gestor:'<img src=x onerror=bad()>',mensaje:'<script>bad()</script>',created_at:'2026-10-01T12:30:00Z'},{categoria:'Problema',gestor:'Test',mensaje:'Sin fecha',created_at:null}];renderAdminReports();});
 assert.match(await page.locator('#list-admin-reportes').innerText(),/08:30.*Cuba/);assert.match(await page.locator('#list-admin-reportes').innerText(),/Fecha no disponible/);assert.equal(await page.locator('#list-admin-reportes script,#list-admin-reportes img').count(),0);
 assert.match(await page.evaluate(()=>formatTeamReportDate('2026-01-01T12:30:00Z')),/07:30/);
 assert.equal(await page.evaluate(()=>formatTeamReportDate('invalid')),'Fecha no disponible');
 console.log(`PASS ${width}px ${role}: embedded access, deferred loading, inert text, session clear/unmount, Havana dates`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
