import {OWNER_IDS, actorKind} from './policy.mjs';
const TABLE='pth_feedback';
export const STATES=['nuevo','en_revision','pendiente_informacion','planificado','resuelto','descartado','duplicado'];
const columns='id,kind,title,need,workflow,benefit,page,created_at,updated_at,status,response,duplicate_of,revision';
const deny=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const field=(value,max,min=1)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max)deny('Completa los campos y respeta su longitud máxima.');return value.trim();};
export function validateSubmission(body,actor){
 if(!uuid(body.id))deny('Identificador no válido.');
 if(!['problema','mejora'].includes(body.kind))deny('Tipo no válido.');
 const page=field(body.page,100);
 if(!/^\/(?:index\.html|subgestores\.html|gestores\.html|studio\.html|master\.html|feedback\.html)?$/.test(page))deny('Página no válida.');
 let screenshot=null;
 if(body.screenshot){
  screenshot=field(body.screenshot,110000);
  if(!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(screenshot))deny('Usa una captura PNG pequeña.');
  let bytes;try{bytes=Uint8Array.from(atob(screenshot.split(',')[1]),c=>c.charCodeAt(0));}catch{deny('Captura no válida.');}
  if(bytes.length<33||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')deny('Captura no válida.');
  const header=new DataView(bytes.buffer),width=header.getUint32(16),height=header.getUint32(20);
  if(!width||!height||width>1600||height>1600)deny('La captura debe medir hasta 1600 píxeles por lado.');
 }
 return {id:body.id,author_id:actor.id,team_id:actor.parent_id||actor.id,kind:body.kind,title:field(body.title,160),need:field(body.need,2000),workflow:field(body.workflow,2000),benefit:body.kind==='mejora'?field(body.benefit,2000):'',page,screenshot};
}
const checked=async query=>{const result=await query;if(result.error)deny('No se pudo guardar o consultar. Conserva el formulario e intenta de nuevo.',503);return result.data;};
export async function feedback(db,body,actor){
 if(!actor?.id||actorKind(actor)==='mensajero')deny('Inicia sesión como gestor.',401);
 const owner=OWNER_IDS.has(actor.id)&&actorKind(actor)==='admin';
 const scoped=query=>owner?query:query.eq('author_id',actor.id);
 if(body.operation==='list'){
  const offset=body.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>100000)deny('Página no válida.');
  const rows=await checked(scoped(db.from(TABLE).select(owner?columns+',author_id,team_id,owner_note,priority':columns)).order('created_at',{ascending:false}).order('id').range(offset,offset+49));
  return {data:{rows,owner,next:rows.length===50?offset+50:null},error:null};
 }
 if(body.operation==='create'){
  const row=validateSubmission(body,actor);
  // Read first for retry after a lost response. The PK also arbitrates concurrent requests.
  const replay=existing=>{if(Object.keys(row).some(key=>row[key]!==existing[key]))deny('Esta referencia ya fue enviada con otros datos. Actualiza la página para iniciar otro envío.',409);return {data:{id:existing.id},error:null};};
  const existing=await checked(db.from(TABLE).select('*').eq('id',row.id).eq('author_id',actor.id).maybeSingle());
  if(existing)return replay(existing);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('feedback:'+actor.id));
  const rateKey=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  const {data:allowed,error:rateError}=await db.rpc('pth_check_login_rate',{p_key:rateKey,p_limit:40});
  if(rateError||allowed!==true)deny('Espera unos minutos antes de enviar más reportes.',429);
  const {error}=await db.from(TABLE).insert(row);
  if(error){
   if(error.code==='23505'){
    const retry=await checked(db.from(TABLE).select('*').eq('id',row.id).eq('author_id',actor.id).maybeSingle());
    if(retry)return replay(retry);
   }
   deny('No se confirmó el envío. Reintenta sin cerrar el formulario.',503);
  }
  return {data:{id:row.id},error:null};
 }
 if(body.operation==='screenshot'){
  if(!uuid(body.id))deny('Identificador no válido.');
  const row=await checked(scoped(db.from(TABLE).select('screenshot').eq('id',body.id)).maybeSingle());
  if(!row)deny('Reporte no disponible.',404);
  return {data:row,error:null};
 }
 if(body.operation==='triage'){
  if(!owner)deny('Solo el dueño puede clasificar reportes.',403);
  if(!uuid(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0||!STATES.includes(body.status)||!['baja','normal','alta'].includes(body.priority))deny('Clasificación no válida.');
  const duplicate=body.duplicate_of||null;
  if(duplicate&&(!uuid(duplicate)||duplicate===body.id))deny('Duplicado no válido.');
  if((body.status==='duplicado')!==Boolean(duplicate))deny('Indica el reporte original solo para duplicados.');
  if(duplicate){
   const original=await checked(db.from(TABLE).select('id,kind,duplicate_of').eq('id',duplicate).maybeSingle());
   const current=await checked(db.from(TABLE).select('kind').eq('id',body.id).maybeSingle());
   const children=await checked(db.from(TABLE).select('id').eq('duplicate_of',body.id).limit(1));
   if(!original||!current||original.kind!==current.kind||original.duplicate_of||children.length)deny('El original debe ser del mismo tipo, sin cadenas de duplicados.');
  }
  const rows=await checked(db.from(TABLE).update({status:body.status,priority:body.priority,response:field(body.response??'',2000,0),owner_note:field(body.owner_note??'',4000,0),duplicate_of:duplicate,revision:body.revision+1,updated_at:new Date().toISOString()}).eq('id',body.id).eq('revision',body.revision).select('id'));
  if(!rows.length)deny('El reporte cambió. Actualiza la lista antes de guardar.',409);
  return {data:rows[0],error:null};
 }
 deny('Operación no permitida.',403);
}
