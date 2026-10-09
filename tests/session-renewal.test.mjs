import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sessionFixture} from './fixtures/session-infrastructure.mjs';
const day=86400000;

for(const child of [false,true])test(`new ${child?'subgestor':'gestor'} session remains usable after a week and expires in 30 days`,async()=>{
 const f=await sessionFixture({child}),before=Date.now();
 const result=await f.request({action:'login',username:'Fixture',password:'fixture-only'},null);
 assert.equal(result.error,null);
 const duration=Date.parse(result.data.expiresAt)-before;
 assert.ok(duration>=30*day&&duration<30*day+5000);
});
test('administrative login retains its seven-day limit',async()=>{
 const f=await sessionFixture();f.rows.gestores[0].rol='admin';
 const before=Date.now(),result=await f.request({action:'login',username:'Fixture',password:'fixture-only'},null);
 assert.equal(result.error,null);assert.ok(Date.parse(result.data.expiresAt)-before>=7*day&&Date.parse(result.data.expiresAt)-before<7*day+5000);
});
for(const courier of [false,true])test(`${courier?'courier':'administrator'} activity does not slide its existing expiry`,async()=>{
 const f=await sessionFixture({courier});if(!courier)f.rows.gestores[0].rol='admin';
 const expiresAt=new Date(Date.now()+day).toISOString();f.rows.pth_secure_sessions[0].expires_at=expiresAt;
 const result=await f.request({action:'session'});
 assert.equal(result.error,null);assert.equal(result.data.expiresAt,expiresAt);assert.equal(f.state.writes,0);
});
for(const child of [false,true])test(`verified ${child?'child':'principal'} activity renews a valid legacy session, without daily repeated writes`,async()=>{
 const f=await sessionFixture({child});f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();
 const before=Date.now(),result=await f.request({action:'session'});
 assert.equal(result.error,null);assert.ok(Date.parse(result.data.expiresAt)>=before+30*day);
 assert.equal(f.rows.pth_secure_sessions[0].expires_at,result.data.expiresAt);
 assert.equal(f.state.writes,1);
 const query=await f.request({action:'query',table:'productos'});
 assert.equal(query.error,null);assert.equal(query.sessionExpiresAt,result.data.expiresAt);assert.equal(f.state.writes,1);
});
for(const scenario of ['expired','revoked','blocked','disabled','changed-password','disabled-parent'])test(`${scenario} cannot renew a session or write a price`,async()=>{
 const f=await sessionFixture({child:scenario==='disabled-parent'});f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();
 if(scenario==='expired')f.rows.pth_secure_sessions[0].expires_at='2000-01-01';
 if(scenario==='revoked')f.rows.pth_secure_sessions=[];
 if(scenario==='blocked')f.rows.gestores[0].estado='bloqueado';
 if(scenario==='disabled')f.rows.gestores[0].activo=false;
 if(scenario==='changed-password')f.rows.gestores[0].password='new-fixture-password';
 if(scenario==='disabled-parent')f.rows.gestores[1].activo=false;
 const result=await f.request({action:'query',table:'precios_personalizados',op:'update',values:{visible_subgestor:true}});
 assert.equal(result.status,401);assert.equal(result.error.code,'SESSION_INVALID');assert.equal(f.state.writes,0);
});
test('revocation between verification and renewal never resurrects the deleted session',async()=>{
 const f=await sessionFixture();f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();
 f.state.beforeSessionUpdate=()=>{f.rows.pth_secure_sessions=[];};
 const result=await f.request({action:'session'});
 assert.equal(result.status,401);assert.equal(f.rows.pth_secure_sessions.length,0);
});
test('concurrent renewal accepts the winner without overwriting it or losing authentication',async()=>{
 const f=await sessionFixture();f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();
 const results=await Promise.all([f.request({action:'session'}),f.request({action:'session'})]);
 for(const result of results){assert.equal(result.error,null);assert.equal(result.data.expiresAt,f.rows.pth_secure_sessions[0].expires_at);}
 assert.ok(Date.parse(f.rows.pth_secure_sessions[0].expires_at)>Date.now()+29*day);
});
test('a renewal service failure stops before a protected write and allows a later retry',async()=>{
 const f=await sessionFixture();f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();
 const expiry=f.rows.pth_secure_sessions[0].expires_at;
 f.state.beforeSessionUpdate=()=>{throw Error('Synthetic outage');};
 const failed=await f.request({action:'query',table:'precios_personalizados',op:'update',values:{visible_subgestor:true}});
 assert.equal(failed.status,503);assert.equal(failed.error.code,'SERVICE_UNAVAILABLE');assert.equal(f.rows.pth_secure_sessions[0].expires_at,expiry);
 assert.equal(f.state.trace.some(t=>t.table==='precios_personalizados'),false);
 f.state.beforeSessionUpdate=null;assert.equal((await f.request({action:'session'})).error,null);
});
test('unauthenticated price save requests login instead of the generic query error',async()=>{
 const f=await sessionFixture(),result=await f.request({action:'query',table:'precios_personalizados',op:'update',values:{visible_subgestor:true}},null);
 assert.equal(result.status,401);assert.equal(result.error.code,'SESSION_INVALID');assert.equal(f.state.writes,0);
});

