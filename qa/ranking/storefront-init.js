// Local full-storefront QA only: fake session and all data requests intercepted.
if(location.hostname!=='127.0.0.1')throw Error('QA fixture only runs on loopback');
window.__rankingQARequests=[];
const qaRole=new URL(location.href).searchParams.get('role')||'gestor';
const qaProfile={id:'11111111-1111-4111-8111-111111111111',nombre:'DEMO Gestor',nombre_publico:'DEMO Mi tienda',rol:qaRole==='admin'?'admin':'gestor',estado:'activo',activo:true,telefono:'5350000000',password:'__session__',nivel:0};
if(qaRole==='subgestor')Object.assign(qaProfile,{id:'22222222-2222-4222-8222-222222222222',parent_id:'11111111-1111-4111-8111-111111111111',parent_nombre:'DEMO Principal',nombre:'DEMO Subgestor'});
sessionStorage.setItem('pth_intro_vista','true');for(const key of ['info_precios_v1','sl_tutorial_completed_v1','pth_subgestor_onboarding_v1'])localStorage.setItem(key,'true');localStorage.setItem('pth_last_seen_level','0');
localStorage.setItem('pth_secure_token','a'.repeat(64));localStorage.setItem('pth_session',JSON.stringify({name:qaProfile.nombre,isAdmin:qaRole==='admin',data:qaProfile}));
const qaProducts=Array.from({length:4},(_,i)=>({id:'qa-product-'+i,nombre:'DEMO Nevera '+i,precio:1000,comision:50,categoria:'NEVERAS',disponible:'SI',precio_flexible:'NO',thumbnail:'log.jpeg',foto:'log.jpeg',created_at:'2026-10-01',garantia:'DEMO'}));
const qaSummary=()=>({period:{key:'2026-10',startAt:'2026-10-01T04:00:00Z',endAt:'2026-11-01T04:00:00Z',startDate:'2026-10-01',endDate:'2026-10-31',timeZone:'America/Havana'},updatedAt:new Date().toISOString(),self:{id:qaProfile.id,alias:qaProfile.nombre_publico,count:qaRole==='admin'?0:2,rank:qaRole==='admin'?null:3,lifetimeCount:2,undatedCount:0,participates:qaRole!=='admin',identityReliable:true,nextHigherCount:qaRole==='admin'?null:3,monthlyBadges:[]},top:[{id:'33333333-3333-4333-8333-333333333333',alias:'DEMO Brisa',count:3,rank:1},{id:'44444444-4444-4444-8444-444444444444',alias:'DEMO Sol',count:3,rank:1},...(qaRole==='admin'?[]:[{id:qaProfile.id,alias:qaProfile.nombre_publico,count:2,rank:3}])],nearby:[],leaderCount:2,history:[],historyComplete:true});
const qaNativeFetch=window.fetch.bind(window);
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.pathname.includes('/functions/v1/secure-data')){
  const body=JSON.parse(options.body||'{}');window.__rankingQARequests.push(body);let data=[];
  if(body.action==='session')data={profile:qaProfile,expiresAt:new Date(Date.now()+86400000).toISOString()};
  else if(body.action==='ranking')data=qaSummary();
  else if(body.table==='gestores')data=qaRole==='subgestor'?[qaProfile,{id:qaProfile.parent_id,nombre:'DEMO Principal',rol:'gestor',estado:'activo',activo:true}]:[qaProfile];
  else if(body.table==='productos')data=qaProducts;
  else if(body.table==='precios_personalizados'&&qaRole==='subgestor')data=qaProducts.map(p=>({gestor:'DEMO Principal',producto_id:p.id,nuevo_precio:1000,comision_subgestor:15,visible_subgestor:true}));
  for(const f of body.filters||[])if(f.method==='eq'&&Array.isArray(data))data=data.filter(r=>r[f.column]===f.value);
  if(body.single&&Array.isArray(data))data=data[0]||null;
  return new Response(JSON.stringify({data,error:null,count:Array.isArray(data)?data.length:0}),{headers:{'Content-Type':'application/json'}});
 }
 if(url.origin!==location.origin){window.__rankingQARequests.push({blockedExternal:url.pathname});return new Response(JSON.stringify({data:[],error:null}),{headers:{'Content-Type':'application/json'}});}
 return qaNativeFetch(input,options);
};
window.addEventListener('DOMContentLoaded',()=>{const notice=document.createElement('div');notice.textContent='QA LOCAL · FRONTEND COMPLETO · DATOS FICTICIOS · '+qaRole.toUpperCase();notice.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fff6db;color:#614816;padding:7px;text-align:center;font-size:11px;font-weight:bold;pointer-events:none';document.body.append(notice);});
