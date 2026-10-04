// Synthetic QA fixture only. No network API, authentication or order writes.
const NativeDate=Date;
const own='demo-ranking-actor';window.currentUserData={id:own};
const person=(id,alias,count,rank)=>({id,alias,count,rank});
function fixture(kind){const data={period:{key:'2026-10',startAt:'2026-10-01T04:00:00Z',endAt:'2026-11-01T04:00:00Z',startDate:'2026-10-01',endDate:'2026-10-31',timeZone:'America/Havana'},updatedAt:new NativeDate().toISOString(),self:{id:own,alias:'DEMO Mi tienda',count:2,rank:2,lifetimeCount:2,undatedCount:3,participates:true,identityReliable:true},top:[person('a','DEMO Brisa',3,1),person(own,'DEMO Mi tienda',2,2)],nearby:[],historyComplete:false};
 if(kind==='single'){Object.assign(data.self,{count:1,rank:1,lifetimeCount:1});data.top=[person(own,data.self.alias,1,1)];}
 if(kind==='zero'){Object.assign(data.self,{count:0,rank:null,lifetimeCount:0});data.top=[];data.nearby=[];}
 if(kind==='ties'){data.top=[person('a','DEMO Brisa',3,1),person('b','DEMO Sol',3,1),person(own,'DEMO Mi tienda',2,3)];data.self.rank=3;data.nearby=data.top;}
 if(kind==='neighbors'){data.self.rank=4;data.top=[person('a','DEMO Brisa',7,1),person('b','DEMO Sol',6,2),person('c','DEMO Casa',5,3)];data.nearby=[data.top[2],person(own,'DEMO Mi tienda',2,4),person('d','DEMO Mar',1,5)];}
 if(kind==='history'){Object.assign(data.period,{key:'2026-12',startAt:'2026-12-01T05:00:00Z',endAt:'2027-01-01T05:00:00Z',startDate:'2026-12-01',endDate:'2026-12-31'});data.updatedAt='2026-12-03T12:00:00Z';data.history=[{month:'2026-11',closedAt:'2026-12-01T05:00:00Z',leaderCount:4,count:9,aliases:['DEMO Brisa','DEMO Sol','DEMO Casa']}];data.self.monthlyBadges=[{month:'2026-11',count:9}];}
 if(kind==='manyties'){data.top=[person('a','DEMO Brisa',3,1),person('b','DEMO Sol',3,1),person('c','DEMO Casa',3,1)];Object.assign(data.self,{count:3,rank:1,lifetimeCount:3});data.nearby=[...data.top.slice(1),person(own,'DEMO Mi tienda',3,1)];}
 if(kind==='admin'){data.self.participates=false;data.self.rank=null;data.self.count=0;data.top=[person('a','DEMO Brisa',1,1)];data.nearby=[];}
 if(kind==='child'){data.self.alias='DEMO Subgestor';data.top.find(p=>p.id===own).alias=data.self.alias;}
 data.leaderCount=kind==='manyties'?4:data.top.filter(p=>p.rank===1).length;data.self.nextHigherCount=data.self.participates&&data.self.count? Math.min(...data.top.filter(p=>p.count>data.self.count).map(p=>p.count)):null;if(!Number.isFinite(data.self.nextHigherCount))data.self.nextHigherCount=null;return data;}
let data=fixture('single');window.PTHSecureData={token:()=> 'synthetic-local-token',ranking:async()=>({data:structuredClone(data),error:null})};
const card=document.getElementById('gestor-ranking'),tools=document.getElementById('tools');
window.openGestorTool=name=>{card.hidden=true;tools.hidden=false;document.getElementById('destination').textContent='Destino simulado: '+name;};
document.getElementById('back').onclick=()=>{tools.hidden=true;card.hidden=false;PTHRanking.load();};
document.getElementById('scenario').onchange=e=>{data=fixture(e.target.value);PTHRanking.clear();PTHRanking.load(true);};
for(const [id,count] of [['first',1],['third',3],['fifth',5]])document.getElementById(id).onclick=()=>{Object.assign(data.self,{count,lifetimeCount:count,rank:1});data.top=[person(own,data.self.alias,count,1)];data.nearby=[];data.leaderCount=1;data.self.nextHigherCount=null;PTHRanking.load(true);};
document.getElementById('reset').onclick=()=>{for(const key of Object.keys(localStorage))if(key.startsWith('pth-ranking-hito:demo-ranking-actor:'))localStorage.removeItem(key);data=fixture('zero');PTHRanking.clear();PTHRanking.load(true);};
if(new URL(location.href).searchParams.get('motion')==='reduce')fetch('../../css/gestor-ranking.css').then(r=>r.text()).then(css=>{const style=document.createElement('style');style.dataset.qaReducedBranch='';style.textContent=css.replace('@media(prefers-reduced-motion:reduce)','@media all');document.head.append(style);});

// Explicit future clock only for the clearly labelled closed-history demo.
window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:[data.period.key==='2026-12'?data.updatedAt:NativeDate.now()]));}static now(){return data.period.key==='2026-12'?NativeDate.parse(data.updatedAt):NativeDate.now();}};
document.getElementById('scenario').addEventListener('change',()=>{document.getElementById('clock-note').textContent=data.period.key==='2026-12'?'Historial DEMO: reloj simulado 3/12/2026; no es un ganador real.':'Reloj real del Mac; solo los datos son ficticios.';});
