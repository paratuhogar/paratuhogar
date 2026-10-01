import test from 'node:test';
import assert from 'node:assert/strict';
import {announcement} from '../supabase/functions/secure-data/announcement.mjs';
import {createHandler,hash} from '../supabase/functions/secure-data/handler.mjs';
function mock(initial=[]){
 const rows=structuredClone(initial);let failure=false;
 return {rows,fail(value=true){failure=value;},from(){let filters=[],payload;const q={
 select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},maybeSingle(){return q;},insert(value){payload=value;return q;},
 then(resolve,reject){return Promise.resolve().then(()=>{
 if(failure)return {error:{code:'offline'}};
 if(payload){if(rows.some(r=>r.gestor_id===payload.gestor_id))return {error:{code:'23505'}};rows.push({...payload});return {error:null};}
 return {data:rows.find(r=>filters.every(f=>f(r)))||null,error:null};
 }).then(resolve,reject);}
 };return q;}};
}
test('acknowledgement isolates individual accounts, including parent and child',async()=>{
 const db=mock(),parent={id:'parent'},child={id:'child',parent_id:'parent'};
 assert.equal((await announcement(db,{operation:'status'},child)).data.acknowledged,false);
 await Promise.all([announcement(db,{operation:'acknowledge'},child),announcement(db,{operation:'acknowledge'},child)]);
 assert.equal(db.rows.length,1);assert.equal((await announcement(db,{operation:'status'},child)).data.acknowledged,true);
 assert.equal((await announcement(db,{operation:'status'},parent)).data.acknowledged,false);
});
test('no anonymous, messenger, impersonation, arbitrary campaigns or reset operation',async()=>{
 const db=mock();
 for(const actor of [null,{id:'m',rol:'mensajero'}])await assert.rejects(announcement(db,{operation:'status'},actor));
 for(const extra of [{gestor_id:'victim'},{campaign:'arbitrary'},{acknowledged_at:'2000'},{operation:'reset'}])await assert.rejects(announcement(db,{operation:'acknowledge',...extra},{id:'actor'}));
 assert.equal(db.rows.length,0);
});
test('failed reads/writes do not report acknowledgement and retry is idempotent',async()=>{
 const db=mock();db.fail();const actor={id:'actor'};
 for(const operation of ['status','acknowledge'])await assert.rejects(announcement(db,{operation},actor),e=>e.status===503);
 assert.equal(db.rows.length,0);db.fail(false);await announcement(db,{operation:'acknowledge'},actor);await announcement(db,{operation:'acknowledge'},actor);assert.equal(db.rows.length,1);
});
test('gateway resolves active identity and parent before acknowledgement',async()=>{
 const profiles=[{id:'parent',password:'test',estado:'activo'},{id:'child',parent_id:'parent',password:'test',estado:'activo'},{id:'other',password:'test',estado:'activo'}];
 const people=mock(profiles),acks=mock(),tokens=['a','b','c'].map(c=>c.repeat(64));
 const sessions=mock(await Promise.all(profiles.map(async(p,i)=>({token_hash:await hash(tokens[i]),gestor_id:p.id,credential_hash:await hash('test'),expires_at:'2099-01-01'}))));
 const db={from:table=>({gestores:people,pth_secure_sessions:sessions,pth_feedback_announcement_ack:acks}[table].from())};
 const handler=createHandler({db});
 const request=async(i,operation,extra={})=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+tokens[i],Origin:'https://paratuhogar.org'},body:JSON.stringify({action:'announcement',operation,...extra})}));
 assert.equal((await request(1,'acknowledge')).status,200);assert.deepEqual(acks.rows,[{gestor_id:'child'}]);
 assert.equal((await (await request(0,'status')).json()).data.acknowledged,false);
 assert.equal((await (await request(2,'status')).json()).data.acknowledged,false);
 assert.equal((await request(0,'acknowledge',{gestor_id:'other'})).status,400);
 people.rows[0].estado='inactivo';assert.equal((await request(1,'status')).status,401);
});
