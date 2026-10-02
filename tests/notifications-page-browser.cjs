const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const role of ['angel','owner','admin','gestor','subgestor']){
 const page=await browser.newPage({viewport:{width:390,height:844}});const requests=[];
 await page.addInitScript(ready=>{localStorage.setItem('pth_secure_token','a'.repeat(64));if(ready)Object.defineProperty(window,'Notification',{value:{permission:'default',requestPermission(){throw Error('permission must never be requested on page load')}}});},['angel','owner'].includes(role));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());requests.push(url.pathname);
 if(url.pathname==='/functions/v1/secure-data'){
  const body=route.request().postDataJSON();
  const profile={id:role==='angel'?'6193f310-1e3f-4404-b874-977d0e23a6a0':role,rol:['angel','owner'].includes(role)?'superadmin':role==='subgestor'?'admin':role,parent_id:role==='subgestor'?'parent':null,estado:'activo'};
  const raw=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url');
  const ready=['angel','owner'].includes(role);
  const data=body.action==='session'?{profile}:{configured:ready,enabled:ready,allowedTopics:role==='angel'?['orders','suggestions','applications']:role==='owner'?['orders','suggestions']:['orders'],publicKey:ready?raw:null};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null}),headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'}});
 }
 const file=path.join(root,url.pathname);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:fs.readFileSync(file),contentType:url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':'application/javascript'});
 });
 const initialPermission=['angel','owner'].includes(role)?'default':await page.evaluate(()=>Notification.permission);
 await page.goto('http://127.0.0.1:8080/notifications.html');
 if(['angel','owner'].includes(role)){await page.locator('fieldset:not([hidden])').waitFor({timeout:5000}).catch(async e=>{throw Error(e.message+' '+await page.locator('body').innerText());});assert.equal(await page.locator('input[type=checkbox]').count(),role==='angel'?3:2);assert.equal(await page.locator('input[value=applications]').count(),role==='angel'?1:0);assert.equal(await page.locator('input:checked').count(),0);}
 else if(role==='admin'){await page.getByRole('status').filter({hasText:'aún no están habilitadas'}).waitFor({timeout:5000}).catch(async e=>{throw Error(e.message+' '+await page.locator('body').innerText());});assert.equal(await page.getByRole('button',{name:'Activar notificaciones',exact:true}).isVisible(),false);assert.equal(await page.getByRole('button',{name:'Volver a comprobar'}).evaluate(e=>getComputedStyle(e).cursor),'pointer');}
 else await page.locator('#push-settings').filter({hasText:'Entra con tu cuenta de administración'}).waitFor();
 assert.equal(requests.some(p=>p==='/service-worker.js'),false);assert.equal(await page.evaluate(()=>Notification.permission),initialPermission);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log(`PASS actual notifications page ${role}: authenticated settings, correct topic choices, no registration/prompt, mobile`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
