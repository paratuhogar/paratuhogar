import {actorKind} from './policy.mjs';

const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const batchUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const fail=(message,status,publicCode)=>{throw Object.assign(Error(message),{status,publicCode});};

// This action never accepts a price, commission, owner name or owner ID from
// the browser. PostgreSQL derives current values and records the whole batch
// in the same transaction as the inserts. Do not retry a mutation here.
export async function assignHalfCommissions(db,body,actor) {
 if(!actor)fail('Inicia sesión para asignar comisiones.',401,'SESSION_INVALID');
 if(actorKind(actor)!=='gestor'||!uuid(actor.id)||actor.estado!=='activo'||actor.activo===false)fail('Solo un gestor principal activo puede asignar comisiones.',403,'ACCESS_DENIED');
 if(Object.keys(body).some(key=>!['action','batchId','productIds'].includes(key))||!batchUuid(body.batchId)||!Array.isArray(body.productIds)||body.productIds.length<1||body.productIds.length>100||body.productIds.some(id=>!uuid(id)))fail('El lote debe contener entre 1 y 100 productos válidos.',400,'INVALID_BATCH');
 const batchId=body.batchId.toLowerCase(),productIds=body.productIds.map(id=>id.toLowerCase());
 if(new Set(productIds).size!==productIds.length)fail('No repitas productos dentro del lote.',400,'INVALID_BATCH');
 let result;
 try {
  result=await db.rpc('pth_assign_half_commissions',{p_gestor_id:actor.id,p_batch_id:batchId,p_product_ids:productIds});
 }catch {
  fail('No se pudo confirmar el lote. Conserva el mismo intento para consultar o reintentar.',503,'ASSIGNMENT_UNCONFIRMED');
 }
 const {data,error}=result||{};
 if(error) {
  if(error.code==='23505')fail('La configuración cambió mientras se guardaba. Reintenta el mismo lote.',409,'ASSIGNMENT_CONFLICT');
  if(error.code==='22023')fail('El lote no es válido o su identificador ya corresponde a otros productos.',409,'INVALID_BATCH');
  if(error.code==='42501')fail('La cuenta ya no puede asignar comisiones. Actualiza la sesión.',403,'ACCESS_DENIED');
  fail('No se pudo confirmar el lote. Conserva el mismo intento para consultar o reintentar.',503,'ASSIGNMENT_UNCONFIRMED');
 }
 const countKeys=['requested','inserted','skippedExisting','skippedUnavailable'];
 if(!data||typeof data!=='object'||Array.isArray(data)||data.batchId!==batchId||countKeys.some(key=>!Number.isInteger(data[key])||data[key]<0)||data.requested!==productIds.length||data.inserted+data.skippedExisting+data.skippedUnavailable!==data.requested)fail('No se pudo verificar el recibo del lote. Conserva el mismo intento.',503,'ASSIGNMENT_UNCONFIRMED');
 // Return only the public receipt, never incidental RPC fields or row data.
 return {data:{batchId,...Object.fromEntries(countKeys.map(key=>[key,data[key]]))},error:null};
}
