// This operation records follow-up only. Order insertion owns assignment;
// neither callers nor administrators can use this endpoint to choose an owner.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status,publicCode:status===503?'CUSTOMER_BINDING_UNAVAILABLE':'CUSTOMER_BINDING_INVALID'});};
function canonicalPhone(phone){
 const digits=phone.replace(/\D/g,'');
 if(/^\d{8}$/.test(digits))return digits;
 if(/^53\d{8}$/.test(digits))return digits.slice(2);
 if(/^0\d{8}$/.test(digits))return digits.slice(1);
 if(/^053\d{8}$/.test(digits))return digits.slice(3);
 if(/^0053\d{8}$/.test(digits))return digits.slice(4);
 return null;
}
export async function customerBindings(db,body,actor){
 if(!actor||actor.estado!=='activo'||actor.activo===false)fail('Inicia sesión para registrar el seguimiento.',401);
 if(!uuid(actor.id)||['mensajero','logistica'].includes(String(actor.rol).toLowerCase()))fail('Esta cuenta no puede registrar este seguimiento.',403);
 if(!body||typeof body!=='object'||Array.isArray(body)||body.operation!=='renew'
  ||Object.keys(body).some(key=>!['action','operation','phone'].includes(key))
  ||body.action!==undefined&&body.action!=='customer_binding')fail('Operación de seguimiento no válida.');
 if(typeof body.phone!=='string'||body.phone.length>80)fail('Revisa el teléfono del cliente.');
 const phone=canonicalPhone(body.phone);if(!phone)fail('Revisa el teléfono del cliente.');
 let result;
 try{result=await db.rpc('pth_customer_binding',{p_actor_id:actor.id,p_phone:phone});}
 catch(_){fail('No se pudo guardar el seguimiento. Conserva los datos y vuelve a intentar.',503);}
 const {data,error}=result||{};
 if(error){
  if(error.code==='42501')fail('No tienes permiso para registrar este seguimiento.',403);
  if(error.code==='P0001')fail('No se pudo verificar la asignación del cliente. Contacta con administración.',409);
  if(['22023','22P02'].includes(error.code))fail('Revisa el teléfono del cliente.');
  fail('No se pudo guardar el seguimiento. Conserva los datos y vuelve a intentar.',503);
 }
 if(!data||data.renewed!==true||data.phone!==phone||!Number.isFinite(Date.parse(data.activityAt)))
  fail('No se pudo verificar el seguimiento. Conserva los datos y vuelve a intentar.',503);
 return {data,error:null};
}