function client(f){
 const items=new Map([['pth_secure_token',f.token],['pth_secure_token_expires_at',String(Date.now()+day)]]);
 const storage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k),key:i=>[...items.keys()][i],get length(){return items.size;}};
 const root={localStorage:storage,AbortSignal,fetch:f.fetch,location:{pathname:'/'}};root.window=root;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),root);
 return {api:root.PTHSecureData,storage,root};
}
test('browser adopts server renewal and a cold offline view accepts the thirty-day session',async()=>{
 const f=await sessionFixture(),c=client(f);f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();await c.api.restore();
 const old=new Date(Date.now()+day).toISOString();f.rows.pth_secure_sessions[0].expires_at=old;
 const db=c.api.install({from(){assert.fail('Direct fallback');},rpc(){assert.fail('Direct RPC fallback');}});
 assert.equal((await db.from('productos').select()).error,null);
 assert.equal(c.api.expiresAt(),Date.parse(f.rows.pth_secure_sessions[0].expires_at));
 assert.ok(c.api.expiresAt()>Date.now()+29*day);assert.equal(c.api.offlineProfile().id,'owner');
});
test('expiry preserves queued orders even without a prepared offline catalogue',async()=>{
 const f=await sessionFixture(),c=client(f);await c.api.restore();
 c.storage.setItem('pth_checkout_submission_token:owner:outcome','synthetic-confirmation');
 c.api.clearSession('expired');
 assert.equal(c.api.token(),null);assert.equal(c.api.preserveOfflineOrders('owner'),true);
 assert.equal(c.storage.getItem('pth_checkout_submission_token:owner:outcome'),'synthetic-confirmation');
});
test('expiry notice survives reload without persisting identity and clears after successful login',async()=>{
 const f=await sessionFixture(),c=client(f);await c.api.restore();c.api.clearSession('expired');
 const cold={localStorage:c.storage,AbortSignal,fetch:f.fetch,location:{pathname:'/'}};cold.window=cold;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),cold);
 assert.equal(cold.PTHSecureData.sessionExpired?.(),true);assert.equal(cold.PTHSecureData.accountId(),null);
 assert.equal(cold.PTHSecureData.token(),null);assert.equal(cold.PTHSecureData.offlineProfile(),null);
 assert.equal(c.storage.getItem('pth_secure_token_expired'),'1');
 await cold.PTHSecureData.login('Fixture','fixture-only');assert.equal(cold.PTHSecureData.sessionExpired(),false);
 cold.PTHSecureData.clearSession();assert.equal(cold.PTHSecureData.sessionExpired(),false);
});
test('late renewal response cannot restore credentials or expiry after logout',async()=>{
 const f=await sessionFixture(),c=client(f);await c.api.restore();
 let release;c.root.fetch=()=>new Promise(resolve=>{release=()=>resolve({status:200,json:async()=>({data:[],error:null,sessionExpiresAt:new Date(Date.now()+30*day).toISOString()})});});
 const db=c.api.install({from(){assert.fail('Direct fallback');},rpc(){assert.fail('Direct RPC fallback');}});
 const pending=Promise.resolve(db.from('productos').select());while(!release)await new Promise(resolve=>setImmediate(resolve));
 c.api.clearSession();release();await pending;
 assert.equal(c.api.token(),null);assert.equal(c.api.expiresAt(),null);
});
test('a delayed same-token refresh cannot shorten expiry already renewed by another query',async()=>{
 const f=await sessionFixture(),c=client(f);f.rows.pth_secure_sessions[0].expires_at=new Date(Date.now()+day).toISOString();await c.api.restore();
 const oldExpiry=new Date(Date.now()+29*day).toISOString(),newExpiry=new Date(Date.now()+30*day-1000).toISOString();let release;
 c.root.fetch=async(_url,options)=>JSON.parse(options.body).action==='session'?new Promise(resolve=>{release=()=>resolve({status:200,json:async()=>({data:{profile:f.rows.gestores[0],expiresAt:oldExpiry},error:null,sessionExpiresAt:oldExpiry})});}):{status:200,json:async()=>({data:[],error:null,sessionExpiresAt:newExpiry})};
 c.storage.setItem('pth_secure_token_expires_at',String(Date.parse(oldExpiry)));
 const refresh=c.api.refresh();while(!release)await new Promise(resolve=>setImmediate(resolve));
 const db=c.api.install({from(){assert.fail('Direct fallback');},rpc(){assert.fail('Direct RPC fallback');}});
 await db.from('productos').select();assert.equal(c.api.expiresAt(),Date.parse(newExpiry));
 release();await refresh;assert.equal(c.api.expiresAt(),Date.parse(newExpiry));
});
