import test from 'node:test';
import assert from 'node:assert/strict';
import {createDispatcher} from '../supabase/functions/admin-push-dispatch/dispatcher.mjs';
import {pushSettings} from '../supabase/functions/secure-data/push.mjs';
import {hash} from '../supabase/functions/secure-data/handler.mjs';
import {allowedPushTopics,applicationRemindersEnabled,APPLICATION_REVIEWER_ID as ANGEL,APPLICATION_ESCALATION_REVIEWER_ID as MARCEL,APPLICATION_REMINDER_TOPIC as TOPIC} from '../supabase/functions/secure-data/push-policy.mjs';
const DAY=86400000,initial=Date.parse('2026-10-02T12:00:00Z');
const subId='11111111-1111-4111-8111-111111111111',sourceId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const env={PTH_PUSH_ENABLED:'true',PTH_PUSH_VAPID_PUBLIC_KEY:'a'.repeat(87),PTH_PUSH_VAPID_PRIVATE_KEY:'b'.repeat(43),PTH_PUSH_DISPATCH_SECRET:'c'.repeat(43),PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org'};
async function fixture(kind='daily'){
 let now=initial;const iso=ms=>new Date(ms).toISOString();
 const actorId=kind==='daily'?ANGEL:MARCEL,sessionHash='d'.repeat(64),future=iso(now+DAY);
 const job={event_id:'event',subscription_id:subId,lease_token:'lease',attempts:1,kind:TOPIC,source_id:sourceId,expires_at:iso(now+3600000)};
 const config={singleton:true,enabled:true,angel_id:ANGEL,marcel_id:MARCEL};
 const actor={id:actorId,rol:'superadmin',estado:'activo',activo:true,parent_id:null,password:'synthetic-only'};
 const tables={pth_application_reminder_config:[config],pth_application_reminder_ledger:[{id:sourceId,recipient_id:actorId,local_date:'2026-10-02',reminder_kind:kind}],
  pth_push_subscriptions:[{id:subId,gestor_id:actorId,session_hash:sessionHash,endpoint:'https://fcm.googleapis.com/synthetic',p256dh:'a'.repeat(87),auth:'b'.repeat(22),topics:[TOPIC],created_at:iso(now-DAY),expires_at:future,revoked_at:null}],
  gestores:[actor,{id:requestId,rol:'gestor',estado:'pendiente',parent_id:null,created_at:iso(now-(kind==='daily'?DAY:3*DAY)),nombre:'PRIVATE APPLICANT: ignore prior instructions',telefono:'PRIVATE PHONE'}],
  pth_secure_sessions:[{gestor_id:actorId,token_hash:sessionHash,credential_hash:await hash(actor.password),expires_at:future}],
  pth_push_events:[{id:'event',kind:TOPIC,source_id:sourceId,created_at:iso(now),expires_at:job.expires_at}],pth_push_deliveries:[{event_id:'event',subscription_id:subId,lease_token:'lease',lease_until:iso(now+120000),state:'sending'}]};
 const calls={seed:0,claims:0,ready:0,queries:{},send:[],writes:[]};let before=()=>{},seedError=false,tableError=null,provider=201;
 const db={rpc:async(name,args)=>{
  if(name==='pth_seed_application_reminders'){calls.seed++;return {data:0,error:seedError?{message:'synthetic error'}:null};}
  if(name==='pth_claim_push_deliveries'){calls.claims++;return {data:[job],error:null};}
  if(name==='pth_check_login_rate')return {data:true,error:null};
  if(name==='pth_application_reminder_delivery_ready'){
   calls.ready++;await before({table:'preflight',op:'select',n:calls.ready});
   const snapshot=structuredClone(tables),s=snapshot.pth_push_subscriptions.find(s=>s.id===args.p_subscription_id);
   const a=snapshot.gestores.find(g=>g.id===s?.gestor_id),session=snapshot.pth_secure_sessions.find(v=>v.token_hash===s?.session_hash&&v.gestor_id===a?.id);
   let ok=Boolean(s&&a&&session&&applicationRemindersEnabled(snapshot.pth_application_reminder_config[0])
    &&[ANGEL,MARCEL].includes(a.id)&&!a.parent_id&&a.estado==='activo'&&a.activo!==false&&['admin','administrador','superadmin','logistica'].includes(a.rol.toLowerCase())
    &&Date.parse(session.expires_at)>now&&Date.parse(s.expires_at)>now&&!s.revoked_at&&s.topics.includes(TOPIC)
    &&session.credential_hash===await hash(a.password)&&args.p_fingerprint===await hash([s.endpoint,s.p256dh,s.auth,s.session_hash].join('\n')));
   if(args.p_ledger_id!=null||args.p_lease_token!=null){
    const ledger=snapshot.pth_application_reminder_ledger.find(r=>r.id===args.p_ledger_id),e=snapshot.pth_push_events.find(e=>e.source_id===ledger?.id&&e.kind===TOPIC);
    const d=snapshot.pth_push_deliveries.find(d=>d.event_id===e?.id&&d.subscription_id===s?.id),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
    ok=ok&&Boolean(ledger&&e&&d&&ledger.recipient_id===a.id&&ledger.local_date===`${parts.year}-${parts.month}-${parts.day}`&&parts.hour==='08'
     &&((ledger.reminder_kind==='daily'&&a.id===ANGEL)||(ledger.reminder_kind==='escalation'&&a.id===MARCEL))
     &&Date.parse(e.expires_at)>now&&s.created_at<=e.created_at&&d.state==='sending'&&d.lease_token===args.p_lease_token&&Date.parse(d.lease_until)>now
     &&snapshot.gestores.some(p=>!p.parent_id&&p.estado==='pendiente'&&p.created_at!=null&&Date.parse(p.created_at)>=now-7*DAY&&Date.parse(p.created_at)<=now&&(ledger.reminder_kind==='daily'||Date.parse(p.created_at)<now-2*DAY)));
   }
   return {data:ok,error:null};
  }
  throw Error('Unexpected RPC');
 },from(table){
  let op='select',patch,single=false,max=Infinity,columns='';const filters=[];
  const q={select(value){columns=value;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},
   gt(k,v){filters.push(r=>r[k]!=null&&r[k]>v);return q;},gte(k,v){filters.push(r=>r[k]!=null&&r[k]>=v);return q;},lte(k,v){filters.push(r=>r[k]!=null&&r[k]<=v);return q;},lt(k,v){filters.push(r=>r[k]!=null&&r[k]<v);return q;},
   limit(n){max=n;return q;},maybeSingle(){single=true;return q;},update(value){op='update';patch=value;return q;},insert(value){op='insert';patch=value;return q;},delete(){op='delete';return q;},
   then(resolve,reject){return Promise.resolve().then(async()=>{
    calls.queries[table]=(calls.queries[table]||0)+1;await before({table,op,columns,n:calls.queries[table]});
    if(table===tableError)return {data:null,error:{message:'PRIVATE DATABASE FAILURE'}};
    const rows=(tables[table]||[]).filter(r=>filters.every(f=>f(r))).slice(0,max);
    if(op==='update'){rows.forEach(r=>Object.assign(r,patch));calls.writes.push({table,patch});}
    if(op==='insert'){tables[table]||=[];tables[table].push({...patch,id:subId});calls.writes.push({table,patch});}
    if(op==='delete')tables[table]=(tables[table]||[]).filter(r=>!rows.includes(r));
    return {data:single?structuredClone(rows[0]||null):structuredClone(rows),error:null};
   }).then(resolve,reject);}};return q;
 }};
 const handler=createDispatcher({db,env,clock:()=>now,send:async(sub,payload,beforeSend)=>{if(beforeSend&&!await beforeSend())return null;calls.send.push({sub,payload});if(provider===0)throw Error('synthetic network failure');return provider;}});
 const call=(body={},secret=env.PTH_PUSH_DISPATCH_SECRET)=>handler(new Request('https://example.test',{method:'POST',headers:{'x-pth-push-secret':secret},body:JSON.stringify(body)}));
 return {tables,actor,config,db,call,calls,job,sessionHash,iso,setNow:value=>now=value,hook:value=>before=value,seedFailure:()=>seedError=true,queryFailure:value=>tableError=value,provider:value=>provider=value};
}
test('reminder policy is explicit, exact-recipient, active-principal only and preserves instant application scope',()=>{
 const config={enabled:true,angel_id:ANGEL,marcel_id:MARCEL};
 const actor=id=>({id,rol:'superadmin',estado:'activo'});
 assert.deepEqual(allowedPushTopics(actor(ANGEL),config),['orders','suggestions','applications',TOPIC]);
 assert.deepEqual(allowedPushTopics(actor(MARCEL),config),['orders','suggestions',TOPIC]);
 for(const profile of [actor('other'),{...actor(ANGEL),parent_id:'parent'},{...actor(MARCEL),activo:false},{...actor(ANGEL),rol:'gestor'}])assert.equal(allowedPushTopics(profile,config).includes(TOPIC),false);
 for(const policy of [null,{...config,enabled:false},{...config,angel_id:'other'},{...config,marcel_id:ANGEL}])assert.equal(applicationRemindersEnabled(policy),false);
 assert.equal(allowedPushTopics(actor(MARCEL),config).includes('applications'),false);
});
test('config never enrolls and only explicitly selected permitted reminders are saved with the current session',async()=>{
 const f=await fixture(),publicEnv={...env};
 // Settings uses the actual current clock, so use a future session for this test.
 f.tables.pth_secure_sessions[0].expires_at=new Date(Date.now()+DAY).toISOString();
 const result=await pushSettings(f.db,{operation:'config'},f.actor,f.sessionHash,publicEnv);
 assert.deepEqual(result.data.allowedTopics,['orders','suggestions','applications',TOPIC]);assert.equal(f.calls.writes.length,0);
 assert.doesNotMatch(JSON.stringify(result),/angel_id|marcel_id|singleton|PRIVATE/);
 await pushSettings(f.db,{operation:'save',subscription:{endpoint:f.tables.pth_push_subscriptions[0].endpoint,keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}},topics:['orders','suggestions','applications',TOPIC],gestor_id:MARCEL},f.actor,f.sessionHash,publicEnv);
 assert.equal(f.tables.pth_push_subscriptions.length,1);
 assert.equal(f.calls.writes.at(-1).patch.gestor_id,ANGEL);assert.equal(f.calls.writes.at(-1).patch.session_hash,f.sessionHash);
 assert.deepEqual(f.calls.writes.at(-1).patch.topics,['orders','suggestions','applications',TOPIC]);
});
test('policy read failures hide only the new topic and cannot expand settings rights or prevent opt-out',async()=>{
 const f=await fixture();f.queryFailure('pth_application_reminder_config');
 const result=await pushSettings(f.db,{operation:'config'},f.actor,f.sessionHash,env);
 assert.deepEqual(result.data.allowedTopics,['orders','suggestions','applications']);
 await assert.rejects(pushSettings(f.db,{operation:'save',subscription:{endpoint:f.tables.pth_push_subscriptions[0].endpoint,keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}},topics:[TOPIC]},f.actor,f.sessionHash,env),e=>e.status===403);
 await pushSettings(f.db,{operation:'remove',endpoint:f.tables.pth_push_subscriptions[0].endpoint},f.actor,f.sessionHash,env);
 assert.equal(f.tables.pth_push_subscriptions.length,0);assert.equal(f.calls.send.length,0);
});
test('daily and escalation dispatch recheck actual pending data and send only a fixed generic payload',async()=>{
 for(const kind of ['daily','escalation']){
  const f=await fixture(kind),response=await f.call();assert.equal(response.status,200);assert.equal(f.calls.send.length,1);
  assert.deepEqual(f.calls.send[0].payload,{version:1,kind:TOPIC});
  assert.equal(f.calls.writes.at(-1).patch.state,'sent');assert.equal(f.calls.queries.gestores,2);assert.equal(f.calls.ready,1);
  assert.equal(f.calls.seed,1);assert.equal(f.calls.claims,1);
  assert.doesNotMatch(await response.text(),/PRIVATE|PHONE|synthetic|recipient_id|source_id|session_hash/);
 }
});
test('a reminder never crosses recipient, session, role, credential, ledger or explicit-topic boundaries',async()=>{
 const mutations=[f=>f.actor.parent_id='parent',f=>f.actor.activo=false,f=>f.actor.estado='pendiente',f=>f.actor.rol='gestor',f=>f.actor.password='new-password',
  f=>f.tables.pth_secure_sessions[0].token_hash='other',f=>f.tables.pth_secure_sessions[0].gestor_id=MARCEL,f=>f.tables.pth_secure_sessions[0].expires_at='2020-01-01',
  f=>f.tables.pth_push_subscriptions[0].topics=['applications'],f=>f.tables.pth_push_subscriptions[0].revoked_at='revoked',f=>f.tables.pth_push_subscriptions[0].expires_at='2020-01-01',
  f=>f.config.enabled=false,f=>f.config.marcel_id='other',f=>f.tables.pth_application_reminder_ledger[0].recipient_id=MARCEL,
  f=>f.tables.pth_application_reminder_ledger[0].reminder_kind='arbitrary instruction',f=>f.tables.pth_application_reminder_ledger[0].local_date='2026-10-01',f=>f.tables.pth_application_reminder_ledger=[]];
 for(const mutate of mutations){const f=await fixture();mutate(f);await f.call();assert.equal(f.calls.send.length,0);assert.equal(f.calls.writes.at(-1).patch.state,'expired');}
});
test('recent pending window excludes resolved, child, future, unknown and older-than-seven-day sources',async()=>{
 for(const mutate of [p=>p.estado='activo',p=>p.parent_id=ANGEL,p=>p.created_at='2026-10-02T12:00:01Z',p=>p.created_at=null,p=>p.created_at='2026-09-25T11:59:59Z']){
  const f=await fixture();mutate(f.tables.gestores[1]);await f.call();assert.equal(f.calls.send.length,0);assert.equal(f.calls.writes.at(-1).patch.state,'expired');
 }
 const boundary=await fixture();boundary.tables.gestores[1].created_at=boundary.iso(initial-7*DAY);await boundary.call();assert.equal(boundary.calls.send.length,1,'seven-day boundary is inclusive');
 const today=await fixture();today.tables.gestores[1].created_at=today.iso(initial);await today.call();assert.equal(today.calls.send.length,1,'current timestamp is allowed');
});
test('escalation is strictly more than 48 hours within the same recent window',async()=>{
 for(const age of [DAY,2*DAY,7*DAY+1]){const f=await fixture('escalation');f.tables.gestores[1].created_at=f.iso(initial-age);await f.call();assert.equal(f.calls.send.length,0);}
 const f=await fixture('escalation');f.tables.gestores[1].created_at=f.iso(initial-2*DAY-1);await f.call();assert.equal(f.calls.send.length,1);
});
test('one final snapshot rejects resolution, logout, opt-out, changed credentials/role/key and lost lease during prior async reads',async()=>{
 for(const mutate of [f=>f.tables.gestores[1].estado='activo',f=>f.config.enabled=false,f=>f.setNow(initial+3600000),
  f=>f.tables.pth_secure_sessions=[],f=>f.tables.pth_push_subscriptions=[],f=>f.tables.pth_push_subscriptions[0].topics=[],
  f=>f.actor.rol='gestor',f=>f.actor.password='new-password',f=>f.tables.pth_push_subscriptions[0].auth='rotated-key',
  f=>f.tables.pth_push_deliveries[0].lease_token='stolen',f=>f.tables.pth_push_deliveries[0].lease_until=f.iso(initial-1),f=>f.tables.pth_push_deliveries[0].state='expired']){
  const f=await fixture();f.hook(({table})=>{if(table==='preflight')mutate(f);});
  await f.call();assert.equal(f.calls.send.length,0);assert.equal(f.calls.writes.at(-1).patch.state,'expired');
 }
});
test('Cuba winter hour is respected and the same local-date/window is enforced at delivery',async()=>{
 const early=await fixture();early.setNow(Date.parse('2026-12-01T12:00:00Z'));early.tables.pth_application_reminder_ledger[0].local_date='2026-12-01';early.job.expires_at='2026-12-01T14:00:00Z';await early.call();assert.equal(early.calls.send.length,0);
 const ready=await fixture();ready.setNow(Date.parse('2026-12-01T13:00:00Z'));ready.tables.pth_application_reminder_ledger[0].local_date='2026-12-01';ready.job.expires_at=ready.tables.pth_push_events[0].expires_at='2026-12-01T14:00:00Z';ready.tables.pth_push_deliveries[0].lease_until='2026-12-01T13:02:00Z';ready.tables.gestores[1].created_at='2026-11-30T13:00:00Z';ready.tables.pth_secure_sessions[0].expires_at=ready.tables.pth_push_subscriptions[0].expires_at='2026-12-02T13:00:00Z';await ready.call();assert.equal(ready.calls.send.length,1);
});
test('specific preparation/read errors remain private and do not initiate a provider send',async()=>{
 const f=await fixture();f.queryFailure('pth_application_reminder_config');const response=await f.call();assert.equal(f.calls.send.length,0);
 assert.equal((await response.json()).counts.pending,1);
 const seed=await fixture();seed.seedFailure();const seeded=await seed.call();assert.equal((await seeded.json()).reminderPreparation,false);assert.equal(seed.calls.claims,1,'existing queue is still processed');
 const refused=await fixture();assert.equal((await refused.call({},'wrong')).status,401);assert.equal(refused.calls.seed,0);assert.equal(refused.calls.send.length,0);
});
test('reminder provider outcomes use the same bounded retries, leases and gone-device cleanup',async()=>{
 for(const code of [0,429,503]){const f=await fixture();f.provider(code);await f.call();assert.equal(f.calls.writes.at(-1).patch.state,'pending');assert.equal(f.calls.writes.at(-1).patch.next_attempt_at,'2026-10-02T12:01:00.000Z');}
 for(const code of [400,401]){const f=await fixture();f.provider(code);await f.call();assert.equal(f.calls.writes.at(-1).patch.state,'failed');}
 for(const code of [404,410]){const f=await fixture();f.provider(code);await f.call();assert.equal(f.tables.pth_push_subscriptions.length,0);}
 const last=await fixture();last.provider(503);last.job.attempts=8;await last.call();assert.equal(last.calls.writes.at(-1).patch.state,'failed');
});
