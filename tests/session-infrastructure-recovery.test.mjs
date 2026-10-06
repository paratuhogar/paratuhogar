import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sessionFixture} from './fixtures/session-infrastructure.mjs';

function client(f,existingStorage){
 const items=new Map(),storage=existingStorage||{getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),removeItem:k=>items.delete(k),key:i=>[...items.keys()][i],get length(){return items.size;}};
 if(!existingStorage){storage.setItem('pth_secure_token',f.token);storage.setItem('pth_secure_token_expires_at',String(Date.parse(f.expiresAt)));}
 const root={localStorage:storage,AbortSignal,fetch:f.fetch,location:{pathname:'/'}};root.window=root;
 vm.runInNewContext(fs.readFileSync(new URL('../js/secure-data.js',import.meta.url),'utf8'),root);
 return {api:root.PTHSecureData,storage};
}
for(const stage of ['session','profile','parent','courier'])for(const mode of ['returned','throw'])test(`${stage} ${mode} infrastructure failure returns 503 before protected work`,async()=>{
 const f=await sessionFixture({child:stage==='parent',courier:stage==='courier'});f.state.failure={stage,mode};
 for(const body of [{action:'session'},{action:'public_name',nombre_publico:'Saved once'},{action:'query',table:'pedidos',op:'insert',values:{cliente:'Fixture'}}]){
  const result=await f.request(body);assert.equal(result.status,503);assert.equal(result.error.code,'SERVICE_UNAVAILABLE');assert.equal(result.data,null);
 }
 assert.equal(f.state.writes,0);assert.equal(f.rows.pedidos.length,0);assert.equal(f.state.trace.some(entry=>entry.table==='pedidos'),false);
});
for(const stage of ['session','profile','parent'])test(`${stage} outage preserves browser session and recovers without login or repeated writes`,async()=>{
 const f=await sessionFixture({child:stage==='parent'}),c=client(f);await c.api.restore();
 const saved=c.storage.getItem('pth_session'),expiry=c.storage.getItem('pth_secure_token_expires_at');
 f.state.failure={stage,mode:'returned'};
 await assert.rejects(c.api.refresh(),e=>e.status===503&&e.code==='SERVICE_UNAVAILABLE');
 const failed=await c.api.publicName('Saved once');assert.equal(failed.error.status,503);assert.equal(f.state.writes,0);
 assert.equal(c.storage.getItem('pth_session'),saved);assert.equal(c.api.token(),f.token);assert.equal(c.storage.getItem('pth_secure_token_expires_at'),expiry);
 const reopened=client(f,c.storage);await assert.rejects(reopened.api.restore(),e=>e.status===503);
 f.state.failure=null;assert.equal((await reopened.api.restore()).id,'owner');
 assert.equal((await reopened.api.publicName('Saved once')).error,null);assert.equal(f.state.writes,1);assert.equal(f.rows.pedidos.length,0);
 assert.equal(f.state.requests.some(body=>body.action==='login'),false);assert.equal(f.rows.pth_secure_sessions[0].expires_at,f.expiresAt);
});
test('cold concurrent protected queries share failed restoration, send no writes, and retry after recovery',async()=>{
 const f=await sessionFixture(),c=client(f);f.state.failure={stage:'session',mode:'returned'};
 let release;f.state.delay=new Promise(resolve=>release=resolve);
 const db=c.api.install({from(){assert.fail('direct protected fallback');},rpc(){assert.fail('direct protected RPC fallback');}});
 const first=Promise.resolve(db.from('pedidos').insert({cliente:'Fixture'})),second=Promise.resolve(db.from('pedidos').insert({cliente:'Fixture'}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(f.state.requests.length,1);release();
 const results=await Promise.all([first,second]);results.forEach(result=>assert.equal(result.error.status,503));assert.equal(f.state.writes,0);assert.equal(f.state.requests.some(body=>body.action==='query'),false);
 f.state.failure=null;f.state.delay=null;assert.equal((await c.api.restore()).id,'owner');assert.equal(c.api.token(),f.token);
});
test('network failure keeps credentials, performs no protected work and recovers without login',async()=>{
 const f=await sessionFixture(),c=client(f);f.state.network=true;
 await assert.rejects(c.api.restore(),e=>e.code==='NETWORK_ERROR');assert.equal(c.api.token(),f.token);assert.equal(f.state.writes,0);
 f.state.network=false;assert.equal((await c.api.restore()).id,'owner');assert.equal(f.state.requests.some(body=>body.action==='login'),false);
});
test('a blocked order can be submitted once after recovery and its unchanged retry key rejects duplicates',async()=>{
 const f=await sessionFixture(),c=client(f),db=c.api.install({from(){assert.fail('direct protected fallback');},rpc(){assert.fail('direct protected fallback');}});
 const order={gestor:'Fixture',cliente:'Fixture customer',proveedor:'Fixture provider',_lineas:[{producto_id:'product',cantidad:1}],submission_token:'fixture-submission'};
 f.state.failure={stage:'profile',mode:'returned'};
 const failed=await db.from('pedidos').insert(order).select();assert.equal(failed.error.status,503);assert.equal(f.state.writes,0);assert.equal(f.rows.pedidos.length,0);
 f.state.failure=null;
 const saved=await db.from('pedidos').insert(order).select();assert.equal(saved.error,null);assert.equal(f.state.writes,1);assert.equal(f.rows.pedidos.length,1);assert.equal(f.rows.pedidos[0].submission_token,order.submission_token);
 const repeated=await db.from('pedidos').insert(order).select();assert.equal(repeated.error.code,'23505');assert.equal(f.state.writes,1);assert.equal(f.rows.pedidos.length,1);
 assert.equal(f.state.requests.some(body=>body.action==='login'),false);assert.equal(c.api.token(),f.token);
});
for(const scenario of ['revoked','expired','missing-profile','inactive','disabled','changed-credential','missing-parent','inactive-parent','nested-parent'])test(`${scenario} remains a genuine 401 and clears browser credentials`,async()=>{
 const f=await sessionFixture({child:scenario.includes('parent')}),c=client(f);
 if(scenario==='revoked')f.rows.pth_secure_sessions=[];
 if(scenario==='expired')f.rows.pth_secure_sessions[0].expires_at='2000-01-01';
 if(scenario==='missing-profile')f.rows.gestores=f.rows.gestores.filter(row=>row.id!=='owner');
 if(scenario==='inactive')f.rows.gestores[0].estado='inactivo';
 if(scenario==='disabled')f.rows.gestores[0].activo=false;
 if(scenario==='changed-credential')f.rows.gestores[0].password='fixture-changed';
 if(scenario==='missing-parent')f.rows.gestores.pop();
 if(scenario==='inactive-parent')f.rows.gestores[1].estado='inactivo';
 if(scenario==='nested-parent')f.rows.gestores[1].parent_id='another';
 await assert.rejects(c.api.restore(),e=>e.status===401&&e.code==='SESSION_INVALID');assert.equal(c.api.token(),null);assert.equal(f.state.writes,0);
});
for(const scenario of ['missing','disabled','changed-pin'])test(`courier ${scenario} remains a genuine 401`,async()=>{
 const f=await sessionFixture({courier:true});if(scenario==='missing')f.rows.mensajeros=[];if(scenario==='disabled')f.rows.mensajeros[0].activo=false;if(scenario==='changed-pin')f.rows.mensajeros[0].pin='fixture-changed';
 const result=await f.request({action:'session'});assert.equal(result.status,401);assert.equal(result.error.code,'SESSION_INVALID');assert.equal(f.state.writes,0);
});
test('genuine 403 blocks a forbidden action without discarding a valid session',async()=>{
 const f=await sessionFixture(),c=client(f);await c.api.restore();
 const db=c.api.install({from(){assert.fail('direct protected fallback');},rpc(){assert.fail('direct protected RPC fallback');}});
 const result=await db.from('gestores').update({rol:'admin'});assert.equal(result.error.status,403);assert.equal(result.error.code,'ACCESS_DENIED');assert.equal(c.api.token(),f.token);assert.equal(f.state.writes,0);
});
