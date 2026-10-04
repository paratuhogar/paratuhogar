const {parseHTML}=require('linkedom');const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const {summary,own}=await import('./fixtures/ranking.mjs');
 const {window}=parseHTML('<section id="gestor-ranking"></section>');let data=summary(),calls=0,now=Date.parse('2026-10-04T12:00:00Z');
 data.period={kind:'created-delivered-30d',key:'2026-10-04',startDate:'2026-09-05',endDate:'2026-10-04',startAt:'2026-09-05T04:00:00Z',endAt:'2026-10-04T12:00:00Z',cacheUntil:'2026-10-05T04:00:00Z',timeZone:'America/Havana'};data.updatedAt=data.period.endAt;data.leaderCount=1;
 const storage=new Map(),root={document:window.document,addEventListener(){},currentUserData:{id:own},navigator:{onLine:true},setTimeout(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 root.PTHSecureData={token:()=> 'demo-token',ranking:async()=>{calls++;return {data:structuredClone(data)}}};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 vm.runInNewContext(fs.readFileSync('js/gestor-ranking.js','utf8'),{window:root,Intl,Date:Clock,Set,Map});const card=()=>root.document.getElementById('gestor-ranking');
 await root.PTHRanking.load(true);assert.match(card().textContent,/Últimos 30 días/);assert.match(card().textContent,/creados/);assert.doesNotMatch(card().textContent,/Cierre:|días restantes|La cima del mes|no tienen una fecha válida|mes en curso/);
 assert.match(card().textContent,/05\/09/);assert.match(card().textContent,/04\/10/);await root.PTHRanking.load();assert.equal(calls,1);
 now=Date.parse('2026-10-05T04:00:00Z');data.period.key='2026-10-05';data.period.startDate='2026-09-06';data.period.endDate='2026-10-05';data.period.cacheUntil='2026-10-06T04:00:00Z';await root.PTHRanking.load();assert.equal(calls,2);
 data.self.participates=false;await root.PTHRanking.load(true);assert.doesNotMatch(card().textContent,/Tus logros|Tu puesto|tus entregas/);assert.match(card().textContent,/no participa/);
 data.self.participates=true;data.self.count=0;data.self.rank=null;data.top=[];data.leaderCount=0;await root.PTHRanking.load(true);assert.match(card().textContent,/Sin puesto/);
 const legacy=summary();data=legacy;await root.PTHRanking.load(true);assert.equal(card().dataset.rankingState,'error');assert.doesNotMatch(card().textContent,/Últimos 30 días/);
 console.log('PASS rolling30 DOM: criterion/labels, no delivery-date exclusions or monthly countdown, midnight cache, admin/zero, legacy not reinterpreted');
})().catch(e=>{console.error(e);process.exit(1)});
