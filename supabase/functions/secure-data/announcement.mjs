const TABLE='pth_feedback_announcement_ack';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
// Fixed, account-scoped announcement. No caller-chosen identity or campaign.
export async function announcement(db,body,actor){
 if(!actor?.id||actor.rol==='mensajero')fail('Inicia sesión como gestor.',401);
 if(Object.keys(body).some(key=>!['action','operation'].includes(key))||!['status','acknowledge'].includes(body.operation))fail('Operación de aviso no válida.',400);
 if(body.operation==='status'){
  const {data,error}=await db.from(TABLE).select('gestor_id').eq('gestor_id',actor.id).maybeSingle();
  if(error)fail('No se pudo consultar el aviso.',503);
  return {data:{acknowledged:Boolean(data)},error:null};
 }
 const {error}=await db.from(TABLE).insert({gestor_id:actor.id});
 if(error&&error.code!=='23505')fail('No se pudo guardar la confirmación. Intenta de nuevo.',503);
 return {data:{acknowledged:true},error:null};
}
