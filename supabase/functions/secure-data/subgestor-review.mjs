import {actorKind} from './policy.mjs';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
export async function reviewSubgestor(db,body,actor) {
 const kind=actorKind(actor);
 if(!actor||!['admin','gestor'].includes(kind)||actor.estado!=='activo'||actor.activo===false)fail('No tienes permiso para revisar pedidos.');
 const {operation}=body;
 if(!['list','history','edit','approve','reject'].includes(operation))fail('Operación no válida.');
 if(operation==='history'&&kind!=='admin')fail('Historial reservado a administración.');
 const offset=body.offset??0,search=String(body.search??'').trim();
 if(!Number.isInteger(offset)||offset<0||offset>1000000||search.length>120)fail('Consulta no válida.');
 if(!['list','history'].includes(operation)) {
  if(!uuid(body.id)||!/^[a-f0-9]{32}$/.test(body.expected||''))fail('Actualiza el pedido antes de continuar.');
 }
 const changes=body.changes??{};
 if(!changes||Array.isArray(changes)||typeof changes!=='object'||Object.entries(changes).some(([k,v])=>!['cliente','telefono','ci','direccion','municipio'].includes(k)||typeof v!=='string'||v.length>4000))fail('Solo puedes editar datos de entrega.');
 const reason=String(body.reason??'').trim();
 if(reason.length>1000||(operation==='reject'&&!reason))fail('Indica el motivo del rechazo.');
 const {data,error}=await db.rpc('pth_review_subgestor',{
  p_actor_id:actor.id,p_operation:operation,
  p_id:body.id??null,p_expected:body.expected??null,p_changes:changes,p_reason:reason||null,p_search:search,p_offset:offset
 });
 if(error) {
  if(error.code==='P0001')fail(error.message,409);
  fail('No se pudo completar la revisión. Actualiza la lista antes de reintentar.',503);
 }
 if(!data||typeof data!=='object'||(['list','history'].includes(operation)?!Array.isArray(data.rows):data.id!==body.id))fail('No se pudo verificar el resultado. Actualiza la lista.',503);
 return {data,error:null};
}
