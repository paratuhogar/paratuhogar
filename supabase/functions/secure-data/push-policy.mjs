// Existing administrative authorization is checked again for every delivery.
import {actorKind,OWNER_IDS} from './policy.mjs';
export function allowedPushTopics(actor){
 if(!actor||actor.estado!=='activo'||actor.activo===false||actorKind(actor)!=='admin')return [];
 return OWNER_IDS.has(actor.id)?['orders','suggestions']:['orders'];
}
export function pushEventForInsert(table,row){
 if(table==='pedidos')return {kind:'orders',source_id:row.id};
 if(table==='pth_feedback'&&row.kind==='mejora')return {kind:'suggestions',source_id:row.id};
 return null;
}
export function canDeliverPush(actor,session,subscription,event,now=Date.now(),currentCredentialHash){
 return Boolean(session&&session.gestor_id===actor?.id&&session.token_hash===subscription.session_hash
  &&currentCredentialHash&&session.credential_hash===currentCredentialHash
  &&subscription.gestor_id===actor?.id&&!subscription.revoked_at
  &&Date.parse(session.expires_at)>now&&Date.parse(subscription.expires_at)>now
  &&subscription.topics?.includes(event.kind)&&allowedPushTopics(actor).includes(event.kind));
}
