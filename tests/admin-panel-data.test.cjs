const {test}=require('node:test');
const assert=require('node:assert/strict');
const data=require('../js/admin-panel-data.js');
const now=Date.parse('2026-10-02T00:00:00Z');
const row=(id,date,extra={})=>({id,estado:'pendiente',created_at:date,...extra});
test('seven days inclusive, invalid/missing/future dates recoverable; parents/duplicates excluded',()=>{
 const rows=[row('recent','2026-10-01T23:59:00Z'),row('boundary','2026-09-25T00:00:00Z'),row('old','2026-09-24T23:59:59Z'),row('missing',null),row('bad','invalid'),row('naive','2026-10-01T23:00:00'),row('future','2026-10-02T00:00:01Z'),row('child','2026-10-01T23:00:00Z',{parent_id:'parent'}),row('recent','2026-10-01T23:59:00Z'),row('active','2026-10-01T23:00:00Z',{estado:'activo'})];
 assert.deepEqual(data.pending(rows,'recent',now).map(r=>r.id),['recent','boundary']);
 assert.deepEqual(data.pending(rows,'history',now).map(r=>r.id),['old']);
 assert.equal(data.pending(rows,'unknown',now).length,4);
 assert.equal(data.pending(rows,'all',now).length,7);
 assert.equal(rows.length,10,'source untouched');
 assert.equal(data.bucket(row('offset','2026-09-24T20:00:00-04:00'),now),'recent');
});
test('Havana hours across UTC midnight and DST; hostile map keys stay inert',()=>{
 const stats=data.aggregate([{timestamp:'2026-10-02T00:00:00Z',pais:'__proto__',agent_name:'constructor',os:'<img onerror="evil()">'},{timestamp:'2026-01-02T00:00:00Z',pais:null},{timestamp:null}]);
 assert.equal(stats.hours[20],1);assert.equal(stats.hours[19],1);assert.equal(stats.total,3);
 assert.equal(stats.countries.find(x=>x[0]==='__proto__')[1],1);
 assert.ok(data.date('2026-10-02T00:00:00Z').includes('1 oct'));
});
test('review highlights only unique valid requests from the last seven days, oldest first',()=>{
 const time=age=>new Date(now-age).toISOString();
 const rows=[row('new',time(0)),row('old',time(9*data.DAY)),row('24h',time(data.DAY)),row('over24h',time(data.DAY+1)),row('48h',time(2*data.DAY)),row('over48h',time(2*data.DAY+1)),row('boundary',time(7*data.DAY)),row('just-old',time(7*data.DAY+1)),row('missing',null),row('invalid','bad date'),row('future',time(-1)),row('boundary',time(7*data.DAY)),row('child',time(data.DAY),{parent_id:'parent'}),row('active',time(data.DAY),{estado:'activo'})];
 const before=JSON.stringify(rows),review=data.pendingReview(rows,now);
 assert.deepEqual(review.rows.map(r=>r.id),['boundary','over48h','48h','over24h','24h','new']);
 assert.equal(review.total,6);assert.equal(review.over24h,4);assert.equal(review.over48h,2);assert.equal(review.unknown,0);
 assert.equal(review.oldest,time(7*data.DAY));assert.equal(JSON.stringify(rows),before);
 const history=data.pendingReview(rows,now,'all');
 assert.equal(history.total,11);assert.equal(history.unknown,3);
 assert.deepEqual(history.rows.slice(0,2).map(r=>r.id),['old','just-old']);
 assert.ok(history.rows.some(r=>r.id==='missing'));assert.ok(history.rows.some(r=>r.id==='future'));
 assert.deepEqual(data.pendingReview([],now),{rows:[],total:0,over24h:0,over48h:0,unknown:0,oldest:null});
});
test('old pending history alone never becomes a current highlight; the exact seven-day boundary expires',()=>{
 const old=[row('old','2020-01-01T00:00:00Z'),row('missing',null),row('future','2030-01-01T00:00:00Z')];
 assert.equal(data.pendingReview(old,now).total,0);assert.equal(data.pendingReview(old,now,'all').total,3);
 const boundary=[row('boundary',new Date(now-7*data.DAY).toISOString())];
 assert.equal(data.pendingReview(boundary,now).total,1);assert.equal(data.pendingReview(boundary,now+1).total,0);
});
function queryRows(rows,{failureAt=-1}={}){const ranges=[];return {ranges,make(){return {range(a,b){ranges.push([a,b]);return Promise.resolve(ranges.length===failureAt?{error:{message:'secret backend error'}}:{data:rows.slice(a,b+1),error:null});}};}};}
test('reads beyond API default caps and exact page multiples; dedupes overlapping rows',async()=>{
 const rows=Array.from({length:1600},(_,id)=>({id}));const mock=queryRows(rows);
 assert.equal((await data.pages(mock.make)).length,1600);assert.equal(mock.ranges.length,4);
 const exact=queryRows(rows.slice(0,1000));assert.equal((await data.pages(exact.make)).length,1000);assert.equal(exact.ranges.length,3);
 const dupe=queryRows([{id:1},{id:1},{id:2}]);assert.equal((await data.pages(dupe.make)).length,2);
});
test('partial responses, failures, limits and interruptions never become complete statistics',async()=>{
 const mock=queryRows(Array.from({length:1000},(_,id)=>({id})),{failureAt:2});await assert.rejects(data.pages(mock.make),/No se pudieron/);
 const bounded=queryRows(Array.from({length:1000},(_,id)=>({id})));await assert.rejects(data.pages(bounded.make,{maxPages:1}),/más corto/);
 await assert.rejects(data.pages(()=>({range:()=>Promise.resolve({data:null})})),/incompleta/);
 const controller=new AbortController();controller.abort();await assert.rejects(data.pages(()=>assert.fail('must not send'),{signal:controller.signal}),/interrumpida/);
});
