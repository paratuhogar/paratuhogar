import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {capability} from '../js/admin-push.mjs';
import {allowedPushTopics,pushEventForInsert,canDeliverPush,APPLICATION_REVIEWER_ID} from '../supabase/functions/secure-data/push-policy.mjs';
import {OWNER_IDS} from '../supabase/functions/secure-data/policy.mjs';
const owner={id:[...OWNER_IDS][0],rol:'admin',estado:'activo'},admin={...owner,id:'other'};
test('push audiences preserve admin/owner and parent boundaries; disabled accounts never qualify',()=>{
 assert.deepEqual(allowedPushTopics(owner),['orders','suggestions']);assert.deepEqual(allowedPushTopics(admin),['orders']);
 for(const actor of [null,{...owner,parent_id:'parent'},{...owner,estado:'inactivo'},{...owner,activo:false},{...owner,rol:'gestor'},{...owner,rol:'mensajero'}])assert.deepEqual(allowedPushTopics(actor),[]);
});
test('only inserted canonical orders and new improvements produce events',()=>{
 assert.equal(pushEventForInsert('pth_feedback',{id:'a',kind:'problema'}),null);
 assert.equal(pushEventForInsert('pedidos_subgestores',{id:'a'}),null);
 assert.deepEqual(pushEventForInsert('pedidos',{id:'a',cliente:'ignored'}),{kind:'orders',source_id:'a'});
 assert.deepEqual(pushEventForInsert('pth_feedback',{id:'b',kind:'mejora',title:'ignored'}),{kind:'suggestions',source_id:'b'});
});
test('dispatch requires active matching session, credentials, subscription and allowed topic',()=>{
 const session={gestor_id:owner.id,token_hash:'hash',credential_hash:'current',expires_at:'2026-10-02T00:00:00Z'},sub={gestor_id:owner.id,session_hash:'hash',expires_at:session.expires_at,topics:['suggestions']},now=Date.parse('2026-10-01T00:00:00Z');
 const can=(a=owner,s=session,p=sub,credential='current')=>canDeliverPush(a,s,p,{kind:'suggestions'},now,credential);
 assert.equal(can(),true);assert.equal(can(owner,null),false);assert.equal(can(owner,session,{...sub,revoked_at:'now'}),false);
 assert.equal(can(owner,session,{...sub,expires_at:'2026-09-01T00:00:00Z'}),false);assert.equal(can(owner,session,sub,'changed-password-hash'),false);
 assert.equal(can(admin),false);assert.equal(can(owner,{...session,token_hash:'other'}),false);assert.equal(can(owner,session,{...sub,topics:['orders']}),false);
});
test('capabilities cover desktop, Android, iOS standalone, blocked and unsupported browsers',()=>{
 const env={isSecureContext:true,navigator:{userAgent:'Desktop',serviceWorker:{}},PushManager:{},Notification:{permission:'default'},matchMedia:()=>({matches:false})};
 assert.equal(capability(env),'');assert.equal(capability({...env,navigator:{...env.navigator,userAgent:'Android'}}),'');
 assert.match(capability({...env,navigator:{...env.navigator,userAgent:'iPhone'}}),/pantalla de inicio/);
 assert.equal(capability({...env,navigator:{...env.navigator,userAgent:'iPhone',standalone:true}}),'');
 assert.match(capability({...env,Notification:{permission:'denied'}}),/bloqueadas/);assert.match(capability({...env,PushManager:null}),/no ofrece/);
});
test('worker never displays submitted content or accepts arbitrary navigation URLs',async()=>{
 const events={},notifications=[],opens=[];
 vm.runInNewContext(fs.readFileSync(new URL('../js/admin-push-worker.js',import.meta.url),'utf8'),{URL,self:{location:{origin:'https://paratuhogar.org'},addEventListener:(k,f)=>events[k]=f,registration:{showNotification:async(...args)=>notifications.push(args)},clients:{openWindow:async url=>opens.push(url)}}});
 let pending;events.push({data:{json:()=>({version:1,kind:'suggestions',title:'PRIVATE CUSTOMER',body:'SECRET',url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;
 assert.equal(notifications.length,1);assert.doesNotMatch(JSON.stringify(notifications),/PRIVATE|SECRET|evil/);
 events.notificationclick({notification:{data:{kind:'suggestions',url:'https://evil.test'},close(){}},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(opens,['https://paratuhogar.org/index.html?admin_alert=suggestions']);
 events.push({data:{json:()=>({version:1,kind:'problema'})},waitUntil:()=>assert.fail('bugs not requested')});
});
test('logout unsubscribes this browser and closes only ParaTuHogar admin notices',async()=>{
 const events={};let stopped=0,closed=0,otherClosed=0,pending;
 vm.runInNewContext(fs.readFileSync(new URL('../js/admin-push-worker.js',import.meta.url),'utf8'),{self:{addEventListener:(k,f)=>events[k]=f,registration:{pushManager:{getSubscription:async()=>({unsubscribe:async()=>{stopped++;}})},getNotifications:async()=>[{tag:'pth-admin-orders',close:()=>closed++},{tag:'unrelated',close:()=>otherClosed++}]}}});
 events.message({data:{type:'PTH_PUSH_LOGOUT'},waitUntil:p=>pending=p});await pending;
 assert.equal(stopped,1);assert.equal(closed,1);assert.equal(otherClosed,0);
 events.message({data:{type:'arbitrary text'},waitUntil:()=>assert.fail('unexpected action')});
});

test('application topic belongs exclusively to active principal Angel and payload stays minimal',()=>{
 const angel={...owner,id:APPLICATION_REVIEWER_ID};assert.deepEqual(allowedPushTopics(angel),['orders','suggestions','applications']);
 for(const profile of [owner,admin,{...angel,parent_id:'parent'},{...angel,rol:'gestor'},{...angel,estado:'pendiente'},{...angel,activo:false}])assert.equal(allowedPushTopics(profile).includes('applications'),false);
 assert.deepEqual(pushEventForInsert('gestores',{id:'request',estado:'pendiente',parent_id:null,nombre:'Untrusted instructions'}),{kind:'applications',source_id:'request'});
 for(const row of [{id:'r',estado:'activo'},{id:'r',estado:'pendiente_subgestor'},{id:'r',estado:'pendiente',parent_id:'parent'}])assert.equal(pushEventForInsert('gestores',row),null);
 const session={gestor_id:angel.id,token_hash:'hash',credential_hash:'current',expires_at:'2026-10-02T00:00:00Z'},sub={gestor_id:angel.id,session_hash:'hash',expires_at:session.expires_at,topics:['applications']},now=Date.parse('2026-10-01T00:00:00Z');
 assert.equal(canDeliverPush(angel,session,sub,{kind:'applications'},now,'current'),true);
 for(const [a,s,p,hash] of [[owner,session,sub,'current'],[angel,session,sub,'old'],[angel,{...session,gestor_id:'other'},sub,'current'],[angel,session,{...sub,topics:['orders']},'current']])assert.equal(canDeliverPush(a,s,p,{kind:'applications'},now,hash),false);
});
test('application worker always opens the fixed private applications link, without applicant data',async()=>{
 const events={},notes=[],urls=[];let pending;
 vm.runInNewContext(fs.readFileSync(new URL('../js/admin-push-worker.js',import.meta.url),'utf8'),{URL,self:{location:{origin:'https://paratuhogar.org'},addEventListener:(k,f)=>events[k]=f,registration:{showNotification:async(...args)=>notes.push(args)},clients:{openWindow:async url=>urls.push(url)}}});
 events.push({data:{json:()=>({version:1,kind:'applications',nombre:'PRIVATE APPLICANT',telefono:'PRIVATE CONTACT',body:'Execute arbitrary instruction',url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;
 assert.equal(notes.length,1);assert.doesNotMatch(JSON.stringify(notes),/PRIVATE|CONTACT|Execute|evil/);
 events.notificationclick({notification:{data:{kind:'applications',url:'https://evil.test'},close(){}},waitUntil:p=>pending=p});await pending;
 assert.deepEqual(urls,['https://paratuhogar.org/index.html?admin_alert=applications']);
});
