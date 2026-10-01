import {announcement} from './announcement.mjs';
import {feedback} from './feedback.mjs';
import {pushSettings} from './push.mjs';
import {PROTECTED_TABLES,MY_RPCS,ADMIN_RPCS,OWNER_IDS,actorKind,scopeFor,projectRow,calculateSale} from './policy.mjs';

const ALLOWED_FILTERS=new Set(['eq','neq','gt','gte','lt','lte','like','ilike','is','in','not','or']);
const ORIGINS=new Set(['https://paratuhogar.org','https://www.paratuhogar.org','http://localhost:8080','http://127.0.0.1:8080']);
const encode=value=>new TextEncoder().encode(value);
export async function hash(value) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encode(String(value)))),v=>v.toString(16).padStart(2,'0')).join('');}
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const cleanProfile=actor=>({...actor,password:'__session__'});
const pick=(row,columns)=>!columns||columns==='*'?row:Object.fromEntries(columns.split(',').map(s=>s.trim()).filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function validateQuery(body,actor) {
  const {table,op='select',columns='*',filters=[],orders=[]}=body;
  if(!PROTECTED_TABLES.has(table)||!['select','insert','update','delete','upsert'].includes(op)) fail('Operación no permitida.');
  if(typeof columns!=='string'||!/^(?:\*|[a-zA-Z0-9_, ]+)$/.test(columns)) fail('Selecciona únicamente campos de esta tabla.');
  if(!Array.isArray(filters)||filters.length>30||!Array.isArray(orders)||orders.length>8) fail('Consulta no válida.');
  const restricted=['public','subgestor','mensajero'].includes(actorKind(actor));
  const financial=/comision|costo_proveedor|pago_gestor|estado_financiero/i;
  for(const filter of filters) {
    if(!ALLOWED_FILTERS.has(filter.method)) fail('Filtro no permitido.');
    if(filter.method==='or'&&actorKind(actor)!=='admin') fail('Los filtros compuestos requieren un administrador.');
    const text=filter.method==='or'?String(filter.value):String(filter.column);
    if(table==='inventario_eventos'&&actorKind(actor)!=='admin'&&(filter.method==='or'||text==='datos_producto')) fail('No puedes filtrar instantáneas privadas de inventario.');
    if(/password|token|credential/i.test(text)||(restricted&&financial.test(text))||(table==='gestores'&&actorKind(actor)!=='admin'&&/email|rol|activo|comision|jefe_id|fecha_rescate|acceso_vip/i.test(text))) fail('No tienes permiso para filtrar datos privados.');
    if(filter.method!=='or'&&!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filter.column)) fail('Campo de filtro no válido.');
    if(filter.method==='not'&&!['eq','neq','is','in','like','ilike'].includes(filter.operator)) fail('Operador no permitido.');
  }
  for(const order of orders) if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(order.column)||/password|token/i.test(order.column)||(restricted&&financial.test(order.column))||(table==='inventario_eventos'&&actorKind(actor)!=='admin'&&order.column==='datos_producto')||(table==='gestores'&&actorKind(actor)!=='admin'&&/email|rol|activo|comision|jefe_id|fecha_rescate|acceso_vip/i.test(order.column))) fail('No tienes permiso para ordenar datos privados.');
  return body;
}
function applyQuery(query,body,scope=[]) {
  for(const [method,column,value] of scope) query=query[method](column,value);
  for(const f of body.filters||[]) {
    if(f.method==='or') query=query.or(f.value);
    else if(f.method==='not') query=query.not(f.column,f.operator,f.value);
    else query=query[f.method](f.column,f.value);
  }
  for(const o of body.orders||[]) query=query.order(o.column,{ascending:o.ascending!==false,nullsFirst:o.nullsFirst===true});
  if(body.range) {
    const [from,to]=body.range.map(Number);
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to-from>=2000) fail('Rango no válido.');
    query=query.range(from,to);
  } else query=query.limit(Math.min(2000,Math.max(1,Number(body.limit)||1000)));
  return query;
}
async function parentFor(db,profile) {
  if(!profile?.parent_id) return null;
  const {data,error}=await db.from('gestores').select('*').eq('id',profile.parent_id).maybeSingle();
  if(error||!data||data.parent_id||data.estado!=='activo') fail('El gestor principal no está activo.',401);
  return data;
}
async function resolveActor(db,token) {
  if(!token) return null;
  if(typeof token!=='string'||token.length!==64) fail('Inicia sesión de nuevo.',401);
  const {data:session,error}=await db.from('pth_secure_sessions').select('*').eq('token_hash',await hash(token)).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error||!session) fail('Tu sesión venció. Inicia sesión de nuevo.',401);
  if(session.mensajero_id){
    const {data:driver}=await db.from('mensajeros').select('*').eq('id',session.mensajero_id).maybeSingle();
    if(!driver?.activo||await hash(driver.pin)!==session.credential_hash)fail('Inicia sesión de nuevo.',401);
    return{id:driver.id,nombre:driver.nombre,telefono:driver.telefono,rol:'mensajero'};
  }
  const {data:profile,error:profileError}=await db.from('gestores').select('*').eq('id',session.gestor_id).maybeSingle();
  if(profileError||!profile||profile.estado!=='activo'||profile.activo===false||await hash(profile.password)!==session.credential_hash) fail('La cuenta o sesión ya no está activa.',401);
  const parent=await parentFor(db,profile);
  return {...profile,parent_nombre:parent?.nombre,parent_telefono:parent?.telefono};
}
async function login(db,body,request) {
  const username=String(body.username||'').trim();
  const password=String(body.password||'').trim();
  if(!username||!password||username.length>200||password.length>512) fail('Usuario o contraseña incorrectos.',401);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const phone=username.replace(/\D/g,'').replace(/^53(?=\d{8}$)/,'');
  const rateIdentity=phone.length===8?phone:normalized(username);
  const {data:allowed,error:rateError}=await db.rpc('pth_check_login_rate',{p_key:await hash(`identity:${rateIdentity}`)});
  if(rateError||allowed!==true) fail('Demasiados intentos. Espera unos minutos y vuelve a intentar.',429);
  const {data:ipAllowed,error:ipError}=await db.rpc('pth_check_login_rate',{p_key:await hash(`ip:${ip}`),p_limit:200});
  if(ipError||ipAllowed!==true)fail('Demasiados intentos. Espera unos minutos.',429);
  const {data:rows,error}=await db.from('gestores').select('*').eq('password',password).limit(1000);
  if(error) fail('No se pudo verificar el acceso.',503);
  const identity=normalized(username);
  const exact=(rows||[]).filter(g=>g.id===username||normalized(g.nombre)===identity||normalized(g.email)===identity||(phone.length===8&&String(g.telefono||'').replace(/\D/g,'').replace(/^53(?=\d{8}$)/,'')===phone));
  const matches=exact.length?exact:(rows||[]).filter(g=>normalized(g.nombre).startsWith(`${identity} `));
  if(matches.length!==1) fail('Usuario o contraseña incorrectos.',401);
  const profile=matches[0];
  if(profile.estado!=='activo'||profile.activo===false) fail('Tu cuenta necesita revisión. Contacta con tu gestor o administrador.',401);
  const parent=await parentFor(db,profile);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const {error:sessionError}=await db.from('pth_secure_sessions').insert({token_hash:await hash(token),gestor_id:profile.id,credential_hash:await hash(password),expires_at:new Date(Date.now()+7*86400000).toISOString()});
  if(sessionError) fail('No se pudo iniciar la sesión.',503);
  return {token,profile:cleanProfile({...profile,parent_nombre:parent?.nombre,parent_telefono:parent?.telefono})};
}
async function loginMessenger(db,body){
  const pin=String(body.pin||'').trim();if(!pin||pin.length>100)fail('PIN incorrecto.',401);
  const {data:allowed}=await db.rpc('pth_check_login_rate',{p_key:await hash('messenger-login'),p_limit:200});
  if(!allowed)fail('Demasiados intentos.',429);
  const {data:driver,error}=await db.from('mensajeros').select('*').eq('pin',pin).eq('activo',true).maybeSingle();
  if(error||!driver)fail('PIN incorrecto o mensajero inactivo.',401);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const {error:sessionError}=await db.from('pth_secure_sessions').insert({token_hash:await hash(token),mensajero_id:driver.id,credential_hash:await hash(pin),expires_at:new Date(Date.now()+86400000).toISOString()});
  if(sessionError)fail('No se pudo iniciar la sesión.',503);
  return {token,profile:{id:driver.id,nombre:driver.nombre,telefono:driver.telefono,rol:'mensajero'}};
}
async function canonicalSale(db,table,input,actor) {
  const allowed=['gestor','subgestor_id','cliente','telefono','ci','direccion','municipio','costo_mensajeria','proveedor','orden_dia','origen','garantia_venta','garantia_dias','submission_token'];
  const row=Object.fromEntries(allowed.filter(key=>Object.hasOwn(input,key)).map(key=>[key,input[key]]));
  const lines=input._lineas;
  // Approval preserves the stored financial snapshot; a browser cannot rewrite it.
  if(table==='pedidos'&&input.subgestor_nombre) {
    if(!actor||actorKind(actor)==='subgestor'||!input.id) fail('Este pedido debe aprobarlo su gestor principal.');
    let query=db.from('pedidos_subgestores').select('*').eq('id',input.id);
    if(actorKind(actor)!=='admin') query=query.eq('parent_gestor_id',actor.id);
    const {data:pending,error}=await query.maybeSingle();
    if(error||!pending) fail('No se encontró el pedido pendiente autorizado.');
    if(!Number.isFinite(Number(pending.comision_total))||Number(pending.comision_subgestor)<0||Number(pending.comision_subgestor)>Number(pending.comision_total)) fail('Revisa el reparto de este pedido antes de aprobarlo.');
    row.id=pending.id;
    row.gestor=pending.parent_gestor_nombre;
    for(const field of ['cliente','telefono','ci','direccion','municipio','producto','total','costo_mensajeria','comision_total','comision_subgestor','orden_dia','proveedor','garantia_venta','garantia_dias','submission_token','subgestor_nombre']) row[field]=pending[field];
    row.comision_parent=Number(pending.comision_total)-Number(pending.comision_subgestor);
    row.estado='Pendiente';row.pago_gestor='Pendiente';row.pago_subgestor='Pendiente';
    return row;
  }
  let seller=null;
  if(table==='pedidos_subgestores') {
    const {data}=await db.from('gestores').select('*').eq('id',row.subgestor_id).maybeSingle();seller=data;
    if(!seller?.parent_id) fail('El subgestor no es válido.');
  } else if(row.gestor&&row.gestor!=='Venta Directa') {
    const {data}=await db.from('gestores').select('*').eq('nombre',row.gestor).maybeSingle();seller=data;
    if(!seller||seller.parent_id) fail('El vendedor no es válido para un pedido directo.');
  }
  if(seller&&(seller.estado!=='activo'||seller.activo===false)) fail('El vendedor no está activo.');
  if(actorKind(actor)==='subgestor'&&seller?.id!==actor.id) fail('Solo puedes registrar tus propias ventas.');
  const parent=await parentFor(db,seller);
  if(!Array.isArray(lines)||!lines.length) fail('Actualiza la página antes de registrar el pedido.');
  const {data:products,error}=await db.from('productos').select('id,nombre,precio,comision,precio_flexible,proveedor,disponible').in('id',[...new Set(lines.map(l=>l.producto_id))]);
  if(error) fail('No se pudieron verificar los equipos.',503);
  if((products||[]).some(p=>p.disponible!=='SI'||p.proveedor!==row.proveedor)) fail('Revisa disponibilidad y proveedor de los equipos.');
  const owner=parent?.nombre||seller?.nombre;
  const {data:prices,error:priceError}=owner?await db.from('precios_personalizados').select('*').eq('gestor',owner):{data:[],error:null};
  if(priceError) fail('No se pudieron verificar las comisiones.',503);
  const sale=calculateSale(lines,products||[],prices||[],Boolean(parent));
  const shipping=Number(row.costo_mensajeria)||0;
  if(shipping<0||!Number.isFinite(shipping)) fail('Envío no válido.');
  row.producto=sale.producto;row.total=Math.round((sale.equipment+shipping)*100)/100;
  row.comision_total=seller?sale.totalCommission:0;
  if(parent) {row.subgestor_id=seller.id;row.subgestor_nombre=seller.nombre;row.parent_gestor_id=parent.id;row.parent_gestor_nombre=parent.nombre;row.comision_subgestor=sale.subCommission;row.estado='Pendiente Aprobacion';delete row.gestor;delete row.origen;}
  else {row.gestor=seller?.nombre||'Venta Directa';delete row.comision_parent;delete row.comision_subgestor;row.estado='Pendiente';row.pago_gestor='Pendiente';}
  return row;
}
async function prepareWrite(db,body,actor) {
  const kind=actorKind(actor);
  const values=Array.isArray(body.values)?body.values:[body.values];
  if(!values.length||values.length>100||values.some(v=>!v||typeof v!=='object'||Array.isArray(v))) fail('Datos no válidos.');
  const result=[];
  for(const input of values) {
    scopeFor(body.table,actor,body.op,input);
    let row={...input};
    if(['pedidos','pedidos_subgestores'].includes(body.table)&&body.op==='insert') row=await canonicalSale(db,body.table,row,actor);
    if(body.table==='gestores'&&body.op==='insert'&&kind!=='admin') {
      if(!row.nombre||!row.telefono||String(row.password||'').length<6) fail('Completa nombre, teléfono y una contraseña de al menos 6 caracteres.');
      row={nombre:row.nombre,email:row.email||null,telefono:row.telefono,password:row.password,parent_id:row.parent_id||null,rol:'gestor',estado:row.parent_id?'pendiente_subgestor':'pendiente'};
      if(row.parent_id) await parentFor(db,{parent_id:row.parent_id});
    }
    if(body.table==='precios_personalizados'&&kind==='gestor') {
      row.gestor=actor.nombre;
      if(row.id&&['insert','upsert'].includes(body.op)) {
        const {data}=await db.from('precios_personalizados').select('gestor').eq('id',row.id).maybeSingle();
        if(data&&data.gestor!==actor.nombre) fail('No puedes modificar precios de otro gestor.');
      }
    }
    result.push(row);
  }
  return Array.isArray(body.values)?result:result[0];
}
async function dataQuery(db,body,actor) {
  validateQuery(body,actor);
  const {table,op='select'}=body;
  if(table==='inventario_eventos'&&!actor)return {data:body.single?null:[],error:null,count:body.count==='exact'?0:null};
  const values=op!=='select'&&op!=='delete'?await prepareWrite(db,body,actor):undefined;
  const scope=scopeFor(table,actor,op,Array.isArray(values)?values[0]:values);
  if(table==='inventario_eventos'&&actorKind(actor)==='subgestor')scope.push(['in','tipo',['nuevo','reposicion','agotado','precio']]);
  let query=db.from(table);
  if(op==='select') query=query.select('*',{count:body.count==='exact'?'exact':undefined,head:body.head===true});
  else {
    query=op==='delete'?query.delete():query[op](values,op==='upsert'?{onConflict:body.onConflict||undefined}:undefined);
    if(body.returning) query=query.select('*');
  }
  query=applyQuery(query,body,scope);
  const {data,error,count}=await query;
  if(error) return {data:null,error:{message:error.message,code:error.code},count:null};
  let assigned=new Map();
  if(table==='productos'&&actorKind(actor)==='subgestor'&&data?.length) {
    // Bound UUID IN filters so large catalogues stay within gateway URL limits.
    const productIds=[...new Set(data.map(p=>p.id))];
    for(let offset=0;offset<productIds.length;offset+=100) {
      const {data:prices,error:priceError}=await db.from('precios_personalizados')
        .select('producto_id,nuevo_precio,comision_subgestor,visible_subgestor')
        .eq('gestor',actor.parent_nombre)
        .in('producto_id',productIds.slice(offset,offset+100));
      if(priceError)fail('No se pudo consultar tu comisión asignada.',503);
      for(const price of prices||[])assigned.set(price.producto_id,price);
    }
  }
  let rows=(data||[]).filter(row=>!(table==='productos'&&actorKind(actor)==='subgestor'&&assigned.get(row.id)?.visible_subgestor===false)).map(row=>projectRow(table,row,actor,assigned)).filter(Boolean).map(row=>pick(row,body.columns));
  if(body.single) {
    if(rows.length>1||(!rows.length&&body.single==='single')) return {data:null,error:{code:'PGRST116',message:'La consulta no devolvió un único registro.'},count};
    return {data:rows[0]||null,error:null,count};
  }
  return {data:data===null?null:rows,error:null,count};
}
async function rpcQuery(db,body,actor) {
  const name=body.name;
  if(!MY_RPCS.has(name)&&!ADMIN_RPCS.has(name)) fail('Función no permitida.');
  if(!actor) fail('Inicia sesión.',401);
  if(ADMIN_RPCS.has(name)&&actorKind(actor)!=='admin') fail('No tienes permiso para consultar la Bóveda.');
  if(name.startsWith('owner_statistics_')&&!OWNER_IDS.has(actor.id)) fail('Estadísticas reservadas al dueño.');
  const params={...(body.params||{}),p_password:actor.password};
  if(MY_RPCS.has(name)) params.p_gestor_id=actor.id;
  else params.p_admin_id=actor.id;
  const query=applyQuery(db.rpc(name,params),body);
  const {data,error,count}=await query;
  return {data,error:error?{message:error.message,code:error.code}:null,count};
}
export function createHandler({db,pushEnv={},pushPilot}) {
  return async request=>{
    const origin=request.headers.get('Origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
    if(origin&&ORIGINS.has(origin)) headers['Access-Control-Allow-Origin']=origin;
    if(origin&&!ORIGINS.has(origin)) return new Response(JSON.stringify({error:{message:'Origen no permitido.'}}),{status:403,headers});
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
    if(request.method!=='POST') return new Response(JSON.stringify({error:{message:'Método no permitido.'}}),{status:405,headers});
    try {
      if(Number(request.headers.get('content-length'))>150000) fail('Solicitud demasiado grande.',413);
      const text=await request.text();if(text.length>150000) fail('Solicitud demasiado grande.',413);
      const body=JSON.parse(text);
      if(body.action==='login') return new Response(JSON.stringify({data:await login(db,body,request),error:null}),{headers});
      if(body.action==='login_messenger') return new Response(JSON.stringify({data:await loginMessenger(db,body),error:null}),{headers});
      const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
      const actor=await resolveActor(db,bearer);
      let result;
      if(body.action==='session') {if(!actor) fail('Inicia sesión.',401);result={data:{profile:cleanProfile(actor)},error:null};}
      else if(body.action==='logout') {if(bearer) await db.from('pth_secure_sessions').delete().eq('token_hash',await hash(bearer));result={data:null,error:null};}
      else if(body.action==='announcement') result=await announcement(db,body,actor);
      else if(body.action==='feedback') result=await feedback(db,body,actor);
      else if(body.action==='push') result=await pushSettings(db,body,actor,await hash(bearer),pushEnv,pushPilot);
      else if(body.action==='query') result=await dataQuery(db,body,actor);
      else if(body.action==='rpc') result=await rpcQuery(db,body,actor);
      else fail('Operación no permitida.');
      return new Response(JSON.stringify(result),{headers});
    } catch(error) {
      return new Response(JSON.stringify({data:null,error:{message:error.status?error.message:'No se pudo completar la consulta segura.',code:error.status===401?'SESSION_INVALID':'ACCESS_DENIED'}}),{status:error.status||403,headers});
    }
  };
}
