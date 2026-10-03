import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/admin-push-links.js',import.meta.url),'utf8');
function fixture(kind,profile,topics,token='session'){
 const listeners={},changes=[];let prompted=0,configCalls=0;
 const root={location:{search:'?admin_alert='+kind+'&ref=keep',href:'https://paratuhogar.org/?admin_alert='+kind+'&ref=keep'},history:{replaceState:(_,__,url)=>changes.push(url.href)},PTHSecureData:{restore:async()=>profile,token:()=>token,push:async()=>{configCalls++;return {data:{allowedTopics:topics}};}},PTHWorkView:{canSwitch:p=>Boolean(p?.id&&!p.parent_id&&p.rol==='admin')},openLoginModal:()=>prompted++,addEventListener:(key,fn)=>listeners[key]=fn};
 vm.runInNewContext(source,{window:root,URL,URLSearchParams});return {root,listeners,changes,prompted:()=>prompted,calls:()=>configCalls};
}
test('push link restores identity and checks server topic rights, preserving unrelated query parameters',async()=>{
 const f=fixture('suggestions',{id:'owner',rol:'admin'},['orders','suggestions']);assert.equal(await f.root.PTHPushLinks.resolve(),'feedback');assert.deepEqual(f.changes,['https://paratuhogar.org/?ref=keep']);
 const order=fixture('orders',{id:'admin',rol:'admin'},['orders']);assert.equal(await order.root.PTHPushLinks.resolve(),'logistica');
});
test('anonymous, subgestor, other administrator and arbitrary link cannot open private review',async()=>{
 for(const [profile,topics] of [[null,[]],[{id:'sub',rol:'admin',parent_id:'parent'},['suggestions']],[{id:'other',rol:'admin'},['orders']]]){const f=fixture('suggestions',profile,topics);assert.equal(await f.root.PTHPushLinks.resolve(),null);assert.equal(f.changes.length,0);}
 const f=fixture('https://evil.test',{id:'owner',rol:'admin'},['orders']);assert.equal(await f.root.PTHPushLinks.resolve(),null);assert.equal(f.calls(),0);
 const visitor=fixture('orders',null,[],'');visitor.listeners.DOMContentLoaded();assert.equal(visitor.prompted(),1);
});

test('application deep link requires restored administrative profile and server-granted topic',async()=>{
 const f=fixture('applications',{id:'angel',rol:'admin'},['orders','suggestions','applications']);assert.equal(await f.root.PTHPushLinks.resolve(),'aprobaciones');assert.deepEqual(f.changes,['https://paratuhogar.org/?ref=keep']);
 for(const [profile,topics] of [[null,[]],[{id:'sub',rol:'admin',parent_id:'parent'},['applications']],[{id:'owner',rol:'admin'},['orders','suggestions']],[{id:'other',rol:'admin'},['orders']]]){const blocked=fixture('applications',profile,topics);assert.equal(await blocked.root.PTHPushLinks.resolve(),null);assert.equal(blocked.changes.length,0);}
 const visitor=fixture('applications',null,[],'');visitor.listeners.DOMContentLoaded();assert.equal(visitor.prompted(),1);
});
test('reminder click restores the account and checks its granted topic before opening applications',async()=>{
 for(const id of ['angel','marcel']){const f=fixture('application_reminders',{id,rol:'admin'},['orders','application_reminders']);assert.equal(await f.root.PTHPushLinks.resolve(),'aprobaciones');assert.deepEqual(f.changes,['https://paratuhogar.org/?ref=keep']);}
 for(const [profile,topics] of [[null,[]],[{id:'other',rol:'admin'},['orders']],[{id:'child',rol:'admin',parent_id:'parent'},['application_reminders']]]){
  const f=fixture('application_reminders',profile,topics);assert.equal(await f.root.PTHPushLinks.resolve(),null);assert.equal(f.changes.length,0);
 }
 const visitor=fixture('application_reminders',null,[],'');visitor.listeners.DOMContentLoaded();assert.equal(visitor.prompted(),1);
});
