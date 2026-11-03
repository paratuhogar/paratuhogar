import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';
const DAY=86400000;
test('one hour and arbitrary phone-date offsets never determine attempt validity',async()=>{
 for(const offset of [3600000,-3600000,3650*DAY,-3650*DAY]){
  const f=await fixture();f.body.intentCreatedAt+=offset;
  const q=await f.quote();assert.equal(q.error,null,JSON.stringify(q.error));
  assert.equal(q.data.attempt.split('.')[0],'pthn2');
  assert.ok(Math.abs(Number(q.data.attempt.split('.')[1])-Date.now())<5000);
  assert.equal((await f.submit(q)).data.complete,true);assert.equal(f.writes,1);
 }
});
test('two quotes of one draft share server issue time and cannot duplicate an order',async()=>{
 const f=await fixture();const [a,b]=await Promise.all([f.quote(),f.quote()]);
 assert.equal(a.error,null);assert.equal(b.error,null);assert.equal(a.data.attempt,b.data.attempt);
 const replies=await Promise.all([f.submit(a),f.submit(b)]);assert.ok(replies.every(r=>r.data.complete));assert.equal(f.writes,1);
});
test('changing phone metadata while retrying does not change a server-timed identity',async()=>{
 const f=await fixture(),q=await f.quote();f.body.intentCreatedAt+=3600000;
 const next=await f.request({...f.body,operation:'quote',attempt:q.data.attempt});assert.equal(next.error,null);assert.equal(next.data.attempt,q.data.attempt);
 assert.equal((await f.submit(next)).data.complete,true);assert.equal(f.writes,1);
});
test('client backdating cannot bypass new-order identity-card validation',async()=>{
 const f=await fixture({ciRequiredFrom:Date.now()-1000});f.body.intentCreatedAt-=3650*DAY;
 assert.equal((await f.quote()).error.code,'CI_REQUIRED');assert.equal(f.writes,0);
});
test('clock-registry errors fail closed without creating any order',async()=>{
 const f=await fixture(),rpc=f.db.rpc;f.db.rpc=(name,args)=>name==='pth_checkout_clock'?Promise.resolve({data:null,error:{code:'SYNTHETIC'}}):rpc(name,args);
 assert.equal((await f.quote()).error.code,'CHECKOUT_UNAVAILABLE');assert.equal(f.writes,0);
});
test('an expired server identity cannot be renewed by dropping its token or altering the phone date',async()=>{
 let clock=Date.now();const f=await fixture({serverNow:()=>clock}),q=await f.quote();
 clock+=7*DAY+1;f.body.intentCreatedAt=clock;
 assert.equal((await f.quote()).error.code,'ATTEMPT_EXPIRED');
 assert.equal((await f.submit(q)).error.code,'ATTEMPT_EXPIRED');
 assert.equal(f.writes,0);
});
