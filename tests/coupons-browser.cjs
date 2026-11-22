const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{chromium}=require('playwright');
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.PTH_CHROMIUM||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});});
test.after(async()=>{await browser?.close();});
async function page(){const p=await browser.newPage();await p.setContent('<form id="checkout-form"><input id="check-tel" value="51234567"><div id="total-convertido">$106</div></form><nav id="admin-master-nav"></nav>');await p.evaluate(()=>{window.PTHSecureData={token:()=>null,coupons:async()=>({data:{enabled:true},error:null})};});const script=path.resolve(__dirname,'../js/coupons.js');if(fs.existsSync(script))await p.addScriptTag({path:script});assert.equal(await p.evaluate(()=>!!window.PTHCoupons),true,'Coupon control exposes review without submitting');return p;}
const request={table:'pedidos',inputs:[{proveedor:'A',telefono:'51234567'}],delivery:{pickup:true},intentId:'x',coupon:'AHORRO'};
const quote={terms:[{proveedor:'A',total:101,costo_mensajeria:6,subtotal_productos:100,descuento_productos:5,cupon_codigo:'AHORRO'}]};
test('client coupon is collapsed, displays exact canonical net and requires a second explicit confirmation',async()=>{
 const p=await page();await p.waitForSelector('#pth-coupon-entry');assert.equal(await p.locator('#pth-coupon-entry').evaluate(n=>n.open),false);
 await p.locator('#pth-coupon-entry summary').click();await p.locator('#pth-coupon-code').fill('ahorro');
 assert.equal(await p.evaluate(()=>PTHCoupons.code()),'AHORRO');
 assert.equal(await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]),false);
 assert.match(await p.locator('#pth-coupon-summary').innerText(),/5\.00/);assert.equal(await p.locator('#total-convertido').innerText(),'$101.00');
 assert.equal(await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]),true);
 await p.locator('#check-tel').fill('51234568');assert.equal(await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]),false);
 await p.close();
});
test('coupon failure retains code and input instead of clearing or submitting at full price',async()=>{
 const p=await page();await p.waitForSelector('#pth-coupon-entry');await p.locator('summary').click();await p.locator('#pth-coupon-code').fill('AHORRO');
 await p.evaluate(()=>PTHCoupons.failure({message:'Cupón no disponible'}));assert.equal(await p.locator('#check-tel').inputValue(),'51234567');assert.equal(await p.locator('#pth-coupon-code').inputValue(),'AHORRO');assert.match(await p.locator('#pth-coupon-status').innerText(),/no disponible/);await p.close();
});
test('Apply never submits an empty or malformed code and carries a quote-only intent',async()=>{
 const p=await page();await p.waitForSelector('#pth-coupon-entry');await p.locator('summary').click();
 await p.evaluate(()=>{window.requests=[];document.getElementById('checkout-form').onsubmit=e=>{e.preventDefault();requests.push(PTHCoupons.consumeApply?.()===true);};});
 await p.getByRole('button',{name:'Aplicar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>requests),[]);
 await p.locator('#pth-coupon-code').fill('bad!');await p.getByRole('button',{name:'Aplicar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>requests),[]);
 await p.locator('#pth-coupon-code').fill('VALID');await p.getByRole('button',{name:'Aplicar',exact:true}).click();assert.deepEqual(await p.evaluate(()=>requests),[true]);await p.close();
});
test('manually clearing the code restores the undiscounted total before another confirmation',async()=>{
 const p=await page();await p.waitForSelector('#pth-coupon-entry');await p.locator('summary').click();await p.locator('#pth-coupon-code').fill('AHORRO');
 await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]);assert.equal(await p.locator('#total-convertido').innerText(),'$101.00');
 await p.locator('#pth-coupon-code').fill('');assert.equal(await p.locator('#total-convertido').innerText(),'$106.00');assert.equal(await p.locator('#pth-coupon-summary').isVisible(),false);await p.close();
});
test('late quote cannot restore a discount after code or phone changes',async()=>{
 const p=await page();await p.waitForSelector('#pth-coupon-entry');await p.locator('summary').click();await p.locator('#pth-coupon-code').fill('AHORRO');
 await p.locator('#pth-coupon-code').fill('');assert.equal(await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]),false);assert.equal(await p.locator('#total-convertido').innerText(),'$106');
 await p.locator('#pth-coupon-code').fill('AHORRO');await p.locator('#check-tel').fill('51234568');assert.equal(await p.evaluate(([r,q])=>PTHCoupons.review(r,q),[request,quote]),false);assert.equal(await p.locator('#total-convertido').innerText(),'$106');await p.close();
});
async function adminPage(){
 const p=await browser.newPage();await p.route('https://coupon.test/**',r=>r.fulfill({contentType:'text/html',body:'<nav id="admin-master-nav"></nav>'}));await p.goto('https://coupon.test/');
 await p.evaluate(()=>{
  localStorage.setItem('pth_session',JSON.stringify({data:{id:'11111111-1111-4111-a111-111111111111',nombre:'Admin',rol:'admin',estado:'activo',activo:true}}));localStorage.setItem('token','original');window.savedCampaigns=[];
  window.PTHSecureData={token:()=>localStorage.getItem('token'),coupons:async body=>{if(body.operation==='settings')return {data:{enabled:false},error:null};if(body.operation==='list')return {data:{rows:[]},error:null};savedCampaigns.push(body.campaign);if(window.delaySave)await new Promise(resolve=>window.releaseSave=resolve);return {data:body.campaign,error:null};}};
 });await p.addScriptTag({path:path.resolve(__dirname,'../js/coupons.js')});return p;
}
test('administrator prepares an inactive coupon with USD cents and explicit validity and limits',async()=>{
 const p=await adminPage();await p.locator('#pth-coupons-admin').click();
 const form=p.locator('#pth-coupon-dialog form');for(const [name,value] of Object.entries({code:'SAVE5',value:'5',minimum:'0',starts_at:'2026-11-22T12:00',ends_at:'2026-12-22T12:00',total_limit:'100',phone_limit:'1',reason:'Nueva promoción'}))await form.locator(`[name=${name}]`).fill(value);
 await form.getByRole('button',{name:'Guardar cupón'}).click();await p.waitForFunction(()=>savedCampaigns.length===1);
 const c=await p.evaluate(()=>savedCampaigns[0]);assert.equal(c.value,500);assert.equal(c.active,false);assert.equal(c.kind,'fixed');assert.equal(c.phone_limit,1);assert.ok(c.starts_at.endsWith('Z'));await p.close();
});
test('logout closes and erases a pending administrative coupon view',async()=>{
 const p=await adminPage();await p.locator('#pth-coupons-admin').click();
 await p.evaluate(()=>{localStorage.removeItem('token');window.dispatchEvent(new Event('pth:session-changed'));});
 assert.equal(await p.locator('#pth-coupon-dialog').evaluate(d=>d.open),false);assert.equal(await p.locator('#pth-coupon-dialog').innerHTML(),'');await p.close();
});
