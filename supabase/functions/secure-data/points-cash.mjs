/* Cash incentives use their own service-only transaction. Nothing here moves
 * money, changes earned points, or authorizes commission/checkout operations. */
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const integer=(value,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const text=value=>typeof value==='string';
const nullable=(value,check)=>value===null||check(value);
const maxUsd=715827882;
const adminRoles=new Set(['admin','administrador','superadmin']);
const selfRoles=new Set(['gestor','subgestor',...adminRoles]);
const states=new Set(['requested','approved','in_payment','paid','rejected','cancelled','refunded']);
const methods=new Set(['efectivo','transferencia','otro']);
const mutationStates={request:'requested',approve:'approved',start_payment:'in_payment',reject:'rejected',cancel:'cancelled',record_payment:'paid',release_payment:'approved',refund:'refunded'};
const fields={
 summary:['beneficiaryId'],list:['beneficiaryId','state','search','offset'],detail:['requestId','offset'],request:['usd','idempotencyKey'],
 approve:['requestId','revision','idempotencyKey'],start_payment:['requestId','revision','idempotencyKey'],
 reject:['requestId','revision','reason','idempotencyKey'],cancel:['requestId','revision','reason','idempotencyKey'],
 record_payment:['requestId','revision','usd','method','reference','confirmPaid','idempotencyKey'],
 release_payment:['requestId','revision','reason','reference','confirmNotPaid','idempotencyKey'],
 refund:['requestId','revision','usd','reason','reference','confirmReturned','idempotencyKey'],
};
const readOperations=new Set(['summary','list','detail']);
const ownOperations=new Set([...readOperations,'request','cancel']);
const rowFields=['id','beneficiaryId','beneficiaryName','usd','points','state','revision','createdAt','updatedAt','claimedBy','claimedByName','paymentMethod','paymentReference','paidAt','reason'];
const eventFields=['id','operation','state','revision','actorId','actorName','reason','reference','createdAt'];
const summaryAmounts=['earnedConfirmed','available','reserved','redeemedPoints','paidUsd','deficit'];
const totalFields=['requestedUsd','approvedUsd','inPaymentUsd','paidUsd'];
const select=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
const fail=(message,status=400,publicCode='POINTS_CASH_INVALID')=>{throw Object.assign(Error(message),{status,publicCode});};
const unavailable=()=>fail('No se pudo comprobar el resultado del cobro. Conserva los datos y vuelve a consultar.',503,'POINTS_CASH_UNAVAILABLE');
const forbidden=()=>fail('Esta cuenta no tiene permiso para esta operación de cobro.',403,'POINTS_CASH_FORBIDDEN');

function sqlFailure(error){
 if(error?.code==='PT400')fail('Revisa los datos de la solicitud de cobro.');
 if(error?.code==='PT403')forbidden();
 if(error?.code==='55P03')fail('La billetera se está actualizando. Conserva el mismo intento y vuelve a consultar.',409,'POINTS_CASH_BUSY');
 if(error?.code==='PT409')fail('La solicitud o el saldo cambiaron. Consulta su estado antes de volver a intentar.',409,'POINTS_CASH_CONFLICT');
 unavailable();
}

function publicRequest(row,owner){
 if(!object(row)||!uuid(row.id)||!uuid(row.beneficiaryId)||owner&&row.beneficiaryId!==owner||!text(row.beneficiaryName)||
  !integer(row.usd,1,maxUsd)||row.points!==row.usd*3||!states.has(row.state)||!integer(row.revision,1,2147483647)||
  !timestamp(row.createdAt)||!timestamp(row.updatedAt)||!nullable(row.claimedBy,uuid)||!nullable(row.claimedByName,text)||
  !nullable(row.paymentMethod,value=>methods.has(value))||!nullable(row.paymentReference,text)||!nullable(row.paidAt,timestamp)||!nullable(row.reason,text))unavailable();
 if(['in_payment','paid','refunded'].includes(row.state)&&(!uuid(row.claimedBy)||!text(row.claimedByName)))unavailable();
 if(['paid','refunded'].includes(row.state)&&(!methods.has(row.paymentMethod)||!text(row.paymentReference)||!row.paymentReference.trim()||!timestamp(row.paidAt)))unavailable();
 return select(row,rowFields);
}

function publicEvent(row){
 if(!object(row)||!uuid(row.id)||!text(row.operation)||!row.operation||!states.has(row.state)||!integer(row.revision,1,2147483647)||
  !nullable(row.reason,text)||!nullable(row.reference,text)||!timestamp(row.createdAt))unavailable();
 const system=row.operation==='backing_reversed'&&row.state==='cancelled'&&row.actorId===null&&row.actorName===null&&text(row.reason)&&row.reason.trim();
 if(!system&&(!uuid(row.actorId)||!text(row.actorName)))unavailable();
 return select(row,eventFields);
}

function publicData(data,operation,args,actor,admin){
 if(!object(data))unavailable();
 const owner=operation==='summary'?args.beneficiaryId||actor.id:args.beneficiaryId||(!admin||operation==='request'?actor.id:null);
 if(operation==='summary'){
  if(!object(data.beneficiary)||data.beneficiary.id!==owner||!text(data.beneficiary.name)||typeof data.enabled!=='boolean'||data.rate!==3||summaryAmounts.some(key=>!integer(data[key])))unavailable();
  return {beneficiary:select(data.beneficiary,['id','name']),enabled:data.enabled,rate:3,...select(data,summaryAmounts)};
 }
 if(operation==='list'){
  if(!Array.isArray(data.rows)||data.rows.length>50||!nullable(data.nextOffset,value=>integer(value,0,1000000))||!object(data.totals)||totalFields.some(key=>!integer(data.totals[key])))unavailable();
  const rows=data.rows.map(row=>publicRequest(row,owner));
  if(args.state&&rows.some(row=>row.state!==args.state))unavailable();
  return {rows,nextOffset:data.nextOffset,totals:select(data.totals,totalFields)};
 }
 const request=publicRequest(data.request,owner);
 if(args.requestId&&request.id!==args.requestId)unavailable();
 if(operation==='detail'){
  if(!Array.isArray(data.events)||data.events.length>50||!nullable(data.nextOffset,value=>integer(value,0,1000000)))unavailable();
  return {request,events:data.events.map(publicEvent),nextOffset:data.nextOffset};
 }
 if(request.state!==mutationStates[operation]||Object.hasOwn(args,'usd')&&request.usd!==args.usd)unavailable();
 if(operation==='record_payment'&&(request.claimedBy!==actor.id||request.paymentMethod!==args.method||request.paymentReference!==args.reference))unavailable();
 if(operation==='start_payment'&&request.claimedBy!==actor.id)unavailable();
 if(operation==='release_payment'&&(request.claimedBy!==null||request.claimedByName!==null))unavailable();
 return {request};
}

export async function pointsCash(db,body,actor){
 if(!actor)fail('Inicia sesión para consultar tus cobros por puntos.',401,'SESSION_INVALID');
 const role=String(actor.rol).toLowerCase(),admin=!actor.parent_id&&adminRoles.has(role);
 if(!uuid(actor.id)||!selfRoles.has(role))forbidden();
 if(actor.estado!=='activo'||actor.activo===false)fail('Inicia sesión para consultar tus cobros por puntos.',401,'SESSION_INVALID');
 if(!object(body)||!Object.hasOwn(fields,body.operation))fail('Operación de cobro no válida.');
 const operation=body.operation,allowed=fields[operation];
 if(!admin&&!ownOperations.has(operation))forbidden();
 if(body.beneficiaryId!==undefined&&body.beneficiaryId!==actor.id&&!admin)forbidden();
 if(Object.keys(body).some(key=>!['action','operation',...allowed].includes(key)))fail('Revisa los campos de la operación de cobro.');
 const args=Object.fromEntries(allowed.filter(key=>Object.hasOwn(body,key)).map(key=>[key,body[key]]));
 for(const key of ['beneficiaryId','requestId'])if(Object.hasOwn(args,key)&&!uuid(args[key]))fail('Selecciona una cuenta o solicitud válida.');
 if(operation==='detail'||!readOperations.has(operation)&&operation!=='request'){
  if(!uuid(args.requestId))fail('Selecciona la solicitud de cobro.');
 }
 if(allowed.includes('offset')){if(!Object.hasOwn(args,'offset'))args.offset=0;if(!integer(args.offset,0,1000000))fail('La página solicitada no es válida.');}
 if(allowed.includes('search')){if(!Object.hasOwn(args,'search'))args.search='';if(!text(args.search)||args.search.length>120)fail('Escribe una búsqueda de hasta 120 caracteres.');args.search=args.search.trim();}
 if(Object.hasOwn(args,'state')&&!states.has(args.state))fail('Selecciona un estado de cobro válido.');
 if(!readOperations.has(operation)){
  if(typeof args.idempotencyKey!=='string'||!/^[0-9a-f]{64}$/.test(args.idempotencyKey))fail('Conserva el mismo intento y vuelve a abrir esta operación.');
  if(operation!=='request'&&!integer(args.revision,1,2147483647))fail('Actualiza la solicitud antes de aplicar esta decisión.');
 }
 if(allowed.includes('usd')&&!integer(args.usd,1,maxUsd))fail('Indica un importe entero entre 1 y 715827882 USD.');
 for(const [key,max] of [['reason',1000],['reference',200]])if(allowed.includes(key)){
  if(!text(args[key])||!args[key].trim()||args[key].length>max)fail(key==='reason'?'Escribe un motivo de hasta 1000 caracteres.':'Escribe una referencia o constancia de hasta 200 caracteres.');
  args[key]=args[key].trim();
 }
 if(operation==='record_payment'&&!methods.has(args.method))fail('Selecciona efectivo, transferencia u otro medio de pago.');
 for(const key of ['confirmPaid','confirmNotPaid','confirmReturned'])if(allowed.includes(key)&&args[key]!==true)fail('Confirma explícitamente la comprobación del pago real.');
 let result;
 try{result=await db.rpc('pth_points_cash',{p_actor_id:actor.id,p_operation:operation,p_body:args});}catch{unavailable();}
 if(!object(result))unavailable();
 if(result.error)sqlFailure(result.error);
 return {data:publicData(result.data,operation,args,actor,admin),error:null};
}
