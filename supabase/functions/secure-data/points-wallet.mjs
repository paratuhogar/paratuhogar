/* Rewards are independent of commission/payment permissions. */
import {pointsCash} from './points-cash.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status,publicCode:status===503?'POINTS_UNAVAILABLE':'POINTS_INVALID'});};
const administrator=actor=>!actor.parent_id&&['admin','administrador','superadmin'].includes(String(actor.rol).toLowerCase());
const fields={summary:['beneficiaryId','offset'],accounts:['search','offset'],rules:['search','offset'],save_rule:['productId','pointsPerUnit','reason','idempotencyKey'],grant:['beneficiaryId','points','reason','idempotencyKey','captureId'],reverse:['movementId','reason','idempotencyKey'],issues:['offset'],settings:[]};
const writes=new Set(['grant','reverse','save_rule']);
const integer=(value,min=0,max=2147483647)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
export async function pointsWallet(db,body,actor,pointsCashEnabled=false){
 if(!actor||actor.estado!=='activo'||actor.activo===false)fail('Inicia sesión para consultar tus puntos.',401);
 if(!uuid(actor.id)||String(actor.rol).toLowerCase()==='mensajero')fail('Esta cuenta no puede consultar puntos.',403);
 const allowed=fields[body.operation];if(!allowed)fail('Operación de puntos no válida.');
 const admin=administrator(actor);
 if(body.operation!=='summary'&&!admin)fail('Esta acción de puntos está reservada a administración.',403);
 if(body.operation==='summary'&&body.beneficiaryId!==undefined&&body.beneficiaryId!==actor.id&&!admin)fail('Solo puedes consultar tu propia billetera.',403);
 if(Object.keys(body).some(key=>!['action','operation',...allowed].includes(key)))fail('Revisa los datos de la operación de puntos.');
 const args={};for(const key of allowed)if(Object.hasOwn(body,key))args[key]=body[key];
 if(allowed.includes('offset')){args.offset??=0;if(!integer(args.offset,0,1000000))fail('La página solicitada no es válida.');}
 if(allowed.includes('search')){args.search??='';if(typeof args.search!=='string'||args.search.length>120)fail('Escribe una búsqueda de hasta 120 caracteres.');args.search=args.search.trim();}
 for(const key of ['beneficiaryId','productId','movementId','captureId'])if(Object.hasOwn(args,key)&&!uuid(args[key]))fail('Selecciona una cuenta, producto o movimiento válido.');
 if(writes.has(body.operation)){
  if(typeof args.reason!=='string'||!args.reason.trim()||args.reason.length>1000)fail('Escribe el motivo de esta operación.');args.reason=args.reason.trim();
  if(typeof args.idempotencyKey!=='string'||!/^[0-9a-f]{64}$/.test(args.idempotencyKey))fail('Conserva el mismo intento y vuelve a abrir esta operación.');
 }
 if(body.operation==='grant'&&(!uuid(args.beneficiaryId)||!integer(args.points,1)))fail('Selecciona el destinatario e indica una cantidad entera positiva.');
 if(body.operation==='reverse'&&!uuid(args.movementId))fail('Selecciona la asignación que quieres revertir.');
 if(body.operation==='save_rule'&&(!uuid(args.productId)||args.pointsPerUnit!==null&&!integer(args.pointsPerUnit)))fail('Indica puntos enteros no negativos o usa la regla por tamaño.');
 const {data,error}=await db.rpc('pth_points_wallet',{p_actor_id:actor.id,p_operation:body.operation,p_body:args});
 if(error){
  if(error.code==='P0001')fail('No se pudo aplicar la operación. Revisa el saldo, el estado de la venta y si este intento ya fue utilizado.',409);
  if(error.code==='42501')fail('No tienes permiso para esta operación de puntos.',403);
  if(['22023','22P02','23514'].includes(error.code))fail('Los datos de la operación de puntos necesitan revisión.');
  fail('No se pudieron consultar o guardar los puntos. Conserva los datos y vuelve a intentar.',503);
 }
 if(!data||typeof data!=='object'||Array.isArray(data))fail('No se pudo comprobar el resultado de los puntos. Vuelve a intentar.',503);
 if(body.operation==='summary'&&data.beneficiary?.id!==(args.beneficiaryId||actor.id))fail('No se pudo verificar el propietario de la billetera.',503);
 if(body.operation==='summary'&&pointsCashEnabled===true&&['gestor','subgestor','admin','administrador','superadmin'].includes(String(actor.rol).toLowerCase())){
  const cash=await pointsCash(db,{operation:'summary',...(args.beneficiaryId?{beneficiaryId:args.beneficiaryId}:{})},actor);
  return {data:{...data,cash:cash.data},error:null};
 }
 return {data,error:null};
}
