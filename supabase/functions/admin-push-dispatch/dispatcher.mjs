import {canDeliverPush} from '../secure-data/push-policy.mjs';
import {pushConfiguration,validatePushEndpoint} from '../secure-data/push.mjs';
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)))),b=>b.toString(16).padStart(2,'0')).join('');
const checked=async q=>{const r=await q;if(r.error)throw Error('Database operation failed');return r.data;};
const id=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
function sameSecret(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==43||b.length!==43)return false;let diff=0;for(let i=0;i<43;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function createDispatcher({db,env,send,clock=()=>Date.now()}){
 async function recipient(subscriptionId,event,expect){
  const sub=await checked(db.from('pth_push_subscriptions').select('*').eq('id',subscriptionId).maybeSingle());
  if(!sub)return null;
  if(expect&&(sub.gestor_id!==expect.actor_id||sub.session_hash!==expect.session_hash))return null;
  const actor=await checked(db.from('gestores').select('id,rol,estado,activo,parent_id,password').eq('id',sub.gestor_id).maybeSingle());
  const session=await checked(db.from('pth_secure_sessions').select('gestor_id,token_hash,expires_at,credential_hash').eq('token_hash',sub.session_hash).maybeSingle());
  const kind=event.kind||sub.topics?.[0];
  if(!canDeliverPush(actor,session,sub,{kind},clock(),actor?await sha(actor.password):null))return null;
  validatePushEndpoint(sub.endpoint);return {sub,kind};
 }
 async function finish(job,state,code,next){
  await checked(db.from('pth_push_deliveries').update({state,status_code:code||null,lease_until:null,next_attempt_at:next||new Date(clock()).toISOString()})
   .eq('event_id',job.event_id).eq('subscription_id',job.subscription_id).eq('lease_token',job.lease_token));
 }
 async function deliver(job){
  if(Date.parse(job.expires_at)<=clock()){await finish(job,'expired');return 'expired';}
  const sourceTable=job.kind==='orders'?'pedidos':job.kind==='suggestions'?'pth_feedback':job.kind==='applications'?'gestores':null;
  if(!sourceTable){await finish(job,'failed');return 'failed';}
  let query=db.from(sourceTable).select(job.kind==='suggestions'?'id,kind':job.kind==='applications'?'id,estado,parent_id':'id').eq('id',job.source_id);
  const source=await checked(query.maybeSingle());
  if(!source||(job.kind==='suggestions'&&source.kind!=='mejora')||(job.kind==='applications'&&(source.estado!=='pendiente'||source.parent_id))){await finish(job,'expired');return 'expired';}
  const target=await recipient(job.subscription_id,job);
  if(!target){await finish(job,'expired');return 'expired';}
  let code=0;try{code=await send(target.sub,{version:1,kind:job.kind});}catch(_){/* no endpoint/key/provider body logging */}
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
    const code=await send(target.sub,{version:1,kind:target.kind});
    return respond(code>=200&&code<300?200:503,{accepted:code>=200&&code<300});
   }
   if(body.mode&&body.mode!=='dispatch')return respond(400,{error:'Invalid mode'});
   const jobs=await checked(db.rpc('pth_claim_push_deliveries',{p_limit:10}));
   const counts={sent:0,pending:0,expired:0,failed:0};
   // Two workers, max ten deliveries, 12s network timeout per attempt.
   for(let i=0;i<(jobs||[]).length;i+=2){
    const results=await Promise.all(jobs.slice(i,i+2).map(job=>deliver(job).catch(()=> 'pending')));
    for(const state of results)counts[state]++;
   }
   await checked(db.from('pth_push_events').delete().lt('expires_at',new Date(clock()-86400000).toISOString()));
   await checked(db.from('pth_push_subscriptions').delete().lt('expires_at',new Date(clock()).toISOString()));
   return respond(200,{processed:(jobs||[]).length,counts});
  }catch(_){return respond(503,{error:'Dispatch unavailable'});}
 };
}
