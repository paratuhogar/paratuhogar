/* Compatibility boundary: protected tables never fall back to public REST. */
(function(root){
 'use strict';
 const tables=new Set(['productos','gestores','pedidos','pedidos_subgestores','precios_personalizados','inventario_eventos','caja_gestores','solicitudes_cobro','solicitudes_cobro_detalle','solicitudes_cobro_adelantos','configuracion_equipo','mensajeros']);
 const rpcs=new Set(['mis_solicitudes_cobro','mis_pedidos_solicitudes_cobro','solicitar_cobro_comision','solicitar_cobro_comision_pedidos','es_admin_boveda','listar_deuda_sistema','resumen_deuda_sistema','listar_pedidos_boveda','liquidar_deuda_sistema','listar_solicitudes_cobro_beatriz','registrar_adelanto_solicitud_cobro','gestionar_solicitud_cobro_beatriz','archivar_solicitudes_pagadas_beatriz','listar_adelantos_solicitudes_nomina','listar_historial_pagos_gestores','listar_historial_solicitudes_cobro_beatriz','aplicar_inactividad_gestores','owner_statistics_orders','owner_statistics_orders_v2','owner_statistics_products','owner_statistics_traffic','owner_statistics_views']);
 const url='https://ljqwaovevfatkiigirhf.supabase.co/functions/v1/secure-data';
 const key='sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt';
 const storage=root.localStorage;let restoration=null;let profile=null;
 const messenger=/\/mensajeros\.html$/.test(root.location?.pathname||'');
 const tokenKey=messenger?'pth_secure_messenger_token':'pth_secure_token';
 function clearCaches(){
  for(let i=storage.length-1;i>=0;i--){const name=storage.key(i);if(/^(pth_catalogo_|pth_catalog_data|pth_ultimo_cambio_productos|pth_studio_.*(?:catalog|product|cache|custom_prices)|pth_stats)/.test(name))storage.removeItem(name);}
 }
 function clearSession(){storage.removeItem(tokenKey);storage.removeItem(messenger?'pth_messenger_session':'pth_session');profile=null;restoration=null;clearCaches();}
 const identity=data=>JSON.stringify([data?.id,data?.rol,data?.parent_id,data?.parent_nombre]);
 function saveSession(data){let previous=null;try{previous=JSON.parse(storage.getItem(messenger?'pth_messenger_session':'pth_session')||'null');}catch(_){}profile=data.profile;if(data.token)storage.setItem(tokenKey,data.token);storage.setItem(messenger?'pth_messenger_session':'pth_session',JSON.stringify(messenger?profile:{name:profile.nombre,isAdmin:!profile.parent_id&&['admin','administrador','superadmin','logistica'].includes(String(profile.rol).toLowerCase()),data:profile}));if(identity(previous?.data||previous)!==identity(profile))clearCaches();}
 async function send(body,token=storage.getItem(tokenKey)){
  try{
   const response=await root.fetch(url,{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   const result=await response.json();
   if(result.error)result.error.status=response.status;
   if(response.status===401&&body.action!=='login'&&token===storage.getItem(tokenKey))clearSession();
   return result;
  }catch(error){return{data:null,error:{message:'No se pudo conectar con el servidor. Intenta de nuevo; no se usará una conexión sin protección.',code:'NETWORK_ERROR'}};}
 }
 async function login(username,password){const result=await send({action:'login',username,password},null);if(result.error)throw Error(result.error.message);saveSession(result.data);restoration=Promise.resolve(profile);return profile;}
 function restore(){
  if(restoration)return restoration;
  const attempt=(async()=>{
   const token=storage.getItem(tokenKey);
   let previous=null;try{previous=JSON.parse(storage.getItem(messenger?'pth_messenger_session':'pth_session')||'null');}catch(_){clearSession();}
   if(!token){
    if(messenger&&previous?.pin)return loginMessenger(previous.pin);
    if(previous?.data?.id&&previous.data.password&&previous.data.password!=='__session__')return login(previous.data.id,previous.data.password);
    if(previous)clearSession();return null;
   }
   const result=await send({action:'session'},token);
   if(result.error)throw Object.assign(Error(result.error.message),result.error);
   if(token!==storage.getItem(tokenKey))throw Object.assign(Error('La sesión cambió. Vuelve a intentar.'),{code:'SESSION_CHANGED'});
   saveSession(result.data);return profile;
  })();
  restoration=attempt;
  // Keep successful restoration shared; failed attempts must be retryable.
  // Do not invalidate a newer login/restoration when an old attempt settles.
  attempt.catch(()=>{if(restoration===attempt)restoration=null;});
  return attempt;
 }
 class Query{
  constructor(body){this.body={filters:[],orders:[],...body};this.promise=null;}
  select(columns='*',options={}){this.body.columns=columns;this.body.count=options.count;this.body.head=options.head;if(this.body.op!=='select')this.body.returning=true;return this;}
  insert(values){this.body.op='insert';this.body.values=values;return this;}
  update(values){this.body.op='update';this.body.values=values;return this;}
  upsert(values,options={}){this.body.op='upsert';this.body.values=values;this.body.onConflict=options.onConflict;return this;}
  delete(){this.body.op='delete';return this;}
  order(column,options={}){this.body.orders.push({column,...options});return this;}
  limit(limit){this.body.limit=limit;return this;}
  range(from,to){this.body.range=[from,to];return this;}
  single(){this.body.single='single';return this;}
  maybeSingle(){this.body.single='maybeSingle';return this;}
  not(column,operator,value){this.body.filters.push({method:'not',column,operator,value});return this;}
  or(value){this.body.filters.push({method:'or',value});return this;}
  filter(column,operator,value){if(!['eq','neq','gt','gte','lt','lte','like','ilike','is','in'].includes(operator))throw Error('Filtro no permitido');return this[operator](column,value);}
  then(resolve,reject){if(!this.promise)this.promise=restore().then(()=>send(this.body)).catch(error=>({data:null,error:{message:error.message,code:error.code||'SESSION_UNAVAILABLE',status:error.status}}));return this.promise.then(resolve,reject);}
  catch(reject){return this.then(undefined,reject);}
 }
 for(const method of ['eq','neq','gt','gte','lt','lte','like','ilike','is','in'])Query.prototype[method]=function(column,value){this.body.filters.push({method,column,value});return this;};
 function install(client){if(client.__pthSecure)return client;const from=client.from.bind(client),rpc=client.rpc.bind(client);client.from=table=>tables.has(table)?new Query({action:'query',table,op:'select'}):from(table);client.rpc=(name,params={},options={})=>rpcs.has(name)?new Query({action:'rpc',name,params,...options}):rpc(name,params,options);client.__pthSecure=true;return client;}
 if(storage.getItem('pth_privacy_schema')!=='commission-v1'){clearCaches();storage.setItem('pth_privacy_schema','commission-v1');}
 async function loginMessenger(pin){const result=await send({action:'login_messenger',pin},null);if(result.error)throw Error(result.error.message);saveSession(result.data);restoration=Promise.resolve(profile);return profile;}
 root.PTHSecureData={login,loginMessenger,restore,clearSession,clearCaches,install,token:()=>storage.getItem(tokenKey),cacheSuffix:()=>':'+(profile?.id||'public'),logout:()=>{const token=storage.getItem(tokenKey);clearSession();return send({action:'logout'},token);}};
 if(root.supabase?.createClient){const create=root.supabase.createClient.bind(root.supabase);root.supabase.createClient=(...args)=>install(create(...args));}
})(window);
