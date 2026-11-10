import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const text=fs.readFileSync(new URL('../js/storefront.js',import.meta.url),'utf8');
const a=text.indexOf('let halfCommissionAssignment = null;');
const code=text.slice(a,text.indexOf('// =====================================================',a));
function fixture({count=103,failAt=-1,lost=false,change=false,cancel=false}={}) {
 const ids=Array.from({length:count},(_,i)=>String(i)),button={innerHTML:'Asignar',disabled:false},alerts=[],calls=[],receipts=new Map();let token='synthetic',n=0,attempt=0,release;
 const ctx={console,Promise,Number,Set,crypto:{randomUUID:()=>`batch-${++n}`},document:{getElementById:()=>button},confirm:()=>!cancel,alert:s=>alerts.push(s),localStorage:{removeItem(){}},resolveSalesHierarchy:async()=>({}),gestorName:'synthetic',renderGestorPricing(){},loadProducts(){}};
 const api={token:()=>token,accountId:()=>token==='synthetic'?'owner':'other',restore:async()=>{},clearCaches(){},assignHalfCommissions:async b=>{
 calls.push(structuredClone(b));const i=attempt++;
 if(release)await new Promise(r=>release.push(r));
 if(change){token='changed';return{data:null,error:null};}
 if(i===failAt&&!lost)return{error:{message:'offline'}};
 let r=receipts.get(b.batchId);
 if(!r){r={batchId:b.batchId,requested:b.productIds.length,inserted:b.productIds.length,skippedExisting:0,skippedUnavailable:0};receipts.set(b.batchId,r);}
 if(i===failAt&&lost)return{error:{message:'lost response'}};
 return{data:r,error:null};
 }};
 ctx.PTHSecureData=api;ctx.window=ctx;
 ctx.supabaseClient={from(){return{select(){return this},eq(){return this},order(){return this},range(a,b){this.a=a;this.b=b;return this},forSession:async function(t){assert.equal(t,'synthetic');return{data:ids.slice(this.a,this.b+1).map(id=>({id}))}}}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,button,alerts,calls,receipts,pause(){release=[];return release},run:()=>ctx.autoAssignHalfCommissions({currentTarget:button})};
}
test('103 products split 100/3; successful receipts only',async()=>{const f=fixture();await f.run();assert.deepEqual(f.calls.map(c=>c.productIds.length),[100,3]);assert.match(f.alerts.at(-1),/terminada/);assert.match(f.alerts.at(-1),/103/);assert.equal(f.button.disabled,false);});
test('lost second response resumes same batch and does not double count',async()=>{const f=fixture({failAt:1,lost:true});await f.run();assert.match(f.alerts.at(-1),/1 de 2/);assert.doesNotMatch(f.alerts.at(-1),/terminada/);const id=f.calls[1].batchId;await f.run();assert.equal(f.calls[2].batchId,id);assert.equal(f.receipts.size,2);assert.match(f.alerts.at(-1),/103/);});
test('failure before commit can retry same batch',async()=>{const f=fixture({failAt:0});await f.run();await f.run();assert.equal(f.calls[0].batchId,f.calls[1].batchId);assert.match(f.alerts.at(-1),/terminada/);});
test('session change stops remaining writes and discards job',async()=>{const f=fixture({change:true});await f.run();assert.equal(f.calls.length,1);assert.match(f.alerts.at(-1),/sesión cambió/);assert.doesNotMatch(f.alerts.at(-1),/terminada/);});
test('cancel and empty catalogue write nothing',async()=>{for(const opts of [{cancel:true},{count:0}]){const f=fixture(opts);await f.run();assert.equal(f.calls.length,0);assert.equal(f.button.disabled,false);}});
test('double click excluded and released currentTarget tolerated',async()=>{const f=fixture({count:1});const pause=f.pause(),event={currentTarget:f.button};const running=f.ctx.autoAssignHalfCommissions(event);event.currentTarget=null;await new Promise(r=>setImmediate(r));await f.run();assert.equal(f.calls.length,1);pause[0]();await running;assert.equal(f.button.disabled,false);});
test('catalogue is paginated beyond 1000 and requests never exceed100',async()=>{const f=fixture({count:1001});await f.run();assert.equal(f.calls.length,11);assert.equal(f.calls.at(-1).productIds.length,1);});
test('preserved/omitted counts are truthful and invalid receipt remains pending',async()=>{const f=fixture({count:3});let first=true;f.ctx.PTHSecureData.assignHalfCommissions=async b=>{if(first){first=false;return{data:{batchId:b.batchId,requested:3,inserted:4,skippedExisting:0,skippedUnavailable:0}}}return{data:{batchId:b.batchId,requested:3,inserted:1,skippedExisting:1,skippedUnavailable:1}}};await f.run();assert.doesNotMatch(f.alerts.at(-1),/terminada/);await f.run();assert.match(f.alerts.at(-1),/conservadas: 1/);});
test('inline event explicit; no legacy writes in bulk function',()=>{const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(index,/autoAssignHalfCommissions\(event\)/);assert.doesNotMatch(code,/\.insert\(|\.upsert\(|\.update\(/);});
