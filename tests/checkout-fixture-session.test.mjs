// Test the faithful session-update contract of the synthetic checkout DB double.
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './fixtures/new-checkout.mjs';import {hash} from '../supabase/functions/secure-data/handler.mjs';
const day=86400000;
test('checkout fixture supports gateway renewal of a short active session without business writes',async()=>{
 const f=await fixture(),session=f.rows.pth_secure_sessions[0],old=new Date(Date.now()+day).toISOString();session.expires_at=old;
 f.rows.pth_secure_sessions.push({...session,token_hash:await hash('b'.repeat(64)),gestor_id:'unrelated-synthetic'});const other=structuredClone(f.rows.pth_secure_sessions[1]),before=structuredClone(f.rows.pedidos),start=Date.now();
 const result=await f.request({action:'session'});assert.equal(f.lastStatus,200,'session renewal must be supported by the synthetic DB contract');assert.equal(result.data.profile.id,'actor-a');assert.equal(result.data.expiresAt,session.expires_at);assert.ok(Date.parse(session.expires_at)>=start+30*day);assert.ok(Date.parse(session.expires_at)<=Date.now()+30*day);assert.deepEqual(f.rows.pth_secure_sessions[1],other);assert.deepEqual(f.rows.pedidos,before);assert.equal(f.writes,0);assert.equal(f.trace.filter(q=>q.table==='pth_secure_sessions'&&q.op==='update').length,1);
});
test('fixture update honors all CAS filters, select projection, maybeSingle and detached returned data',async()=>{
 const f=await fixture(),session=f.rows.pth_secure_sessions[0],old=session.expires_at,next='2099-02-01';
 const miss=await f.db.from('pth_secure_sessions').update({expires_at:next}).eq('token_hash',session.token_hash).eq('expires_at','stale-expiry').gt('expires_at',new Date().toISOString()).select('expires_at').maybeSingle();assert.deepEqual(miss,{data:null,error:null});assert.equal(session.expires_at,old);
 const hit=await f.db.from('pth_secure_sessions').update({expires_at:next}).eq('token_hash',session.token_hash).eq('expires_at',old).gt('expires_at',new Date().toISOString()).select('expires_at').maybeSingle();assert.deepEqual(hit,{data:{expires_at:next},error:null});hit.data.expires_at='changed-return-only';assert.equal(session.expires_at,next);
 const replay=await f.db.from('pth_secure_sessions').update({expires_at:'2099-03-01'}).eq('token_hash',session.token_hash).eq('expires_at',old).select('expires_at').maybeSingle();assert.equal(replay.data,null);assert.equal(session.expires_at,next);
 const noReturn=await f.db.from('pth_secure_sessions').update({expires_at:'2099-04-01'}).eq('token_hash',session.token_hash);assert.deepEqual(noReturn,{data:null,error:null});assert.equal(session.expires_at,'2099-04-01');
});
test('fixture renewal cannot turn an expired or deleted session into an active one',async()=>{
 for(const state of ['expired','deleted']){const f=await fixture();if(state==='expired')f.rows.pth_secure_sessions[0].expires_at='2000-01-01';else f.rows.pth_secure_sessions.length=0;const before=structuredClone(f.rows.pth_secure_sessions);await f.request({action:'session'});assert.equal(f.lastStatus,401);assert.deepEqual(f.rows.pth_secure_sessions,before);assert.equal(f.trace.some(q=>q.op==='update'),false);assert.equal(f.writes,0);}
});
