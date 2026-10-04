import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {rankingDTO} from '../supabase/functions/secure-data/ranking.mjs';import {summary,own} from './fixtures/ranking.mjs';
const window={addEventListener(){}};vm.runInNewContext(fs.readFileSync(new URL('../js/gestor-ranking.js',import.meta.url),'utf8'),{window,Intl,Date,Set,Map});
const rolling=()=>{const d=summary();d.period={kind:'created-delivered-30d',key:'2026-10-04',startDate:'2026-09-05',endDate:'2026-10-04',startAt:'2026-09-05T04:00:00Z',endAt:'2026-10-04T12:00:00Z',cacheUntil:'2026-10-05T04:00:00Z',timeZone:'America/Havana'};d.updatedAt=d.period.endAt;return d;};
test('DTO preserves creation-window identity and next midnight, rejects malformed criteria and bounds',()=>{
 const d=rolling();const dto=rankingDTO(d,own);assert.equal(dto.period.kind,'created-delivered-30d');assert.equal(dto.period.cacheUntil,'2026-10-05T04:00:00Z');
 for(const edit of [d=>d.period.kind='delivery-date-30d',d=>d.period.key='2026-10',d=>d.period.endAt='2026-10-05T12:00:00Z',d=>d.period.cacheUntil=d.period.endAt,d=>d.period.startDate='2026-09-06',d=>d.period.endDate='2026-10-05',d=>d.period.startAt='2026-09-05T12:00:00Z',d=>d.period.cacheUntil='2026-10-05T05:00:00Z']){const bad=rolling();edit(bad);assert.throws(()=>rankingDTO(bad,own));}
});
test('rolling-window drift and other sellers leaving cannot fabricate personal milestones',()=>{
 const make=(count,lifetime,rank,key='2026-10-04')=>{const d=rolling();d.period.key=key;Object.assign(d.self,{count,lifetimeCount:lifetime,rank});return d;};
 assert.equal(window.PTHRanking.milestoneEvents(make(2,6,4),make(2,6,1,'2026-10-05')).length,0);
 assert.equal(window.PTHRanking.milestoneEvents(make(2,6,4),make(2,6,1)).length,0);
 assert.equal(window.PTHRanking.milestoneEvents(make(2,6,4),make(3,7,1,'2026-10-05')).length,2);
 const events=window.PTHRanking.milestoneEvents(make(2,6,4),make(3,7,1));assert.equal(events[0].key,'created-delivered-30d-podium');assert.equal(events[1].key,'created-delivered-30d-leader');
 assert.equal(window.PTHRanking.milestoneEvents(make(0,0,null),make(1,1,1,'2026-10-05')).length,3);
});
export {rolling};
