// Synthetic isolated DOM QA; install linkedom externally and set NODE_PATH.
const {parseHTML}=require('linkedom');
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/gestor-ranking.js','utf8');
(async()=>{
 const {summary,own}=await import('./fixtures/ranking.mjs');
 const {window}=parseHTML('<section id="gestor-ranking"></section>');
 let data=summary(),calls=0,timers=[],storage=new Map(),actions=[];
 const root={document:window.document,addEventListener(){}};root.currentUserData={id:own};root.navigator={onLine:true};root.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};root.setTimeout=fn=>timers.push(fn);root.openGestorTool=x=>actions.push(x);
 root.PTHSecureData={token:()=> 'demo-token',ranking:async()=>{calls++;return {data:structuredClone(data)}}};
 vm.runInNewContext(source,{window:root,Intl,Date,Set,Map});
 const card=()=>root.document.getElementById('gestor-ranking');
 for(const role of ['gestor','subgestor','admin']){
  data=summary();data.self.participates=role!=='admin';await root.PTHRanking.load(true);
  assert.match(card().textContent,/La cima del mes/);assert.equal(card().querySelectorAll('.ranking-leader').length,1);
  if(role==='admin')assert.doesNotMatch(card().textContent,/tus entregas|Tus logros|Tu puesto/);
 }
 data=summary();data.self.count=0;data.self.rank=null;data.self.lifetimeCount=0;data.top=[];data.nearby=[];await root.PTHRanking.load(true);
 assert.match(card().textContent,/Sin puesto/);assert.equal(card().querySelectorAll('.ranking-leader').length,0);
 data.self.count=1;data.self.rank=1;data.self.lifetimeCount=1;data.top=[{id:own,alias:'DEMO <img onerror=bad()>',count:1,rank:1}];
 await root.PTHRanking.load(true);assert.equal(card().querySelectorAll('.ranking-celebration').length,1);assert.equal(card().querySelectorAll('img').length,0);
 await root.PTHRanking.load(true);assert.equal(card().querySelectorAll('.ranking-celebration').length,0);
 data=summary();data.self.count=2;data.self.rank=3;data.top=[{id:'demo-a',alias:'DEMO A',count:3,rank:1},{id:'demo-b',alias:'DEMO B',count:3,rank:1},{id:own,alias:'DEMO tú',count:2,rank:3}];data.nearby=data.top;await root.PTHRanking.load(true);
 assert.equal(card().querySelectorAll('.ranking-leader').length,2);assert.match(card().textContent,/1 para empatar el puesto #1 y 2 para superarlo/);
 data.top=[{id:'a',alias:'DEMO A',count:7,rank:1},{id:'b',alias:'DEMO B',count:6,rank:2},{id:'c',alias:'DEMO C',count:5,rank:3}];data.self.rank=4;data.nearby=[data.top[2],{id:own,alias:'DEMO tú',count:2,rank:4},{id:'d',alias:'DEMO D',count:1,rank:5}];await root.PTHRanking.load(true);
 assert.equal(card().querySelector('[data-ranking-nearby]').children.length,2);
 const before=calls;await Promise.all([root.PTHRanking.load(true),root.PTHRanking.load(true)]);assert.equal(calls,before+1);
 [...card().querySelectorAll('button')].find(b=>b.textContent==='Preparar próxima venta').click();assert.deepEqual(actions,['mensaje']);
 root.PTHRanking.clear();assert.equal(card().children.length,0);
 console.log('PASS DOM: gestor/subgestor/admin, zero/single/ties/top3/neighbors, aliases as text, milestones once, duplicate events, CTA and clearing');
})().catch(e=>{console.error(e);process.exit(1)});
