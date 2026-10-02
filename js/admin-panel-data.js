/* Date boundaries and bounded reads shared by the private administration UI. */
(function(root){
 'use strict';
 const DAY=86400000, zone='America/Havana';
 function timestamp(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))return NaN;
  return Date.parse(value);
 }
 function bucket(row,now=Date.now()){
  const time=timestamp(row?.created_at);
  return !Number.isFinite(time)||time>now?'unknown':time>=now-7*DAY?'recent':'history';
 }
 function pending(rows,filter='recent',now=Date.now()){
  const seen=new Set();
  return rows.filter(row=>{
   if(!row?.id||seen.has(row.id)||row.parent_id||row.estado!=='pendiente')return false;
   seen.add(row.id);return filter==='all'||bucket(row,now)===filter;
  }).sort((a,b)=>(timestamp(b.created_at)||0)-(timestamp(a.created_at)||0));
 }
 function pendingReview(rows,now=Date.now()){
  const waiting=pending(rows,'all',now),valid=row=>bucket(row,now)!=='unknown';
  waiting.sort((a,b)=>{
   if(valid(a)!==valid(b))return valid(a)?-1:1;
   return valid(a)?timestamp(a.created_at)-timestamp(b.created_at):0;
  });
  return {rows:waiting,total:waiting.length,
   over24h:waiting.filter(row=>valid(row)&&now-timestamp(row.created_at)>DAY).length,
   over48h:waiting.filter(row=>valid(row)&&now-timestamp(row.created_at)>2*DAY).length,
   unknown:waiting.filter(row=>!valid(row)).length,
   oldest:waiting.find(valid)?.created_at||null};
 }
 function date(value){const time=timestamp(value);return Number.isFinite(time)?new Intl.DateTimeFormat('es-CU',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(time):'Fecha no disponible';}
 function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 async function pages(makeQuery,{size=500,maxPages=60,signal}={}){
  const rows=[],seen=new Set();
  for(let page=0;page<maxPages;page++){
   if(signal?.aborted)throw Error('Consulta interrumpida. Vuelve a actualizar.');
   let query=makeQuery().range(page*size,(page+1)*size-1);
   if(signal&&typeof query.abortSignal==='function')query=query.abortSignal(signal);
   const result=await query;
   if(result.error)throw Error('No se pudieron consultar los datos. Vuelve a actualizar.');
   if(!Array.isArray(result.data))throw Error('Respuesta de datos incompleta.');
   for(const row of result.data){if(row.id==null||!seen.has(row.id)){rows.push(row);if(row.id!=null)seen.add(row.id);}}
   if(result.data.length<size)return rows;
  }
  throw Error('Este período tiene demasiados registros. Elige uno más corto.');
 }
 function aggregate(rows){
  const hours=Array(24).fill(0),countries=new Map(),agents=new Map(),systems=new Map();
  const hour=new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'2-digit',hourCycle:'h23'});
  const add=(map,value,fallback)=>{const key=String(value||fallback);map.set(key,(map.get(key)||0)+1);};
  for(const row of rows){const time=timestamp(row.timestamp);if(Number.isFinite(time))hours[Number(hour.format(time))]++;add(countries,row.pais,'Sin país registrado');add(agents,row.agent_name,'Directo');add(systems,row.os,'Sin sistema registrado');}
  const sorted=map=>[...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {total:rows.length,hours,countries:sorted(countries),agents:sorted(agents),systems:sorted(systems)};
 }
 const api={DAY,zone,timestamp,bucket,pending,pendingReview,date,escape,pages,aggregate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PTHAdminData=api;
})(globalThis);
