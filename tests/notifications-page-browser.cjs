const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const role of ['admin','gestor','subgestor']){
 const page=await browser.newPage({viewport:{width:390,height:844}});const requests=[];
 await page.addInitScript(()=>localStorage.setItem('pth_secure_token','a'.repeat(64)));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());requests.push(url.pathname);
 if(url.pathname==='/functions/v1/secure-data'){
  const body=route.request().postDataJSON();const data=body.action==='session'?{profile:{id:role,rol:role==='subgestor'?'admin':role,parent_id:role==='subgestor'?'parent':null,estado:'activo'}}:{configured:false,enabled:false,allowedTopics:['orders'],publicKey:null};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({data,error:null}),headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'}});
 }
 const file=path.join(root,url.pathname);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({body:fs.readFileSync(file),contentType:url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':'application/javascript'});
 });
 const initialPermission=await page.evaluate(()=>Notification.permission);
 await page.goto('http://127.0.0.1:8080/notifications.html');
 if(role==='admin'){await page.getByRole('status').filter({hasText:'aún no están habilitadas'}).waitFor({timeout:5000}).catch(async e=>{throw Error(e.message+' '+await page.locator('body').innerText());});assert.equal(await page.getByRole('button',{name:'Activar notificaciones',exact:true}).isVisible(),false);assert.equal(await page.getByRole('button',{name:'Volver a comprobar'}).evaluate(e=>getComputedStyle(e).cursor),'pointer');}
 else await page.locator('#push-settings').filter({hasText:'Entra con tu cuenta de administración'}).waitFor();
 assert.equal(requests.some(p=>p==='/service-worker.js'),false);assert.equal(await page.evaluate(()=>Notification.permission),initialPermission);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);console.log(`PASS actual notifications page ${role}: authenticated settings, disabled, no registration/prompt, mobile`);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
