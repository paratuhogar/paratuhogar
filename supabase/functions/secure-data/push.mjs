import {allowedPushTopics} from './push-policy.mjs';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
// Explicit server configuration stays off by default. Keys alone cannot enable it.
export const PUSH_DELIVERY_READY=true;
export function pushReadiness(env={}){
 // Boolean diagnostics only. Never expose values, lengths, hashes or prefixes.
 return {deliveryReady:PUSH_DELIVERY_READY,switchOn:env.PTH_PUSH_ENABLED==='true',
  publicKeyValid:/^[A-Za-z0-9_-]{87}$/.test(env.PTH_PUSH_VAPID_PUBLIC_KEY||''),
  privateKeyValid:/^[A-Za-z0-9_-]{43}$/.test(env.PTH_PUSH_VAPID_PRIVATE_KEY||''),
  dispatchSecretValid:/^[A-Za-z0-9_-]{43}$/.test(env.PTH_PUSH_DISPATCH_SECRET||''),
  subjectValid:env.PTH_PUSH_VAPID_SUBJECT==='https://paratuhogar.org'};
}
export function pushConfiguration(env={}){
 const ready=pushReadiness(env),prepared=ready.publicKeyValid&&ready.privateKeyValid&&ready.dispatchSecretValid&&ready.subjectValid;
 return {configured:prepared,enabled:ready.deliveryReady&&prepared&&ready.switchOn};
}
export function validatePushEndpoint(value){
 let url;try{url=new URL(value);}catch(_){fail('Suscripción no válida.',400);}
 const host=url.hostname;
 const allowed=['fcm.googleapis.com','web.push.apple.com'].includes(host)
  ||/^(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com$/.test(host)
  ||/^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
 if(typeof value!=='string'||value.length>2048||url.protocol!=='https:'||url.port||url.username||url.password||url.hash||!allowed)fail('Servicio de notificaciones no permitido.',400);
 return url.href;
}
export async function pushSettings(db,body,actor,sessionHash,env={},dispatchPilot){
 const allowed=allowedPushTopics(actor);if(!allowed.length)fail('Tu cuenta no tiene notificaciones administrativas.');
 const state=pushConfiguration(env);
 if(body.operation==='config')return {data:{...state,allowedTopics:allowed,publicKey:state.enabled?env.PTH_PUSH_VAPID_PUBLIC_KEY:null,
  ...(allowed.includes('suggestions')?{readiness:pushReadiness(env)}:{})},error:null};
 if(body.operation==='status'){
  const endpoint=validatePushEndpoint(body.endpoint);
  const {data,error}=await db.from('pth_push_subscriptions').select('topics,expires_at').eq('endpoint',endpoint).eq('gestor_id',actor.id).eq('session_hash',sessionHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error)fail('No se pudo comprobar este dispositivo.',503);
  return {data:{active:Boolean(data),topics:data?.topics?.filter(topic=>allowed.includes(topic))||[],expiresAt:data?.expires_at||null},error:null};
 }
 if(body.operation==='pilot'){
  if(!state.enabled||!dispatchPilot)fail('Las notificaciones todavía no están habilitadas.',503);
  const endpoint=validatePushEndpoint(body.endpoint);
  const {data:sub,error}=await db.from('pth_push_subscriptions').select('id').eq('endpoint',endpoint).eq('gestor_id',actor.id).eq('session_hash',sessionHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error||!sub)fail('Activa primero las notificaciones en este dispositivo.',409);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('push-pilot:'+sessionHash));
  const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const rate=await db.rpc('pth_check_login_rate',{p_key:key,p_limit:5});
  if(rate.error||rate.data!==true)fail('Espera unos minutos antes de repetir la prueba.',429);
  const accepted=await dispatchPilot({mode:'pilot',subscription_id:sub.id,actor_id:actor.id,session_hash:sessionHash});
  if(!accepted)fail('No se pudo enviar la prueba. Revisa la configuración.',503);
  return {data:{accepted:true},error:null};
 }
 if(body.operation==='remove'){
  const endpoint=validatePushEndpoint(body.endpoint);
  const {error}=await db.from('pth_push_subscriptions').delete().eq('endpoint',endpoint).eq('gestor_id',actor.id).eq('session_hash',sessionHash);
  if(error)fail('No se pudo confirmar la desactivación.',503);
  return {data:{removed:true},error:null};
 }
 if(body.operation!=='save')fail('Operación no permitida.');
 if(!state.enabled)fail('Las notificaciones todavía no están habilitadas.',503);
 const input=body.subscription,keys=input?.keys;
 const endpoint=validatePushEndpoint(input?.endpoint);
 if(!keys||!/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(keys.auth||''))fail('Claves de suscripción no válidas.',400);
 if(!Array.isArray(body.topics)||!body.topics.length||body.topics.length>allowed.length||body.topics.some(topic=>!allowed.includes(topic)))fail('Estos avisos no corresponden a tu cuenta.');
 const {data:session,error:sessionError}=await db.from('pth_secure_sessions').select('gestor_id,expires_at').eq('token_hash',sessionHash).eq('gestor_id',actor.id).maybeSingle();
 if(sessionError||!session||Date.parse(session.expires_at)<=Date.now())fail('La sesión cambió. Vuelve a entrar.',401);
 const {data:existing,error:readError}=await db.from('pth_push_subscriptions').select('id,gestor_id,session_hash').eq('endpoint',endpoint).maybeSingle();
 if(readError)fail('No se pudo comprobar la suscripción.',503);
 // Never reassign another actor/session's subscription through an upsert.
 if(existing&&(existing.gestor_id!==actor.id||existing.session_hash!==sessionHash))fail('Desactiva la suscripción anterior en este navegador antes de volver a activarla.',409);
 const values={gestor_id:actor.id,session_hash:sessionHash,endpoint,p256dh:keys.p256dh,auth:keys.auth,topics:[...new Set(body.topics)],expires_at:session.expires_at,revoked_at:null};
 const result=existing?await db.from('pth_push_subscriptions').update(values).eq('id',existing.id).eq('gestor_id',actor.id).eq('session_hash',sessionHash):await db.from('pth_push_subscriptions').insert(values);
 if(result.error)fail('No se confirmó la suscripción. Vuelve a intentarlo.',503);
 return {data:{saved:true,expiresAt:session.expires_at},error:null};
}
