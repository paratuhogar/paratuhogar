import {canDeliverPush,APPLICATION_REVIEWER_ID,APPLICATION_ESCALATION_REVIEWER_ID,APPLICATION_REMINDER_TOPIC} from '../secure-data/push-policy.mjs';
import {pushConfiguration,validatePushEndpoint,applicationReminderConfig} from '../secure-data/push.mjs';
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)))),b=>b.toString(16).padStart(2,'0')).join('');
const checked=async q=>{const r=await q;if(r.error)throw Error('Database operation failed');return r.data;};
const id=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==43||b.length!==43)return false;let diff=0;for(let i=0;i<43;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
const DAY=86400000;
const havanaClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/Havana',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function reminderDate(now){
 const parts=Object.fromEntries(havanaClock.formatToParts(now).map(p=>[p.type,p.value]));
 return parts.hour==='08'?`${parts.year}-${parts.month}-${parts.day}`:null;
}
export function createDispatcher({db,env,send,clock=()=>Date.now()}){
 async function recipient(subscriptionId,event,expect){
  const sub=await checked(db.from('pth_push_subscriptions').select('*').eq('id',subscriptionId).maybeSingle());
  if(!sub)return null;
  if(expect&&(sub.gestor_id!==expect.actor_id||sub.session_hash!==expect.session_hash))return null;
  const actor=await checked(db.from('gestores').select('id,rol,estado,activo,parent_id,password').eq('id',sub.gestor_id).maybeSingle());
  const session=await checked(db.from('pth_secure_sessions').select('gestor_id,token_hash,expires_at,credential_hash').eq('token_hash',sub.session_hash).maybeSingle());
  const kind=event.kind||sub.topics?.[0];
  const reminders=kind===APPLICATION_REMINDER_TOPIC?await applicationReminderConfig(db,{required:true}):null;
  if(!canDeliverPush(actor,session,sub,{kind},clock(),actor?await sha(actor.password):null,reminders))return null;
  validatePushEndpoint(sub.endpoint);return {sub,kind};
 }
 async function reminderSource(job){
  const source=await checked(db.from('pth_application_reminder_ledger')
   .select('id,recipient_id,local_date,reminder_kind').eq('id',job.source_id).maybeSingle());
  if(!source||source.local_date!==reminderDate(clock()))return null;
  const expected=source.reminder_kind==='daily'?APPLICATION_REVIEWER_ID
   :source.reminder_kind==='escalation'?APPLICATION_ESCALATION_REVIEWER_ID:null;
  return source.recipient_id===expected?source:null;
 }
 async function reminderPending(source){
  const now=clock();if(source.local_date!==reminderDate(now))return false;
  let query=db.from('gestores').select('id').eq('estado','pendiente').is('parent_id',null)
   .gte('created_at',new Date(now-7*DAY).toISOString()).lte('created_at',new Date(now).toISOString());
  if(source.reminder_kind==='escalation')query=query.lt('created_at',new Date(now-2*DAY).toISOString());
  return Boolean(await checked(query.limit(1).maybeSingle()));
 }
 async function finish(job,state,code,next){
  await checked(db.from('pth_push_deliveries').update({state,status_code:code||null,lease_until:null,next_attempt_at:next||new Date(clock()).toISOString()})
   .eq('event_id',job.event_id).eq('subscription_id',job.subscription_id).eq('lease_token',job.lease_token));
 }
 async function deliver(job){
  if(Date.parse(job.expires_at)<=clock()){await finish(job,'expired');return 'expired';}
  const reminder=job.kind===APPLICATION_REMINDER_TOPIC;
  let source;
  if(reminder){source=await reminderSource(job);if(source&&!await reminderPending(source))source=null;}
  else{
   const sourceTable=job.kind==='orders'?'pedidos':job.kind==='suggestions'?'pth_feedback':job.kind==='applications'?'gestores':null;
   if(!sourceTable){await finish(job,'failed');return 'failed';}
   source=await checked(db.from(sourceTable).select(job.kind==='suggestions'?'id,kind':job.kind==='applications'?'id,estado,parent_id':'id').eq('id',job.source_id).maybeSingle());
  }
  if(!source||(job.kind==='suggestions'&&source.kind!=='mejora')||(job.kind==='applications'&&(source.estado!=='pendiente'||source.parent_id))){await finish(job,'expired');return 'expired';}
  const target=await recipient(job.subscription_id,job);
  if(!target||(reminder&&target.sub.gestor_id!==source.recipient_id)
   ||Date.parse(job.expires_at)<=clock()){
   await finish(job,'expired');return 'expired';
  }
  // Snapshot authorization is checked after encryption, immediately before HTTP.
  // Fingerprint rejects a changed endpoint/key/session without transmitting them.
  const fingerprint=reminder?await sha([target.sub.endpoint,target.sub.p256dh,target.sub.auth,target.sub.session_hash].join('\n')):null;
  const beforeSend=reminder?async()=>await checked(db.rpc('pth_application_reminder_delivery_ready',{
   p_ledger_id:job.source_id,p_subscription_id:job.subscription_id,
   p_lease_token:job.lease_token,p_fingerprint:fingerprint,
  }))===true&&source.local_date===reminderDate(clock())&&Date.parse(job.expires_at)>clock():undefined;
  let code=0;try{code=await send(target.sub,{version:1,kind:job.kind},beforeSend);}catch(_){/* no endpoint/key/provider body logging */}
  if(code===null){await finish(job,'expired');return 'expired';}
  if(code>=200&&code<300){await finish(job,'sent',code);return 'sent';}
  if(code===404||code===410){await checked(db.from('pth_push_subscriptions').delete().eq('id',target.sub.id));return 'expired';}
  const retry=code===0||code===429||code>=500;
  const delay=Math.min(900,60*2**Math.min(4,job.attempts-1));
  const next=new Date(clock()+delay*1000).toISOString();
  const state=retry&&job.attempts<8&&Date.parse(next)<Date.parse(job.expires_at)?'pending':'failed';
  await finish(job,state,code,next);return state;
 }
 return async request=>{
  const respond=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method!=='POST')return respond(405,{error:'Method not allowed'});
  if(!sameSecret(request.headers.get('x-pth-push-secret'),env.PTH_PUSH_DISPATCH_SECRET))return respond(401,{error:'Unauthorized'});
  if(!pushConfiguration(env).enabled)return respond(503,{enabled:false});
  try{
   const text=await request.text();if(text.length>2000)return respond(413,{error:'Too large'});
   const body=JSON.parse(text||'{}');
   if(body.mode==='pilot'){
    if(!id(body.subscription_id)||!id(body.actor_id)||!/^[a-f0-9]{64}$/.test(body.session_hash||''))return respond(400,{error:'Invalid pilot'});
    const target=await recipient(body.subscription_id,{},body);if(!target)return respond(403,{error:'Unavailable subscription'});
    const fingerprint=target.kind===APPLICATION_REMINDER_TOPIC?await sha([target.sub.endpoint,target.sub.p256dh,target.sub.auth,target.sub.session_hash].join('\n')):null;
    const beforeSend=fingerprint?async()=>await checked(db.rpc('pth_application_reminder_delivery_ready',{
     p_ledger_id:null,p_subscription_id:body.subscription_id,p_lease_token:null,p_fingerprint:fingerprint,
    }))===true:undefined;
    const code=await send(target.sub,{version:1,kind:target.kind},beforeSend);
    return respond(code>=200&&code<300?200:503,{accepted:code>=200&&code<300});
   }
   if(body.mode&&body.mode!=='dispatch')return respond(400,{error:'Invalid mode'});
   // A reminder-specific preparation failure must not stop existing channels.
   let reminderPreparation=true;
   try{await checked(db.rpc('pth_seed_application_reminders'));}catch(_){reminderPreparation=false;}
   const jobs=await checked(db.rpc('pth_claim_push_deliveries',{p_limit:10}));
   const counts={sent:0,pending:0,expired:0,failed:0};
   // Two workers, max ten deliveries, 12s network timeout per attempt.
   for(let i=0;i<(jobs||[]).length;i+=2){
    const results=await Promise.all(jobs.slice(i,i+2).map(job=>deliver(job).catch(()=> 'pending')));
    for(const state of results)counts[state]++;
   }
   await checked(db.from('pth_push_events').delete().lt('expires_at',new Date(clock()-86400000).toISOString()));
   await checked(db.from('pth_push_subscriptions').delete().lt('expires_at',new Date(clock()).toISOString()));
   return respond(200,{processed:(jobs||[]).length,counts,reminderPreparation});
  }catch(_){return respond(503,{error:'Dispatch unavailable'});}
 };
}
