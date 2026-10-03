// Existing administrative authorization is checked again for every delivery.
import {actorKind,OWNER_IDS} from './policy.mjs';
// Confirmed account; no name/email matching and no additional administrative grants.
export const APPLICATION_REVIEWER_ID='6193f310-1e3f-4404-b874-977d0e23a6a0';
export const APPLICATION_ESCALATION_REVIEWER_ID='38f20b63-a845-4a03-8d10-9a57da2ac2c4';
export const APPLICATION_REMINDER_TOPIC='application_reminders';
export function applicationRemindersEnabled(config){
 return config?.enabled===true&&config.angel_id===APPLICATION_REVIEWER_ID
  &&config.marcel_id===APPLICATION_ESCALATION_REVIEWER_ID;
}
export function allowedPushTopics(actor,reminders){
 if(!actor||actor.estado!=='activo'||actor.activo===false||actorKind(actor)!=='admin')return [];
 const topics=OWNER_IDS.has(actor.id)?['orders','suggestions']:['orders'];
 if(actor.id===APPLICATION_REVIEWER_ID)topics.push('applications');
 if(applicationRemindersEnabled(reminders)
  &&[APPLICATION_REVIEWER_ID,APPLICATION_ESCALATION_REVIEWER_ID].includes(actor.id))topics.push(APPLICATION_REMINDER_TOPIC);
 return topics;
}
export function pushEventForInsert(table,row){
 if(table==='gestores'&&row.estado==='pendiente'&&row.parent_id==null)return {kind:'applications',source_id:row.id};
 if(table==='pedidos')return {kind:'orders',source_id:row.id};
 if(table==='pth_feedback'&&row.kind==='mejora')return {kind:'suggestions',source_id:row.id};
 return null;
}
export function canDeliverPush(actor,session,subscription,event,now=Date.now(),currentCredentialHash,reminders){
 return Boolean(session&&session.gestor_id===actor?.id&&session.token_hash===subscription.session_hash
  &&currentCredentialHash&&session.credential_hash===currentCredentialHash
  &&subscription.gestor_id===actor?.id&&!subscription.revoked_at
  &&Date.parse(session.expires_at)>now&&Date.parse(subscription.expires_at)>now
  &&subscription.topics?.includes(event.kind)&&allowedPushTopics(actor,reminders).includes(event.kind));
}
