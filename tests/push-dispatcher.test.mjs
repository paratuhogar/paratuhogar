import test from 'node:test';
import assert from 'node:assert/strict';
import {createDispatcher} from '../supabase/functions/admin-push-dispatch/dispatcher.mjs';
import {hash} from '../supabase/functions/secure-data/handler.mjs';
import {APPLICATION_REVIEWER_ID} from '../supabase/functions/secure-data/push-policy.mjs';
import {OWNER_IDS} from '../supabase/functions/secure-data/policy.mjs';
const now=Date.parse('2026-10-01T12:00:00Z'),future='2026-10-01T13:00:00Z';
const actorId=[...OWNER_IDS][0],subId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222';
const env={PTH_PUSH_ENABLED:'true',PTH_PUSH_VAPID_PUBLIC_KEY:'a'.repeat(87),PTH_PUSH_VAPID_PRIVATE_KEY:'b'.repeat(43),PTH_PUSH_DISPATCH_SECRET:'c'.repeat(43),PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org'};
async function fixture(code=201,kind='suggestions'){
 const recipientId=kind==='applications'?APPLICATION_REVIEWER_ID:actorId;
 const job={event_id:'event',subscription_id:subId,lease_token:'lease',attempts:1,kind,source_id:sourceId,expires_at:future};
 const tables={pth_push_subscriptions:[{id:subId,gestor_id:recipientId,session_hash:'d'.repeat(64),endpoint:'https://fcm.googleapis.com/synthetic',topics:[kind],expires_at:future}],gestores:[{id:recipientId,rol:'admin',estado:'activo',password:'test-only'}],pth_secure_sessions:[{gestor_id:recipientId,token_hash:'d'.repeat(64),credential_hash:await hash('test-only'),expires_at:future}],pth_feedback:[{id:sourceId,kind:'mejora'}],pth_push_deliveries:[{event_id:'event',subscription_id:subId,lease_token:'lease'}],pth_push_events:[]};
 if(kind==='applications')tables.gestores.push({id:sourceId,rol:'gestor',estado:'pendiente',parent_id:null});
 const writes=[];let sends=0,claims=0;
 const db={rpc:async name=>{if(name==='pth_seed_application_reminders')return {data:0,error:null};claims++;return {data:[job],error:null};},from(table){let op='select',patch,filters=[],single=false;const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},lt(k,v){filters.push(r=>r[k]<v);return q;},maybeSingle(){single=true;return q;},update(v){op='update';patch=v;return q;},delete(){op='delete';return q;},then(resolve){const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r)));if(op==='update'){writes.push(patch);rows.forEach(r=>Object.assign(r,patch));}if(op==='delete')tables[table]=(tables[table]||[]).filter(r=>!rows.includes(r));resolve({data:single?rows[0]||null:rows,error:null});}};return q;}};
 const handler=createDispatcher({db,env,clock:()=>now,send:async(sub,payload)=>{sends++;assert.deepEqual(payload,{version:1,kind});if(code===0)throw Error('network');return code;}});
 const call=(body={},secret=env.PTH_PUSH_DISPATCH_SECRET)=>handler(new Request('https://example.test',{method:'POST',headers:{'x-pth-push-secret':secret},body:JSON.stringify(body)}));
 return {call,tables,job,writes,sends:()=>sends,claims:()=>claims};
}
test('dispatcher rejects unauthenticated callers without querying or sending',async()=>{const f=await fixture();assert.equal((await f.call({},'wrong')).status,401);assert.equal(f.sends(),0);assert.equal(f.claims(),0);});
test('authorized dispatch sends only generic payload and updates matching lease',async()=>{const f=await fixture();const r=await f.call();assert.equal(r.status,200);assert.equal(f.sends(),1);assert.equal(f.writes[0].state,'sent');assert.doesNotMatch(await r.text(),/test-only|synthetic|lease|gestor_id/);});
test('revoked role, wrong credential, expired session, missing source and changed kind suppress delivery',async()=>{
 for(const mutate of [f=>f.tables.gestores[0].parent_id='parent',f=>f.tables.gestores[0].id='other',f=>f.tables.gestores[0].password='changed',f=>f.tables.pth_secure_sessions[0].expires_at='2020-01-01',f=>f.tables.pth_feedback=[],f=>f.tables.pth_feedback[0].kind='problema']){
  const f=await fixture();mutate(f);await f.call();assert.equal(f.sends(),0);assert.equal(f.writes[0].state,'expired');
 }
});
test('provider retries are bounded and gone endpoints are deleted',async()=>{
 for(const code of [0,429,503]){const f=await fixture(code);await f.call();assert.equal(f.writes[0].state,'pending');assert.equal(f.writes[0].next_attempt_at,'2026-10-01T12:01:00.000Z');}
 for(const code of [400,401]){const f=await fixture(code);await f.call();assert.equal(f.writes[0].state,'failed');}
 for(const code of [404,410]){const f=await fixture(code);await f.call();assert.equal(f.tables.pth_push_subscriptions.length,0);}
 const f=await fixture(503);f.job.attempts=8;await f.call();assert.equal(f.writes[0].state,'failed');
});
test('pilot is bound to requesting actor and session and does not claim real events',async()=>{
 const f=await fixture();const body={mode:'pilot',subscription_id:subId,actor_id:actorId,session_hash:'d'.repeat(64)};
 assert.equal((await f.call(body)).status,200);assert.equal(f.claims(),0);assert.equal(f.sends(),1);
 assert.equal((await f.call({...body,actor_id:sourceId})).status,403);assert.equal(f.sends(),1);
});

test('application dispatch checks exclusive Angel and a still-pending principal source',async()=>{
 const ready=await fixture(201,'applications');assert.equal((await ready.call()).status,200);assert.equal(ready.sends(),1);assert.equal(ready.writes[0].state,'sent');
 for(const mutate of [f=>f.tables.gestores[0].id=actorId,f=>f.tables.gestores[0].rol='gestor',f=>f.tables.gestores[0].parent_id='parent',f=>f.tables.gestores[0].activo=false,f=>f.tables.gestores[0].password='changed',f=>f.tables.gestores[1].estado='activo',f=>f.tables.gestores[1].parent_id='parent',f=>f.tables.gestores.pop(),f=>f.tables.pth_push_subscriptions[0].topics=['orders'],f=>f.tables.pth_secure_sessions[0].expires_at='2020-01-01']){
  const f=await fixture(201,'applications');mutate(f);await f.call();assert.equal(f.sends(),0);assert.equal(f.writes[0].state,'expired');
 }
});
