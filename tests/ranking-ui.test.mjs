import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const window={addEventListener(){}};
vm.runInNewContext(fs.readFileSync(new URL('../js/gestor-ranking.js',import.meta.url),'utf8'),{window,Intl,Date,Set});
test('exact distance uses higher counts, preserves ties and never ranks zero',()=>{
 const data={self:{count:2,rank:4},top:[{count:6,rank:1}],nearby:[{count:3,rank:3},{count:2,rank:4}]};
 assert.equal(window.PTHRanking.distance(data).tie,1);
 assert.equal(window.PTHRanking.distance(data).overtake,2);
 data.self.count=0;data.self.rank=null;assert.equal(window.PTHRanking.distance(data),null);
 data.self.count=6;data.self.rank=1;assert.equal(window.PTHRanking.distance(data),null);
 data.self.count=2;data.self.rank=10;data.nearby=[{count:2,rank:10}];assert.equal(window.PTHRanking.distance(data),null);
 data.self.nextHigherCount=3;assert.equal(window.PTHRanking.distance(data).tie,1);
});
test('remaining calendar days use Cuba dates across DST and month boundaries',()=>{
 const period={endDate:'2026-10-31',endAt:'2026-11-01T04:00:00Z'};
 assert.equal(window.PTHRanking.daysLeft(period,'2026-10-04T02:00:00Z'),28);
 assert.equal(window.PTHRanking.daysLeft(period,'2026-11-01T03:59:59Z'),0);
 assert.equal(window.PTHRanking.daysLeft(period,'2026-11-01T04:00:00Z'),0);
});
test('milestones require an observed increase, do not repeat and do not invent month transitions',()=>{
 const make=(count,rank,month='2026-10',participates=true)=>({period:{key:month},self:{lifetimeCount:count,rank,participates,identityReliable:true}});
 assert.equal(window.PTHRanking.milestoneEvents(null,make(5,1)).length,0);
 assert.equal(window.PTHRanking.milestoneEvents(make(0,null),make(1,1)).length,3);
 assert.equal(window.PTHRanking.milestoneEvents(make(1,1),make(1,1)).length,0);
 assert.equal(window.PTHRanking.milestoneEvents(make(0,null),make(5,1,'2026-11')).length,0);
 assert.equal(window.PTHRanking.milestoneEvents(make(0,null),make(5,1,'2026-10',false)).length,0);
 const unreliable=make(0,null);unreliable.self.identityReliable=false;
 assert.equal(window.PTHRanking.milestoneEvents(unreliable,make(5,1)).length,0);
});
