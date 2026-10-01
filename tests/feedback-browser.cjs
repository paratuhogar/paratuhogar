// Local browser smoke test, mocks only the authenticated gateway. Never touches production.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const screenshots=process.env.PTH_FEEDBACK_SCREENSHOTS;
if(screenshots)fs.mkdirSync(screenshots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 for(const width of [360,390,1280]){
 const page=await browser.newPage({viewport:{width,height:850}});let reports=[],requests=[],drop=true,isOwner=false;
 await page.addInitScript(()=>localStorage.setItem('pth_secure_token','a'.repeat(64)));
 await page.route('https://ljqwaovevfatkiigirhf.supabase.co/**',async route=>{
 const body=route.request().postDataJSON();let data;
 if(body.action==='session')data={profile:{id:'a',rol:'gestor',nombre:'Test'}};
 if(body.operation==='list')data={rows:reports,owner:isOwner,next:null};
 if(body.operation==='create'){
 requests.push(body);if(!reports.length)reports.push({...body,status:'nuevo',created_at:new Date().toISOString(),revision:0,response:''});
 if(drop){drop=false;return route.abort('failed');}data={id:body.id};
 }
 await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8080'},body:JSON.stringify({data,error:null})});
 });
 await page.goto('http://127.0.0.1:8080/feedback.html');await page.waitForFunction(()=>document.querySelector('#message').textContent==='Sección privada.');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('#need-label').textContent(),'¿Qué intentabas hacer?');
 assert.equal(await page.locator('#benefit-wrap').isVisible(),false);
 assert.equal(await page.locator('#submit').textContent(),'Enviar problema');
 assert.doesNotMatch(await page.locator('body').innerText(),/dueño/i);
 for(const selector of ['#kind','#title','#need','#workflow','#screenshot','#submit','#refresh','.back-link']){
 const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44,selector+' tap target');
 }
 await page.locator('#submit').focus();assert.equal(await page.locator('#submit').evaluate(e=>getComputedStyle(e).outlineWidth),'3px');
 if(screenshots){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${screenshots}/feedback-problema-${width}.png`,fullPage:true});}
 await page.selectOption('[name=kind]','mejora');
 assert.equal(await page.locator('#need-label').textContent(),'¿Qué te gustaría poder hacer?');
 assert.equal(await page.locator('#workflow-label').textContent(),'¿Cómo lo haces ahora?');
 assert.equal(await page.locator('#benefit').evaluate(e=>e.required),true);
 assert.equal(await page.locator('#submit').textContent(),'Enviar mejora');
 if(screenshots){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${screenshots}/feedback-mejora-${width}.png`,fullPage:true});}
 await page.fill('[name=title]','<img src=x onerror=alert(1)>');await page.fill('[name=need]','Necesito compartir productos');await page.fill('[name=workflow]','Los copio manualmente');await page.fill('[name=benefit]','Ahorraría diez minutos');
 await page.setInputFiles('#screenshot',{name:'private.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=50;canvas.height=50;canvas.getContext('2d').fillRect(0,0,50,50);return canvas.toDataURL('image/png').split(',')[1];}),'base64')});await page.waitForSelector('#preview:visible');
 await page.click('#submit');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('no se creará un duplicado'));
 assert.equal(await page.inputValue('[name=need]'),'Necesito compartir productos');await page.click('#submit');await page.waitForSelector('#reports article');assert.equal(requests.length,2);assert.equal(requests[0].id,requests[1].id);assert.equal(await page.locator('#reports img').count(),0);assert.equal(await page.locator('#reports article').count(),1);
 isOwner=true;await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('#list-title').textContent==='Revisión de reportes y mejoras');
 assert.doesNotMatch(await page.locator('body').innerText(),/dueño/i);
 await page.locator('#reports summary').click();assert.equal(await page.locator('#reports select').first().inputValue(),'nuevo');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>{localStorage.removeItem('pth_secure_token');dispatchEvent(new StorageEvent('storage',{key:'pth_secure_token'}));});assert.equal(await page.locator('#private').isVisible(),false);assert.equal(await page.locator('#reports article').count(),0);
 await page.close();console.log(`PASS ${width}px: layout, improvement, failed network/retry, duplicate key, inert HTML, session clearing`);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
