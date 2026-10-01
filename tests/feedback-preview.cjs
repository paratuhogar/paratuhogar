// Start scripts/preview-feedback.py first. Every backend request is mocked here.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();const actions=[];
  await page.route('https://ljqwaovevfatkiigirhf.supabase.co/**',async route=>{
   const body=route.request().postDataJSON();actions.push(body.action);
   const profile={id:'test',nombre:'Synthetic QA',rol:'gestor',password:'__session__'};
   const data=body.action==='login'?{token:'a'.repeat(64),profile}:body.action==='session'?{profile}:body.action==='feedback'?{rows:[],owner:false,next:null}:null;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,error:null})});
  });
  for(const path of ['/.git/config','/docs/','/js/','/supabase/functions/secure-data/index.ts']){
   const response=await page.request.get('http://127.0.0.1:8080'+path);assert.equal(response.status(),404);
  }
  const response=await page.goto('http://127.0.0.1:8080/');assert.equal(response.headers()['cache-control'],'no-store');
  await page.fill('#username','synthetic-qa-user');await page.fill('#password','synthetic-qa-password');await page.click('#submit');await page.waitForSelector('#open:visible');
  assert.equal(await page.inputValue('#password'),'');assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('synthetic-qa-password')),false);
  await page.click('#open');await page.waitForFunction(()=>document.querySelector('#message').textContent==='Sección privada.');
  await page.goto('http://127.0.0.1:8080/');await page.waitForSelector('#logout:visible');await page.click('#logout');await page.waitForSelector('#login:visible');assert.equal(await page.evaluate(()=>localStorage.getItem('pth_secure_token')),null);
  assert.ok(actions.includes('login')&&actions.includes('logout')&&actions.includes('feedback'));
  console.log('PASS private preview: repository/backend paths denied, no-store, ordinary login, password field cleared, private feedback navigation, logout clears token; backend mocked.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
