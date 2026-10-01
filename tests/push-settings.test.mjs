import test from 'node:test';
import assert from 'node:assert/strict';
import {pushSettings,pushConfiguration,validatePushEndpoint} from '../supabase/functions/secure-data/push.mjs';
const actor={id:'admin',rol:'admin',estado:'activo'};
test('prepared backend stays disabled even if environment asks to enable it; no private values returned',async()=>{
 const env={PTH_PUSH_VAPID_PUBLIC_KEY:'a'.repeat(87),PTH_PUSH_VAPID_PRIVATE_KEY:'b'.repeat(43),PTH_PUSH_DISPATCH_SECRET:'c'.repeat(43),PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org',PTH_PUSH_ENABLED:'true'};
 assert.deepEqual(pushConfiguration(env),{configured:true,enabled:false});
 const db={from:()=>assert.fail('config/save when disabled must not query subscription tables')};
 const result=await pushSettings(db,{operation:'config'},actor,'hash',env);
 assert.deepEqual(result.data,{configured:true,enabled:false,allowedTopics:['orders'],publicKey:null});
 assert.doesNotMatch(JSON.stringify(result),/b{43}|c{43}/);
 await assert.rejects(pushSettings(db,{operation:'save'},actor,'hash',env),/no están habilitadas/);
});
test('endpoint validator refuses redirects/private targets, credentials, fragments and lookalike domains',()=>{
 for(const url of ['http://fcm.googleapis.com/push','https://127.0.0.1/push','https://fcm.googleapis.com.evil.test/push','https://user:pass@fcm.googleapis.com/push','https://web.push.apple.com/push#secret','https://fcm.googleapis.com:8443/push'])assert.throws(()=>validatePushEndpoint(url));
 for(const url of ['https://fcm.googleapis.com/push','https://updates.push.services.mozilla.com/push','https://web.push.apple.com/push'])assert.equal(validatePushEndpoint(url),url);
});
test('remove is bound to current account and session; other roles cannot reach push settings',async()=>{
 const filters=[];const query={delete(){return this;},eq(k,v){filters.push([k,v]);return this;},then(resolve){resolve({error:null});}};
 await pushSettings({from:()=>query},{operation:'remove',endpoint:'https://fcm.googleapis.com/synthetic'},actor,'current-session');
 assert.deepEqual(filters,[['endpoint','https://fcm.googleapis.com/synthetic'],['gestor_id','admin'],['session_hash','current-session']]);
 for(const profile of [null,{...actor,parent_id:'parent'},{...actor,estado:'inactivo'},{...actor,rol:'gestor'}])await assert.rejects(pushSettings({}, {operation:'config'},profile,'hash'),/no tiene notificaciones/);
});
