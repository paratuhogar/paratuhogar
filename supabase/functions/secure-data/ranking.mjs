import {actorKind} from './policy.mjs';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const label=value=>typeof value==='string'?Array.from(value.replace(/[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,40).join(''):'Cuenta';
function participant(row){
 if(!row||!uuid(row.id)||!count(row.count)||!Number.isSafeInteger(row.rank)||row.rank<1)fail('No se pudo comprobar la clasificación.',503);
 return {id:row.id,alias:label(row.alias)||'Cuenta',count:row.count,rank:row.rank};
}
export function rankingDTO(source,actorId){
 const period=source?.period,self=source?.self;
 if(!period||period.timeZone!=='America/Havana'||!/^\d{4}-\d{2}$/.test(period.key||'')||
  !/^\d{4}-\d{2}-\d{2}$/.test(period.startDate||'')||!/^\d{4}-\d{2}-\d{2}$/.test(period.endDate||'')||
  !Number.isFinite(Date.parse(period.startAt))||!Number.isFinite(Date.parse(period.endAt))||Date.parse(period.endAt)<=Date.parse(period.startAt)||
  !Number.isFinite(Date.parse(source.updatedAt))||self?.id!==actorId||!uuid(self.id)||
  !count(self.count)||!count(self.lifetimeCount)||!count(self.undatedCount)||
  !(self.rank===null||(Number.isSafeInteger(self.rank)&&self.rank>0))||
  typeof self.participates!=='boolean'||typeof self.identityReliable!=='boolean'||
  !Array.isArray(source.top)||source.top.length>3||!Array.isArray(source.nearby)||source.nearby.length>5)fail('No se pudo comprobar la clasificación.',503);
 const extended = {};
 if(source.leaderCount !== undefined) {
  if(!count(source.leaderCount) || source.leaderCount < source.top.filter(p=>p.rank===1).length) fail('Clasificación incompleta.',503);
  extended.leaderCount=source.leaderCount;
 }
 const month=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&value>='2026-11'&&value<period.key;
 const badges=source.self.monthlyBadges;
 const next=source.self.nextHigherCount;
 if(next!==undefined&&next!==null&&(!count(next)||next<=self.count)) fail('Meta inválida.',503);
 if(source.history!==undefined){
  if(!Array.isArray(source.history)||source.history.length>6)fail('Historial inválido.',503);
  extended.history=source.history.map(item=>{
   if(!month(item.month)||!Number.isFinite(Date.parse(item.closedAt))||Date.parse(item.closedAt)>Date.parse(source.updatedAt)||!count(item.leaderCount)||item.leaderCount<1||!count(item.count)||item.count<1||!Array.isArray(item.aliases)||item.aliases.length>3||item.aliases.length>item.leaderCount)fail('Cierre inválido.',503);
   return {month:item.month,closedAt:item.closedAt,leaderCount:item.leaderCount,count:item.count,aliases:item.aliases.map(value=>label(value)||'Cuenta')};
  });
 }
 if(badges!==undefined&&(!Array.isArray(badges)||badges.length>120||badges.some(b=>!month(b.month)||!count(b.count)||b.count<1)))fail('Insignias inválidas.',503);
 return {
  ...extended,
  period:Object.fromEntries(['key','startAt','endAt','startDate','endDate','timeZone'].map(key=>[key,period[key]])),updatedAt:source.updatedAt,
  self:{id:self.id,alias:label(self.alias)||'Cuenta',count:self.count,rank:self.rank,lifetimeCount:self.lifetimeCount,
   undatedCount:self.undatedCount,...(next===undefined?{}:{nextHigherCount:next}),...(badges===undefined?{}:{monthlyBadges:badges.map(b=>({month:b.month,count:b.count}))}),participates:self.participates,identityReliable:self.identityReliable},
  top:source.top.map(participant),nearby:source.nearby.map(participant),historyComplete:source.historyComplete===true
 };
}
export async function ranking(db,body,actor){
 if(!actor)fail('Inicia sesión para ver la clasificación.',401);
 if(!uuid(actor.id)||!['gestor','subgestor','admin'].includes(actorKind(actor)))fail('Esta cuenta no puede consultar la clasificación.');
 if(actor.estado!=='activo'||actor.activo===false)fail('La cuenta ya no está activa.',401);
 if(Object.keys(body).some(key=>key!=='action'))fail('La clasificación solo admite consultar tu propia posición.');
 const {data,error}=await db.rpc('pth_ranking_summary',{p_actor_id:actor.id});
 if(error||!data)fail('No se pudo actualizar la clasificación. Vuelve a intentar.',503);
 return {data:rankingDTO(data,actor.id),error:null};
}
