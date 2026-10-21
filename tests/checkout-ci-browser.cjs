// Native form and real local queue, with synthetic data and no production API.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture');
  if(['/online','/offline'].includes(url.pathname)){
   const html=fs.readFileSync(path.join(root,url.pathname==='/online'?'index.html':'offline-order.html'),'utf8');
   const input=html.match(/<input[^>]*id="check-ci"[^>]*>/)[0];
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<form id="identity-form">'+input+'</form><script src="/js/checkout-form-shared.js"></script><script src="/js/pending-checkout.js"></script>');return;
  }
  if(['/js/checkout-form-shared.js','/js/pending-checkout.js'].includes(url.pathname)){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(root,url.pathname)));return;}
  res.writeHead(404);res.end();
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM||process.env.PTH_CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  for(const route of ['/online','/offline']){
   const page=await browser.newPage();page.on('pageerror',error=>console.error(error.stack));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await page.goto(origin+route);
   const result=await page.evaluate(async()=>{
    const ci=document.getElementById('check-ci'),form=document.getElementById('identity-form');
    const checks=[!form.checkValidity()];ci.value='1234567890';checks.push(!form.checkValidity());ci.value='1234567890x';checks.push(!form.checkValidity());ci.value='00123456789';checks.push(form.checkValidity());
    const queue=PTHPendingCheckout.create(PTHPendingCheckout.indexedStore(indexedDB));
    const input={lines:[{id:'synthetic-product',qty:1,price:5}],form:{nombre:'Synthetic',tel:'50000000',pickup:true,moneda:'USD (Efectivo)',ci:''}};
    const old=await queue.save('synthetic-'+location.pathname,input);
    PTHCheckoutForm.setIdentityRequired(document,old.identityRequired===true);ci.value=old.form.ci;checks.push(form.checkValidity());
    ci.value='No especificado';checks.push(form.checkValidity());
    PTHCheckoutForm.setIdentityRequired(document,true);ci.value='';checks.push(!form.checkValidity());
    let code;try{await queue.save('synthetic-new-'+location.pathname,{...input,identityRequired:true});}catch(e){code=e.code;}
    const preserved=await queue.read('synthetic-'+location.pathname,old.id);
    return {checks,code,oldCI:preserved.form.ci,oldIntent:preserved.intentId===old.intentId};
   });
   assert.ok(result.checks.every(Boolean),JSON.stringify(result));assert.equal(result.code,'CI_REQUIRED');assert.equal(result.oldCI,'');assert.equal(result.oldIntent,true);await page.close();
  }
  console.log('PASS native online/offline CI validation, initial zeros, legacy queue exemption and restored new-form constraints; no production requests');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
