import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';

async function direct(enabled=true){
 const f=await fixture({couponsEnabled:enabled});
 for(const row of f.body.inputs){row.gestor='Venta Directa';row.telefono='+53 5 1234567';}
 f.body.coupon=' verano-5 ';
 const rpc=f.db.rpc;f.couponCalls=[];
 f.db.rpc=async(name,args)=>{
  if(name==='pth_coupon_quote'){
   f.couponCalls.push({name,args});
   return f.quoteError?{data:null,error:{code:f.quoteError}}:{data:{id:'11111111-1111-4111-a111-111111111111',revision:f.revision||1,code:'VERANO-5',subtotal_cents:30000,discount_cents:500,allocations:[{proveedor:'A',gross_cents:10000,discount_cents:167,net_cents:9833},{proveedor:'B',gross_cents:20000,discount_cents:333,net_cents:19667}]},error:null};
  }
  if(name==='pth_insert_coupon_checkout'){
   f.couponCalls.push({name,args});
   if(f.insertError)return {data:null,error:{code:f.insertError}};
   const saved=args.p_rows.map(row=>{const a=args.p_coupon.allocations.find(x=>x.proveedor===row.proveedor);return {...row,total:a.net_cents/100+row.costo_mensajeria,subtotal_productos:a.gross_cents/100,descuento_productos:a.discount_cents/100,cupon_codigo:args.p_coupon.code};});
   return rpc('pth_insert_checkout',{p_table:'pedidos',p_rows:saved});
  }
  return rpc(name,args);
 };
 f.q=()=>f.request({...f.body,operation:'quote'},null);
 f.s=q=>f.request({...f.body,operation:'submit',attempt:q.data.attempt,quote:q.data.quote},null);
 return f;
}
test('coupon is server quoted, signs net products, and leaves shipping and commission untouched',async()=>{
 const f=await direct(),q=await f.q();assert.equal(q.error,null);
 assert.deepEqual(q.data.terms.map(t=>[t.total,t.subtotal_productos,t.descuento_productos,t.costo_mensajeria]),[[104.33,100,1.67,6],[196.67,200,3.33,0]]);
 assert.equal(q.data.terms[0].cupon_codigo,'VERANO-5');
 assert.equal((await f.s(q)).data?.complete,true);
 const saved=f.rows.pedidos.slice(1);assert.deepEqual(saved.map(x=>x.total),[104.33,196.67]);assert.deepEqual(saved.map(x=>x.comision_total),[0,0]);
 assert.ok(f.couponCalls.find(x=>x.name==='pth_insert_coupon_checkout').args.p_rows.every(x=>!Object.hasOwn(x,'descuento_productos')));
});
test('disabled coupons never fall back to full price',async()=>{
 const f=await direct(false),q=await f.q();assert.equal(q.error?.code,'COUPON_UNAVAILABLE');assert.equal(f.writes,0);assert.equal(f.couponCalls.length,0);
});
test('commercial session and reference context fail before coupon lookup',async()=>{
 const f=await direct();const auth=await f.request({...f.body,operation:'quote'});assert.equal(auth.error?.code,'COUPON_INVALID');
 f.body.inputs[0]._referral_reference='ref-id';assert.equal((await f.q()).error?.code,'COUPON_INVALID');assert.equal(f.couponCalls.length,0);
});
test('phone and code changes cannot reuse a signed attempt and revision changes need review',async()=>{
 const f=await direct(),q=await f.q();f.body.inputs[0].telefono='51234568';assert.equal((await f.s(q)).error?.code,'PAYLOAD_CHANGED');
 f.body.inputs[0].telefono='+53 5 1234567';f.body.coupon='OTHER';assert.equal((await f.s(q)).error?.code,'PAYLOAD_CHANGED');
 f.body.coupon='verano-5';f.revision=2;assert.equal((await f.s(q)).error?.code,'CONDITIONS_CHANGED');assert.equal(f.writes,0);
});
test('rate and stale quota responses preserve draft and cannot silently submit undiscounted',async()=>{
 const f=await direct();f.quoteError='PT429';assert.equal((await f.q()).error?.code,'COUPON_RATE_LIMIT');assert.equal(f.writes,0);
 delete f.quoteError;const q=await f.q();f.insertError='PT409';assert.equal((await f.s(q)).error?.code,'COUPON_INVALID');assert.equal(f.writes,0);
});
test('accepted receipt is returned even when the campaign later becomes invalid',async()=>{
 const f=await direct(),q=await f.q();assert.equal((await f.s(q)).data?.complete,true);f.quoteError='PT409';
 assert.equal((await f.s(q)).data?.complete,true);assert.equal(f.writes,1);
});
test('absent coupon keeps the old signed payload and insertion path',async()=>{
 const f=await direct();delete f.body.coupon;const q=await f.q();assert.equal(q.error,null);assert.deepEqual(q.data.terms.map(t=>t.total),[106,200]);assert.equal((await f.s(q)).data?.complete,true);assert.equal(f.couponCalls.length,0);
});
test('rate key cannot be bypassed by alternate formats of the same Cuban phone',async()=>{
 const f=await direct();await f.q();for(const row of f.body.inputs)row.telefono='051234567';await f.q();
 assert.equal(f.couponCalls[0].args.p_rate_key,f.couponCalls[1].args.p_rate_key);
});
test('generic administration cannot fabricate coupon snapshots',async()=>{
 const f=await fixture();f.rows.gestores[0].rol='admin';
 const r=await f.request({action:'query',table:'pedidos',op:'update',values:{subtotal_productos:200,descuento_productos:10,cupon_codigo:'FAKE'},filters:[{column:'id',method:'eq',value:f.historical.id}]});
 assert.ok(r.error);assert.equal(f.rows.pedidos[0].cupon_codigo,undefined);
});
