import test from 'node:test';
import assert from 'node:assert/strict';
import {pushSettings,pushConfiguration,validatePushEndpoint} from '../supabase/functions/secure-data/push.mjs';
import {APPLICATION_REVIEWER_ID} from '../supabase/functions/secure-data/push-policy.mjs';
import {OWNER_IDS} from '../supabase/functions/secure-data/policy.mjs';
const actor={id:'admin',rol:'admin',estado:'activo'};
const enabledEnv={PTH_PUSH_VAPID_PUBLIC_KEY:'a'.repeat(87),PTH_PUSH_VAPID_PRIVATE_KEY:'b'.repeat(43),PTH_PUSH_DISPATCH_SECRET:'c'.repeat(43),PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org',PTH_PUSH_ENABLED:'true'};
const endpoint='https://fcm.googleapis.com/synthetic';
const body={operation:'save',subscription:{endpoint,keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}},topics:['orders']};
function fixture(){
 const future=new Date(Date.now()+3600000).toISOString();
 const tables={pth_secure_sessions:[{gestor_id:actor.id,token_hash:'session-a',expires_at:future}],pth_push_subscriptions:[]};
 const writes=[];let allowedRate=true;
 const db={rpc:async(name,args)=>{assert.equal(name,'pth_check_login_rate');assert.equal(args.p_limit,5);assert.match(args.p_key,/^[a-f0-9]{64}$/);return {data:allowedRate,error:null};},from(table){
  let op='select',values,single=false;const filters=[];
  const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},maybeSingle(){single=true;return q;},insert(v){op='insert';values=v;return q;},update(v){op='update';values=v;return q;},then(resolve){
   const rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(op==='insert'){writes.push(values);tables[table].push({id:'subscription-a',...values});}
   if(op==='update'){writes.push(values);rows.forEach(r=>Object.assign(r,values));}
   resolve({data:single?rows[0]||null:rows,error:null});
  }};return q;
 }};
 return {db,tables,writes,future,blockRate:()=>allowedRate=false};
}
test('backend stays disabled when configuration explicitly disables it; no private values returned',async()=>{
 const env={PTH_PUSH_VAPID_PUBLIC_KEY:'a'.repeat(87),PTH_PUSH_VAPID_PRIVATE_KEY:'b'.repeat(43),PTH_PUSH_DISPATCH_SECRET:'c'.repeat(43),PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org',PTH_PUSH_ENABLED:'false'};
 assert.deepEqual(pushConfiguration(env),{configured:true,enabled:false});
 const db={from:()=>assert.fail('config/save when disabled must not query subscription tables')};
 const result=await pushSettings(db,{operation:'config'},actor,'hash',env);
 assert.deepEqual(result.data,{configured:true,enabled:false,allowedTopics:['orders'],publicKey:null});
 assert.doesNotMatch(JSON.stringify(result),/b{43}|c{43}/);
 await assert.rejects(pushSettings(db,{operation:'save'},actor,'hash',env),/no están habilitadas/);
});
test('existing review owner gets per-condition booleans only; ordinary admins do not receive diagnostics',async()=>{
 const owner={...actor,id:[...OWNER_IDS][0]},db={from:()=>assert.fail('no diagnostic database reads')};
 for(const [name,check] of [['PTH_PUSH_ENABLED','switchOn'],['PTH_PUSH_VAPID_PUBLIC_KEY','publicKeyValid'],['PTH_PUSH_VAPID_PRIVATE_KEY','privateKeyValid'],['PTH_PUSH_DISPATCH_SECRET','dispatchSecretValid'],['PTH_PUSH_VAPID_SUBJECT','subjectValid']]){
  const env={...enabledEnv,[name]:'invalid'};
  const result=await pushSettings(db,{operation:'config'},owner,'hash',env);
  assert.equal(result.data.enabled,false);assert.equal(result.data.readiness[check],false);
  assert.ok(Object.values(result.data.readiness).every(v=>typeof v==='boolean'));
  assert.doesNotMatch(JSON.stringify(result),/invalid|b{43}|c{43}|a{87}/);
 }
 assert.equal((await pushSettings(db,{operation:'config'},actor,'hash',enabledEnv)).data.readiness,undefined);
});
test('endpoint validator refuses redirects/private targets, credentials, fragments and lookalike domains',()=>{
 for(const url of ['http://fcm.googleapis.com/push','https://127.0.0.1/push','https://fcm.googleapis.com.evil.test/push','https://user:pass@fcm.googleapis.com/push','https://web.push.apple.com/push#secret','https://fcm.googleapis.com:8443/push'])assert.throws(()=>validatePushEndpoint(url));
 for(const url of ['https://fcm.googleapis.com/push','https://updates.push.services.mozilla.com/push','https://web.push.apple.com/push'])assert.equal(validatePushEndpoint(url),url);
});
test('remove is bound to current account and session; other roles cannot reach push settings',async()=>{
 const filters=[];const query={delete(){return this;},eq(k,v){filters.push([k,v]);return this;},then(resolve){resolve({error:null});}};
 await pushSettings({from:()=>query},{operation:'remove',endpoint:'https://fcm.googleapis.com/synthetic'},actor,'current-session');
 assert.deepEqual(filters,[['endpoint','https://fcm.googleapis.com/synthetic'],['gestor_id','admin'],['session_hash','current-session']]);
 for(const profile of [null,{...actor,parent_id:'parent'},{...actor,estado:'inactivo'},{...actor,rol:'gestor'}])await assert.rejects(pushSettings({}, {operation:'config'},profile,'hash'),/no tiene notificaciones/);
});
test('save retries keep one device, derive identity and expire with the validated session',async()=>{
 const f=fixture();
 for(let n=0;n<2;n++)assert.equal((await pushSettings(f.db,{...body,gestor_id:'spoofed',session_hash:'spoofed'},actor,'session-a',enabledEnv)).data.saved,true);
 assert.equal(f.tables.pth_push_subscriptions.length,1);
 assert.equal(f.writes[0].gestor_id,actor.id);assert.equal(f.writes[0].session_hash,'session-a');assert.equal(f.writes[0].expires_at,f.future);
});
test('save cannot reassign another account or session, accept unauthorized topics or expired credentials',async()=>{
 for(const previous of [{gestor_id:'other',session_hash:'session-a'},{gestor_id:actor.id,session_hash:'other-session'}]){
  const f=fixture();f.tables.pth_push_subscriptions.push({id:'previous',endpoint,...previous});
  await assert.rejects(pushSettings(f.db,body,actor,'session-a',enabledEnv),e=>e.status===409);assert.equal(f.writes.length,0);
 }
 const f=fixture();await assert.rejects(pushSettings(f.db,{...body,topics:['suggestions']},actor,'session-a',enabledEnv),e=>e.status===403);
 await assert.rejects(pushSettings(f.db,{...body,subscription:{...body.subscription,keys:{p256dh:'invalid',auth:'invalid'}}},actor,'session-a',enabledEnv),e=>e.status===400);
 f.tables.pth_secure_sessions[0].expires_at='2020-01-01';await assert.rejects(pushSettings(f.db,body,actor,'session-a',enabledEnv),e=>e.status===401);
 assert.equal(f.writes.length,0);
});
test('status reveals only the same actor/session subscription, even when delivery is paused',async()=>{
 const f=fixture();await pushSettings(f.db,body,actor,'session-a',enabledEnv);
 const paused={...enabledEnv,PTH_PUSH_ENABLED:'false'};
 assert.equal((await pushSettings(f.db,{operation:'status',endpoint},actor,'session-a',paused)).data.active,true);
 for(const [profile,session] of [[{...actor,id:'other'},'session-a'],[actor,'other-session']]){
  assert.deepEqual((await pushSettings(f.db,{operation:'status',endpoint},profile,session,paused)).data,{active:false,topics:[],expiresAt:null});
 }
});
test('pilot resolves its target server-side, limits repetitions and rejects cross-session requests',async()=>{
 const f=fixture(),calls=[];await pushSettings(f.db,body,actor,'session-a',enabledEnv);
 const send=async target=>{calls.push(target);return true;};
 const result=await pushSettings(f.db,{operation:'pilot',endpoint,actor_id:'spoofed',subscription_id:'spoofed'},actor,'session-a',enabledEnv,send);
 assert.equal(result.data.accepted,true);assert.deepEqual(calls,[{mode:'pilot',subscription_id:'subscription-a',actor_id:actor.id,session_hash:'session-a'}]);
 await assert.rejects(pushSettings(f.db,{operation:'pilot',endpoint},actor,'session-b',enabledEnv,send),e=>e.status===409);
 f.blockRate();await assert.rejects(pushSettings(f.db,{operation:'pilot',endpoint},actor,'session-a',enabledEnv,send),e=>e.status===429);
 assert.equal(calls.length,1);
});
test('pilot handles dispatcher refusal and stays unavailable while paused',async()=>{
 const f=fixture();await pushSettings(f.db,body,actor,'session-a',enabledEnv);
 await assert.rejects(pushSettings(f.db,{operation:'pilot',endpoint},actor,'session-a',enabledEnv,async()=>false),e=>e.status===503);
 await assert.rejects(pushSettings(f.db,{operation:'pilot',endpoint},actor,'session-a',{...enabledEnv,PTH_PUSH_ENABLED:'false'},()=>assert.fail('no send while paused')),e=>e.status===503);
});

test('only Angel can explicitly enroll applications; existing topics never change on config',async()=>{
 const angel={...actor,id:APPLICATION_REVIEWER_ID},f=fixture();
 f.tables.pth_secure_sessions[0].gestor_id=angel.id;
 const config=await pushSettings(f.db,{operation:'config'},angel,'session-a',enabledEnv);
 assert.deepEqual(config.data.allowedTopics,['orders','suggestions','applications']);assert.equal(f.writes.length,0);
 const topics=['orders','suggestions','applications'];
 await pushSettings(f.db,{...body,topics},angel,'session-a',enabledEnv);assert.deepEqual(f.writes[0].topics,topics);
 const other=fixture();await assert.rejects(pushSettings(other.db,{...body,topics:['applications'],gestor_id:angel.id},actor,'session-a',enabledEnv),e=>e.status===403);assert.equal(other.writes.length,0);
 const owner={...actor,id:[...OWNER_IDS][0]};await assert.rejects(pushSettings(other.db,{...body,topics:['applications']},owner,'session-a',enabledEnv),e=>e.status===403);
 for(const blocked of [{...angel,rol:'gestor'},{...angel,parent_id:'parent'},{...angel,activo:false}])await assert.rejects(pushSettings(other.db,{...body,topics:['applications']},blocked,'session-a',enabledEnv),e=>e.status===403);
});
