import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const path=new URL('../js/subgestor-review.js',import.meta.url);
function library(){const c={module:{exports:{}},console};c.window=c;if(fs.existsSync(path))vm.runInNewContext(fs.readFileSync(path,'utf8'),c);assert.equal(typeof c.module.exports.createController,'function');return c.module.exports;}
const row={id:'fixture',orden_dia:'CA-1587',review_version:'a'.repeat(32),cliente:'<img src=x onerror=evil()>',direccion:'Calle uno [NOTA: llamar] [VUELTO: 100]'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('search and paging preserve references and use server pagination beyond 1000',async()=>{
 const {createController}=library(),calls=[];
 const c=createController({account:()=> 'admin:token',api:async body=>{calls.push(body);return{data:{rows:[row],hasMore:body.offset===0},error:null};}});
 await c.load('CA-1587');assert.equal(c.state.rows[0].cliente,row.cliente);await c.more();assert.equal(calls[1].offset,50);assert.equal(calls[1].search,'CA-1587');
});
test('late account responses cannot restore private rows and duplicate clicks send one decision',async()=>{
 const {createController}=library();let key='admin:one';const delayed=deferred(),sent=[];
 const c=createController({account:()=>key,api:async b=>{if(b.operation==='list')return{data:{rows:[row],hasMore:false}};sent.push(b);return delayed.promise;}});
 await c.load();const a=c.decide(row,'approve'),b=c.decide(row,'approve');assert.equal(await b,false);assert.equal(sent.length,1);
 key='other:two';c.clear();delayed.resolve({data:{id:row.id}});await a;assert.equal(c.state.rows.length,0);
});
test('failed edit keeps rows available and financial changes never enter a review request',async()=>{
 const {createController}=library();const sent=[];
 const c=createController({account:()=> 'a',api:async b=>{sent.push(b);return b.operation==='list'?{data:{rows:[row]}}:{error:{message:'Recarga antes de continuar'}};}});
 await c.load();await assert.rejects(()=>c.save(row,{total:0}));assert.equal(sent.length,1);
 assert.equal(await c.save(row,{direccion:'Nueva calle'}),false);assert.equal(c.state.rows.length,1);assert.match(c.state.error,/Recarga/);
});
test('the explicit vuelto field preserves unrelated notes and removes only old change tags',()=>{
 const {deliveryWithChange,splitDelivery}=library();assert.equal(splitDelivery(row.direccion).vuelto,'100');
 assert.equal(deliveryWithChange(splitDelivery(row.direccion).direccion,'50'),'Calle uno [NOTA: llamar] [VUELTO: 50]');
 assert.equal(deliveryWithChange(row.direccion,''),'Calle uno [NOTA: llamar]');assert.throws(()=>deliveryWithChange('Street','-1'));
});
test('clearing a private session resets search and history mode as well as its rows',async()=>{
 const {createController}=library();const c=createController({account:()=> 'a',api:async()=>({data:{rows:[],hasMore:false}})});
 await c.load('Private customer',0,true);c.clear();assert.equal(c.state.search,'');assert.equal(c.state.history,false);assert.equal(c.state.offset,0);
});
test('a replay does not claim that this caller saved a new rejection reason',async()=>{
 const {createController}=library();const c=createController({account:()=> 'a',api:async b=>b.operation==='list'?{data:{rows:[row],hasMore:false}}:{data:{id:row.id,decision:'reject',replayed:true}}});
 await c.load();await c.decide(row,'reject','A different later reason');assert.match(c.state.notice,/ya había/);
});
